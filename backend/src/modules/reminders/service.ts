import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import { mergeTranslations, translated, type Locale, type Translations } from '../../lib/i18n';
import { ensureKitchen, foodCtx, type FoodCtx } from '../food/kitchen';
import { planNeeds } from '../food/plan';
import { localDate } from '../food/stock';
import { toUser, USER_COLUMNS } from '../users';
import { DEFAULT_CUSTOM_TRANSLATIONS, REMINDER_WORDS, reminderWords } from './i18n';
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
  /** The text in other languages: { ro: { text }, ru: { text }, en: { text } }. */
  translations: Translations;
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
  translations: Translations | null;
  enabled: boolean;
}

const SELECT = `SELECT id, user_id, kind, to_char(time, 'HH24:MI') AS time, minutes_before, days, text, translations, enabled FROM reminders`;

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  kind: row.kind,
  time: row.time,
  minutesBefore: row.minutes_before,
  days: row.days,
  text: row.text,
  translations: row.translations ?? {},
  enabled: row.enabled,
});

const EVERY_DAY = [1, 2, 3, 4, 5, 6, 7];
const DEFAULT_CUSTOM = REMINDER_WORDS.en.defaultCustom;
const DEFAULTS: Array<Omit<Reminder, 'id'>> = [
  {
    kind: 'shopping',
    time: '18:30',
    minutesBefore: null,
    days: EVERY_DAY,
    text: '',
    translations: {},
    enabled: true,
  },
  {
    kind: 'prep',
    time: '21:00',
    minutesBefore: null,
    days: EVERY_DAY,
    text: '',
    translations: {},
    enabled: true,
  },
  {
    kind: 'expiring',
    time: '09:00',
    minutesBefore: null,
    days: EVERY_DAY,
    text: '',
    translations: {},
    enabled: true,
  },
  {
    kind: 'meal',
    time: null,
    minutesBefore: 45,
    days: EVERY_DAY,
    text: '',
    translations: {},
    enabled: true,
  },
  {
    kind: 'custom',
    time: '17:30',
    minutesBefore: null,
    days: [1, 2, 3, 4, 5],
    text: DEFAULT_CUSTOM,
    translations: DEFAULT_CUSTOM_TRANSLATIONS,
    enabled: false,
  },
];

