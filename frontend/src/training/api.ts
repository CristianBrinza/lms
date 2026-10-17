import type { Translations } from '@/i18n';
import { api, query } from '@/services/api/client';
import type {
  Equipment,
  EquipmentPreset,
  ExerciseHistory,
  Focus,
  EnergySummary,
  Generated,
  HealthSummary,
  LibraryExercise,
  Person,
  RecordKind,
  Routine,
  SetInput,
  Stats,
  TrainingOverview,
  TrainingSet,
  Workout,
  WorkoutInput,
  WorkoutItem,
  WorkoutSummary,
} from './types';

/** /api/training. Every person-specific call takes `userId` (someone in the household; default me). */

export const trainingKeys = {
  all: ['training'] as const,
  overview: (userId: string, today: string) => ['training', 'overview', userId, today] as const,
  people: ['training', 'people'] as const,
  equipment: ['training', 'equipment'] as const,
  exercises: (userId: string) => ['training', 'exercises', userId] as const,
  exercise: (id: string, userId: string) => ['training', 'exercise', id, userId] as const,
  routines: (who: string) => ['training', 'routines', who] as const,
  workouts: (who: string, from: string, to: string) =>
    ['training', 'workouts', who, from, to] as const,
  workout: (id: string) => ['training', 'workout', id] as const,
  stats: (userId: string, from: string, to: string) =>
    ['training', 'stats', userId, from, to] as const,
  health: (userId: string, from: string, to: string) =>
    ['training', 'health', userId, from, to] as const,
  energy: (userId: string, from: string, to: string) =>
    ['training', 'energy', userId, from, to] as const,
};

export interface ExerciseInput {
  name: string;
  category: LibraryExercise['category'];
  muscles?: LibraryExercise['muscles'];
  secondary?: LibraryExercise['muscles'];
  equipment?: string[][];
  measure: LibraryExercise['measure'];
  weighted?: boolean;
  unilateral?: boolean;
  reps?: number | null;
  seconds?: number | null;
  distance?: number | null;
  rest?: number;
  level?: number;
  impact?: 'low' | 'high';
  icon?: string;
  steps?: string[];
  note?: string;
  variants?: string[];
  translations?: Translations;
}

export interface EquipmentInput {
  kind: string;
  name?: string;
  icon?: string;
  weights?: number[];
  pairs?: boolean;
  count?: number;
  note?: string;
  variants?: Array<{ name: string; kg?: number | null }>;
  translations?: Translations;
}

