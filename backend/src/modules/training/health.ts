import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { FoodCtx as Ctx } from '../food/kitchen';
import { dateField, idField } from '../food/schemas';
import { localDate } from '../food/stock';
import { syncCatalog } from './library';
import { addDays } from './stats';
import { personId } from './workouts';

/**
 * Health data from the phone: Apple Health (sent by an iOS Shortcut) or Health Connect (sent by
 * the Android companion), or typed in. A web app can't read either store itself, so the phone
 * sends days of totals — steps, sleep, resting heart rate, weight… — and its workouts, with an
 * access key. A day is overwritten as it fills up; a workout becomes a set once, however often
 * it is sent again. Numbers arrive loosely (a Shortcut may send "8 543" or "72,5"): read them
 * leniently, refuse what isn't a number.
 */

export const HEALTH_KINDS = {
  steps: { unit: 'steps', integer: true, max: 200_000 },
  distance: { unit: 'm', integer: true, max: 300_000 },
  activeEnergy: { unit: 'kcal', integer: true, max: 20_000 },
  exerciseMinutes: { unit: 'min', integer: true, max: 1440 },
  flights: { unit: 'floors', integer: true, max: 1000 },
  restingHeartRate: { unit: 'bpm', integer: true, max: 250 },
  heartRate: { unit: 'bpm', integer: true, max: 250 },
  hrv: { unit: 'ms', integer: true, max: 500 },
  sleep: { unit: 'min', integer: true, max: 1440 },
  weight: { unit: 'kg', integer: false, max: 400 },
  bodyFat: { unit: '%', integer: false, max: 80 },
  vo2max: { unit: 'ml/kg/min', integer: false, max: 100 },
} as const;
export type HealthKind = keyof typeof HEALTH_KINDS;
export const HEALTH_KIND_LIST = Object.keys(HEALTH_KINDS) as HealthKind[];

