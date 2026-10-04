import type { FoodCtx as Ctx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { findExercise, listEquipment, pinsOf, type Exercise } from './library';
import {
  e1rm,
  listWorkouts,
  setsOn,
  trainingPeople,
  type TrainingSet,
  type WorkoutSummary,
} from './workouts';
import type { Muscle } from './catalog';

/**
 * How training adds up for one person: days trained, streaks, what each muscle got this week,
 * the exercises done most, and per exercise its history and personal bests.
 */

export interface DayActivity {
  day: string;
  sets: number;
  reps: number;
  seconds: number;
  distance: number;
  workouts: number;
  minutes: number;
}

export interface Stats {
  from: string;
  to: string;
  days: DayActivity[];
  totals: {
    activeDays: number;
    workouts: number;
    minutes: number;
    sets: number;
    reps: number;
    distance: number;
  };
  /** Sets per muscle: 1 for a main muscle, ½ for a helper. */
  muscles: Partial<Record<Muscle, number>>;
  top: Array<{
    exerciseId: string;
    name: string;
    icon: string;
    sets: number;
    reps: number;
    seconds: number;
    distance: number;
  }>;
  streak: { current: number; best: number; weeks: number };
}

export async function stats(
  ctx: Ctx,
  userId: string,
  from: string,
  to: string,
  today: string,
): Promise<Stats> {
  const [byDay, workouts, muscles, top, streak] = await Promise.all([
    ctx.db.query<{ day: string; sets: number; reps: number; seconds: number; distance: number }>(
      `SELECT to_char(day, 'YYYY-MM-DD') AS day, count(*)::int AS sets, coalesce(sum(reps), 0)::int AS reps,
              coalesce(sum(seconds), 0)::int AS seconds, coalesce(sum(distance), 0)::int AS distance
         FROM training_sets WHERE household_id = $1 AND user_id = $2 AND day BETWEEN $3 AND $4 GROUP BY day ORDER BY day`,
      [ctx.actor.householdId, userId, from, to],
    ),
    ctx.db.query<{ day: string; workouts: number; minutes: number }>(
      `SELECT to_char(date, 'YYYY-MM-DD') AS day, count(*)::int AS workouts, coalesce(round(sum(duration_seconds) / 60.0), 0)::int AS minutes
         FROM training_workouts WHERE household_id = $1 AND user_id = $2 AND status = 'done' AND date BETWEEN $3 AND $4 GROUP BY date`,
      [ctx.actor.householdId, userId, from, to],
    ),
    ctx.db.query<{ muscle: Muscle; sets: string }>(
      `SELECT m.muscle, sum(m.weight) AS sets FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id
         CROSS JOIN LATERAL (SELECT unnest(e.muscles) AS muscle, 1.0 AS weight UNION ALL SELECT unnest(e.secondary), 0.5) m
        WHERE s.household_id = $1 AND s.user_id = $2 AND s.day BETWEEN $3 AND $4 GROUP BY m.muscle`,
      [ctx.actor.householdId, userId, from, to],
    ),
    ctx.db.query<{
      exercise_id: string;
      name: string;
      icon: string;
      sets: number;
      reps: number;
      seconds: number;
      distance: number;
    }>(
      `SELECT s.exercise_id, e.name, e.icon, count(*)::int AS sets, coalesce(sum(s.reps), 0)::int AS reps, coalesce(sum(s.seconds), 0)::int AS seconds,
              coalesce(sum(s.distance), 0)::int AS distance
         FROM training_sets s JOIN training_exercises e ON e.id = s.exercise_id
        WHERE s.household_id = $1 AND s.user_id = $2 AND s.day BETWEEN $3 AND $4
        GROUP BY s.exercise_id, e.name, e.icon ORDER BY count(*) DESC, e.name LIMIT 8`,
      [ctx.actor.householdId, userId, from, to],
    ),
    streaks(ctx, userId, today),
  ]);

  const days = new Map<string, DayActivity>();
  const entry = (day: string) =>
    days.get(day) ?? { day, sets: 0, reps: 0, seconds: 0, distance: 0, workouts: 0, minutes: 0 };
  for (const row of byDay.rows)
    days.set(row.day, {
      ...entry(row.day),
      sets: row.sets,
      reps: row.reps,
      seconds: row.seconds,
      distance: row.distance,
    });
  for (const row of workouts.rows)
    days.set(row.day, { ...entry(row.day), workouts: row.workouts, minutes: row.minutes });
  // Sets logged on their own count their own time (a 2-minute plank is 2 minutes of training).
  for (const day of days.values())
    if (!day.workouts && day.seconds) day.minutes = Math.round(day.seconds / 60);
  const list = [...days.values()].sort((a, b) => a.day.localeCompare(b.day));

  return {
    from,
    to,
    days: list,
    totals: {
      activeDays: list.length,
      workouts: list.reduce((sum, d) => sum + d.workouts, 0),
      minutes: list.reduce((sum, d) => sum + d.minutes, 0),
      sets: list.reduce((sum, d) => sum + d.sets, 0),
      reps: list.reduce((sum, d) => sum + d.reps, 0),
      distance: list.reduce((sum, d) => sum + d.distance, 0),
    },
    muscles: Object.fromEntries(muscles.rows.map((row) => [row.muscle, Number(row.sets)])),
    top: top.rows.map((row) => ({
      exerciseId: row.exercise_id,
      name: row.name,
      icon: row.icon,
      sets: row.sets,
      reps: row.reps,
      seconds: row.seconds,
      distance: row.distance,
    })),
    streak,
  };
}

const dayNumber = (day: string) =>
  Math.round(
    Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) /
      86_400_000,
  );

