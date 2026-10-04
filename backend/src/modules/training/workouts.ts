import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx as Ctx } from '../food/kitchen';
import { kitchenPeople } from '../food/restrictions';
import { setKcal, workoutKcal } from './energy';
import { localDate } from '../food/stock';
import { isUuid } from '../users';
import {
  describeExercise,
  exercisesById,
  ownItems,
  findExercise,
  listEquipment,
  pinsOf,
  type Equipment,
  type Exercise,
  type LibraryExercise,
} from './library';
import type {
  FinishInput,
  RoutineInput,
  RoutinePatch,
  SetInput,
  SetPatch,
  WorkoutInput,
  WorkoutItem,
  WorkoutPatch,
} from './schemas';

/**
 * Workouts and the sets done in them. A workout belongs to one person on one day: planned, then
 * under way once started (or once its first set is logged), then done or skipped. Sets are the
 * record of what was really done, in a workout or logged on their own — one push-up in passing
 * counts as much as a set in a planned workout, for the statistics and the personal bests.
 */

// ---------------------------------------------------------------- people

/** Someone in the household (the caller by default); anyone else is refused. */
export async function personId(ctx: Ctx, userId: string | undefined): Promise<string> {
  if (!userId || userId === ctx.actor.userId) return ctx.actor.userId;
  if (!isUuid(userId))
    throw new AppError(400, 'VALIDATION', 'That person isn’t in this household', {
      fields: { userId: 'Unknown person' },
    });
  const { rows } = await ctx.db.query('SELECT 1 FROM users WHERE id = $1 AND household_id = $2', [
    userId,
    ctx.actor.householdId,
  ]);
  if (!rows[0])
    throw new AppError(400, 'VALIDATION', 'That person isn’t in this household', {
      fields: { userId: 'Unknown person' },
    });
  return userId;
}

export const trainingPeople = kitchenPeople;

// ---------------------------------------------------------------- sets

export interface TrainingSet {
  id: string;
  userId: string;
  exerciseId: string;
  exercise: string;
  icon: string;
  workoutId: string | null;
  itemIndex: number | null;
  round: number | null;
  setNumber: number | null;
  side: 'left' | 'right' | null;
  reps: number | null;
  weight: number | null;
  seconds: number | null;
  distance: number | null;
  performedAt: string;
  day: string;
  timeKnown: boolean;
  effort: number | null;
  note: string;
  /** Grip, stance or band. */
  variant: string;
}

interface SetRow {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise: string;
  icon: string;
  workout_id: string | null;
  item_index: number | null;
  round: number | null;
  set_number: number | null;
  side: 'left' | 'right' | null;
  reps: number | null;
  weight: string | null;
  seconds: number | null;
  distance: number | null;
  performed_at: Date;
  day: string;
  time_known: boolean;
  effort: number | null;
  note: string;
  variant: string;
}

const SET_SELECT = `SELECT s.id, s.user_id, s.exercise_id, e.name AS exercise, e.icon, s.workout_id, s.item_index, s.round, s.set_number, s.side,
       s.reps, s.weight, s.seconds, s.distance, s.performed_at, to_char(s.day, 'YYYY-MM-DD') AS day, s.time_known, s.effort, s.note, s.variant
  FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id`;

const toSet = (row: SetRow): TrainingSet => ({
  id: row.id,
  userId: row.user_id,
  exerciseId: row.exercise_id,
  exercise: row.exercise,
  icon: row.icon,
  workoutId: row.workout_id,
  itemIndex: row.item_index,
  round: row.round,
  setNumber: row.set_number,
  side: row.side,
  reps: row.reps,
  weight: row.weight === null ? null : Number(row.weight),
  seconds: row.seconds,
  distance: row.distance,
  performedAt: row.performed_at.toISOString(),
  day: row.day,
  timeKnown: row.time_known,
  effort: row.effort,
  note: row.note,
  variant: row.variant,
});

/** A personal best one set can set. */
export type RecordKind = 'reps' | 'weight' | 'e1rm' | 'seconds' | 'distance';

/** Estimated one-rep max (Epley), the fairest way to compare 5 × 20 kg with 12 × 15 kg. */
export const e1rm = (weight: number, reps: number) =>
  reps <= 0 ? 0 : reps === 1 ? weight : weight * (1 + reps / 30);

interface Bests {
  reps: number;
  weight: number;
  e1rm: number;
  seconds: number;
  distance: number;
}

