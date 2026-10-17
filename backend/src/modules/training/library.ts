import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import {
  cleanTranslations,
  LOCALES,
  mergeTranslations,
  type Translations,
} from '../../lib/i18n';
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
import { equipmentRowTranslations, exerciseRowTranslations, wayIn } from './catalog-i18n';
import { rebaseTranslations } from './i18n';
import type {
  EquipmentInput,
  EquipmentPatch,
  ExerciseInput,
  ExercisePatch,
  WorkoutItem,
} from './schemas';

/**
 * The home gym. The equipment is the household's (one pull-up bar for everyone); the exercises
 * are each person's — the catalog's, copied in for them to tune or hide, and their own — so a
 * mother's and a son's libraries can differ. Whether an exercise can be done at home comes from
 * the equipment: one of its alternatives must be fully owned. Equipment can list its pieces
 * (each band with its resistance, each grip of the bar), offered as the ways to do an exercise
 * next to the exercise's own variations (wide grip, single leg, arms straight…).
 */

// ---------------------------------------------------------------- equipment

/** One piece of a piece of equipment: a band ("Red", 15 kg), a grip of the bar ("Neutral handles"). */
export interface Piece {
  name: string;
  kg: number | null;
}

export interface Equipment {
  id: string;
  kind: string;
  name: string;
  icon: string;
  weights: number[];
  pairs: boolean;
  count: number;
  note: string;
  variants: Piece[];
  /** { ro: { name, note, variants: [piece names, in order] }, ru: … } */
  translations: Translations;
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
  variants: Piece[];
  translations: Translations | null;
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
  variants: row.variants,
  translations: row.translations ?? {},
});

const EQUIPMENT_FIELDS = 'id, kind, name, icon, weights, pairs, count, note, variants, translations';
const EQUIPMENT_SELECT = `SELECT ${EQUIPMENT_FIELDS} FROM training_equipment`;

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

/** Pieces with their names tidied and no name twice. */
function cleanPieces(pieces: Array<{ name: string; kg?: number | null }> | undefined): Piece[] {
  const seen = new Set<string>();
  const out: Piece[] = [];
  for (const piece of pieces ?? []) {
    const name = piece.name.trim().replace(/\s+/g, ' ');
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push({
      name,
      kg: piece.kg === null || piece.kg === undefined ? null : Math.round(piece.kg * 100) / 100,
    });
  }
  return out;
}