/** "8 543", "8,543" (thousands), "72,5" (decimal), 72.5, "6.5 h" → a number, or null. */
export function looseNumber(value: unknown, integer: boolean): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  let text = value.replace(/[\s\u00a0\u202f']/g, '').replace(/[^\d.,-].*$/, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    // The later separator is the decimal one.
    text =
      text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
  } else if (text.includes(',')) {
    const [, after = ''] = text.split(',');
    text = integer && after.length === 3 ? text.replace(/,/g, '') : text.replace(',', '.');
  }
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

const looseField = z
  .union([z.number(), z.string().max(40)])
  .nullable()
  .optional();

const DayFields = {
  steps: looseField,
  distance: looseField.describe('Metres walked and run'),
  distanceKm: looseField.describe('Or the same in km'),
  activeEnergy: looseField.describe('kcal'),
  exerciseMinutes: looseField,
  flights: looseField,
  restingHeartRate: looseField,
  heartRate: looseField.describe('Average bpm'),
  hrv: looseField.describe('ms'),
  sleep: looseField.describe('Minutes asleep'),
  sleepHours: looseField.describe('Or hours asleep'),
  weight: looseField.describe('kg'),
  bodyFat: looseField.describe('%'),
  vo2max: looseField,
};

const HealthDay = z.object({ date: dateField.optional().describe('Default today'), ...DayFields });

const HealthWorkout = z.object({
  id: z
    .string()
    .trim()
    .max(120)
    .optional()
    .describe('The health app’s id, so a re-sync doesn’t count it twice'),
  type: z.string().trim().min(1).max(60).describe('Running, Walking, Cycling, Rowing, Yoga…'),
  start: z.iso.datetime({ offset: true }),
  end: z.iso.datetime({ offset: true }).optional(),
  durationSeconds: looseField,
  durationMinutes: looseField,
  distance: looseField.describe('Metres'),
  distanceKm: looseField,
  energy: looseField.describe('kcal'),
});

export const HealthImport = z.object({
  source: z.enum(['apple', 'google', 'manual']).default('apple'),
  userId: idField.optional(),
  days: z.array(HealthDay).max(400).optional(),
  workouts: z.array(HealthWorkout).max(500).optional(),
  // A Shortcut sends one day flat: { date, steps, sleepHours… }
  date: dateField.optional(),
  ...DayFields,
});
export type HealthImport = z.infer<typeof HealthImport>;

type DayInput = z.infer<typeof HealthDay>;

const present = (value: unknown) => value !== null && value !== undefined && value !== '';

function dayValues(day: DayInput): Array<[HealthKind, number]> {
  const out: Array<[HealthKind, number]> = [];
  const read = (kind: HealthKind, raw: unknown, scale = 1) => {
    const spec = HEALTH_KINDS[kind];
    const n = looseNumber(raw, spec.integer && scale === 1);
    if (n === null) return;
    const value = spec.integer ? Math.round(n * scale) : Math.round(n * scale * 100) / 100;
    if (value < 0 || value > spec.max)
      throw new AppError(400, 'VALIDATION', `${kind} ${value} isn’t believable`, {
        fields: { [kind]: 'Out of range' },
      });
    out.push([kind, value]);
  };
  for (const kind of HEALTH_KIND_LIST)
    if (kind !== 'distance' && kind !== 'sleep') read(kind, day[kind]);
  if (present(day.distance)) read('distance', day.distance);
  else if (present(day.distanceKm)) read('distance', day.distanceKm, 1000);
  if (present(day.sleep)) read('sleep', day.sleep);
  else if (present(day.sleepHours)) read('sleep', day.sleepHours, 60);
  // Zero steps or zero sleep usually means "the phone recorded nothing", not a day of none.
  return out.filter(
    ([kind, value]) => value > 0 || kind === 'exerciseMinutes' || kind === 'flights',
  );
}

/** Health app workout names → the catalog exercise that is the same thing. */
const WORKOUT_PRESET: Array<[RegExp, string]> = [
  [/run|jog|бег|alerg/i, 'run'],
  [/walk|hik|ходьб|mers/i, 'walk'],
  [/cycl|bik|велос/i, 'cycling'],
  [/row/i, 'rowing'],
  [/rope|скакал/i, 'jump-rope'],
  [/stair|step ?climb/i, 'stair-climb'],
];

async function exerciseForWorkout(
  ctx: Ctx,
  userId: string,
  type: string,
): Promise<{ id: string; measure: string }> {
  const preset = WORKOUT_PRESET.find(([pattern]) => pattern.test(type))?.[1];
  const { rows } = await ctx.db.query<{ id: string; measure: string }>(
    preset
      ? 'SELECT id, measure FROM training_exercises WHERE user_id = $1 AND preset = $2'
      : 'SELECT id, measure FROM training_exercises WHERE user_id = $1 AND lower(name) = lower($2) ORDER BY archived_at NULLS FIRST LIMIT 1',
    [userId, preset ?? type],
  );
  if (rows[0]) return rows[0];
  // Yoga, Swimming, Tennis… become the household's own timed exercise, named as the app names it.
  const name = type
    .replace(/^HKWorkoutActivityType/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();
  const created = await ctx.db.query<{ id: string; measure: string }>(
    `INSERT INTO training_exercises (id, household_id, name, category, muscles, measure, icon, rest, created_by, created_at, updated_at, user_id)
     VALUES ($1, $2, $3, 'cardio', '{heart}', 'time', 'jumping-jack', 0, $4, $5, $5, $6) RETURNING id, measure`,
    [
      randomUUID(),
      ctx.actor.householdId,
      name.charAt(0).toUpperCase() + name.slice(1),
      ctx.actor.userId,
      ctx.now,
      userId,
    ],
  );
  return created.rows[0]!;
}

export async function importHealth(
  ctx: Ctx,
  input: HealthImport,
): Promise<{ days: number; values: number; workouts: number }> {
  const userId = await personId(ctx, input.userId);
  const days: DayInput[] = [...(input.days ?? [])];
  const flat = dayValues(input);
  if (flat.length || input.date) days.push({ ...input, date: input.date });
  const today = localDate(ctx.now);
  return ctx.tx(async (tx) => {
    let values = 0;
    const touched = new Set<string>();
    for (const day of days) {
      const date = day.date ?? today;
      if (date > addDays(today, 1))
        throw new AppError(400, 'VALIDATION', 'That day hasn’t come yet', {
          fields: { date: 'In the future' },
        });
      for (const [kind, value] of dayValues(day)) {
        await tx.db.query(
          `INSERT INTO health_days (user_id, household_id, day, kind, source, value, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (user_id, day, kind, source) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
          [userId, tx.actor.householdId, date, kind, input.source, value, tx.now],
        );
        values++;
        touched.add(date);
      }
    }
    let workouts = 0;
    if (input.workouts?.length) await syncCatalog(tx, userId);
    for (const w of input.workouts ?? []) {
      const start = new Date(w.start);
      if (start.getTime() > tx.now.getTime() + 5 * 60_000) continue;
      const end = w.end ? new Date(w.end) : null;
      const minutes = looseNumber(w.durationMinutes, false);
      const seconds =
        looseNumber(w.durationSeconds, false) ??
        (minutes !== null ? minutes * 60 : null) ??
        (end ? (end.getTime() - start.getTime()) / 1000 : null);
      const km = looseNumber(w.distanceKm, false);
      const metres = looseNumber(w.distance, false) ?? (km !== null ? km * 1000 : null);
      if (!seconds && !metres) continue;
      const exercise = await exerciseForWorkout(tx, userId, w.type);
      const externalId = `${input.source}:${w.id ?? `${w.type}:${w.start}`}`;
      const energy = looseNumber(w.energy, true);
      await tx.db.query(
        `INSERT INTO training_sets (id, household_id, user_id, exercise_id, seconds, distance, performed_at, day, time_known, note, via, created_by, created_at, external_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10, $11, $12, $13)
         ON CONFLICT (user_id, external_id) WHERE external_id IS NOT NULL
         DO UPDATE SET seconds = EXCLUDED.seconds, distance = EXCLUDED.distance, note = EXCLUDED.note`,
        [
          randomUUID(),
          tx.actor.householdId,
          userId,
          exercise.id,
          seconds ? Math.round(seconds) : null,
          metres && exercise.measure === 'distance'
            ? Math.round(metres)
            : metres
              ? Math.round(metres)
              : null,
          start,
          localDate(start),
          `From ${input.source === 'apple' ? 'Apple Health' : input.source === 'google' ? 'Health Connect' : 'the app'}${energy ? ` · ${energy} kcal` : ''}`,
          tx.actor.via,
          tx.actor.userId,
          tx.now,
          externalId,
        ],
      );
      workouts++;
    }
    return { days: touched.size, values, workouts };
  });
}

export interface HealthDay {
  day: string;
  values: Partial<Record<HealthKind, number>>;
}

export interface HealthSummary {
  from: string;
  to: string;
  days: HealthDay[];
  /** Averages of the last 7 days and the 7 before, per kind (weight: the latest reading instead). */
  week: Partial<Record<HealthKind, { now: number | null; before: number | null }>>;
  latest: Partial<Record<HealthKind, { value: number; day: string }>>;
  lastSync: Partial<Record<'apple' | 'google' | 'manual', string>>;
  insights: Array<{ tone: 'good' | 'watch' | 'info'; text: string }>;
}

export async function healthSummary(
  ctx: Ctx,
  userId: string,
  from: string,
  to: string,
): Promise<HealthSummary> {
  // A day with values from more than one source keeps one: the phone's, over what was typed.
  const { rows } = await ctx.db.query<{ day: string; kind: HealthKind; value: string }>(
    `SELECT DISTINCT ON (day, kind) to_char(day, 'YYYY-MM-DD') AS day, kind, value FROM health_days
      WHERE household_id = $1 AND user_id = $2 AND day BETWEEN $3 AND $4
      ORDER BY day, kind, CASE source WHEN 'manual' THEN 1 ELSE 0 END, updated_at DESC`,
    [ctx.actor.householdId, userId, from, to],
  );
  const sync = await ctx.db.query<{ source: 'apple' | 'google' | 'manual'; at: Date }>(
    'SELECT source, max(updated_at) AS at FROM health_days WHERE household_id = $1 AND user_id = $2 GROUP BY source',
    [ctx.actor.householdId, userId],
  );
  const byDay = new Map<string, HealthDay>();
  for (const row of rows) {
    const entry = byDay.get(row.day) ?? { day: row.day, values: {} };
    entry.values[row.kind] = Number(row.value);
    byDay.set(row.day, entry);
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  const latest: HealthSummary['latest'] = {};
  for (const d of days)
    for (const [kind, value] of Object.entries(d.values) as Array<[HealthKind, number]>)
      latest[kind] = { value, day: d.day };

  const average = (kind: HealthKind, first: string, last: string) => {
    const list = days
      .filter((d) => d.day >= first && d.day <= last && d.values[kind] !== undefined)
      .map((d) => d.values[kind]!);
    return list.length
      ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10
      : null;
  };
  const week: HealthSummary['week'] = {};
  for (const kind of HEALTH_KIND_LIST) {
    const now = average(kind, addDays(to, -6), to);
    const before = average(kind, addDays(to, -13), addDays(to, -7));
    if (now !== null || before !== null) week[kind] = { now, before };
  }
  return {
    from,
    to,
    days,
    week,
    latest,
    lastSync: Object.fromEntries(sync.rows.map((r) => [r.source, r.at.toISOString()])),
    insights: insights(days, week, to),
  };
}

/** Plain observations, not medical advice: changes week on week, and habits worth noticing. */
export function insights(
  days: HealthDay[],
  week: HealthSummary['week'],
  to: string,
): HealthSummary['insights'] {
  const out: HealthSummary['insights'] = [];
  const pct = (now: number, before: number) => Math.round(((now - before) / before) * 100);
  const steps = week.steps;
  if (steps?.now && steps.before) {
    const change = pct(steps.now, steps.before);
    if (Math.abs(change) >= 10)
      out.push({
        tone: change > 0 ? 'good' : 'watch',
        text: `Steps ${change > 0 ? 'up' : 'down'} ${Math.abs(change)}% on the week before (${Math.round(steps.now).toLocaleString('en')} a day)`,
      });
  }
  const lastWeek = days.filter((d) => d.day > addDays(to, -7));
  const nights = lastWeek.filter((d) => d.values.sleep !== undefined);
  const short = nights.filter((d) => d.values.sleep! < 7 * 60).length;
  if (nights.length >= 3 && short >= Math.ceil(nights.length / 2))
    out.push({
      tone: 'watch',
      text: `Under 7 hours’ sleep on ${short} of the last ${nights.length} nights`,
    });
  else if (nights.length >= 3 && short === 0)
    out.push({ tone: 'good', text: `7 hours or more every night this week` });
  const rhr = week.restingHeartRate;
  if (rhr?.now && rhr.before && Math.abs(rhr.now - rhr.before) >= 3) {
    out.push({
      tone: rhr.now < rhr.before ? 'good' : 'watch',
      text: `Resting heart rate ${rhr.now < rhr.before ? 'down' : 'up'} ${Math.round(Math.abs(rhr.now - rhr.before))} bpm on the week before${rhr.now > rhr.before ? ' — tiredness, a cold or stress can do that' : ''}`,
    });
  }
  const weights = days.filter((d) => d.values.weight !== undefined);
  if (weights.length >= 2) {
    const first = weights[0]!;
    const last = weights[weights.length - 1]!;
    const change = Math.round((last.values.weight! - first.values.weight!) * 10) / 10;
    if (Math.abs(change) >= 0.5)
      out.push({
        tone: 'info',
        text: `Weight ${change > 0 ? '+' : '−'}${Math.abs(change)} kg since ${first.day.slice(8)}.${first.day.slice(5, 7)}`,
      });
  }
  const active = lastWeek.filter((d) => (d.values.steps ?? 0) >= 8000).length;
  if (lastWeek.length >= 5 && active >= 5)
    out.push({ tone: 'good', text: `8,000 steps or more on ${active} of the last 7 days` });
  return out;
}

export const HealthQuery = z.object({ userId: idField.optional(), from: dateField, to: dateField });
