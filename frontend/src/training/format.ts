import type {
  Block,
  ExerciseCategory,
  Focus,
  LibraryExercise,
  Measure,
  Muscle,
  TrainingSet,
  WorkoutItem,
  WorkoutStatus,
} from './types';

/** How Training reads: targets, times, distances, muscles. */

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  core: 'Abs',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  hips: 'Hips',
  heart: 'Heart',
};
export const MUSCLE_ORDER = Object.keys(MUSCLE_LABEL) as Muscle[];

export const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  core: 'Core',
  mobility: 'Mobility',
  stretch: 'Stretching',
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as ExerciseCategory[];

export const FOCUS_LABEL: Record<Focus, string> = {
  full: 'Full body',
  upper: 'Upper body',
  lower: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
  mobility: 'Mobility',
};

export const BLOCK_LABEL: Record<Block, string> = {
  warmup: 'Warm-up',
  main: 'Workout',
  cooldown: 'Cool-down',
};

export const STATUS_LABEL: Record<WorkoutStatus, string> = {
  planned: 'Planned',
  active: 'Under way',
  done: 'Done',
  skipped: 'Skipped',
};

export const LEVEL_LABEL = ['', 'Easy', 'Medium', 'Hard'] as const;

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
  const s = Math.round(seconds);
  if (s < 60) return `${s} s`;
  if (s < 600 && s % 60) return `${Math.floor(s / 60)}${s % 60 >= 30 ? '½' : ''} min`;
  const minutes = Math.round(s / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
}

/** Metres: 800 → "800 m"; 3000 → "3 km"; 2500 → "2.5 km". */
export function distance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  const km = metres / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(km < 10 ? 2 : 1).replace(/0$/, '')} km`;
}

export const kg = (value: number) =>
  `${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, '')} kg`;

/** What one set aims for: "10 reps", "45 s", "3 km", with "· 8 kg". */
export function target(
  item: Pick<WorkoutItem, 'reps' | 'seconds' | 'distance' | 'weight'>,
  measure: Measure,
): string {
  const main =
    measure === 'reps'
      ? `${item.reps ?? 10} reps`
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
  const each = exercise.unilateral ? ' each side' : '';
  return `${item.sets > 1 ? `${item.sets} × ` : ''}${target(item, exercise.measure)}${each}`;
}

/** What a logged set was: "12 reps · 8 kg", "50 s", "3.2 km in 18:40". */
export function setLabel(
  set: Pick<TrainingSet, 'reps' | 'weight' | 'seconds' | 'distance'>,
): string {
  if (set.distance)
    return `${distance(set.distance)}${set.seconds ? ` in ${clock(set.seconds)}` : ''}`;
  if (set.reps !== null && set.reps !== undefined)
    return `${set.reps} ${set.reps === 1 ? 'rep' : 'reps'}${set.weight ? ` · ${kg(set.weight)}` : ''}`;
  if (set.seconds) return `${duration(set.seconds)}${set.weight ? ` · ${kg(set.weight)}` : ''}`;
  return '—';
}

/** min/km for a run: 3000 m in 900 s → "5:00 /km". */
export function pace(metres: number, seconds: number): string {
  if (!metres || !seconds) return '';
  return `${clock((seconds / metres) * 1000)} /km`;
}

export const RECORD_LABEL = {
  reps: 'Most reps',
  weight: 'Heaviest',
  e1rm: 'Strongest set',
  seconds: 'Longest hold',
  distance: 'Furthest',
} as const;

export function equipmentLabel(kinds: string[], names: Record<string, string>): string {
  return kinds.map((kind) => names[kind] ?? kind.replace(/_/g, ' ')).join(' + ');
}

/** The people's first names, "Ana" for one; initials for an avatar. */
export const initials = (name: string, surname = '') =>
  `${name[0] ?? ''}${surname[0] ?? ''}`.toUpperCase() || '?';
