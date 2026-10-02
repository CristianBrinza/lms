import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { enforceRateLimits } from '../../lib/rate-limit';
import { maskIp } from '../../lib/text';
import { nameField, newPasswordField, readJson, surnameField } from '../../lib/validation';
import { requireAuth, sessionOf } from '../../middleware/auth';
import { setAccessCookie } from '../auth/cookies';
import { issueAccessToken, listActiveSessions, revokeAllSessions } from '../auth/sessions';
import { findUserById, isUuid, toPublicUser } from '../users';

const ProfileBody = z.object({ name: nameField('Name'), surname: surnameField });

const PasswordBody = z.object({
  /** Not asked right after the admin set a temporary password: the person just signed in with it. */
  currentPassword: z.string().max(200).optional(),
  newPassword: newPasswordField,
});

/** The signed-in person: profile, password, and the devices they are signed in on. */
export function meRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps));

  app.get('/', (c) => c.json({ user: toPublicUser(c.get('user')) }));

  app.patch('/', async (c) => {
    const body = await readJson(c, ProfileBody);
    const user = c.get('user');
    await deps.db.query('UPDATE users SET name = $2, surname = $3, updated_at = $4 WHERE id = $1', [user.id, body.name, body.surname, deps.now()]);
    const updated = await findUserById(deps.db, user.id);
    return c.json({ user: toPublicUser(updated!) });
  });

  app.post('/password', async (c) => {
    const body = await readJson(c, PasswordBody);
    const user = c.get('user');
    const ip = c.get('ip');
    await enforceRateLimits(deps, [{ key: `password:${user.id}`, limit: 10, windowSec: 15 * 60 }]);

    if (!user.mustChangePassword) {
      if (!body.currentPassword) throw new AppError(400, 'VALIDATION', 'Enter your current password', { fields: { currentPassword: 'Enter your current password' } });
      const check = await deps.passwords.verify(body.currentPassword, user.passwordHash);
      if (!check.ok) throw new AppError(400, 'VALIDATION', 'Your current password is not right', { fields: { currentPassword: 'This is not your current password' } });
    }
    if ((await deps.passwords.verify(body.newPassword, user.passwordHash)).ok) {
      throw new AppError(400, 'VALIDATION', 'Choose a password you have not used here', { fields: { newPassword: 'This is the password you have now' } });
    }

    const now = deps.now();
    const sessionId = sessionOf(c);
    const hash = await deps.passwords.hash(body.newPassword);
    await deps.db.tx(async (tx) => {
      await tx.query('UPDATE users SET password_hash = $2, must_change_password = false, updated_at = $3 WHERE id = $1', [user.id, hash, now]);
      // Every other device signs in again; this one stays, with a token for the new version.
      await revokeAllSessions(tx, user.id, now, sessionId);
    });
    const updated = (await findUserById(deps.db, user.id))!;
    setAccessCookie(c, deps.config, await issueAccessToken(deps, updated, sessionId));
    await audit(deps, { actorId: user.id, action: 'user.password_changed', targetId: user.id, ip: maskIp(ip) });
    return c.json({ user: toPublicUser(updated) });
  });

  app.get('/sessions', async (c) => {
    return c.json({ sessions: await listActiveSessions(deps, c.get('user').id, sessionOf(c)) });
  });

  app.delete('/sessions/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Device not found');
    if (id === sessionOf(c)) throw new AppError(400, 'CURRENT_SESSION', 'Use “Sign out” to end this device’s session');
    const { rowCount } = await deps.db.query('UPDATE sessions SET revoked_at = $3 WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL', [
      id,
      c.get('user').id,
      deps.now(),
    ]);
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Device not found');
    return c.body(null, 204);
  });

  app.post('/sessions/sign-out-others', async (c) => {
    const user = c.get('user');
    const sessionId = sessionOf(c);
    const now = deps.now();
    await revokeAllSessions(deps.db, user.id, now, sessionId);
    const updated = (await findUserById(deps.db, user.id))!;
    setAccessCookie(c, deps.config, await issueAccessToken(deps, updated, sessionId));
    return c.body(null, 204);
  });

  return app;
}