async function bestsBefore(
  ctx: Ctx,
  userId: string,
  exerciseId: string,
  exceptId: string | null,
): Promise<Bests & { count: number }> {
  const { rows } = await ctx.db.query<{
    count: number;
    reps: number | null;
    weight: string | null;
    e1rm: string | null;
    seconds: number | null;
    distance: number | null;
  }>(
    `SELECT count(*)::int AS count, max(reps) AS reps, max(weight) AS weight,
            max(CASE WHEN weight > 0 AND reps > 0 THEN CASE WHEN reps = 1 THEN weight ELSE weight * (1 + reps / 30.0) END END) AS e1rm,
            max(seconds) AS seconds, max(distance) AS distance
       FROM training_sets WHERE user_id = $1 AND exercise_id = $2 AND ($3::uuid IS NULL OR id <> $3)`,
    [userId, exerciseId, exceptId],
  );
  const row = rows[0]!;
  return {
    count: row.count,
    reps: row.reps ?? 0,
    weight: Number(row.weight ?? 0),
    e1rm: Number(row.e1rm ?? 0),
    seconds: row.seconds ?? 0,
    distance: row.distance ?? 0,
  };
}

/** Which bests this set beat. The very first set of an exercise sets none: there was nothing to beat. */
function recordsOf(
  set: TrainingSet,
  before: Bests & { count: number },
  exercise: Exercise,
): RecordKind[] {
  if (before.count === 0) return [];
  const found: RecordKind[] = [];
  if (exercise.measure === 'reps' && set.reps !== null) {
    if (set.weight && set.weight > before.weight) found.push('weight');
    else if (
      set.reps > before.reps &&
      (!exercise.weighted || !set.weight || set.weight >= before.weight)
    )
      found.push('reps');
    if (
      set.weight &&
      set.reps &&
      e1rm(set.weight, set.reps) > before.e1rm + 0.01 &&
      !found.includes('weight')
    )
      found.push('e1rm');
  }
  if (exercise.measure === 'time' && set.seconds !== null && set.seconds > before.seconds)
    found.push('seconds');
  if (exercise.measure === 'distance' && set.distance !== null && set.distance > before.distance)
    found.push('distance');
  return found;
}

