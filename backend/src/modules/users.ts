import { randomUUID } from 'node:crypto';
import type { Role } from '../config';
import type { AppDeps } from '../context';
import type { Queryable } from '../db';
import type { Locale } from '../lib/i18n';

/** A person with an account. Only the admin creates them; there is no public sign-up. */
export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdBy: string | null;
  /** The kitchen whose food this person shares; set on their first visit to Food. */
  householdId: string | null;
  createdAt: Date;
  updatedAt: Date;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  heightCm: number | null;
  goal: 'lose' | 'keep' | 'gain' | null;
  goalWeight: number | null;
  goalRate: number | null;
  activity: 'sedentary' | 'light' | 'moderate' | 'active' | 'very' | null;
  /** When the picture was last set; null without one. */
  avatarAt: Date | null;
  /** The app's language for this person; null until chosen. */
  locale: Locale | null;
  /** The day of the month the salary comes (1–31); null if not said. */
  salaryDay: number | null;
  /** The day of the month the advance (avans), the salary's earlier part, comes; null if none. */
  advanceDay: number | null;
}

export const GENDERS = ['female', 'male', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

interface UserRow {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  password_hash: string;
  is_active: boolean;
  must_change_password: boolean;
  token_version: number;
  last_login_at: Date | null;
  created_by: string | null;
  household_id: string | null;
  created_at: Date;
  updated_at: Date;
  gender: Gender | null;
  birth_date: string | null;
  height_cm: number | null;
  avatar_at: Date | null;
  goal: User['goal'];
  goal_weight: string | null;
  goal_rate: string | null;
  activity: User['activity'];
  locale: Locale | null;
  salary_day: number | null;
  advance_day: number | null;
}

export const USER_COLUMNS =
  'id, email, name, surname, role, password_hash, is_active, must_change_password, token_version, last_login_at, created_by, household_id, created_at, updated_at, gender, birth_date::text AS birth_date, height_cm, avatar_at, goal, goal_weight, goal_rate, activity, locale, salary_day, advance_day';

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    surname: row.surname,
    role: row.role,
    passwordHash: row.password_hash,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    tokenVersion: row.token_version,
    lastLoginAt: row.last_login_at,
    createdBy: row.created_by,
    householdId: row.household_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    gender: row.gender,
    birthDate: row.birth_date,
    heightCm: row.height_cm,
    avatarAt: row.avatar_at,
    goal: row.goal,
    goalWeight: row.goal_weight === null ? null : Number(row.goal_weight),
    goalRate: row.goal_rate === null ? null : Number(row.goal_rate),
    activity: row.activity,
    locale: row.locale,
    salaryDay: row.salary_day,
    advanceDay: row.advance_day,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

export async function findUserById(db: Queryable, id: string): Promise<User | null> {
  if (!isUuid(id)) return null;
  const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserByEmail(db: Queryable, email: string): Promise<User | null> {
  const { rows } = await db.query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function insertUser(
  db: Queryable,
  input: {
    email: string;
    name: string;
    surname: string;
    role: Role;
    passwordHash: string;
    mustChangePassword: boolean;
    createdBy: string | null;
  },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (id, email, name, surname, role, password_hash, must_change_password, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${USER_COLUMNS}`,
    [
      randomUUID(),
      input.email,
      input.name,
      input.surname,
      input.role,
      input.passwordHash,
      input.mustChangePassword,
      input.createdBy,
    ],
  );
  return toUser(rows[0]!);
}

/** Active admins left: the last one can never be demoted, deactivated or deleted. */
export async function countActiveAdmins(db: Queryable): Promise<number> {
  const { rows } = await db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM users WHERE role = 'admin' AND is_active`,
  );
  return rows[0]?.count ?? 0;
}

/** What the app may know about a person (never the hash or token version). */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  mustChangePassword: boolean;
  createdAt: string;
  gender: Gender | null;
  birthDate: string | null;
  heightCm: number | null;
  goal: User['goal'];
  goalWeight: number | null;
  goalRate: number | null;
  activity: User['activity'];
  /** The picture's address (it changes with the picture), or null. */
  avatarUrl: string | null;
  locale: Locale | null;
  salaryDay: number | null;
  advanceDay: number | null;
  /** The latest weight from any source (the phone or typed in), kg; null without one. */
  weightKg: number | null;
  /** The day of that weight, YYYY-MM-DD. */
  weightDay: string | null;
}

/** A person's latest weight and its day. */
export interface LatestWeight {
  kg: number;
  day: string;
}

/**
 * The latest weight lives in Health (health_days), not on the user, so it is read apart. On a day
 * with more than one reading the phone's wins over a typed one, as in Training's energy numbers.
 */
export async function latestWeight(db: Queryable, userId: string): Promise<LatestWeight | null> {
  const { rows } = await db.query<{ value: string; day: string }>(
    `SELECT value, day::text AS day FROM health_days WHERE user_id = $1 AND kind = 'weight' ORDER BY day DESC, source LIMIT 1`,
    [userId],
  );
  return rows[0] ? { kg: Number(rows[0].value), day: rows[0].day } : null;
}

/** A person's picture, for an <img>: the address changes when the picture does, so it caches forever. */
export const avatarUrl = (id: string, at: Date | null) =>
  at ? `/api/users/${id}/avatar?v=${at.getTime()}` : null;

/** `weight` is the person's latestWeight: it isn't on the user row, so the caller reads it. */
export function toPublicUser(user: User, weight: LatestWeight | null): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
    gender: user.gender,
    birthDate: user.birthDate,
    heightCm: user.heightCm,
    goal: user.goal,
    goalWeight: user.goalWeight,
    goalRate: user.goalRate,
    activity: user.activity,
    avatarUrl: avatarUrl(user.id, user.avatarAt),
    locale: user.locale,
    salaryDay: user.salaryDay,
    advanceDay: user.advanceDay,
    weightKg: weight?.kg ?? null,
    weightDay: weight?.day ?? null,
  };
}

/** The person as the app sees them, with their latest weight. */
export async function publicUserWithWeight(db: Queryable, user: User): Promise<PublicUser> {
  return toPublicUser(user, await latestWeight(db, user.id));
}

/** Creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD when the database has none. */
export async function ensureBootstrapAdmin(
  deps: AppDeps,
  log: (message: string) => void,
): Promise<void> {
  const admin = deps.config.bootstrapAdmin;
  if (!admin) return;
  const { rows } = await deps.db.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM users WHERE role = 'admin'`,
  );
  if ((rows[0]?.count ?? 0) > 0) return;
  if (await findUserByEmail(deps.db, admin.email)) {
    log(`ADMIN_EMAIL ${admin.email} already belongs to a member; not creating an admin`);
    return;
  }
  await insertUser(deps.db, {
    email: admin.email,
    name: admin.name,
    surname: admin.surname,
    role: 'admin',
    passwordHash: await deps.passwords.hash(admin.password),
    mustChangePassword: false,
    createdBy: null,
  });
  log(
    `created the first admin, ${admin.email} (you can now remove ADMIN_PASSWORD from the environment)`,
  );
}
