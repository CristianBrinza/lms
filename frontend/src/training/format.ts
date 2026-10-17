import { formatNumber, tr } from '@/i18n';
import { trainingT } from './i18n';
import type {
  Block,
  ExerciseCategory,
  Focus,
  LibraryExercise,
  Measure,
  Muscle,
  RecordKind,
  TrainingSet,
  WorkoutItem,
  WorkoutStatus,
} from './types';

/** How Training reads: targets, times, distances, muscles. In the current language. */

/**
 * A label map that reads the dictionary each time it is looked at, so a module-level constant
 * still follows the language (the app remounts on a change; modules don't re-run).
 */
function live<K extends string>(
  keys: readonly K[],
  pick: (t: ReturnType<typeof trainingT>) => Record<K, string>,
): Readonly<Record<K, string>> {
  const map = {} as Record<K, string>;
  for (const key of keys)
    Object.defineProperty(map, key, { enumerable: true, get: () => pick(trainingT())[key] });
  return map;
}

export const MUSCLE_ORDER: Muscle[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'core',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'calves',
  'hips',
  'heart',
];
export const MUSCLE_LABEL = live(MUSCLE_ORDER, (t) => t.muscle);

export const CATEGORY_ORDER: ExerciseCategory[] = [
  'strength',
  'cardio',
  'core',
  'mobility',
  'stretch',
];
export const CATEGORY_LABEL = live(CATEGORY_ORDER, (t) => t.category);

export const FOCUS_ORDER: Focus[] = ['full', 'upper', 'lower', 'core', 'cardio', 'mobility'];
export const FOCUS_LABEL = live(FOCUS_ORDER, (t) => t.focus);

export const BLOCK_LABEL = live(['warmup', 'main', 'cooldown'] as Block[], (t) => t.block);

export const STATUS_LABEL = live(
  ['planned', 'active', 'done', 'skipped'] as WorkoutStatus[],
  (t) => t.status,
);

export const MEASURE_LABEL = live(['reps', 'time', 'distance'] as Measure[], (t) => t.measure);

export const IMPACT_LABEL = live(['low', 'high'] as const, (t) => t.impact);

/** By level: 1 easy, 2 medium, 3 hard (0 is blank). */
export const LEVEL_LABEL: Readonly<Record<number, string>> = live(['0', '1', '2', '3'], (t) => ({
  0: t.level[0]!,
  1: t.level[1]!,
  2: t.level[2]!,
  3: t.level[3]!,
}));

export const RECORD_LABEL = live(
  ['reps', 'weight', 'e1rm', 'seconds', 'distance'] as RecordKind[],
  (t) => t.record,
);

/** 75 → "1:15"; 3725 → "1:02:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}

/** 45 → "45 s"; 90 → "1½ min"; 1500 → "25 min"; 5400 → "1 h 30 min". */
export function duration(seconds: number): string {
  const { unit } = trainingT();
  const s = Math.round(seconds);
  if (s < 60) return `${s} ${unit.s}`;
  if (s < 600 && s % 60) return `${Math.floor(s / 60)}${s % 60 >= 30 ? '½' : ''} ${unit.min}`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} ${unit.min}`;
  return `${Math.floor(minutes / 60)} ${unit.h}${minutes % 60 ? ` ${minutes % 60} ${unit.min}` : ''}`;
}

/** Metres: 800 → "800 m"; 3000 → "3 km"; 2500 → "2.5 km" ("2,5 km" in Romanian). */
export function distance(metres: number): string {
  const { unit } = trainingT();
  if (metres < 1000) return `${formatNumber(Math.round(metres))} ${unit.m}`;
  const km = metres / 1000;
  return `${formatNumber(km, { maximumFractionDigits: km < 10 ? 2 : 1 })} ${unit.km}`;
}

/** 8 → "8 kg"; 12.5 → "12.5 kg" ("12,5 kg"). */
export const kg = (value: number) =>
  `${formatNumber(value, { maximumFractionDigits: 1 })} ${trainingT().unit.kg}`;

/** What one set aims for: "10 reps", "45 s", "3 km", with "· 8 kg". */
export function target(
  item: Pick<WorkoutItem, 'reps' | 'seconds' | 'distance' | 'weight'>,
  measure: Measure,
): string {
  const t = trainingT();
  const main =
    measure === 'reps'
      ? t.reps(item.reps ?? 10)
      : measure === 'time'
        ? duration(item.seconds ?? 30)
        : distance(item.distance ?? 1000);
  return item.weight ? `${main} · ${kg(item.weight)}` : main;
}

/** "3 × 10 reps", "2 × 45 s each side". */
export function plan(
  item: WorkoutItem,
  exercise: Pick<LibraryExercise, 'measure' | 'unilateral'>,
): string {
  const each = exercise.unilateral ? ` ${trainingT().eachSide}` : '';
  return `${item.sets > 1 ? `${item.sets} × ` : ''}${target(item, exercise.measure)}${each}`;
}

/** What a logged set was: "12 reps · 8 kg", "50 s", "3.2 km in 18:40". */
export function setLabel(
  set: Pick<TrainingSet, 'reps' | 'weight' | 'seconds' | 'distance'>,
): string {
  const t = trainingT();
  if (set.distance)
    return set.seconds
      ? t.inTime(distance(set.distance), clock(set.seconds))
      : distance(set.distance);
  if (set.reps !== null && set.reps !== undefined)
    return `${t.reps(set.reps)}${set.weight ? ` · ${kg(set.weight)}` : ''}`;
  if (set.seconds) return `${duration(set.seconds)}${set.weight ? ` · ${kg(set.weight)}` : ''}`;
  return '—';
}

/** min/km for a run: 3000 m in 900 s → "5:00 /km". */
export function pace(metres: number, seconds: number): string {
  if (!metres || !seconds) return '';
  return `${clock((seconds / metres) * 1000)} ${trainingT().unit.perKm}`;
}

/** A way (grip, stance, band) saved by its written name, shown in the current language. */
export function wayName(exercise: Pick<LibraryExercise, 'options'>, name: string): string {
  const option = exercise.options.find((o) => o.name === name);
  return option ? tr(option, 'name') : name;
}

export function equipmentLabel(kinds: string[], names: Record<string, string>): string {
  return kinds
    .map((kind) => names[kind] ?? kind.replace(/_/g, ' '))
    .join(trainingT().equipmentJoin);
}

/** The people's first names, "Ana" for one; initials for an avatar. */
export const initials = (name: string, surname = '') =>
  `${name[0] ?? ''}${surname[0] ?? ''}`.toUpperCase() || '?';
