import type { FoodCtx as Ctx } from '../food/kitchen';
import type { Muscle } from './catalog';
import { listExercises, type LibraryExercise } from './library';
import type { Focus, GenerateInput, WorkoutItem } from './schemas';
import { estimate } from './workouts';

/**
 * A workout made up on the spot from what the household owns: a short warm-up, the main block for
 * the focus (filled to the minutes asked for), a short cool-down. "Quiet" leaves out jumping.
 * The person's own history decides the weight: what they lifted last, else the middle of what's at home.
 */

/** Movement slots per focus, in order; each slot takes one exercise hitting one of its muscles. */
const SLOTS: Record<Focus, Muscle[][]> = {
  full: [
    ['quads', 'glutes'],
    ['chest'],
    ['back'],
    ['hamstrings', 'glutes'],
    ['shoulders'],
    ['core'],
    ['heart'],
    ['obliques'],
    ['triceps', 'biceps'],
  ],
  upper: [
    ['chest'],
    ['back'],
    ['shoulders'],
    ['triceps'],
    ['biceps'],
    ['core'],
    ['chest'],
    ['back'],
  ],
  lower: [
    ['quads'],
    ['hamstrings', 'glutes'],
    ['quads', 'glutes'],
    ['glutes'],
    ['calves'],
    ['core'],
  ],
  core: [['core'], ['obliques'], ['core'], ['back'], ['core'], ['obliques']],
  cardio: [['heart'], ['heart'], ['heart'], ['heart'], ['heart'], ['heart']],
  mobility: [['back'], ['hips'], ['hamstrings'], ['shoulders'], ['quads'], ['chest'], ['hips']],
};

const shuffle = <T>(list: T[], random: () => number) => {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
};

export interface Generated {
  title: string;
  items: WorkoutItem[];
  rounds: number;
  roundRest: number;
  estimatedSeconds: number;
  exercises: Array<{ id: string; name: string; icon: string }>;
}

