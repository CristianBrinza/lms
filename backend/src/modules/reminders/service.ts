import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import { ensureKitchen, foodCtx, type FoodCtx } from '../food/kitchen';
import { planNeeds } from '../food/plan';
import { localDate } from '../food/stock';
import { toUser, USER_COLUMNS } from '../users';
import type { PushMessage } from './push';

/**
 * Reminders on the phone, written from the kitchen as it is at that moment:
 *
 * - shopping (evening): what tomorrow's meals still need, per store
 * - prep (evening): the meals to pack for tomorrow (to go)
 * - expiring (morning): food to use today or tomorrow
 * - meal: a heads-up some minutes before each planned meal
 * - custom: your own words at your own time ("On the way home? Linella.")
 *
 * Times are the kitchen's local time (the server's TZ). Each reminder fires once per day (or per
 * meal), and says nothing when there is nothing to say.
 */

export const REMINDER_KINDS = ['shopping', 'expiring', 'meal', 'prep', 'custom'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export interface Reminder {
  id: string;
  kind: ReminderKind;
  time: string | null;
  minutesBefore: number | null;
  /** 1 = Monday … 7 = Sunday. */
  days: number[];
  text: string;
  enabled: boolean;
}

interface ReminderRow {
  id: string;
  user_id: string;
  kind: ReminderKind;
  time: string | null;
  minutes_before: number | null;
  days: number[];
  text: string;
  enabled: boolean;
}

const SELECT = `SELECT id, user_id, kind, to_char(time, 'HH24:MI') AS time, minutes_before, days, text, enabled FROM reminders`;

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  kind: row.kind,
  time: row.time,
  minutesBefore: row.minutes_before,
  days: row.days,
  text: row.text,
  enabled: row.enabled,
});

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
const DEFAULTS: Array<Omit<Reminder, 'id'>> = [
  {
    kind: 'shopping',
    time: '18:30',
    minutesBefore: null,
    days: EVERY_DAY,
    text: '',
    enabled: true,
  },
  { kind: 'prep', time: '21:00', minutesBefore: null, days: EVERY_DAY, text: '', enabled: true },
  {
    kind: 'expiring',
    time: '09:00',
    minutesBefore: null,
    days: EVERY_DAY,
    text: '',
    enabled: true,
  },
  { kind: 'meal', time: null, minutesBefore: 45, days: EVERY_DAY, text: '', enabled: true },
  {
    kind: 'custom',
    time: '17:30',
    minutesBefore: null,
    days: [1, 2, 3, 4, 5],
    text: 'On the way home? Check the shopping list.',
    enabled: false,
  },
];

/** A person's reminders; the first visit sets up the defaults. */
export async function listReminders(deps: AppDeps, userId: string): Promise<Reminder[]> {
  const { rows } = await deps.db.query<ReminderRow>(
    `${SELECT} WHERE user_id = $1 ORDER BY created_at, id`,
    [userId],
  );
  if (rows.length) return rows.map(toReminder);
  for (const [index, reminder] of DEFAULTS.entries()) {
    await deps.db.query(
      'INSERT INTO reminders (id, user_id, kind, time, minutes_before, days, text, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        randomUUID(),
        userId,
        reminder.kind,
        reminder.time,
        reminder.minutesBefore,
        reminder.days,
        reminder.text,
        reminder.enabled,
        new Date(deps.now().getTime() + index),
      ],
    );
  }
  return listReminders(deps, userId);
}

export async function saveReminder(
  deps: AppDeps,
  userId: string,
  id: string | null,
  input: Partial<Omit<Reminder, 'id'>>,
): Promise<Reminder> {
  if (id) {
    const { rows } = await deps.db.query<ReminderRow>(
      `UPDATE reminders SET time = CASE WHEN $3::boolean THEN $4::time ELSE time END,
              minutes_before = coalesce($5, minutes_before), days = coalesce($6, days), text = coalesce($7, text), enabled = coalesce($8, enabled)
        WHERE id = $1 AND user_id = $2 RETURNING id`,
      [
        id,
        userId,
        input.time !== undefined,
        input.time ?? null,
        input.minutesBefore ?? null,
        input.days ?? null,
        input.text ?? null,
        input.enabled ?? null,
      ],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Reminder not found');
  } else {
    id = randomUUID();
    await deps.db.query(
      'INSERT INTO reminders (id, user_id, kind, time, minutes_before, days, text, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        id,
        userId,
        input.kind ?? 'custom',
        input.time ?? null,
        input.minutesBefore ?? null,
        input.days ?? EVERY_DAY,
        input.text ?? '',
        input.enabled ?? true,
        deps.now(),
      ],
    );
  }
  const { rows } = await deps.db.query<ReminderRow>(`${SELECT} WHERE id = $1`, [id]);
  return toReminder(rows[0]!);
}