export async function addEquipment(ctx: Ctx, input: EquipmentInput): Promise<Equipment> {
  const preset = EQUIPMENT_PRESETS.find((p) => p.kind === input.kind);
  const kind = preset ? preset.kind : 'other';
  const name = input.name ?? preset?.name;
  if (!name)
    throw new AppError(400, 'VALIDATION', 'Give it a name', { fields: { name: 'Give it a name' } });
  const note = input.note ?? '';
  const variants = cleanPieces(input.variants);
  // From a preset: the catalog's own words come in every language (what was renamed stays as written).
  const translations = mergeTranslations(
    equipmentRowTranslations(preset, { name, note, variants }),
    input.translations,
  );
  const { rows } = await ctx.db.query<EquipmentRow>(
    `INSERT INTO training_equipment (id, household_id, kind, name, icon, weights, pairs, count, note, variants, created_at, updated_at, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12) RETURNING ${EQUIPMENT_FIELDS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      kind,
      name,
      input.icon ?? preset?.icon ?? 'mat',
      cleanWeights(input.weights),
      input.pairs ?? preset?.pairs ?? false,
      input.count ?? 1,
      note,
      JSON.stringify(variants),
      ctx.now,
      JSON.stringify(translations),
    ],
  );
  return toEquipment(rows[0]!);
}

/** The text of equipment whose translations follow it, piece names as a list. */
const equipmentText = (e: Pick<Equipment, 'name' | 'note' | 'variants'>) => ({
  name: e.name,
  note: e.note,
  variants: e.variants.map((piece) => piece.name),
});

export async function updateEquipment(
  ctx: Ctx,
  id: string,
  patch: EquipmentPatch,
): Promise<Equipment> {
  const current = await findEquipment(ctx, id);
  const { translations: given, ...fields } = patch;
  const next = {
    ...current,
    ...fields,
    weights: fields.weights ? cleanWeights(fields.weights) : current.weights,
    variants: fields.variants ? cleanPieces(fields.variants) : current.variants,
  };
  const translations = mergeTranslations(
    rebaseTranslations(current.translations, equipmentText(current), equipmentText(next)),
    given,
  );
  const { rows } = await ctx.db.query<EquipmentRow>(
    `UPDATE training_equipment SET name = $3, icon = $4, weights = $5, pairs = $6, count = $7, note = $8, variants = $9, updated_at = $10,
            translations = $11
      WHERE id = $1 AND household_id = $2 RETURNING ${EQUIPMENT_FIELDS}`,
    [
      id,
      ctx.actor.householdId,
      next.name,
      next.icon,
      next.weights,
      next.pairs,
      next.count,
      next.note,
      JSON.stringify(next.variants),
      ctx.now,
      JSON.stringify(translations),
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

/** A way to do an exercise: one of its own variations, or a piece of the equipment it uses. */
export interface ExerciseOption {
  name: string;
  /** A band's resistance, which counts as the set's weight. */
  kg: number | null;
  from: 'exercise' | 'equipment';
  equipment?: string;
  /** { ro: { name, equipment }, ru: … }; `name` is still what a set records. */
  translations: Translations;
}

/** Item `index` of a list field in each language that has it. */
function itemTranslations(
  translations: Translations | null | undefined,
  field: string,
  index: number,
  as: string,
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const list = translations?.[locale]?.[field];
    const value = Array.isArray(list) ? list[index] : undefined;
    if (value) out[locale] = { [as]: value };
  }
  return out;
}

/** Two sets of translations, field by field. */
const joinTranslations = (a: Translations, b: Translations): Translations =>
  Object.fromEntries(
    LOCALES.filter((l) => a[l] || b[l]).map((l) => [l, { ...a[l], ...b[l] }]),
  ) as Translations;

/**
 * How a way of doing an exercise, as a set records it ("Wide grip"), reads in other languages: the
 * exercise's own translation of it, else the catalog's (the bands and grips of the equipment).
 */
export function variantTranslations(
  variant: string,
  exercise: Pick<Exercise, 'variants' | 'translations'>,
): Translations {
  if (!variant) return {};
  const at = exercise.variants.indexOf(variant);
  const own = at >= 0 ? itemTranslations(exercise.translations, 'variants', at, 'variant') : {};
  for (const locale of ['ro', 'ru'] as const) {
    const catalog = wayIn(variant, locale);
    if (!own[locale] && catalog) own[locale] = { variant: catalog };
  }
  return own;
}

export function optionsFor(
  exercise: Pick<Exercise, 'variants' | 'equipment' | 'translations'>,
  uses: string[] | null,
  equipment: Equipment[],
): ExerciseOption[] {
  const own: ExerciseOption[] = exercise.variants.map((name, index) => ({
    name,
    kg: null,
    from: 'exercise',
    translations: itemTranslations(exercise.translations, 'variants', index, 'name'),
  }));
  const kinds = new Set(uses ?? []);
  const pieces: ExerciseOption[] = equipment
    .filter((item) => kinds.has(item.kind) && item.count > 0)
    .flatMap((item) =>
      item.variants.map((piece, index) => ({
        name: piece.name,
        kg: piece.kg,
        from: 'equipment' as const,
        equipment: item.name,
        translations: joinTranslations(
          itemTranslations(item.translations, 'variants', index, 'name'),
          pickName(item.translations, 'equipment'),
        ),
      })),
    );
  // The bar's "Wide grip" and the exercise's "Wide grip" are one choice: the piece says where it is.
  const named = new Set(pieces.map((p) => p.name.toLowerCase()));
  return [...pieces, ...own.filter((o) => !named.has(o.name.toLowerCase()))];
}

/** A record's name in each language, under another field name. */
function pickName(translations: Translations | null | undefined, as: string): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const name = translations?.[locale]?.name;
    if (typeof name === 'string' && name) out[locale] = { [as]: name };
  }
  return out;
}

// ---------------------------------------------------------------- exercises

export interface Exercise {
  id: string;
  /** Whose library it is in. */
  userId: string;
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
  /** Its own ways: wide grip, single leg, arms straight… */
  variants: string[];
  archived: boolean;
  /** { ro: { name, steps: […], note, variants: […] }, ru: … }: lists item by item, in order. */
  translations: Translations;
}

/** An exercise as the household can do it today. */
export interface LibraryExercise extends Exercise {
  /** One of its equipment alternatives is owned (or it needs none). */
  available: boolean;
  /** The alternative to use: the kinds needed, [] for none, null when it can't be done. */
  uses: string[] | null;
  weights: Array<{ kg: number; pair: boolean }>;
  /** Its variations and the pieces of the equipment it uses (bands, grips). */
  options: ExerciseOption[];
  pinned: boolean;
}

interface ExerciseRow {
  id: string;
  user_id: string;
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
  variants: string[];
  archived_at: Date | null;
  translations: Translations | null;
}

const EXERCISE_COLUMNS = `id, user_id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral, reps, seconds,
  distance, rest, level, impact, icon, steps, note, variants, archived_at, translations`;

const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  userId: row.user_id,
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
  variants: row.variants,
  archived: row.archived_at !== null,
  translations: row.translations ?? {},
});

/**
 * Brings the catalog's exercises into a person's library, once per catalog version: new ones are
 * added, and catalog variations fill exercises that have none yet. Safe to run twice at once.
 */
export async function syncCatalog(ctx: Ctx, userId: string = ctx.actor.userId): Promise<void> {
  const { rows } = await ctx.db.query<{ version: number }>(
    'SELECT training_catalog_version AS version FROM users WHERE id = $1',
    [userId],
  );
  if ((rows[0]?.version ?? CATALOG_VERSION) >= CATALOG_VERSION) return;
  await ctx.tx(async (tx) => {
    const locked = await tx.db.query<{ version: number }>(
      'SELECT training_catalog_version AS version FROM users WHERE id = $1 FOR UPDATE',
      [userId],
    );
    if ((locked.rows[0]?.version ?? CATALOG_VERSION) >= CATALOG_VERSION) return;
    for (const p of EXERCISE_PRESETS) {
      await tx.db.query(
        `INSERT INTO training_exercises (id, household_id, user_id, preset, name, category, muscles, secondary, equipment, measure, weighted,
                                         unilateral, reps, seconds, distance, rest, level, impact, icon, steps, variants, created_at, updated_at,
                                         translations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $22, $23)
         ON CONFLICT (user_id, preset) WHERE preset IS NOT NULL
         DO UPDATE SET variants = EXCLUDED.variants WHERE training_exercises.variants = '{}'`,
        [
          randomUUID(),
          tx.actor.householdId,
          userId,
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
          p.variants ?? [],
          tx.now,
          JSON.stringify(
            exerciseRowTranslations(p, { name: p.name, steps: p.steps, variants: p.variants ?? [] }),
          ),
        ],
      );
    }
    await translateCatalogCopies(tx, userId);
    await tx.db.query('UPDATE users SET training_catalog_version = $2 WHERE id = $1', [
      userId,
      CATALOG_VERSION,
    ]);
  });
}

/**
 * Catalog exercises (this person's) and catalog equipment (the household's) copied in before the
 * catalog had other languages get its translations, matched by preset key and kind. Only rows
 * with none yet, and only for what still reads as the catalog wrote it. Running it again changes nothing.
 */
async function translateCatalogCopies(ctx: Ctx, userId: string): Promise<void> {
  const exercises = await ctx.db.query<{
    id: string;
    preset: string;
    name: string;
    steps: string[];
    variants: string[];
  }>(
    `SELECT id, preset, name, steps, variants FROM training_exercises
      WHERE user_id = $1 AND preset IS NOT NULL AND translations = '{}'::jsonb`,
    [userId],
  );
  for (const row of exercises.rows) {
    const preset = EXERCISE_PRESETS.find((p) => p.key === row.preset);
    const translations = exerciseRowTranslations(preset, row);
    if (Object.keys(translations).length)
      await ctx.db.query(
        `UPDATE training_exercises SET translations = $2 WHERE id = $1 AND translations = '{}'::jsonb`,
        [row.id, JSON.stringify(translations)],
      );
  }
  const equipment = await ctx.db.query<{
    id: string;
    kind: string;
    name: string;
    note: string;
    variants: Piece[];
  }>(
    `SELECT id, kind, name, note, variants FROM training_equipment
      WHERE household_id = $1 AND kind <> 'other' AND translations = '{}'::jsonb`,
    [ctx.actor.householdId],
  );
  for (const row of equipment.rows) {
    const preset = EQUIPMENT_PRESETS.find((p) => p.kind === row.kind);
    const translations = equipmentRowTranslations(preset, row);
    if (Object.keys(translations).length)
      await ctx.db.query(
        `UPDATE training_equipment SET translations = $2 WHERE id = $1 AND translations = '{}'::jsonb`,
        [row.id, JSON.stringify(translations)],
      );
  }
}

/** Any exercise in the household (to look at); whose it is says `userId`. */
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

/**
 * A list of items made someone's own: each exercise from another person's library becomes the
 * same exercise in theirs (the catalog one by its key, an own one by name, or copied over). So a
 * workout planned for a son from his mother's routine uses his exercises, his bests, his pins.
 */
export async function ownItems(
  ctx: Ctx,
  userId: string,
  items: WorkoutItem[],
): Promise<{ items: WorkoutItem[]; exercises: Map<string, Exercise> }> {
  if (!items.length) return { items, exercises: new Map() };
  const given = await exercisesById(
    ctx,
    items.map((item) => item.exerciseId),
    'items',
  );
  const foreign = [...given.values()].filter((e) => e.userId !== userId);
  const swap = new Map<string, string>();
  if (foreign.length) {
    await syncCatalog(ctx, userId);
    for (const e of foreign) {
      const { rows } = await ctx.db.query<{ id: string }>(
        e.preset
          ? 'SELECT id FROM training_exercises WHERE user_id = $1 AND preset = $2'
          : 'SELECT id FROM training_exercises WHERE user_id = $1 AND preset IS NULL AND lower(name) = lower($2) ORDER BY archived_at NULLS FIRST LIMIT 1',
        [userId, e.preset ?? e.name],
      );
      const found = rows[0]?.id ?? (await copyExercise(ctx, e, userId)).id;
      swap.set(e.id, found);
    }
  }
  const mapped = items.map((item) => ({
    ...item,
    exerciseId: swap.get(item.exerciseId) ?? item.exerciseId,
  }));
  return {
    items: mapped,
    exercises: swap.size
      ? await exercisesById(
          ctx,
          mapped.map((i) => i.exerciseId),
          'items',
        )
      : given,
  };
}

async function copyExercise(ctx: Ctx, e: Exercise, userId: string): Promise<Exercise> {
  const { rows } = await ctx.db.query<ExerciseRow>(
    `INSERT INTO training_exercises (id, household_id, user_id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral,
                                     reps, seconds, distance, rest, level, impact, icon, steps, note, variants, created_by, created_at, updated_at,
                                     translations)
     SELECT $1, household_id, $2, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral, reps, seconds, distance,
            rest, level, impact, icon, steps, note, variants, $3, $4, $4, translations
       FROM training_exercises WHERE id = $5
     RETURNING ${EXERCISE_COLUMNS}`,
    [randomUUID(), userId, ctx.actor.userId, ctx.now, e.id],
  );
  return toExercise(rows[0]!);
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
    options: optionsFor(exercise, uses, equipment),
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

/** One person's library. */
export async function listExercises(
  ctx: Ctx,
  userId: string,
  options: { archived?: boolean } = {},
): Promise<LibraryExercise[]> {
  await syncCatalog(ctx, userId);
  const [{ rows }, equipment, pins] = await Promise.all([
    ctx.db.query<ExerciseRow>(
      `SELECT ${EXERCISE_COLUMNS} FROM training_exercises WHERE household_id = $1 AND user_id = $2${options.archived ? '' : ' AND archived_at IS NULL'} ORDER BY name`,
      [ctx.actor.householdId, userId],
    ),
    listEquipment(ctx),
    pinsOf(ctx, userId),
  ]);
  return rows.map((row) => describeExercise(toExercise(row), equipment, pins));
}

const cleanVariants = (variants: string[] | undefined) => [
  ...new Set((variants ?? []).map((v) => v.trim().replace(/\s+/g, ' ')).filter(Boolean)),
];

export async function createExercise(
  ctx: Ctx,
  userId: string,
  input: ExerciseInput,
): Promise<Exercise> {
  const { rows } = await ctx.db.query<ExerciseRow>(
    `INSERT INTO training_exercises (id, household_id, user_id, preset, name, category, muscles, secondary, equipment, measure, weighted, unilateral,
                                     reps, seconds, distance, rest, level, impact, icon, steps, note, variants, created_by, created_at, updated_at,
                                     translations)
     VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $23, $24)
     RETURNING ${EXERCISE_COLUMNS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      userId,
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
      cleanVariants(input.variants),
      ctx.actor.userId,
      ctx.now,
      JSON.stringify(cleanTranslations(input.translations)),
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
  const { archived, translations: given, ...fields } = patch;
  const next = {
    ...current,
    ...fields,
    variants: fields.variants ? cleanVariants(fields.variants) : current.variants,
  };
  const text = (e: Pick<Exercise, 'name' | 'note' | 'steps' | 'variants'>) => ({
    name: e.name,
    note: e.note,
    steps: e.steps,
    variants: e.variants,
  });
  // A renamed exercise drops the translations of its old name; translations sent along win.
  const translations = mergeTranslations(
    rebaseTranslations(current.translations, text(current), text(next)),
    given,
  );
  const { rows } = await ctx.db.query<ExerciseRow>(
    `UPDATE training_exercises SET name = $3, category = $4, muscles = $5, secondary = $6, equipment = $7, measure = $8, weighted = $9,
            unilateral = $10, reps = $11, seconds = $12, distance = $13, rest = $14, level = $15, impact = $16, icon = $17, steps = $18,
            note = $19, archived_at = $20, variants = $21, updated_at = $22, translations = $23
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
      next.variants,
      ctx.now,
      JSON.stringify(translations),
    ],
  );
  return toExercise(rows[0]!);
}

/** Pins live in the library they belong to: someone pins their own exercises. */
export async function setPinned(
  ctx: Ctx,
  userId: string,
  exerciseId: string,
  pinned: boolean,
): Promise<void> {
  const exercise = await findExercise(ctx, exerciseId);
  if (exercise.userId !== userId)
    throw new AppError(400, 'VALIDATION', 'That exercise is in someone else’s library', {
      fields: { userId: 'Not theirs' },
    });
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
