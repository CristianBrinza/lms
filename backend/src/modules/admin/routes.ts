import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { audit } from '../../lib/audit';
import { readablePassword } from '../../lib/crypto';
import { AppError } from '../../lib/errors';
import { enforceRateLimits } from '../../lib/rate-limit';
import { maskIp } from '../../lib/text';
import {
  emailField,
  nameField,
  newPasswordField,
  readJson,
  surnameField,
} from '../../lib/validation';
import { requireAuth, requireRole } from '../../middleware/auth';
import { revokeAllSessions } from '../auth/sessions';
import { AvatarBody, ProfileFields, saveProfileFields, setAvatar } from '../profile';
import { saveTypedWeight } from '../training/health';
import {
  countActiveAdmins,
  findUserById,
  insertUser,
  toPublicUser,
  USER_COLUMNS,
  toUser,
  type PublicUser,
  type User,
} from '../users';

const RoleField = z.enum(['member', 'admin'], { error: 'Choose member or admin' });

const CreateBody = z.object({
  email: emailField,
  name: nameField('Name'),
  surname: surnameField.default(''),
  role: RoleField.default('member'),
  /** Empty: a one-time password is generated and shown to the admin once. */
  password: newPasswordField.optional(),
  /** Ask the person to choose their own password at first sign-in. */
  mustChangePassword: z.boolean().default(true),
});

const UpdateBody = z
  .object({
    email: emailField,
    name: nameField('Name'),
    surname: surnameField,
    role: RoleField,
    isActive: z.boolean(),
  })
  .extend(ProfileFields.shape)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

const KitchenBody = z.object({
  /** Seat them in this kitchen; null gives them a kitchen of their own. */
  householdId: z.uuid('Not a valid kitchen').nullable(),
});

const HouseholdBody = z.object({
  name: z.string().trim().min(1, 'Name the household').max(60, 'Keep it under 60 characters'),
});

const ResetBody = z.object({
  password: newPasswordField.optional(),
  mustChangePassword: z.boolean().default(true),
});

export interface AdminUser extends PublicUser {
  isActive: boolean;
  /** The kitchen whose food they share (null until their first visit to Food). */
  kitchen: { id: string; name: string; members: number } | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
  updatedAt: string;
}

type AdminRow = Parameters<typeof toUser>[0] & {
  active_sessions: number;
  last_seen_at: Date | null;
  household_name: string | null;
  household_members: number;
  weight_kg: string | null;
  weight_day: string | null;
};

function toAdminUser(row: AdminRow): AdminUser {
  const user = toUser(row);
  const weight =
    row.weight_kg === null || row.weight_day === null
      ? null
      : { kg: Number(row.weight_kg), day: row.weight_day };
  return {
    ...toPublicUser(user, weight),
    isActive: user.isActive,
    kitchen: user.householdId
      ? {
          id: user.householdId,
          name: row.household_name ?? 'Kitchen',
          members: row.household_members,
        }
      : null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    lastSeenAt: row.last_seen_at?.toISOString() ?? null,
    activeSessions: row.active_sessions,
    updatedAt: user.updatedAt.toISOString(),
  };
}

const ADMIN_SELECT = `
  SELECT ${USER_COLUMNS.split(', ')
    .map((column) => `u.${column}`)
    .join(', ')},
    (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > $1) AS active_sessions,
    (SELECT max(s.last_used_at) FROM sessions s WHERE s.user_id = u.id) AS last_seen_at,
    h.name AS household_name,
    (SELECT count(*)::int FROM users x WHERE x.household_id = u.household_id) AS household_members,
    w.value AS weight_kg, w.day::text AS weight_day
  FROM users u LEFT JOIN households h ON h.id = u.household_id
  -- The latest weight, read as latestWeight reads it (the phone's over a typed one on one day).
  LEFT JOIN LATERAL (
    SELECT hd.value, hd.day FROM health_days hd
     WHERE hd.user_id = u.id AND hd.kind = 'weight'
     ORDER BY hd.day DESC, hd.source LIMIT 1
  ) w ON true`;

const isUniqueViolation = (error: unknown) => (error as { code?: string }).code === '23505';
const EMAIL_TAKEN = () =>
  new AppError(409, 'EMAIL_TAKEN', 'Someone already uses this email', {
    fields: { email: 'Someone already uses this email' },
  });
