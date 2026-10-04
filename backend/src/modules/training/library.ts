import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx as Ctx } from '../food/kitchen';
import { isUuid } from '../users';
import {
  CATALOG_VERSION,
  EQUIPMENT_PRESETS,
  EXERCISE_PRESETS,
  type ExerciseCategory,
  type Measure,
  type Muscle,
} from './catalog';
import type { EquipmentInput, EquipmentPatch, ExerciseInput, ExercisePatch } from './schemas';

/**
 * The household's home gym: the equipment it owns, and the exercises it knows (the catalog's,
 * copied in so they can be tuned, and its own). Whether an exercise can be done at home comes from
 * the equipment: one of its alternatives must be fully owned.
 */

// ---------------------------------------------------------------- equipment

export interface Equipment {
  id: string;
  kind: string;
  name: string;
  icon: string;
  weights: number[];
  pairs: boolean;
  count: number;
  note: string;
}

interface EquipmentRow {
  id: string;
  kind: string;
  name: string;
  icon: string;
  weights: string[];
  pairs: boolean;
  count: number;
  note: string;
}

const toEquipment = (row: EquipmentRow): Equipment => ({
  id: row.id,
  kind: row.kind,
  name: row.name,
  icon: row.icon,
  weights: row.weights.map(Number).sort((a, b) => a - b),
  pairs: row.pairs,
  count: row.count,
  note: row.note,
});

const EQUIPMENT_SELECT =
  'SELECT id, kind, name, icon, weights, pairs, count, note FROM training_equipment';

export async function listEquipment(ctx: Ctx): Promise<Equipment[]> {
  const { rows } = await ctx.db.query<EquipmentRow>(
    `${EQUIPMENT_SELECT} WHERE household_id = $1 ORDER BY created_at, name`,
    [ctx.actor.householdId],
  );
  return rows.map(toEquipment);
}