export const trainingApi = {
  overview: (userId: string, today: string) =>
    api.get<TrainingOverview>(`/training/overview${query({ userId, today })}`),
  people: () => api.get<{ people: Person[] }>('/training/people').then((r) => r.people),

  equipment: () =>
    api.get<{ equipment: Equipment[]; presets: EquipmentPreset[] }>('/training/equipment'),
  addEquipment: (body: EquipmentInput) =>
    api.post<{ equipment: Equipment }>('/training/equipment', body).then((r) => r.equipment),
  updateEquipment: (id: string, body: Partial<Omit<EquipmentInput, 'kind'>>) =>
    api.patch<{ equipment: Equipment }>(`/training/equipment/${id}`, body).then((r) => r.equipment),
  removeEquipment: (id: string) => api.delete<void>(`/training/equipment/${id}`),

  exercises: (userId: string, archived = false) =>
    api
      .get<{ exercises: LibraryExercise[] }>(
        `/training/exercises${query({ userId, archived: archived ? 'true' : undefined })}`,
      )
      .then((r) => r.exercises),
  exercise: (id: string, userId: string) =>
    api.get<ExerciseHistory>(`/training/exercises/${id}${query({ userId })}`),
  createExercise: (body: ExerciseInput & { userId?: string }) =>
    api.post<{ exercise: LibraryExercise }>('/training/exercises', body).then((r) => r.exercise),
  updateExercise: (id: string, body: Partial<ExerciseInput> & { archived?: boolean }) =>
    api
      .patch<{ exercise: LibraryExercise }>(`/training/exercises/${id}`, body)
      .then((r) => r.exercise),
  pin: (id: string, pinned: boolean, userId: string) =>
    api
      .put<{ exercise: LibraryExercise }>(`/training/exercises/${id}/pin`, { pinned, userId })
      .then((r) => r.exercise),

  /** who: a person's id, or 'everyone'. */
  routines: (who: string) =>
    api
      .get<{ routines: Routine[] }>(
        `/training/routines${query(who === 'everyone' ? { everyone: 'true' } : { userId: who })}`,
      )
      .then((r) => r.routines),
  createRoutine: (body: {
    userId?: string;
    name: string;
    note?: string;
    items: WorkoutItem[];
    rounds?: number;
    roundRest?: number;
    translations?: Translations;
  }) => api.post<{ routine: Routine }>('/training/routines', body).then((r) => r.routine),
  updateRoutine: (
    id: string,
    body: Partial<{
      name: string;
      note: string;
      items: WorkoutItem[];
      rounds: number;
      roundRest: number;
      translations: Translations;
    }>,
  ) => api.patch<{ routine: Routine }>(`/training/routines/${id}`, body).then((r) => r.routine),
  removeRoutine: (id: string) => api.delete<void>(`/training/routines/${id}`),

  /** who: a person's id, or 'everyone'. */
  workouts: (who: string, from: string, to: string) =>
    api
      .get<{ workouts: WorkoutSummary[] }>(
        `/training/workouts${query(who === 'everyone' ? { everyone: 'true', from, to } : { userId: who, from, to })}`,
      )
      .then((r) => r.workouts),
  workout: (id: string) =>
    api.get<{ workout: Workout }>(`/training/workouts/${id}`).then((r) => r.workout),
  createWorkout: (body: WorkoutInput) =>
    api.post<{ workout: Workout }>('/training/workouts', body).then((r) => r.workout),
  updateWorkout: (
    id: string,
    body: Partial<{
      date: string;
      time: string | null;
      title: string;
      items: WorkoutItem[];
      rounds: number;
      roundRest: number;
      note: string;
      status: 'planned' | 'skipped';
    }>,
  ) => api.patch<{ workout: Workout }>(`/training/workouts/${id}`, body).then((r) => r.workout),
  removeWorkout: (id: string) => api.delete<void>(`/training/workouts/${id}`),
  startWorkout: (id: string) =>
    api.post<{ workout: Workout }>(`/training/workouts/${id}/start`).then((r) => r.workout),
  finishWorkout: (
    id: string,
    body: { durationSeconds?: number; feeling?: number | null; note?: string },
  ) =>
    api.post<{ workout: Workout }>(`/training/workouts/${id}/finish`, body).then((r) => r.workout),
  copyWorkout: (id: string, body: { date: string; userId?: string }) =>
    api.post<{ workout: Workout }>(`/training/workouts/${id}/copy`, body).then((r) => r.workout),
  logWorkoutSet: (workoutId: string, body: SetInput) =>
    api.post<{ set: TrainingSet; records: RecordKind[] }>(
      `/training/workouts/${workoutId}/sets`,
      body,
    ),

  logSet: (body: SetInput) =>
    api.post<{ set: TrainingSet; records: RecordKind[] }>('/training/sets', body),
  updateSet: (
    id: string,
    body: Partial<
      Pick<TrainingSet, 'reps' | 'weight' | 'seconds' | 'distance' | 'effort' | 'note'>
    >,
  ) => api.patch<{ set: TrainingSet }>(`/training/sets/${id}`, body).then((r) => r.set),
  removeSet: (id: string) => api.delete<void>(`/training/sets/${id}`),

  stats: (userId: string, from: string, to: string, today: string) =>
    api
      .get<{ stats: Stats }>(`/training/stats${query({ userId, from, to, today })}`)
      .then((r) => r.stats),
  health: (userId: string, from: string, to: string) =>
    api
      .get<{ health: HealthSummary }>(`/training/health${query({ userId, from, to })}`)
      .then((r) => r.health),
  energy: (userId: string, from: string, to: string, today: string) =>
    api
      .get<{ energy: EnergySummary }>(`/training/energy${query({ userId, from, to, today })}`)
      .then((r) => r.energy),
  addHealth: (body: {
    userId?: string;
    source: 'manual';
    date: string;
    weight?: number;
    sleepHours?: number;
    steps?: number;
    restingHeartRate?: number;
  }) => api.post<{ days: number; values: number; workouts: number }>('/training/health', body),
  generate: (body: {
    userId?: string;
    minutes: number;
    focus: Focus;
    level: number;
    quiet: boolean;
    style: 'sets' | 'circuit';
  }) => api.post<{ workout: Generated }>('/training/generate', body).then((r) => r.workout),
};