/** A person's reminders; the first visit sets up the defaults. */
export async function listReminders(deps: AppDeps, userId: string): Promise<Reminder[]> {
  // The starting custom reminder, made before reminders spoke Romanian and Russian, gets its words.
  await deps.db.query(
    `UPDATE reminders SET translations = $3 WHERE user_id = $1 AND kind = 'custom' AND text = $2 AND translations = '{}'::jsonb`,
    [userId, DEFAULT_CUSTOM, JSON.stringify(DEFAULT_CUSTOM_TRANSLATIONS)],
  );
  const { rows } = await deps.db.query<ReminderRow>(
    `${SELECT} WHERE user_id = $1 ORDER BY created_at, id`,
    [userId],
  );
  if (rows.length) return rows.map(toReminder);
  for (const [index, reminder] of DEFAULTS.entries()) {
    await deps.db.query(
      'INSERT INTO reminders (id, user_id, kind, time, minutes_before, days, text, translations, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        randomUUID(),
        userId,
        reminder.kind,
        reminder.time,
        reminder.minutesBefore,
        reminder.days,
        reminder.text,
        JSON.stringify(reminder.translations),
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
  input: Partial<Omit<Reminder, 'id' | 'translations'>> & { translations?: Translations },
): Promise<Reminder> {
  if (id) {
    const { rows: before } = await deps.db.query<ReminderRow>(
      `${SELECT} WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    if (!before[0]) throw new AppError(404, 'NOT_FOUND', 'Reminder not found');
    let stored = before[0].translations ?? {};
    // New words without new translations: the old translations no longer say the same thing.
    if (input.text !== undefined && input.text !== before[0].text && !input.translations) {
      stored = Object.fromEntries(
        Object.entries(stored).map(([locale, fields]) => {
          const { text: _text, ...rest } = fields ?? {};
          return [locale, rest];
        }),
      );
    }
    const translations = mergeTranslations(stored, input.translations);
    await deps.db.query(
      `UPDATE reminders SET time = CASE WHEN $3::boolean THEN $4::time ELSE time END,
              minutes_before = coalesce($5, minutes_before), days = coalesce($6, days), text = coalesce($7, text), enabled = coalesce($8, enabled),
              translations = $9
        WHERE id = $1 AND user_id = $2`,
      [
        id,
        userId,
        input.time !== undefined,
        input.time ?? null,
        input.minutesBefore ?? null,
        input.days ?? null,
        input.text ?? null,
        input.enabled ?? null,
        JSON.stringify(translations),
      ],
    );
  } else {
    id = randomUUID();
    await deps.db.query(
      'INSERT INTO reminders (id, user_id, kind, time, minutes_before, days, text, translations, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        id,
        userId,
        input.kind ?? 'custom',
        input.time ?? null,
        input.minutesBefore ?? null,
        input.days ?? EVERY_DAY,
        input.text ?? '',
        JSON.stringify(mergeTranslations({}, input.translations)),
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

type Named = { name: string; translations: Translations | null };

/** A meal's title in a language: its own translation, else its recipe's when it has the recipe's title. */
function mealTitle(
  row: {
    title: string;
    translations: Translations | null;
    recipe_title: string | null;
    recipe_translations: Translations | null;
  },
  locale: Locale,
): string {
  const own = translated(row, 'title', locale);
  if (own !== row.title || row.recipe_title !== row.title) return own;
  return translated(
    { title: row.recipe_title, translations: row.recipe_translations },
    'title',
    locale,
  );
}

const MEAL_TITLE_SELECT = `m.title, m.translations, r.title AS recipe_title, r.translations AS recipe_translations
   FROM meals m LEFT JOIN recipes r ON r.id = m.recipe_id`;

async function shoppingMessage(
  ctx: FoodCtx,
  today: string,
  locale: Locale,
): Promise<PushMessage | null> {
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const needs = (await planNeeds(ctx, tomorrow, tomorrow)).lines.filter((l) => l.toBuy > 0);
  const { rows: listed } = await ctx.db.query<{
    name: string;
    product: Named | null;
    store: Named | null;
  }>(
    `SELECT i.name,
            CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('name', p.name, 'translations', p.translations) END AS product,
            CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('name', s.name, 'translations', s.translations) END AS store
       FROM shopping_items i LEFT JOIN stores s ON s.id = i.store_id LEFT JOIN products p ON p.id = i.product_id
      WHERE i.household_id = $1 AND i.trip_id IS NULL AND i.checked_at IS NULL AND (i.need_by <= $2 OR i.priority)`,
    [ctx.actor.householdId, tomorrow],
  );
  const { rows: products } = needs.length
    ? await ctx.db.query<{ id: string; translations: Translations | null }>(
        'SELECT id, translations FROM products WHERE id = ANY($1::uuid[])',
        [needs.map((n) => n.productId)],
      )
    : { rows: [] };
  const productWords = new Map(products.map((p) => [p.id, p.translations]));
  // A line named as its item reads as the item does in this language; its own words otherwise.
  const lineName = (line: (typeof listed)[number]) =>
    line.product && line.product.name === line.name
      ? translated(line.product, 'name', locale)
      : line.name;
  const needName = (line: (typeof needs)[number]) =>
    translated(
      { name: line.name, translations: productWords.get(line.productId) ?? null },
      'name',
      locale,
    );
  const names = [...new Set([...listed.map(lineName), ...needs.map(needName)])];
  if (!names.length) return null;
  const stores = [
    ...new Set(
      listed.map((l) => (l.store ? translated(l.store, 'name', locale) : '')).filter(Boolean),
    ),
  ];
  return {
    title: reminderWords(locale).shoppingTitle(names.length),
    body: `${list(names)}${stores.length ? ` · ${stores.join(', ')}` : ''}`,
    url: '/food/shopping',
    tag: 'shopping',
  };
}

async function prepMessage(
  ctx: FoodCtx,
  today: string,
  locale: Locale,
): Promise<PushMessage | null> {
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const { rows } = await ctx.db.query<Parameters<typeof mealTitle>[0]>(
    `SELECT ${MEAL_TITLE_SELECT}
      WHERE m.household_id = $1 AND m.date = $2 AND m.status = 'planned' AND m.to_go ORDER BY m.time NULLS LAST`,
    [ctx.actor.householdId, tomorrow],
  );
  if (!rows.length) return null;
  return {
    title: reminderWords(locale).packTitle,
    body: list(rows.map((r) => mealTitle(r, locale))),
    url: `/food/plan?day=${tomorrow}`,
    tag: 'prep',
  };
}

async function expiringMessage(
  ctx: FoodCtx,
  today: string,
  locale: Locale,
): Promise<PushMessage | null> {
  const words = reminderWords(locale);
  const tomorrow = localDate(new Date(`${today}T12:00:00`), 1);
  const { rows } = await ctx.db.query<{
    name: string;
    translations: Translations | null;
    expires_on: string;
  }>(
    `SELECT p.name, p.translations, min(l.expires_on)::text AS expires_on FROM stock_lots l JOIN products p ON p.id = l.product_id
      WHERE l.household_id = $1 AND l.finished_at IS NULL AND l.expires_on <= $2 GROUP BY p.id ORDER BY min(l.expires_on), p.name`,
    [ctx.actor.householdId, tomorrow],
  );
  if (!rows.length) return null;
  const when = (date: string) =>
    date < today ? words.pastDate : date === today ? words.today : words.tomorrow;
  return {
    title: words.useSoonTitle,
    body: list([
      ...new Set(rows.map((r) => `${translated(r, 'name', locale)} (${when(r.expires_on)})`)),
    ]),
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
    const locale: Locale = user.locale ?? 'en';
    const words = reminderWords(locale);
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
      const { rows: meals } = await deps.db.query<
        Parameters<typeof mealTitle>[0] & { id: string; time: string; to_go: boolean }
      >(
        `SELECT m.id, to_char(m.time, 'HH24:MI') AS time, m.to_go, ${MEAL_TITLE_SELECT}
          WHERE m.household_id = $1 AND m.date = $2 AND m.status = 'planned' AND m.time IS NOT NULL`,
        [kitchen.id, today],
      );
      for (const meal of meals) {
        const due = minutesOf(meal.time) - before;
        if (nowMinutes < due || nowMinutes > due + GRACE) continue;
        await once(`meal:${meal.id}`, async () => ({
          title: words.mealTitle(mealTitle(meal, locale), meal.time),
          body: meal.to_go ? words.mealToGo : words.mealIn(before),
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
      if (reminder.kind === 'shopping') return shoppingMessage(ctx, today, locale);
      if (reminder.kind === 'prep') return prepMessage(ctx, today, locale);
      if (reminder.kind === 'expiring') return expiringMessage(ctx, today, locale);
      let text = translated(
        { text: reminder.text, translations: reminder.translations },
        'text',
        locale,
      );
      // The starting reminder's words, in case its translations were never stored.
      if (text === DEFAULT_CUSTOM) text = words.defaultCustom;
      return {
        title: words.customTitle,
        body: text || words.customFallback,
        url: '/food/shopping',
        tag: `custom-${reminder.id}`,
      };
    });
  }
  return sent;
}

export const clock = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