async function findEquipment(ctx: Ctx, id: string): Promise<Equipment> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');
  const { rows } = await ctx.db.query<EquipmentRow>(
    `${EQUIPMENT_SELECT} WHERE id = $1 AND household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Equipment not found');
  return toEquipment(rows[0]);
}

const cleanWeights = (weights: number[] | undefined) =>
  [...new Set((weights ?? []).map((kg) => Math.round(kg * 100) / 100))].sort((a, b) => a - b);

export async function addEquipment(ctx: Ctx, input: EquipmentInput): Promise<Equipment> {
  const preset = EQUIPMENT_PRESETS.find((p) => p.kind === input.kind);
  const kind = preset ? preset.kind : 'other';
  const name = input.name ?? preset?.name;
  if (!name)
    throw new AppError(400, 'VALIDATION', 'Give it a name', { fields: { name: 'Give it a name' } });
  const { rows } = await ctx.db.query<EquipmentRow>(
    `INSERT INTO training_equipment (id, household_id, kind, name, icon, weights, pairs, count, note, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
     RETURNING id, kind, name, icon, weights, pairs, count, note`,
    [
      randomUUID(),
      ctx.actor.householdId,
      kind,
      name,
      input.icon ?? preset?.icon ?? 'mat',
      cleanWeights(input.weights),
      input.pairs ?? preset?.pairs ?? false,
      input.count ?? 1,
      input.note ?? '',
      ctx.now,
    ],
  );
  return toEquipment(rows[0]!);
}

export async function updateEquipment(
  ctx: Ctx,
  id: string,
  patch: EquipmentPatch,
): Promise<Equipment> {
  const current = await findEquipment(ctx, id);
  const next = {
    ...current,
    ...patch,
    weights: patch.weights ? cleanWeights(patch.weights) : current.weights,
  };
  const { rows } = await ctx.db.query<EquipmentRow>(
    `UPDATE training_equipment SET name = $3, icon = $4, weights = $5, pairs = $6, count = $7, note = $8, updated_at = $9
      WHERE id = $1 AND household_id = $2 RETURNING id, kind, name, icon, weights, pairs, count, note`,
    [
      id,
      ctx.actor.householdId,
      next.name,
      next.icon,
      next.weights,
      next.pairs,
      next.count,
      next.note,
      ctx.now,
    ],
  );
  return toEquipment(rows[0]!);
}

export async function removeEquipment(ctx: Ctx, id: string): Promise<void> {
  await findEquipment(ctx, id);
  await ctx.db.query('DELETE FROM training_equipment WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

/** The kinds the household owns (at least one of). */
export function ownedKinds(equipment: Equipment[]): Set<string> {
  return new Set(equipment.filter((item) => item.count > 0).map((item) => item.kind));
}

/** The first alternative the household can do the exercise with: [] when it needs nothing, null when none. */
export function usableWith(needs: string[][], owned: Set<string>): string[] | null {
  if (!needs.length) return [];
  return needs.find((option) => option.every((kind) => owned.has(kind))) ?? null;
}

/** The weights (kg) owned for an exercise's equipment, each marked pair or single. */
export function weightsFor(
  needs: string[][],
  equipment: Equipment[],
): Array<{ kg: number; pair: boolean }> {
  const kinds = new Set(needs.flat());
  const found = new Map<number, boolean>();
  for (const item of equipment) {
    if (!kinds.has(item.kind) || item.count <= 0) continue;
    for (const kg of item.weights)
      found.set(kg, (found.get(kg) ?? false) || item.pairs || item.count >= 2);
  }
  return [...found].map(([kg, pair]) => ({ kg, pair })).sort((a, b) => a.kg - b.kg);
}

// ---------------------------------------------------------------- exercises

export interface Exercise {
  id: string;
  preset: string | null;
  name: string;
  category: ExerciseCategory;
  muscles: Muscle[];
  secondary: Muscle[];
  equipment: string[][];
  measure: Measure;
  weighted: boolean;
  unilateral: boolean;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  rest: number;
  level: number;
  impact: 'low' | 'high';
  icon: string;
  steps: string[];
  note: string;
  archived: boolean;
}

/** An exercise as the household can do it today. */
export interface LibraryExercise extends Exercise {
  /** One of its equipment alternatives is owned (or it needs none). */
  available: boolean;
  /** The alternative to use: the kinds needed, [] for none, null when it can't be done. */
  uses: string[] | null;
  weights: Array<{ kg: number; pair: boolean }>;
  pinned: boolean;
}

interface ExerciseRow {
  id: string;
  preset: string | null;
  name: string;
  category: ExerciseCategory;
  muscles: Muscle[];
  secondary: Muscle[];
  equipment: string[][];
  measure: Measure;
  weighted: boolean;
  unilateral: boolean;
  reps: number | null;
  seconds: number | null;
  distance: number | null;
  rest: number;
  level: number;
  impact: 'low' | 'high';
  icon: string;
  steps: string[];
  note: string;
  archived_at: Date | null;
}

const EXERCISE_COLUMNS = `id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral, reps, seconds,
  distance, rest, level, impact, icon, steps, note, archived_at`;

const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  preset: row.preset,
  name: row.name,
  category: row.category,
  muscles: row.muscles,
  secondary: row.secondary,
  equipment: row.equipment,
  measure: row.measure,
  weighted: row.weighted,
  unilateral: row.unilateral,
  reps: row.reps,
  seconds: row.seconds,
  distance: row.distance,
  rest: row.rest,
  level: row.level,
  impact: row.impact,
  icon: row.icon,
  steps: row.steps,
  note: row.note,
  archived: row.archived_at !== null,
});

/** Brings the catalog's exercises into the household, once per catalog version. Safe to run twice at once. */
export async function syncCatalog(ctx: Ctx): Promise<void> {
  const { rows } = await ctx.db.query<{ version: number }>(
    'SELECT training_catalog_version AS version FROM households WHERE id = $1',
    [ctx.actor.householdId],
  );
  if ((rows[0]?.version ?? 0) >= CATALOG_VERSION) return;
  await ctx.tx(async (tx) => {
    const locked = await tx.db.query<{ version: number }>(
      'SELECT training_catalog_version AS version FROM households WHERE id = $1 FOR UPDATE',
      [tx.actor.householdId],
    );
    if ((locked.rows[0]?.version ?? 0) >= CATALOG_VERSION) return;
    for (const p of EXERCISE_PRESETS) {
      await tx.db.query(
        `INSERT INTO training_exercises (id, household_id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral,
                                         reps, seconds, distance, rest, level, impact, icon, steps, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $20)
         ON CONFLICT (household_id, preset) DO NOTHING`,
        [
          randomUUID(),
          tx.actor.householdId,
          p.key,
          p.name,
          p.category,
          p.muscles,
          p.secondary ?? [],
          JSON.stringify(p.equipment),
          p.measure,
          p.weighted ?? false,
          p.unilateral ?? false,
          p.reps ?? null,
          p.seconds ?? null,
          p.distance ?? null,
          p.rest ?? 60,
          p.level,
          p.impact ?? 'low',
          p.icon,
          p.steps,
          tx.now,
        ],
      );
    }
    await tx.db.query('UPDATE households SET training_catalog_version = $2 WHERE id = $1', [
      tx.actor.householdId,
      CATALOG_VERSION,
    ]);
  });
}

export async function findExercise(ctx: Ctx, id: string): Promise<Exercise> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Exercise not found');
  const { rows } = await ctx.db.query<ExerciseRow>(
    `SELECT ${EXERCISE_COLUMNS} FROM training_exercises WHERE id = $1 AND household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Exercise not found');
  return toExercise(rows[0]);
}

/** Several at once, by id; every id must be the household's (400 otherwise, naming the field). */
export async function exercisesById(
  ctx: Ctx,
  ids: string[],
  field = 'exerciseId',
): Promise<Map<string, Exercise>> {
  const unique = [...new Set(ids)];
  if (unique.some((id) => !isUuid(id)))
    throw new AppError(400, 'VALIDATION', 'Unknown exercise', {
      fields: { [field]: 'Unknown exercise' },
    });
  const { rows } = await ctx.db.query<ExerciseRow>(
    `SELECT ${EXERCISE_COLUMNS} FROM training_exercises WHERE household_id = $1 AND id = ANY($2::uuid[])`,
    [ctx.actor.householdId, unique],
  );
  if (rows.length !== unique.length)
    throw new AppError(400, 'VALIDATION', 'Unknown exercise', {
      fields: { [field]: 'Unknown exercise' },
    });
  return new Map(rows.map((row) => [row.id, toExercise(row)]));
}

export function describeExercise(
  exercise: Exercise,
  equipment: Equipment[],
  pins: Set<string>,
): LibraryExercise {
  const uses = usableWith(exercise.equipment, ownedKinds(equipment));
  return {
    ...exercise,
    available: uses !== null,
    uses,
    weights: exercise.weighted ? weightsFor(exercise.equipment, equipment) : [],
    pinned: pins.has(exercise.id),
  };
}

export async function pinsOf(ctx: Ctx, userId: string): Promise<Set<string>> {
  const { rows } = await ctx.db.query<{ exercise_id: string }>(
    'SELECT exercise_id FROM training_pins WHERE user_id = $1',
    [userId],
  );
  return new Set(rows.map((row) => row.exercise_id));
}

export async function listExercises(
  ctx: Ctx,
  userId: string,
  options: { archived?: boolean } = {},
): Promise<LibraryExercise[]> {
  await syncCatalog(ctx);
  const [{ rows }, equipment, pins] = await Promise.all([
    ctx.db.query<ExerciseRow>(
      `SELECT ${EXERCISE_COLUMNS} FROM training_exercises WHERE household_id = $1${options.archived ? '' : ' AND archived_at IS NULL'} ORDER BY name`,
      [ctx.actor.householdId],
    ),
    listEquipment(ctx),
    pinsOf(ctx, userId),
  ]);
  return rows.map((row) => describeExercise(toExercise(row), equipment, pins));
}

export async function createExercise(ctx: Ctx, input: ExerciseInput): Promise<Exercise> {
  const { rows } = await ctx.db.query<ExerciseRow>(
    `INSERT INTO training_exercises (id, household_id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral,
                                     reps, seconds, distance, rest, level, impact, icon, steps, note, created_by, created_at, updated_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $21)
     RETURNING ${EXERCISE_COLUMNS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      input.name,
      input.category,
      input.muscles ?? [],
      input.secondary ?? [],
      JSON.stringify(input.equipment ?? []),
      input.measure,
      input.weighted ?? false,
      input.unilateral ?? false,
      input.reps ?? null,
      input.seconds ?? null,
      input.distance ?? null,
      input.rest ?? 60,
      input.level ?? 1,
      input.impact ?? 'low',
      input.icon || defaultIcon(input.category, input.measure),
      input.steps ?? [],
      input.note ?? '',
      ctx.actor.userId,
      ctx.now,
    ],
  );
  return toExercise(rows[0]!);
}

function defaultIcon(category: ExerciseCategory, measure: Measure): string {
  if (measure === 'distance') return 'run';
  return {
    strength: 'squat',
    cardio: 'jumping-jack',
    core: 'plank',
    mobility: 'arm-circles',
    stretch: 'hamstring-stretch',
  }[category];
}

export async function updateExercise(
  ctx: Ctx,
  id: string,
  patch: ExercisePatch,
): Promise<Exercise> {
  const current = await findExercise(ctx, id);
  const { archived, ...fields } = patch;
  const next = { ...current, ...fields };
  const { rows } = await ctx.db.query<ExerciseRow>(
    `UPDATE training_exercises SET name = $3, category = $4, muscles = $5, secondary = $6, equipment = $7, measure = $8, weighted = $9,
            unilateral = $10, reps = $11, seconds = $12, distance = $13, rest = $14, level = $15, impact = $16, icon = $17, steps = $18,
            note = $19, archived_at = $20, updated_at = $21
      WHERE id = $1 AND household_id = $2 RETURNING ${EXERCISE_COLUMNS}`,
    [
      id,
      ctx.actor.householdId,
      next.name,
      next.category,
      next.muscles,
      next.secondary,
      JSON.stringify(next.equipment),
      next.measure,
      next.weighted,
      next.unilateral,
      next.reps ?? null,
      next.seconds ?? null,
      next.distance ?? null,
      next.rest,
      next.level,
      next.impact,
      next.icon,
      next.steps,
      next.note,
      archived === undefined ? (current.archived ? ctx.now : null) : archived ? ctx.now : null,
      ctx.now,
    ],
  );
  return toExercise(rows[0]!);
}

export async function setPinned(
  ctx: Ctx,
  userId: string,
  exerciseId: string,
  pinned: boolean,
): Promise<void> {
  await findExercise(ctx, exerciseId);
  if (pinned)
    await ctx.db.query(
      'INSERT INTO training_pins (user_id, exercise_id, created_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [userId, exerciseId, ctx.now],
    );
  else
    await ctx.db.query('DELETE FROM training_pins WHERE user_id = $1 AND exercise_id = $2', [
      userId,
      exerciseId,
    ]);
}