/** Days in a row with any training (today not over yet: a streak through yesterday still counts), the best ever, and weeks in a row. */
async function streaks(
  ctx: Ctx,
  userId: string,
  today: string,
): Promise<{ current: number; best: number; weeks: number }> {
  const { rows } = await ctx.db.query<{ day: string }>(
    `SELECT DISTINCT to_char(day, 'YYYY-MM-DD') AS day FROM training_sets WHERE household_id = $1 AND user_id = $2
     UNION SELECT DISTINCT to_char(date, 'YYYY-MM-DD') FROM training_workouts WHERE household_id = $1 AND user_id = $2 AND status = 'done'
     ORDER BY day`,
    [ctx.actor.householdId, userId],
  );
  const numbers = [...new Set(rows.map((row) => dayNumber(row.day)))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < numbers.length; i++) {
    run = i > 0 && numbers[i] === numbers[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const todayN = dayNumber(today);
  const set = new Set(numbers);
  let current = 0;
  for (let n = set.has(todayN) ? todayN : todayN - 1; set.has(n); n--) current++;
  // Weeks (Monday to Sunday) in a row with at least one day: this week counts once it has one, and doesn't break it while it's young.
  const weekOf = (n: number) => Math.floor((n + 3) / 7); // day 0 (1970-01-01) was a Thursday
  const weeks = new Set(numbers.map(weekOf));
  let w = weeks.has(weekOf(todayN)) ? weekOf(todayN) : weekOf(todayN) - 1;
  let weekRun = 0;
  for (; weeks.has(w); w--) weekRun++;
  return { current, best, weeks: weekRun };
}

export interface ExerciseHistory {
  exercise: Exercise;
  bests: {
    reps: { value: number; day: string } | null;
    weight: { value: number; reps: number; day: string } | null;
    e1rm: { value: number; day: string } | null;
    seconds: { value: number; day: string } | null;
    distance: { value: number; seconds: number | null; day: string } | null;
  };
  /** Per day trained, newest first: the sets and the day's best (for the chart). */
  days: Array<{ day: string; sets: TrainingSet[]; best: number; volume: number }>;
  totals: { sets: number; reps: number; seconds: number; distance: number };
}

export async function exerciseHistory(
  ctx: Ctx,
  userId: string,
  exerciseId: string,
): Promise<ExerciseHistory> {
  const exercise = await findExercise(ctx, exerciseId);
  const { rows } = await ctx.db.query<{
    id: string;
    day: string;
    reps: number | null;
    weight: string | null;
    seconds: number | null;
    distance: number | null;
    side: 'left' | 'right' | null;
    performed_at: Date;
    workout_id: string | null;
    time_known: boolean;
    effort: number | null;
    note: string;
  }>(
    `SELECT id, to_char(day, 'YYYY-MM-DD') AS day, reps, weight, seconds, distance, side, performed_at, workout_id, time_known, effort, note
       FROM training_sets WHERE household_id = $1 AND user_id = $2 AND exercise_id = $3 ORDER BY performed_at DESC LIMIT 600`,
    [ctx.actor.householdId, userId, exerciseId],
  );
  const sets: TrainingSet[] = rows.map((row) => ({
    id: row.id,
    userId,
    exerciseId,
    exercise: exercise.name,
    icon: exercise.icon,
    workoutId: row.workout_id,
    itemIndex: null,
    round: null,
    setNumber: null,
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
  }));
  const bests: ExerciseHistory['bests'] = {
    reps: null,
    weight: null,
    e1rm: null,
    seconds: null,
    distance: null,
  };
  for (const s of [...sets].reverse()) {
    if (s.reps !== null && (!bests.reps || s.reps > bests.reps.value))
      bests.reps = { value: s.reps, day: s.day };
    if (s.weight && (!bests.weight || s.weight > bests.weight.value))
      bests.weight = { value: s.weight, reps: s.reps ?? 0, day: s.day };
    if (s.weight && s.reps) {
      const value = Math.round(e1rm(s.weight, s.reps) * 10) / 10;
      if (!bests.e1rm || value > bests.e1rm.value) bests.e1rm = { value, day: s.day };
    }
    if (
      s.seconds !== null &&
      exercise.measure === 'time' &&
      (!bests.seconds || s.seconds > bests.seconds.value)
    )
      bests.seconds = { value: s.seconds, day: s.day };
    if (s.distance && (!bests.distance || s.distance > bests.distance.value))
      bests.distance = { value: s.distance, seconds: s.seconds, day: s.day };
  }
  const byDay = new Map<string, TrainingSet[]>();
  for (const s of sets) byDay.set(s.day, [...(byDay.get(s.day) ?? []), s]);
  const metric = (s: TrainingSet) =>
    exercise.measure === 'time'
      ? (s.seconds ?? 0)
      : exercise.measure === 'distance'
        ? (s.distance ?? 0)
        : s.weight && s.reps
          ? e1rm(s.weight, s.reps)
          : (s.reps ?? 0);
  const days = [...byDay].map(([day, list]) => ({
    day,
    sets: list.reverse(),
    best: Math.round(Math.max(...list.map(metric)) * 10) / 10,
    volume: list.reduce(
      (sum, s) =>
        sum +
        (exercise.measure === 'reps'
          ? (s.reps ?? 0) * (s.weight || 1)
          : exercise.measure === 'time'
            ? (s.seconds ?? 0)
            : (s.distance ?? 0)),
      0,
    ),
  }));
  return {
    exercise,
    bests,
    days: days.slice(0, 60),
    totals: {
      sets: sets.length,
      reps: sets.reduce((sum, s) => sum + (s.reps ?? 0), 0),
      seconds: sets.reduce((sum, s) => sum + (s.seconds ?? 0), 0),
      distance: sets.reduce((sum, s) => sum + (s.distance ?? 0), 0),
    },
  };
}

// ---------------------------------------------------------------- the front page

export interface TrainingOverview {
  people: Array<{ id: string; name: string; surname: string }>;
  userId: string;
  today: string;
  /** Today's workouts, then the next planned one after today. */
  todays: WorkoutSummary[];
  next: WorkoutSummary | null;
  week: Array<{ day: string; workouts: WorkoutSummary[]; sets: number; minutes: number }>;
  streak: Stats['streak'];
  totals: Stats['totals'];
  /** Exercises kept at hand, with today's count of each. */
  pins: Array<{
    id: string;
    name: string;
    icon: string;
    measure: string;
    weighted: boolean;
    unilateral: boolean;
    reps: number | null;
    seconds: number | null;
    today: number;
  }>;
  /** Sets logged today, newest first (to undo a mis-tap). */
  loggedToday: TrainingSet[];
  equipment: number;
}

/** Monday of the week a day is in. */
export function weekStart(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function trainingOverview(
  ctx: Ctx,
  userId: string,
  today = localDate(ctx.now),
): Promise<TrainingOverview> {
  const monday = weekStart(today);
  const sunday = addDays(monday, 6);
  const [people, week, weekStats, upcoming, pins, equipment, loggedToday] = await Promise.all([
    trainingPeople(ctx),
    listWorkouts(ctx, { userId, from: monday, to: sunday }),
    stats(ctx, userId, monday, sunday, today),
    listWorkouts(ctx, { userId, from: addDays(today, 1), to: addDays(today, 60) }),
    pinnedToday(ctx, userId, today),
    listEquipment(ctx),
    setsOn(ctx, userId, today),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i)).map((day) => {
    const activity = weekStats.days.find((d) => d.day === day);
    return {
      day,
      workouts: week.filter((w) => w.date === day),
      sets: activity?.sets ?? 0,
      minutes: activity?.minutes ?? 0,
    };
  });
  return {
    people,
    userId,
    today,
    todays: week.filter((w) => w.date === today),
    next: upcoming.find((w) => w.status === 'planned') ?? null,
    week: days,
    streak: weekStats.streak,
    totals: weekStats.totals,
    pins,
    loggedToday: loggedToday.reverse(),
    equipment: equipment.length,
  };
}

async function pinnedToday(
  ctx: Ctx,
  userId: string,
  today: string,
): Promise<TrainingOverview['pins']> {
  const pins = await pinsOf(ctx, userId);
  if (!pins.size) return [];
  const { rows } = await ctx.db.query<{
    id: string;
    name: string;
    icon: string;
    measure: string;
    weighted: boolean;
    unilateral: boolean;
    reps: number | null;
    seconds: number | null;
    today: number;
  }>(
    `SELECT e.id, e.name, e.icon, e.measure, e.weighted, e.unilateral, e.reps, e.seconds,
            coalesce((SELECT CASE WHEN e.measure = 'time' THEN sum(s.seconds) ELSE sum(s.reps) END FROM training_sets s
                       WHERE s.user_id = $2 AND s.exercise_id = e.id AND s.day = $3), 0)::int AS today
       FROM training_pins p JOIN training_exercises e ON e.id = p.exercise_id
      WHERE p.user_id = $2 AND e.household_id = $1 AND e.archived_at IS NULL ORDER BY p.created_at`,
    [ctx.actor.householdId, userId, today],
  );
  return rows;
}