export async function generateWorkout(
  ctx: Ctx,
  userId: string,
  input: GenerateInput,
  random: () => number = Math.random,
): Promise<Generated> {
  const library = (await listExercises(ctx, userId)).filter(
    (e) => e.available && e.level <= input.level && (!input.quiet || e.impact === 'low'),
  );
  const lastWeights = await lastWeightsOf(ctx, userId);
  const pool = shuffle(library, random);
  const used = new Set<string>();
  const take = (filter: (e: LibraryExercise) => boolean) => {
    const found = pool.find((e) => !used.has(e.id) && filter(e));
    if (found) used.add(found.id);
    return found ?? null;
  };

  const warmup =
    input.focus === 'mobility'
      ? []
      : [
          take((e) => e.category === 'mobility'),
          take(
            (e) =>
              e.category === 'mobility' ||
              (e.category === 'cardio' && e.measure === 'time' && e.level === 1),
          ),
        ];
  const cooldown =
    input.focus === 'mobility'
      ? []
      : [take((e) => e.category === 'stretch'), take((e) => e.category === 'stretch')];
  const edges = (
    list: Array<LibraryExercise | null>,
    block: 'warmup' | 'cooldown',
  ): WorkoutItem[] =>
    list
      .filter((e): e is LibraryExercise => Boolean(e))
      .map((e) => ({
        exerciseId: e.id,
        sets: 1,
        seconds: e.measure === 'time' ? 30 : null,
        reps: e.measure === 'reps' ? (e.reps ?? 8) : null,
        rest: 5,
        block,
      }));

  const circuit = input.style === 'circuit' || input.focus === 'cardio';
  const main: LibraryExercise[] = [];
  const slots = SLOTS[input.focus];
  const mainCategory = (e: LibraryExercise) =>
    input.focus === 'mobility'
      ? e.category === 'mobility' || e.category === 'stretch'
      : input.focus === 'cardio'
        ? e.category === 'cardio' && e.measure !== 'distance'
        : e.category !== 'mobility' && e.category !== 'stretch' && e.measure !== 'distance';
  const budget =
    input.minutes * 60 -
    estimate(
      [...edges(warmup, 'warmup'), ...edges(cooldown, 'cooldown')],
      1,
      0,
      new Map(library.map((e) => [e.id, e])),
    );
  const mainItem = (e: LibraryExercise): WorkoutItem => {
    const weight =
      e.weighted && e.weights.length
        ? (lastWeights.get(e.id) ?? e.weights[Math.floor((e.weights.length - 1) / 2)]!.kg)
        : null;
    if (circuit)
      return {
        exerciseId: e.id,
        sets: 1,
        reps: e.measure === 'reps' ? (e.reps ?? 10) : null,
        seconds: e.measure === 'time' ? 40 : null,
        weight,
        rest: 20,
      };
    if (input.focus === 'mobility')
      return {
        exerciseId: e.id,
        sets: 1,
        seconds: e.measure === 'time' ? (e.seconds ?? 45) : null,
        reps: e.measure === 'reps' ? (e.reps ?? 6) : null,
        rest: 10,
      };
    return {
      exerciseId: e.id,
      sets: 3,
      reps: e.measure === 'reps' ? (e.reps ?? 10) : null,
      seconds: e.measure === 'time' ? (e.seconds ?? 30) : null,
      weight,
      rest: e.rest || 60,
    };
  };
  const map = new Map(library.map((e) => [e.id, e]));
  const fits = (items: WorkoutItem[], rounds: number) =>
    estimate(items, rounds, circuit ? 60 : 0, map) <= budget;

  for (let i = 0; main.length < 10; i++) {
    const slot = slots[i % slots.length]!;
    const next =
      take((e) => mainCategory(e) && e.muscles.some((m) => slot.includes(m))) ?? take(mainCategory);
    if (!next) break;
    const trial = [...main, next].map(mainItem);
    if (!circuit && main.length >= 2 && !fits(trial, 1)) break;
    if (circuit && main.length >= 4 && !fits(trial, 2)) break;
    main.push(next);
    if (i > 40) break;
  }
  let items = main.map(mainItem);
  let rounds = 1;
  if (circuit && items.length) {
    while (rounds < 8 && fits(items, rounds + 1)) rounds++;
  } else {
    // Sets in a row: trim the last exercises' sets until it fits.
    for (let i = items.length - 1; i >= 0 && !fits(items, 1); i--)
      items[i] = { ...items[i]!, sets: 2 };
    while (items.length > 2 && !fits(items, 1)) items = items.slice(0, -1);
  }

  const all = [...edges(warmup, 'warmup'), ...items, ...edges(cooldown, 'cooldown')];
  const label = {
    full: 'Full body',
    upper: 'Upper body',
    lower: 'Legs and glutes',
    core: 'Core',
    cardio: 'Cardio',
    mobility: 'Mobility',
  }[input.focus];
  return {
    title: `${label} · ${input.minutes} min${circuit && input.focus !== 'cardio' ? ' circuit' : ''}`,
    items: all,
    rounds,
    roundRest: circuit ? 60 : 0,
    estimatedSeconds: estimate(all, rounds, circuit ? 60 : 0, map),
    exercises: all
      .map((item) => map.get(item.exerciseId)!)
      .map((e) => ({ id: e.id, name: e.name, icon: e.icon })),
  };
}

async function lastWeightsOf(ctx: Ctx, userId: string): Promise<Map<string, number>> {
  const { rows } = await ctx.db.query<{ exercise_id: string; weight: string }>(
    `SELECT DISTINCT ON (exercise_id) exercise_id, weight FROM training_sets WHERE user_id = $1 AND weight > 0 ORDER BY exercise_id, performed_at DESC`,
    [userId],
  );
  return new Map(rows.map((row) => [row.exercise_id, Number(row.weight)]));
}
