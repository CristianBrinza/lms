import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../context';
import type { Queryable } from '../db';
import { AppError } from '../lib/errors';
import { LOCALES } from '../lib/i18n';
import { requireAuth } from '../middleware/auth';
import { findUserById, GENDERS, isUuid } from './users';

/**
 * The profile beyond a name: a picture, gender, birth date and height — for the family to see who
 * is who, and for Training and Health to fit plans and numbers to the person. Each person sets
 * their own; the admin can set anyone's. The picture is small (the app shrinks it before sending)
 * and is shown only to the person, their household and admins. Paydays (the days of the month the
 * salary and the advance come) are set here too, and today's weight, which is kept in Health.
 */

const birthDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 1990-05-31')
  .refine((value) => {
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isNaN(time) && value >= '1900-01-01' && time <= Date.now();
  }, 'Not a real birth date');

/** A day of the month. Only the day is kept, never an amount. */
const monthDay = z
  .number()
  .int('Pick a day from 1 to 31')
  .min(1, 'Pick a day from 1 to 31')
  .max(31, 'Pick a day from 1 to 31');

export const ProfileFields = z.object({
  gender: z.enum(GENDERS).nullable().optional(),
  birthDate: birthDate.nullable().optional(),
  heightCm: z.number().int().min(40, 'Height in cm').max(250, 'Height in cm').nullable().optional(),
  goal: z
    .enum(['lose', 'keep', 'gain'])
    .nullable()
    .optional()
    .describe('Lose, keep or gain weight'),
  goalWeight: z.number().min(20).max(400).nullable().optional().describe('kg'),
  goalRate: z.number().min(0).max(1.5).nullable().optional().describe('kg a week'),
  activity: z
    .enum(['sedentary', 'light', 'moderate', 'active', 'very'])
    .nullable()
    .optional()
    .describe('How active a day is without the training, when the phone doesn’t say'),
  locale: z.enum(LOCALES).nullable().optional().describe('The app’s language: en, ro or ru'),
  salaryDay: monthDay.nullable().optional().describe('The day of the month the salary comes, 1–31'),
  advanceDay: monthDay
    .nullable()
    .optional()
    .describe('The day of the month the advance (avans), the salary’s earlier part, comes, 1–31'),
  // Not a column: saved as today's typed-in weight in Health (saveTypedWeight), so Training and
  // Health count with it too. null leaves the weights already there.
  weightKg: z
    .number()
    .min(20, 'Weight in kg')
    .max(400, 'Weight in kg')
    .nullable()
    .optional()
    .describe('Today’s weight, kg'),
});
export type ProfileFields = z.infer<typeof ProfileFields>;

/** Writes the fields given (null clears one); leaves the rest. */
export async function saveProfileFields(
  db: Queryable,
  userId: string,
  fields: ProfileFields,
  now: Date,
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [userId];
  const column = {
    gender: 'gender',
    birthDate: 'birth_date',
    heightCm: 'height_cm',
    goal: 'goal',
    goalWeight: 'goal_weight',
    goalRate: 'goal_rate',
    activity: 'activity',
    locale: 'locale',
    salaryDay: 'salary_day',
    advanceDay: 'advance_day',
  } as const;
  for (const key of Object.keys(column) as Array<keyof typeof column>) {
    if (fields[key] === undefined) continue;
    values.push(fields[key]);
    sets.push(`${column[key]} = $${values.length}`);
  }
  if (!sets.length) return;
  values.push(now);
  await db.query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = $${values.length} WHERE id = $1`,
    values,
  );
}

export const AvatarBody = z.object({
  image: z
    .string()
    .max(700_000, 'That picture is too large')
    .describe('A data URL: image/jpeg, image/png or image/webp, up to about 500 KB'),
});

const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_AVATAR = 512 * 1024;

/** Checks the picture really is one of the allowed images (by its first bytes, not only its label). */
export function decodeAvatar(dataUrl: string): { bytes: Buffer; type: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match || !AVATAR_TYPES.has(match[1]!))
    throw new AppError(400, 'VALIDATION', 'Use a JPEG, PNG or WebP picture', {
      fields: { image: 'Not a picture' },
    });
  const bytes = Buffer.from(match[2]!, 'base64');
  if (!bytes.length || bytes.length > MAX_AVATAR)
    throw new AppError(400, 'VALIDATION', 'That picture is too large', {
      fields: { image: 'Too large' },
    });
  const type = match[1]!;
  const ok =
    (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8) ||
    (type === 'image/png' &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (type === 'image/webp' &&
      bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
      bytes.subarray(8, 12).toString('latin1') === 'WEBP');
  if (!ok)
    throw new AppError(400, 'VALIDATION', 'That file isn’t the picture it says it is', {
      fields: { image: 'Not a picture' },
    });
  return { bytes, type };
}

export async function setAvatar(
  db: Queryable,
  userId: string,
  image: string | null,
  now: Date,
): Promise<void> {
  if (image === null) {
    await db.query(
      'UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_at = NULL, updated_at = $2 WHERE id = $1',
      [userId, now],
    );
    return;
  }
  const { bytes, type } = decodeAvatar(image);
  await db.query(
    'UPDATE users SET avatar = $2, avatar_type = $3, avatar_at = $4, updated_at = $4 WHERE id = $1',
    [userId, bytes, type, now],
  );
}

/** GET /api/users/:id/avatar — the picture, for the person, their household and admins. */
export function avatarRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps));
  app.get('/:id/avatar', async (c) => {
    const id = c.req.param('id');
    const viewer = c.get('user');
    const target = isUuid(id) ? await findUserById(deps.db, id) : null;
    const allowed =
      target &&
      (target.id === viewer.id ||
        viewer.role === 'admin' ||
        (viewer.householdId !== null && viewer.householdId === target.householdId));
    if (!allowed) throw new AppError(404, 'NOT_FOUND', 'No picture');
    const { rows } = await deps.db.query<{ avatar: Buffer | null; avatar_type: string | null }>(
      'SELECT avatar, avatar_type FROM users WHERE id = $1',
      [id],
    );
    const row = rows[0];
    if (!row?.avatar || !row.avatar_type) throw new AppError(404, 'NOT_FOUND', 'No picture');
    return c.body(new Uint8Array(row.avatar), 200, {
      'content-type': row.avatar_type,
      // The address carries the picture's version (?v=), so a copy never goes stale.
      'cache-control': 'private, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    });
  });
  return app;
}

/** Years old on a day. */
export function age(birth: string | null, today: Date): number | null {
  if (!birth) return null;
  const [y, m, d] = birth.split('-').map(Number) as [number, number, number];
  let years = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) years--;
  return years;
}