const LAST_ADMIN = () =>
  new AppError(409, 'LAST_ADMIN', 'Keep at least one active admin, or nobody can manage accounts');

/** Accounts are created and managed here only: the app has no public sign-up. */
export function adminRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireRole('admin'));
  app.use('*', async (c, next) => {
    if (c.req.method !== 'GET') {
      await enforceRateLimits(deps, [
        { key: `admin:${c.get('user').id}`, limit: 120, windowSec: 15 * 60 },
      ]);
    }
    await next();
  });

  const loadTarget = async (id: string): Promise<User> => {
    const user = await findUserById(deps.db, id);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'This person was not found');
    return user;
  };

  const adminUser = async (id: string): Promise<AdminUser> => {
    const { rows } = await deps.db.query<AdminRow>(`${ADMIN_SELECT} WHERE u.id = $2`, [
      deps.now(),
      id,
    ]);
    return toAdminUser(rows[0]!);
  };

  app.get('/users', async (c) => {
    const q = (c.req.query('q') ?? '').trim().slice(0, 100);
    const pattern = `%${q.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const { rows } = await deps.db.query<AdminRow>(
      `${ADMIN_SELECT}
       WHERE $2 = '' OR lower(u.name || ' ' || u.surname || ' ' || u.email) LIKE $3
       ORDER BY u.is_active DESC, u.created_at ASC
       LIMIT 500`,
      [deps.now(), q, pattern],
    );
    return c.json({ users: rows.map(toAdminUser) });
  });

  app.get('/users/:id', async (c) => {
    const user = await loadTarget(c.req.param('id'));
    return c.json({ user: await adminUser(user.id) });
  });

  app.post('/users', async (c) => {
    const body = await readJson(c, CreateBody);
    const actor = c.get('user');
    const generated = body.password ? null : readablePassword();
    let created: User;
    try {
      created = await insertUser(deps.db, {
        email: body.email,
        name: body.name,
        surname: body.surname,
        role: body.role,
        passwordHash: await deps.passwords.hash(body.password ?? generated!),
        mustChangePassword: generated ? true : body.mustChangePassword,
        createdBy: actor.id,
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw EMAIL_TAKEN();
      throw error;
    }
    await audit(deps, {
      actorId: actor.id,
      action: 'user.created',
      targetId: created.id,
      ip: maskIp(c.get('ip')),
      meta: { role: created.role },
    });
    return c.json({ user: await adminUser(created.id), password: generated }, 201);
  });

  app.patch('/users/:id', async (c) => {
    const body = await readJson(c, UpdateBody);
    const actor = c.get('user');
    const target = await loadTarget(c.req.param('id'));
    const self = target.id === actor.id;

    if (body.isActive === false && self)
      throw new AppError(400, 'SELF', 'You cannot switch off your own account');
    const losesAdmin =
      target.role === 'admin' &&
      target.isActive &&
      (body.role === 'member' || body.isActive === false);
    const now = deps.now();

    try {
      await deps.db.tx(async (tx) => {
        // Serialise admin changes so two admins demoting each other cannot leave none.
        if (losesAdmin) {
          await tx.query('SELECT pg_advisory_xact_lock(727275)');
          if ((await countActiveAdmins(tx)) <= 1) throw LAST_ADMIN();
        }
        await tx.query(
          `UPDATE users SET
             email = COALESCE($2, email), name = COALESCE($3, name), surname = COALESCE($4, surname),
             role = COALESCE($5, role), is_active = COALESCE($6, is_active), updated_at = $7
           WHERE id = $1`,
          [
            target.id,
            body.email ?? null,
            body.name ?? null,
            body.surname ?? null,
            body.role ?? null,
            body.isActive ?? null,
            now,
          ],
        );
        await saveProfileFields(tx, target.id, body, now);
        // Switched off: signed out of every device at once.
        if (body.isActive === false && target.isActive) await revokeAllSessions(tx, target.id, now);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw EMAIL_TAKEN();
      throw error;
    }
    // Their weight goes to Health as today's typed-in reading, after the rest is saved.
    if (typeof body.weightKg === 'number') await saveTypedWeight(deps, target, body.weightKg);

    const ip = maskIp(c.get('ip'));
    if (body.role && body.role !== target.role) {
      await audit(deps, {
        actorId: actor.id,
        action: 'user.role_changed',
        targetId: target.id,
        ip,
        meta: { from: target.role, to: body.role },
      });
    }
    if (body.isActive !== undefined && body.isActive !== target.isActive) {
      await audit(deps, {
        actorId: actor.id,
        action: body.isActive ? 'user.reactivated' : 'user.deactivated',
        targetId: target.id,
        ip,
      });
    }
    const changed = (['email', 'name', 'surname'] as const).filter(
      (key) => body[key] !== undefined && body[key] !== target[key],
    );
    if (changed.length > 0)
      await audit(deps, {
        actorId: actor.id,
        action: 'user.updated',
        targetId: target.id,
        ip,
        meta: { fields: changed },
      });

    return c.json({ user: await adminUser(target.id) });
  });

  /** Someone's picture, set or removed by the admin. */
  app.put('/users/:id/avatar', async (c) => {
    const body = await readJson(c, AvatarBody);
    const target = await loadTarget(c.req.param('id'));
    await setAvatar(deps.db, target.id, body.image, deps.now());
    return c.json({ user: await adminUser(target.id) });
  });
  app.delete('/users/:id/avatar', async (c) => {
    const target = await loadTarget(c.req.param('id'));
    await setAvatar(deps.db, target.id, null, deps.now());
    return c.json({ user: await adminUser(target.id) });
  });

  /** Kitchens and who shares each one: family members who share a fridge share one kitchen. */
  app.get('/households', async (c) => {
    const { rows } = await deps.db.query<{
      id: string;
      name: string;
      members: Array<{ id: string; name: string; surname: string }>;
    }>(
      `SELECT h.id, h.name, coalesce(json_agg(json_build_object('id', u.id, 'name', u.name, 'surname', u.surname) ORDER BY u.created_at)
                                     FILTER (WHERE u.id IS NOT NULL), '[]') AS members
         FROM households h LEFT JOIN users u ON u.household_id = h.id
        GROUP BY h.id ORDER BY h.created_at`,
    );
    return c.json({ households: rows });
  });

  /** A new household (family): its own kitchen, buy list and shared views, empty until people join. */
  app.post('/households', async (c) => {
    const { name } = await readJson(c, HouseholdBody);
    const id = randomUUID();
    await deps.db.query('INSERT INTO households (id, name) VALUES ($1, $2)', [id, name]);
    await audit(deps, {
      actorId: c.get('user').id,
      action: 'household.created',
      targetId: null,
      ip: maskIp(c.get('ip')),
      meta: { householdId: id, name },
    });
    return c.json({ household: { id, name, members: [] } }, 201);
  });

  app.patch('/households/:id', async (c) => {
    const { name } = await readJson(c, HouseholdBody);
    const id = c.req.param('id');
    const { rowCount } = await deps.db.query(
      'UPDATE households SET name = $2 WHERE id = $1::uuid',
      [z.uuid().safeParse(id).success ? id : '00000000-0000-0000-0000-000000000000', name],
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'That kitchen was not found');
    return c.json({ household: { id, name } });
  });

  /**
   * An empty household goes, with everything kept in it (its kitchen, lists, trips). One with
   * people in it is refused: move them first.
   */
  app.delete('/households/:id', async (c) => {
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success)
      throw new AppError(404, 'NOT_FOUND', 'That kitchen was not found');
    const { rows } = await deps.db.query<{ name: string; members: number }>(
      `SELECT h.name, (SELECT count(*)::int FROM users u WHERE u.household_id = h.id) AS members
         FROM households h WHERE h.id = $1`,
      [id],
    );
    const household = rows[0];
    if (!household) throw new AppError(404, 'NOT_FOUND', 'That kitchen was not found');
    if (household.members > 0)
      throw new AppError(409, 'HOUSEHOLD_NOT_EMPTY', 'Move the people in it to another household first');
    await deps.db.query('DELETE FROM households WHERE id = $1', [id]);
    await audit(deps, {
      actorId: c.get('user').id,
      action: 'household.deleted',
      targetId: null,
      ip: maskIp(c.get('ip')),
      meta: { householdId: id, name: household.name },
    });
    return c.body(null, 204);
  });

  app.put('/users/:id/kitchen', async (c) => {
    const body = await readJson(c, KitchenBody);
    const target = await loadTarget(c.req.param('id'));
    let householdId = body.householdId;
    if (householdId) {
      const { rowCount } = await deps.db.query('SELECT 1 FROM households WHERE id = $1', [
        householdId,
      ]);
      if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'That kitchen was not found');
    } else {
      householdId = randomUUID();
      await deps.db.query('INSERT INTO households (id, name) VALUES ($1, $2)', [
        householdId,
        `${target.name}’s kitchen`,
      ]);
    }
    await deps.db.query('UPDATE users SET household_id = $2, updated_at = $3 WHERE id = $1', [
      target.id,
      householdId,
      deps.now(),
    ]);
    await audit(deps, {
      actorId: c.get('user').id,
      action: 'user.kitchen_changed',
      targetId: target.id,
      ip: maskIp(c.get('ip')),
      meta: { householdId },
    });
    return c.json({ user: await adminUser(target.id) });
  });

  app.post('/users/:id/password', async (c) => {
    const body = await readJson(c, ResetBody);
    const actor = c.get('user');
    const target = await loadTarget(c.req.param('id'));
    if (target.id === actor.id)
      throw new AppError(400, 'SELF', 'Change your own password from your profile');
    const generated = body.password ? null : readablePassword();
    const now = deps.now();
    const hash = await deps.passwords.hash(body.password ?? generated!);
    await deps.db.tx(async (tx) => {
      await tx.query(
        'UPDATE users SET password_hash = $2, must_change_password = $3, updated_at = $4 WHERE id = $1',
        [target.id, hash, generated ? true : body.mustChangePassword, now],
      );
      await revokeAllSessions(tx, target.id, now);
    });
    await audit(deps, {
      actorId: actor.id,
      action: 'user.password_reset',
      targetId: target.id,
      ip: maskIp(c.get('ip')),
    });
    return c.json({ user: await adminUser(target.id), password: generated });
  });

  app.post('/users/:id/sign-out', async (c) => {
    const actor = c.get('user');
    const target = await loadTarget(c.req.param('id'));
    if (target.id === actor.id)
      throw new AppError(400, 'SELF', 'Manage your own devices from Settings');
    await revokeAllSessions(deps.db, target.id, deps.now());
    await audit(deps, {
      actorId: actor.id,
      action: 'user.signed_out',
      targetId: target.id,
      ip: maskIp(c.get('ip')),
    });
    return c.json({ user: await adminUser(target.id) });
  });

  app.delete('/users/:id', async (c) => {
    const actor = c.get('user');
    const target = await loadTarget(c.req.param('id'));
    if (target.id === actor.id)
      throw new AppError(400, 'SELF', 'You cannot delete your own account');
    await deps.db.tx(async (tx) => {
      if (target.role === 'admin' && target.isActive) {
        await tx.query('SELECT pg_advisory_xact_lock(727275)');
        if ((await countActiveAdmins(tx)) <= 1) throw LAST_ADMIN();
      }
      await tx.query('DELETE FROM users WHERE id = $1', [target.id]);
    });
    await audit(deps, {
      actorId: actor.id,
      action: 'user.deleted',
      ip: maskIp(c.get('ip')),
      meta: { email: target.email, name: `${target.name} ${target.surname}`.trim() },
    });
    return c.body(null, 204);
  });

  app.get('/activity', async (c) => {
    const { rows } = await deps.db.query<{
      id: number;
      action: string;
      meta: Record<string, unknown>;
      created_at: Date;
      actor_id: string | null;
      actor_name: string | null;
      target_id: string | null;
      target_name: string | null;
    }>(
      `SELECT a.id, a.action, a.meta, a.created_at, a.actor_id, a.target_id,
         nullif(trim(actor.name || ' ' || actor.surname), '') AS actor_name,
         nullif(trim(target.name || ' ' || target.surname), '') AS target_name
       FROM audit_log a
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN users target ON target.id = a.target_id
       ORDER BY a.created_at DESC, a.id DESC
       LIMIT 40`,
    );
    return c.json({
      activity: rows.map((row) => ({
        id: String(row.id),
        action: row.action,
        meta: row.meta,
        createdAt: row.created_at.toISOString(),
        actor: row.actor_id ? { id: row.actor_id, name: row.actor_name ?? '' } : null,
        target: row.target_id ? { id: row.target_id, name: row.target_name ?? '' } : null,
      })),
    });
  });

  return app;
}