async function findSet(ctx: Ctx, id: string): Promise<TrainingSet> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Set not found');
  const { rows } = await ctx.db.query<SetRow>(
    `${SET_SELECT} WHERE s.id = $1 AND s.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Set not found');
  return toSet(rows[0]);
}

/**
 * Logs one set. With a workout it's part of it (and starts it, if it was only planned); without,
 * it's a set on its own: now, at a time given, or just on a day ("sometime yesterday").
 */
export async function logSet(
  ctx: Ctx,
  input: SetInput,
  workoutId: string | null = null,
): Promise<{ set: TrainingSet; records: RecordKind[] }> {
  return ctx.tx(async (tx) => {
    // The workout first: one that isn't the household's is simply not found.
    const workout = workoutId ? await lockWorkout(tx, workoutId) : null;
    if (workout?.status === 'skipped')
      throw new AppError(409, 'SKIPPED', 'That workout was skipped; plan it again first');
    const userId = workout ? workout.user_id : await personId(tx, input.userId);
    // Someone else's exercise (logging for a son from the mother's list) is his own one of the same.
    const owned = await ownItems(tx, userId, [{ exerciseId: input.exerciseId, sets: 1 }]).catch(
      () => {
        throw new AppError(400, 'VALIDATION', 'Unknown exercise', {
          fields: { exerciseId: 'Unknown exercise' },
        });
      },
    );
    const exercise = owned.exercises.get(owned.items[0]!.exerciseId)!;
    // The app's id for the set: a retry after a lost answer finds the set already there.
    const externalId = input.clientId ? `app:${input.clientId}` : null;
    if (externalId) {
      const { rows: existing } = await tx.db.query<{ id: string }>(
        'SELECT id FROM training_sets WHERE user_id = $1 AND external_id = $2',
        [userId, externalId],
      );
      if (existing[0]) return { set: await findSet(tx, existing[0].id), records: [] };
    }
    const at = input.at ? new Date(input.at) : input.day ? noonOf(input.day) : tx.now;
    if (at.getTime() > tx.now.getTime() + 5 * 60_000)
      throw new AppError(400, 'VALIDATION', 'That time hasn’t come yet', {
        fields: { at: 'In the future' },
      });
    const day = input.day ?? localDate(at);
    const before = await bestsBefore(tx, userId, exercise.id, null);
    const { rows } = await tx.db.query<{ id: string }>(
      `INSERT INTO training_sets (id, household_id, user_id, exercise_id, workout_id, item_index, round, set_number, side, reps, weight, seconds,
                                  distance, performed_at, day, time_known, effort, note, via, created_by, created_at, variant, external_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING id`,
      [
        randomUUID(),
        tx.actor.householdId,
        userId,
        exercise.id,
        workoutId,
        input.itemIndex ?? null,
        input.round ?? null,
        input.setNumber ?? null,
        input.side ?? null,
        input.reps ?? null,
        input.weight ?? null,
        input.seconds ?? null,
        input.distance ?? null,
        at,
        day,
        !input.day || Boolean(input.at),
        input.effort ?? null,
        input.note ?? '',
        tx.actor.via,
        tx.actor.userId,
        tx.now,
        input.variant ?? '',
        externalId,
      ],
    );
    if (workout && workout.status === 'planned') {
      await tx.db.query(
        `UPDATE training_workouts SET status = 'active', started_at = coalesce(started_at, $2), updated_at = $2 WHERE id = $1`,
        [workout.id, tx.now],
      );
    }
    const set = await findSet(tx, rows[0]!.id);
    return { set, records: recordsOf(set, before, exercise) };
  });
}

/** Noon on a day, local time: a set from "sometime that day" sorts into the middle of it. */
function noonOf(day: string): Date {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12, 0, 0);
}

export async function updateSet(ctx: Ctx, id: string, patch: SetPatch): Promise<TrainingSet> {
  const current = await findSet(ctx, id);
  const next = { ...current, ...patch };
  if (next.reps === null && next.seconds === null && next.distance === null)
    throw new AppError(400, 'VALIDATION', 'Say how many, how long or how far');
  await ctx.db.query(
    'UPDATE training_sets SET reps = $3, weight = $4, seconds = $5, distance = $6, effort = $7, note = $8, variant = $9 WHERE id = $1 AND household_id = $2',
    [
      id,
      ctx.actor.householdId,
      next.reps,
      next.weight,
      next.seconds,
      next.distance,
      next.effort,
      next.note,
      next.variant,
    ],
  );
  return findSet(ctx, id);
}

export async function removeSet(ctx: Ctx, id: string): Promise<void> {
  await findSet(ctx, id);
  await ctx.db.query('DELETE FROM training_sets WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

export async function setsOn(ctx: Ctx, userId: string, day: string): Promise<TrainingSet[]> {
  const { rows } = await ctx.db.query<SetRow>(
    `${SET_SELECT} WHERE s.household_id = $1 AND s.user_id = $2 AND s.day = $3 ORDER BY s.performed_at`,
    [ctx.actor.householdId, userId, day],
  );
  return rows.map(toSet);
}

// ---------------------------------------------------------------- last time, and what to aim for

export interface LastTime {
  day: string;
  sets: Array<{
    reps: number | null;
    weight: number | null;
    seconds: number | null;
    distance: number | null;
    side: 'left' | 'right' | null;
    variant: string;
  }>;
}

export interface Suggestion {
  reps?: number;
  weight?: number;
  seconds?: number;
  distance?: number;
  text: string;
}

/** The most recent day this person did the exercise (outside the given workout). */
async function lastTimes(
  ctx: Ctx,
  userId: string,
  exerciseIds: string[],
  exceptWorkout: string | null,
): Promise<Map<string, LastTime>> {
  if (!exerciseIds.length) return new Map();
  const { rows } = await ctx.db.query<{
    exercise_id: string;
    day: string;
    reps: number | null;
    weight: string | null;
    seconds: number | null;
    distance: number | null;
    side: 'left' | 'right' | null;
    variant: string;
  }>(
    `WITH last AS (
       SELECT exercise_id, max(day) AS day FROM training_sets
        WHERE user_id = $1 AND exercise_id = ANY($2::uuid[]) AND ($3::uuid IS NULL OR workout_id IS DISTINCT FROM $3)
        GROUP BY exercise_id)
     SELECT s.exercise_id, to_char(s.day, 'YYYY-MM-DD') AS day, s.reps, s.weight, s.seconds, s.distance, s.side, s.variant
       FROM training_sets s JOIN last l ON l.exercise_id = s.exercise_id AND l.day = s.day
      WHERE s.user_id = $1 AND ($3::uuid IS NULL OR s.workout_id IS DISTINCT FROM $3)
      ORDER BY s.performed_at`,
    [userId, exerciseIds, exceptWorkout],
  );
  const found = new Map<string, LastTime>();
  for (const row of rows) {
    const entry = found.get(row.exercise_id) ?? { day: row.day, sets: [] };
    entry.sets.push({
      reps: row.reps,
      weight: row.weight === null ? null : Number(row.weight),
      seconds: row.seconds,
      distance: row.distance,
      side: row.side,
      variant: row.variant,
    });
    found.set(row.exercise_id, entry);
  }
  return found;
}

/**
 * Double progression: hit the target in every set → one more rep next time; well past it with a
 * heavier weight at home → that weight, back at the target reps. Missed it → match it first.
 */
export function suggest(
  item: WorkoutItem,
  exercise: LibraryExercise,
  last: LastTime | undefined,
): Suggestion | null {
  if (!last?.sets.length) return null;
  // Warm-ups, cool-downs and stretches are for the body, not for records.
  if (
    (item.block ?? 'main') !== 'main' ||
    exercise.category === 'mobility' ||
    exercise.category === 'stretch'
  )
    return null;
  // A wide-grip target is measured against wide-grip sets, when there were any.
  const same = item.variant ? last.sets.filter((s) => s.variant === item.variant) : [];
  const sets = same.length ? same : last.sets;
  if (exercise.measure === 'reps' && item.reps) {
    const reps = sets.map((s) => s.reps ?? 0);
    const worst = Math.min(...reps);
    const weight = Math.max(...sets.map((s) => s.weight ?? 0));
    if (worst >= item.reps) {
      const heavier = exercise.weights.find((w) => w.kg > Math.max(weight, item.weight ?? 0));
      if (exercise.weighted && heavier && worst >= item.reps + 3)
        return {
          weight: heavier.kg,
          reps: item.reps,
          text: `Last time ${reps.join(', ')}${weight ? ` at ${weight} kg` : ''} · next: ${heavier.kg} kg`,
        };
      return {
        reps: worst + 1,
        ...(weight ? { weight } : {}),
        text: `Last time ${reps.join(', ')} · next: ${worst + 1}`,
      };
    }
    return {
      reps: worst,
      ...(weight ? { weight } : {}),
      text: `Last time ${reps.join(', ')}`,
    };
  }
  if (exercise.measure === 'time' && item.seconds) {
    const worst = Math.min(...sets.map((s) => s.seconds ?? 0));
    if (worst >= item.seconds)
      return {
        seconds: worst + 5,
        text: `Last time ${sets.map((x) => `${x.seconds ?? 0} s`).join(', ')} · next: ${worst + 5} s`,
      };
    return null;
  }
  if (exercise.measure === 'distance') {
    const best = Math.max(...sets.map((s) => s.distance ?? 0));
    const time = sets.find((s) => s.distance === best)?.seconds;
    return best
      ? {
          distance: best,
          text: time
            ? `Last time ${(best / 1000).toFixed(1)} km in ${Math.round(time / 60)} min`
            : `Last time ${(best / 1000).toFixed(1)} km`,
        }
      : null;
  }
  return null;
}

// ---------------------------------------------------------------- routines

export interface Routine {
  id: string;
  /** Whose program it is. */
  userId: string;
  name: string;
  note: string;
  items: WorkoutItem[];
  rounds: number;
  roundRest: number;
  exercises: Array<{ id: string; name: string; icon: string; available: boolean }>;
  estimatedSeconds: number;
  updatedAt: string;
}

interface RoutineRow {
  id: string;
  user_id: string;
  name: string;
  note: string;
  items: WorkoutItem[];
  rounds: number;
  round_rest: number;
  updated_at: Date;
}

async function describeRoutines(ctx: Ctx, rows: RoutineRow[]): Promise<Routine[]> {
  const ids = rows.flatMap((row) => row.items.map((item) => item.exerciseId));
  const exercises = ids.length
    ? await exercisesById(ctx, ids).catch(() => new Map<string, Exercise>())
    : new Map<string, Exercise>();
  const equipment = await listEquipment(ctx);
  return rows.map((row) => {
    const library = row.items
      .map((item) => exercises.get(item.exerciseId))
      .filter((e): e is Exercise => Boolean(e))
      .map((e) => describeExercise(e, equipment, new Set()));
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      note: row.note,
      items: row.items,
      rounds: row.rounds,
      roundRest: row.round_rest,
      exercises: library.map((e) => ({
        id: e.id,
        name: e.name,
        icon: e.icon,
        available: e.available,
      })),
      estimatedSeconds: estimate(row.items, row.rounds, row.round_rest, exercises),
      updatedAt: row.updated_at.toISOString(),
    };
  });
}

const ROUTINE_COLUMNS = 'id, user_id, name, note, items, rounds, round_rest, updated_at';

/** One person's saved programs (everyone's with null). */
export async function listRoutines(ctx: Ctx, userId: string | null): Promise<Routine[]> {
  const { rows } = await ctx.db.query<RoutineRow>(
    `SELECT ${ROUTINE_COLUMNS} FROM training_routines WHERE household_id = $1 AND ($2::uuid IS NULL OR user_id = $2) ORDER BY updated_at DESC`,
    [ctx.actor.householdId, userId],
  );
  return describeRoutines(ctx, rows);
}

async function findRoutine(ctx: Ctx, id: string): Promise<RoutineRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Routine not found');
  const { rows } = await ctx.db.query<RoutineRow>(
    `SELECT ${ROUTINE_COLUMNS} FROM training_routines WHERE id = $1 AND household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Routine not found');
  return rows[0];
}

export async function createRoutine(ctx: Ctx, input: RoutineInput): Promise<Routine> {
  const userId = await personId(ctx, input.userId);
  const { items } = await ownItems(ctx, userId, input.items);
  const { rows } = await ctx.db.query<RoutineRow>(
    `INSERT INTO training_routines (id, household_id, user_id, name, note, items, rounds, round_rest, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10) RETURNING ${ROUTINE_COLUMNS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      userId,
      input.name,
      input.note ?? '',
      JSON.stringify(items),
      input.rounds ?? 1,
      input.roundRest ?? 60,
      ctx.actor.userId,
      ctx.now,
    ],
  );
  return (await describeRoutines(ctx, rows))[0]!;
}

export async function updateRoutine(ctx: Ctx, id: string, patch: RoutinePatch): Promise<Routine> {
  const current = await findRoutine(ctx, id);
  const items = patch.items
    ? (await ownItems(ctx, current.user_id, patch.items)).items
    : current.items;
  const { rows } = await ctx.db.query<RoutineRow>(
    `UPDATE training_routines SET name = $3, note = $4, items = $5, rounds = $6, round_rest = $7, updated_at = $8
      WHERE id = $1 AND household_id = $2 RETURNING ${ROUTINE_COLUMNS}`,
    [
      id,
      ctx.actor.householdId,
      patch.name ?? current.name,
      patch.note ?? current.note,
      JSON.stringify(items),
      patch.rounds ?? current.rounds,
      patch.roundRest ?? current.round_rest,
      ctx.now,
    ],
  );
  return (await describeRoutines(ctx, rows))[0]!;
}

export async function removeRoutine(ctx: Ctx, id: string): Promise<void> {
  await findRoutine(ctx, id);
  await ctx.db.query('DELETE FROM training_routines WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

// ---------------------------------------------------------------- workouts

export type WorkoutStatus = 'planned' | 'active' | 'done' | 'skipped';

export interface WorkoutItemView extends WorkoutItem {
  rest: number;
  exercise: LibraryExercise;
  last: LastTime | null;
  suggest: Suggestion | null;
}

export interface WorkoutSummary {
  id: string;
  userId: string;
  person: string;
  date: string;
  time: string | null;
  title: string;
  routineId: string | null;
  status: WorkoutStatus;
  startedAt: string | null;
  finishedAt: string | null;
  durationSeconds: number | null;
  feeling: number | null;
  note: string;
  rounds: number;
  roundRest: number;
  /** Sets planned (items × sets × rounds) and done. */
  setsPlanned: number;
  setsDone: number;
  estimatedSeconds: number;
  exercises: Array<{ id: string; name: string; icon: string }>;
  /** Equipment it needs that the household doesn't have. */
  missing: string[];
}

export interface Workout extends WorkoutSummary {
  items: WorkoutItemView[];
  sets: TrainingSet[];
  /** Energy it costs (gross, Compendium METs × weight × time): what the sets done cost, or before
   * any is done, what the plan should. */
  kcal: number;
  kcalSource: 'done' | 'planned';
}

interface WorkoutRow {
  id: string;
  user_id: string;
  person: string;
  date: string;
  time: string | null;
  title: string;
  routine_id: string | null;
  items: WorkoutItem[];
  rounds: number;
  round_rest: number;
  status: WorkoutStatus;
  started_at: Date | null;
  finished_at: Date | null;
  duration_seconds: number | null;
  feeling: number | null;
  note: string;
  sets_done: number;
}

const WORKOUT_SELECT = `SELECT w.id, w.user_id, u.name AS person, to_char(w.date, 'YYYY-MM-DD') AS date, w.time, w.title, w.routine_id, w.items, w.rounds,
       w.round_rest, w.status, w.started_at, w.finished_at, w.duration_seconds, w.feeling, w.note,
       (SELECT count(*)::int FROM training_sets s WHERE s.workout_id = w.id) AS sets_done
  FROM training_workouts w JOIN users u ON u.id = w.user_id`;

/** About how long a list takes: each set's work (reps at ~3 s, both sides for one-sided moves) plus its rest. */
export function estimate(
  items: WorkoutItem[],
  rounds: number,
  roundRest: number,
  exercises: Map<string, Exercise>,
): number {
  let seconds = 0;
  for (const item of items) {
    const times = isMain(item) ? rounds : 1;
    const exercise = exercises.get(item.exerciseId);
    const sides = exercise?.unilateral ? 2 : 1;
    const work =
      item.seconds ??
      exercise?.seconds ??
      ((item.distance ?? exercise?.distance)
        ? Math.round((item.distance ?? exercise!.distance!) / 2.7)
        : (item.reps ?? exercise?.reps ?? 10) * 3);
    const rest = item.rest ?? exercise?.rest ?? 60;
    seconds += times * item.sets * (work * sides + rest);
  }
  return Math.round(seconds + roundRest * Math.max(0, rounds - 1));
}

/** Rounds repeat the main block; warm-up and cool-down are done once. */
export const isMain = (item: WorkoutItem) => (item.block ?? 'main') === 'main';

function summarize(
  row: WorkoutRow,
  exercises: Map<string, Exercise>,
  owned: Equipment[],
): WorkoutSummary {
  const ownedKinds = new Set(owned.filter((e) => e.count > 0).map((e) => e.kind));
  const missing = new Set<string>();
  for (const item of row.items) {
    const needs = exercises.get(item.exerciseId)?.equipment ?? [];
    if (needs.length && !needs.some((option) => option.every((kind) => ownedKinds.has(kind))))
      needs[0]!.filter((kind) => !ownedKinds.has(kind)).forEach((kind) => missing.add(kind));
  }
  return {
    id: row.id,
    userId: row.user_id,
    person: row.person,
    date: row.date,
    time: row.time,
    title: row.title,
    routineId: row.routine_id,
    status: row.status,
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    feeling: row.feeling,
    note: row.note,
    rounds: row.rounds,
    roundRest: row.round_rest,
    setsPlanned: row.items.reduce(
      (sum, item) =>
        sum +
        item.sets *
          (exercises.get(item.exerciseId)?.unilateral ? 2 : 1) *
          (isMain(item) ? row.rounds : 1),
      0,
    ),
    setsDone: row.sets_done,
    estimatedSeconds: estimate(row.items, row.rounds, row.round_rest, exercises),
    exercises: row.items
      .map((item) => exercises.get(item.exerciseId))
      .filter((e): e is Exercise => Boolean(e))
      .map((e) => ({ id: e.id, name: e.name, icon: e.icon })),
    missing: [...missing],
  };
}

async function exercisesOf(ctx: Ctx, rows: WorkoutRow[]): Promise<Map<string, Exercise>> {
  const ids = [...new Set(rows.flatMap((row) => row.items.map((item) => item.exerciseId)))];
  if (!ids.length) return new Map();
  return exercisesById(ctx, ids).catch(async () => {
    // An item whose exercise is gone (shouldn't happen: exercises are archived, not deleted): skip it.
    const map = new Map<string, Exercise>();
    for (const id of ids) {
      const found = await findExercise(ctx, id).catch(() => null);
      if (found) map.set(id, found);
    }
    return map;
  });
}

/** What a planned workout should cost: every set at its target, plus the rests between. */
async function plannedKcal(
  ctx: Ctx,
  userId: string,
  items: WorkoutItemView[],
  rounds: number,
  roundRest: number,
): Promise<number> {
  const { rows } = await ctx.db.query<{ value: string }>(
    `SELECT value FROM health_days WHERE user_id = $1 AND kind = 'weight' ORDER BY day DESC LIMIT 1`,
    [userId],
  );
  const kg = rows[0] ? Number(rows[0].value) : 70;
  let kcal = 0;
  for (const item of items) {
    const times = item.sets * (item.exercise.unilateral ? 2 : 1) * (isMain(item) ? rounds : 1);
    const set = {
      preset: item.exercise.preset,
      category: item.exercise.category,
      measure: item.exercise.measure,
      unilateral: item.exercise.unilateral,
      reps: item.reps ?? null,
      seconds: item.seconds ?? null,
      distance: item.distance ?? null,
      effort: null,
      side: null,
    };
    kcal += times * setKcal(set, kg) + (times * item.rest * 1.3 * kg) / 3600;
  }
  kcal += (Math.max(0, rounds - 1) * roundRest * 1.3 * kg) / 3600;
  return Math.round(kcal);
}

export async function listWorkouts(
  ctx: Ctx,
  options: { userId?: string | null; from: string; to: string },
): Promise<WorkoutSummary[]> {
  const { rows } = await ctx.db.query<WorkoutRow>(
    `${WORKOUT_SELECT} WHERE w.household_id = $1 AND ($2::uuid IS NULL OR w.user_id = $2) AND w.date BETWEEN $3 AND $4
      ORDER BY w.date, w.time NULLS LAST, w.created_at`,
    [ctx.actor.householdId, options.userId ?? null, options.from, options.to],
  );
  const [exercises, equipment] = await Promise.all([exercisesOf(ctx, rows), listEquipment(ctx)]);
  return rows.map((row) => summarize(row, exercises, equipment));
}

async function lockWorkout(ctx: Ctx, id: string): Promise<WorkoutRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Workout not found');
  const { rows } = await ctx.db.query<WorkoutRow>(
    `${WORKOUT_SELECT} WHERE w.id = $1 AND w.household_id = $2 FOR UPDATE OF w`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Workout not found');
  return rows[0];
}

export async function getWorkout(ctx: Ctx, id: string): Promise<Workout> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Workout not found');
  const { rows } = await ctx.db.query<WorkoutRow>(
    `${WORKOUT_SELECT} WHERE w.id = $1 AND w.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  const row = rows[0];
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Workout not found');
  const [exercises, equipment, pins, sets] = await Promise.all([
    exercisesOf(ctx, [row]),
    listEquipment(ctx),
    pinsOf(ctx, row.user_id),
    ctx.db.query<SetRow>(`${SET_SELECT} WHERE s.workout_id = $1 ORDER BY s.performed_at`, [id]),
  ]);
  const last = await lastTimes(ctx, row.user_id, [...exercises.keys()], id);
  const items = row.items
    .filter((item) => exercises.has(item.exerciseId))
    .map((item): WorkoutItemView => {
      const exercise = describeExercise(exercises.get(item.exerciseId)!, equipment, pins);
      return {
        ...item,
        rest: item.rest ?? exercise.rest,
        exercise,
        last: last.get(item.exerciseId) ?? null,
        suggest: suggest(item, exercise, last.get(item.exerciseId)),
      };
    });
  const done = sets.rows.map(toSet);
  const kcal = done.length
    ? await workoutKcal(ctx, id, row.user_id, row.status === 'done' ? row.duration_seconds : null)
    : await plannedKcal(ctx, row.user_id, items, row.rounds, row.round_rest);
  return {
    ...summarize(row, exercises, equipment),
    items,
    sets: done,
    kcal,
    kcalSource: done.length ? 'done' : 'planned',
  };
}

/** Each item's target filled from its exercise where the plan left it open. */
function withDefaults(items: WorkoutItem[], exercises: Map<string, Exercise>): WorkoutItem[] {
  return items.map((item) => {
    const exercise = exercises.get(item.exerciseId)!;
    const target =
      exercise.measure === 'reps'
        ? { reps: item.reps ?? exercise.reps ?? 10 }
        : exercise.measure === 'time'
          ? { seconds: item.seconds ?? exercise.seconds ?? 30 }
          : { distance: item.distance ?? exercise.distance ?? 1000 };
    return { ...item, ...target, rest: item.rest ?? exercise.rest };
  });
}

function titleFor(items: WorkoutItem[], exercises: Map<string, Exercise>): string {
  const names = items
    .map((item) => exercises.get(item.exerciseId)?.name)
    .filter(Boolean) as string[];
  if (!names.length) return 'Workout';
  return names.length <= 2 ? names.join(' + ') : `${names[0]}, ${names[1]} +${names.length - 2}`;
}

export async function createWorkout(ctx: Ctx, input: WorkoutInput): Promise<Workout> {
  const userId = await personId(ctx, input.userId);
  let items = input.items ?? [];
  let rounds = input.rounds;
  let roundRest = input.roundRest;
  let title = input.title;
  let note = input.note ?? '';
  if (input.routineId) {
    const routine = await findRoutine(ctx, input.routineId).catch(() => {
      throw new AppError(400, 'VALIDATION', 'Unknown routine', {
        fields: { routineId: 'Unknown routine' },
      });
    });
    if (!input.items) items = routine.items;
    rounds ??= routine.rounds;
    roundRest ??= routine.round_rest;
    title ??= routine.name;
    if (!input.note) note = routine.note;
  }
  const owned = await ownItems(ctx, userId, items);
  items = owned.items;
  const exercises = owned.exercises;
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO training_workouts (id, household_id, user_id, date, time, title, routine_id, items, rounds, round_rest, note, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
    [
      id,
      ctx.actor.householdId,
      userId,
      input.date,
      input.time ?? null,
      title ?? titleFor(items, exercises),
      input.routineId ?? null,
      JSON.stringify(withDefaults(items, exercises)),
      rounds ?? 1,
      roundRest ?? 60,
      note,
      ctx.actor.userId,
      ctx.now,
    ],
  );
  return getWorkout(ctx, id);
}

export async function updateWorkout(ctx: Ctx, id: string, patch: WorkoutPatch): Promise<Workout> {
  await ctx.tx(async (tx) => {
    const current = await lockWorkout(tx, id);
    let items = current.items;
    if (patch.items) {
      const owned = await ownItems(tx, current.user_id, patch.items);
      items = withDefaults(owned.items, owned.exercises);
    }
    let status = current.status;
    let startedAt = current.started_at;
    let finishedAt = current.finished_at;
    let duration = current.duration_seconds;
    if (patch.status === 'skipped') {
      if (current.status === 'done')
        throw new AppError(409, 'DONE', 'That workout is done; plan it again first');
      status = 'skipped';
    } else if (patch.status === 'planned') {
      // Planned again: from skipped, or reopened after done. Sets already logged stay: they happened.
      status = current.sets_done ? 'active' : 'planned';
      finishedAt = null;
      duration = null;
      if (!current.sets_done) startedAt = null;
    }
    await tx.db.query(
      `UPDATE training_workouts SET date = $3, time = $4, title = $5, items = $6, rounds = $7, round_rest = $8, note = $9, status = $10,
              started_at = $11, finished_at = $12, duration_seconds = $13, updated_at = $14
        WHERE id = $1 AND household_id = $2`,
      [
        id,
        tx.actor.householdId,
        patch.date ?? current.date,
        patch.time === undefined ? current.time : patch.time,
        patch.title ?? current.title,
        JSON.stringify(items),
        patch.rounds ?? current.rounds,
        patch.roundRest ?? current.round_rest,
        patch.note ?? current.note,
        status,
        startedAt,
        finishedAt,
        duration,
        tx.now,
      ],
    );
  });
  return getWorkout(ctx, id);
}

export async function startWorkout(ctx: Ctx, id: string): Promise<Workout> {
  await ctx.tx(async (tx) => {
    const current = await lockWorkout(tx, id);
    if (current.status === 'done') throw new AppError(409, 'DONE', 'That workout is already done');
    await tx.db.query(
      `UPDATE training_workouts SET status = 'active', started_at = coalesce(started_at, $2), updated_at = $2 WHERE id = $1`,
      [id, tx.now],
    );
  });
  return getWorkout(ctx, id);
}

export async function finishWorkout(ctx: Ctx, id: string, input: FinishInput): Promise<Workout> {
  await ctx.tx(async (tx) => {
    const current = await lockWorkout(tx, id);
    if (current.status === 'done') throw new AppError(409, 'DONE', 'That workout is already done');
    if (!current.sets_done)
      throw new AppError(409, 'NOTHING_DONE', 'Log at least one set first, or skip the workout');
    const started = current.started_at ?? tx.now;
    const duration =
      input.durationSeconds ??
      Math.max(0, Math.round((tx.now.getTime() - started.getTime()) / 1000));
    await tx.db.query(
      `UPDATE training_workouts SET status = 'done', started_at = $2, finished_at = $3, duration_seconds = $4, feeling = $5, note = $6, updated_at = $3 WHERE id = $1`,
      [id, started, tx.now, duration, input.feeling ?? current.feeling, input.note ?? current.note],
    );
  });
  return getWorkout(ctx, id);
}

export async function removeWorkout(ctx: Ctx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    await lockWorkout(tx, id);
    await tx.db.query('DELETE FROM training_workouts WHERE id = $1 AND household_id = $2', [
      id,
      tx.actor.householdId,
    ]);
  });
}

/** A planned workout copied to another day (or person): same exercises, nothing done yet. */
export async function copyWorkout(
  ctx: Ctx,
  id: string,
  target: { date: string; userId?: string },
): Promise<Workout> {
  const source = await getWorkout(ctx, id);
  return createWorkout(ctx, {
    userId: target.userId ?? source.userId,
    date: target.date,
    time: source.time,
    title: source.title,
    items: source.items.map(({ exercise: _e, last: _l, suggest: _s, ...item }) => item),
    rounds: source.rounds,
    roundRest: source.roundRest,
    note: source.note,
  });
}