export async function deleteReminder(deps: AppDeps, userId: string, id: string): Promise<void> {
  const { rowCount } = await deps.db.query('DELETE FROM reminders WHERE id = $1 AND user_id = $2', [
    id,
    userId,
  ]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Reminder not found');
}

export async function subscribe(
  deps: AppDeps,
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent: string },
): Promise<void> {
  await deps.db.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
    [
      randomUUID(),
      userId,
      input.endpoint,
      input.p256dh,
      input.auth,
      input.userAgent.slice(0, 300),
      deps.now(),
    ],
  );
}

export async function unsubscribe(deps: AppDeps, userId: string, endpoint: string): Promise<void> {
  await deps.db.query('DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2', [
    userId,
    endpoint,
  ]);
}

export async function deviceCount(deps: AppDeps, userId: string): Promise<number> {
  const { rows } = await deps.db.query<{ count: number }>(
    'SELECT count(*)::int AS count FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  return rows[0]?.count ?? 0;
}

/** Sends a message to every phone a person turned reminders on for. Returns how many got it. */
export async function sendToUser(
  deps: AppDeps,
  userId: string,
  message: PushMessage,
): Promise<number> {
  if (!deps.push) return 0;
  const { rows } = await deps.db.query<{
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1', [userId]);
  let sent = 0;
  for (const row of rows) {
    const result = await deps.push.send(row, message);
    if (result === 'ok') {
      sent += 1;
      await deps.db.query('UPDATE push_subscriptions SET last_ok_at = $2 WHERE id = $1', [
        row.id,
        deps.now(),
      ]);
    } else if (result === 'gone') {
      await deps.db.query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
    }
  }
  return sent;
}

// ---------------------------------------------------------------- what each reminder says

const list = (names: string[], max = 4) =>
  names.length > max
    ? `${names.slice(0, max).join(', ')} +${names.length - max}`
    : names.join(', ');

async function shoppingMessage(ctx: FoodCtx, today: string): Promise<PushMessage | null> {
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const needs = (await planNeeds(ctx, tomorrow, tomorrow)).lines.filter((l) => l.toBuy > 0);
  const { rows: listed } = await ctx.db.query<{ name: string; store: string | null }>(
    `SELECT i.name, s.name AS store FROM shopping_items i LEFT JOIN stores s ON s.id = i.store_id
      WHERE i.household_id = $1 AND i.trip_id IS NULL AND i.checked_at IS NULL AND (i.need_by <= $2 OR i.priority)`,
    [ctx.actor.householdId, tomorrow],
  );
  const names = [...new Set([...listed.map((l) => l.name), ...needs.map((n) => n.name)])];
  if (!names.length) return null;
  const stores = [...new Set(listed.map((l) => l.store).filter((s): s is string => Boolean(s)))];
  return {
    title: `For tomorrow: ${names.length} ${names.length === 1 ? 'thing' : 'things'} to buy`,
    body: `${list(names)}${stores.length ? ` · ${stores.join(', ')}` : ''}`,
    url: '/food/shopping',
    tag: 'shopping',
  };
}

async function prepMessage(ctx: FoodCtx, today: string): Promise<PushMessage | null> {
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const { rows } = await ctx.db.query<{ title: string }>(
    `SELECT title FROM meals WHERE household_id = $1 AND date = $2 AND status = 'planned' AND to_go ORDER BY time NULLS LAST`,
    [ctx.actor.householdId, tomorrow],
  );
  if (!rows.length) return null;
  return {
    title: 'Pack for tomorrow',
    body: list(rows.map((r) => r.title)),
    url: `/food/plan?day=${tomorrow}`,
    tag: 'prep',
  };
}

async function expiringMessage(ctx: FoodCtx, today: string): Promise<PushMessage | null> {
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const { rows } = await ctx.db.query<{ name: string; expires_on: string }>(
    `SELECT p.name, min(l.expires_on)::text AS expires_on FROM stock_lots l JOIN products p ON p.id = l.product_id
      WHERE l.household_id = $1 AND l.finished_at IS NULL AND l.expires_on <= $2 GROUP BY p.name ORDER BY min(l.expires_on)`,
    [ctx.actor.householdId, tomorrow],
  );
  if (!rows.length) return null;
  const when = (date: string) =>
    date < today ? 'past date' : date === today ? 'today' : 'tomorrow';
  return {
    title: 'Use soon',
    body: list(rows.map((r) => `${r.name} (${when(r.expires_on)})`)),
    url: '/food/kitchen',
    tag: 'expiring',
  };
}

// ---------------------------------------------------------------- the clock

const pad = (n: number) => String(n).padStart(2, '0');
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** A reminder still fires if the server was busy (or restarting) for up to this many minutes. */
const GRACE = 15;

/** Called every minute: sends what is due. Returns how many notifications went out. */
export async function runReminders(deps: AppDeps, now: Date = deps.now()): Promise<number> {
  if (!deps.push) return 0;
  const today = localDate(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekday = ((now.getDay() + 6) % 7) + 1;
  const { rows } = await deps.db.query<ReminderRow>(
    `${SELECT} r WHERE r.enabled AND EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = r.user_id)
       AND EXISTS (SELECT 1 FROM users u WHERE u.id = r.user_id AND u.is_active)`,
  );
  const columns = USER_COLUMNS.split(', ').join(', ');
  let sent = 0;

  for (const reminder of rows) {
    if (!reminder.days.includes(weekday)) continue;
    const { rows: users } = await deps.db.query<Parameters<typeof toUser>[0]>(
      `SELECT ${columns} FROM users WHERE id = $1`,
      [reminder.user_id],
    );
    const user = toUser(users[0]!);
    const kitchen = await ensureKitchen(deps, user);
    const ctx = foodCtx(deps, {
      householdId: kitchen.id,
      userId: user.id,
      via: 'app',
      currency: kitchen.currency,
    });

    const once = async (key: string, write: () => Promise<PushMessage | null>) => {
      const { rowCount } = await deps.db.query(
        'INSERT INTO reminder_log (reminder_id, key, sent_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [reminder.id, key, now],
      );
      if (!rowCount) return;
      const message = await write();
      if (message) sent += await sendToUser(deps, user.id, message);
    };

    if (reminder.kind === 'meal') {
      const before = reminder.minutes_before ?? 30;
      const { rows: meals } = await deps.db.query<{
        id: string;
        title: string;
        time: string;
        to_go: boolean;
      }>(
        `SELECT id, title, to_char(time, 'HH24:MI') AS time, to_go FROM meals
          WHERE household_id = $1 AND date = $2 AND status = 'planned' AND time IS NOT NULL`,
        [kitchen.id, today],
      );
      for (const meal of meals) {
        const due = minutesOf(meal.time) - before;
        if (nowMinutes < due || nowMinutes > due + GRACE) continue;
        await once(`meal:${meal.id}`, async () => ({
          title: `${meal.title} at ${meal.time}`,
          body: meal.to_go
            ? 'Packed? It’s to take along.'
            : `In ${before} minutes. Tap to see what it needs.`,
          url: `/food/plan?meal=${meal.id}`,
          tag: `meal-${meal.id}`,
        }));
      }
      continue;
    }

    if (!reminder.time) continue;
    const at = minutesOf(reminder.time);
    if (nowMinutes < at || nowMinutes > at + GRACE) continue;
    await once(`day:${today}`, async () => {
      if (reminder.kind === 'shopping') return shoppingMessage(ctx, today);
      if (reminder.kind === 'prep') return prepMessage(ctx, today);
      if (reminder.kind === 'expiring') return expiringMessage(ctx, today);
      return {
        title: 'LMS',
        body: reminder.text || 'Reminder',
        url: '/food/shopping',
        tag: `custom-${reminder.id}`,
      };
    });
  }
  return sent;
}

export const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
