import type { Translations } from '@/i18n';

/** The shapes /api/training answers with (see backend/src/modules/training). */

export type Muscle =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'core'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves'
  | 'hips'
  | 'heart';

export type ExerciseCategory = 'strength' | 'cardio' | 'core' | 'mobility' | 'stretch';
export type Measure = 'reps' | 'time' | 'distance';
export type Block = 'warmup' | 'main' | 'cooldown';
export type WorkoutStatus = 'planned' | 'active' | 'done' | 'skipped';
export type Focus = 'full' | 'upper' | 'lower' | 'core' | 'cardio' | 'mobility';
export type RecordKind = 'reps' | 'weight' | 'e1rm' | 'seconds' | 'distance';

export interface Person {
  id: string;
  name: string;
  surname: string;
  gender?: 'female' | 'male' | 'other' | null;
  birthDate?: string | null;
  age?: number | null;
  heightCm?: number | null;
  avatarUrl?: string | null;
}

/** A piece of equipment's own part: a band with its resistance, a grip of the bar. */
export interface Piece {
  name: string;
  kg: number | null;
}

/** A way to do an exercise: its own variation, or a piece of the equipment it uses. */
export interface ExerciseOption {
  name: string;
  kg: number | null;
  from: 'exercise' | 'equipment';
  equipment?: string;
  /** name and equipment in the other languages. */
  translations?: Translations;
}

export interface EquipmentPreset {
  kind: string;
  name: string;
  icon: string;
  weighted: boolean;
  pairs?: boolean;
  weights?: number[];
  note?: string;
  pieces?: Piece[];
  /** The name (and note) in each language. */
  translations?: Translations;
}

export interface Equipment {
  id: string;
  kind: string;
  name: string;
  icon: string;
  /** kg, ascending */
  weights: number[];
  pairs: boolean;
  count: number;
  note: string;
  variants: Piece[];
  /** name and note in the other languages (tr(equipment, 'name')). */
  translations?: Translations;
}

export interface Exercise {
  id: string;
  /** Whose library it is in. */
  userId: string;
  preset: string | null;
  name: string;
  category: ExerciseCategory;
  muscles: Muscle[];
  secondary: Muscle[];
  /** Alternatives, each the kinds needed together; [] needs nothing. */
  equipment: string[][];
  measure: Measure;
  weighted: boolean;
  unilateral: boolean;
  reps: number | null;
  seconds: number | null;
  /** metres */
  distance: number | null;
  rest: number;
  level: number;
  impact: 'low' | 'high';
  icon: string;
  steps: string[];
  note: string;
  /** Its own ways: grips, stances, positions. */
  variants: string[];
  archived: boolean;
  /** name, steps and note in the other languages (tr(exercise, 'steps')). */
  translations?: Translations;
}

export interface LibraryExercise extends Exercise {
  available: boolean;
  uses: string[] | null;
  weights: Array<{ kg: number; pair: boolean }>;
  options: ExerciseOption[];
  pinned: boolean;
}

export interface WorkoutItem {
  exerciseId: string;
  sets: number;
  reps?: number | null;
  seconds?: number | null;
  distance?: number | null;
  weight?: number | null;
  rest?: number;
  note?: string;
  /** Grip, stance or band. */
  variant?: string;
  block?: Block;
}

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

export interface WorkoutItemView extends WorkoutItem {
  rest: number;
  exercise: LibraryExercise;
  last: LastTime | null;
  suggest: Suggestion | null;
}

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
  variant: string;
  /** exercise and variant in the other languages (tr(set, 'exercise')). */
  translations?: Translations;
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
  setsPlanned: number;
  setsDone: number;
  estimatedSeconds: number;
  exercises: Array<{ id: string; name: string; icon: string; translations?: Translations }>;
  missing: string[];
  /** title in the other languages (tr(workout, 'title')). */
  translations?: Translations;
}

export interface Workout extends WorkoutSummary {
  items: WorkoutItemView[];
  sets: TrainingSet[];
  /** kcal it costs: the sets done (Compendium METs × weight × time), or the plan's estimate. */
  kcal: number;
  kcalSource: 'done' | 'planned';
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  note: string;
  items: WorkoutItem[];
  rounds: number;
  roundRest: number;
  exercises: Array<{
    id: string;
    name: string;
    icon: string;
    available: boolean;
    translations?: Translations;
  }>;
  estimatedSeconds: number;
  updatedAt: string;
  /** name and note in the other languages. */
  translations?: Translations;
}

export interface DayActivity {
  day: string;
  sets: number;
  reps: number;
  seconds: number;
  distance: number;
  workouts: number;
  minutes: number;
}

export interface Streak {
  current: number;
  best: number;
  weeks: number;
}

export interface Totals {
  activeDays: number;
  workouts: number;
  minutes: number;
  sets: number;
  reps: number;
  distance: number;
}

export interface Stats {
  from: string;
  to: string;
  days: DayActivity[];
  totals: Totals;
  muscles: Partial<Record<Muscle, number>>;
  top: Array<{
    exerciseId: string;
    name: string;
    icon: string;
    sets: number;
    reps: number;
    seconds: number;
    distance: number;
    translations?: Translations;
  }>;
  streak: Streak;
}

export interface Pin {
  id: string;
  name: string;
  icon: string;
  measure: Measure;
  weighted: boolean;
  unilateral: boolean;
  reps: number | null;
  seconds: number | null;
  today: number;
  translations?: Translations;
}

export interface TrainingOverview {
  people: Person[];
  userId: string;
  today: string;
  todays: WorkoutSummary[];
  next: WorkoutSummary | null;
  week: Array<{ day: string; workouts: WorkoutSummary[]; sets: number; minutes: number }>;
  streak: Streak;
  totals: Totals;
  pins: Pin[];
  loggedToday: TrainingSet[];
  equipment: number;
}

export interface ExerciseHistory {
  exercise: LibraryExercise;
  bests: {
    reps: { value: number; day: string } | null;
    weight: { value: number; reps: number; day: string } | null;
    e1rm: { value: number; day: string } | null;
    seconds: { value: number; day: string } | null;
    distance: { value: number; seconds: number | null; day: string } | null;
  };
  days: Array<{ day: string; sets: TrainingSet[]; best: number; volume: number }>;
  totals: { sets: number; reps: number; seconds: number; distance: number };
}

export interface Generated {
  title: string;
  items: WorkoutItem[];
  rounds: number;
  roundRest: number;
  estimatedSeconds: number;
  exercises: Array<{ id: string; name: string; icon: string; translations?: Translations }>;
  translations?: Translations;
}

export interface SetInput {
  userId?: string;
  exerciseId: string;
  reps?: number | null;
  weight?: number | null;
  seconds?: number | null;
  distance?: number | null;
  side?: 'left' | 'right' | null;
  effort?: number | null;
  note?: string;
  variant?: string;
  /** The app's id for the set: sent twice, logged once. */
  clientId?: string;
  at?: string;
  day?: string;
  itemIndex?: number;
  round?: number;
  setNumber?: number;
}

export interface WorkoutInput {
  userId?: string;
  date: string;
  time?: string | null;
  title?: string;
  routineId?: string;
  items?: WorkoutItem[];
  rounds?: number;
  roundRest?: number;
  note?: string;
}

export type HealthKind =
  | 'steps'
  | 'distance'
  | 'activeEnergy'
  | 'exerciseMinutes'
  | 'flights'
  | 'restingHeartRate'
  | 'heartRate'
  | 'hrv'
  | 'sleep'
  | 'weight'
  | 'bodyFat'
  | 'vo2max';

export interface HealthSummary {
  from: string;
  to: string;
  days: Array<{ day: string; values: Partial<Record<HealthKind, number>> }>;
  week: Partial<Record<HealthKind, { now: number | null; before: number | null }>>;
  latest: Partial<Record<HealthKind, { value: number; day: string }>>;
  lastSync: Partial<Record<'apple' | 'google' | 'manual', string>>;
  insights: Array<{ tone: 'good' | 'watch' | 'info'; text: string }>;
}

export interface EnergyNutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface EnergyDay {
  day: string;
  eaten: EnergyNutrients | null;
  meals: number;
  unknown: number;
  burned: {
    resting: number;
    active: number;
    training: number;
    total: number;
    source: 'phone' | 'estimate';
  };
  balance: number | null;
}

export interface EnergySummary {
  person: {
    weight: number | null;
    weightDay: string | null;
    heightCm: number | null;
    age: number | null;
    gender: 'female' | 'male' | 'other' | null;
    goal: 'lose' | 'keep' | 'gain' | null;
    goalWeight: number | null;
    goalRate: number | null;
    activity: string;
    assumedWeight: boolean;
    bmr: number | null;
  };
  days: EnergyDay[];
  burn: { estimated: number; measured: number | null };
  target: { kcal: number; protein: number; fat: number; carbs: number; why: string };
  insights: Array<{ tone: 'good' | 'watch' | 'info'; text: string }>;
}
