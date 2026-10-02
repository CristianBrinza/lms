import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import { describeLines, ingredientRows, insertIngredientRows, resolveIngredients, stockSnapshot, type Availability, type IngredientLine, type IngredientRow } from './ingredients';
import type { FoodCtx } from './kitchen';
import type { FoodIcon } from './presets';
import { findProduct, resolveProduct, updateProduct } from './products';
import { getRecipe, recipeIngredients } from './recipes';
import type { CompleteMealInput, MEAL_SLOTS, MealIngredientInput, MealInput, MealPatch } from './schemas';
import { addStock, localDate, removeLot, restoreStock, useStock } from './stock';
import { round, type BaseUnit } from './units';

/**
 * The plan: meals on a day, at a time or in a slot, from a recipe or just named. A meal keeps its
 * own ingredient list (copied from the recipe and scaled to its servings) so it can be changed for
 * that day alone. Marking it done takes the ingredients from the kitchen — the chosen piece, else
 * first-expiring first — and can put leftovers back as portions. Reopening undoes all of it.
 */

export type Slot = (typeof MEAL_SLOTS)[number];

export interface Meal {
  id: string;
  date: string;
  time: string | null;
  slot: Slot;
  recipeId: string | null;
  title: string;
  icon: FoodIcon;
  servings: number;
  status: 'planned' | 'done' | 'skipped';
  note: string;
  doneAt: string | null;
  createdVia: 'app' | 'ai';
  leftoversLotId: string | null;
  ingredients: IngredientLine[];
  availability: Availability;
}

interface MealRow {
  id: string;
  date: string;
  time: string | null;
  slot: Slot;
  recipe_id: string | null;
  recipe_icon: FoodIcon | null;
  title: string;
  servings: number;
  status: Meal['status'];
  note: string;
  done_at: Date | null;
  created_via: 'app' | 'ai';
  leftovers_lot_id: string | null;
}

const MEAL_SELECT = `SELECT m.id, m.date, to_char(m.time, 'HH24:MI') AS time, m.slot, m.recipe_id, r.icon AS recipe_icon, m.title, m.servings, m.status, m.note,
       m.done_at, m.created_via, m.leftovers_lot_id
  FROM meals m LEFT JOIN recipes r ON r.id = m.recipe_id`;

/** A day's meals in eating order: by time, a slot without a time standing at its usual hour. */
const MEAL_ORDER = `m.date, coalesce(m.time, CASE m.slot WHEN 'breakfast' THEN time '08:00' WHEN 'lunch' THEN time '13:00' WHEN 'snack' THEN time '16:30' ELSE time '19:00' END), m.created_at`;

export function slotFor(time: string | null | undefined): Slot {
  if (!time) return 'dinner';
  const hour = Number(time.slice(0, 2));
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 18) return 'snack';
  return 'dinner';
}

async function build(ctx: FoodCtx, rows: MealRow[]): Promise<Meal[]> {
  const stock = await stockSnapshot(ctx);
  const ingredients = await ingredientRows(ctx, 'meal_ingredients', rows.map((r) => r.id));
  return rows.map((row) => {
    const { lines, availability } = describeLines(ingredients.get(row.id) ?? [], stock, ctx.now);
    return {
      id: row.id,
      date: row.date,
      time: row.time,
      slot: row.slot,
      recipeId: row.recipe_id,
      title: row.title,
      icon: row.recipe_icon ?? 'pot',
      servings: row.servings,
      status: row.status,
      note: row.note,
      doneAt: row.done_at?.toISOString() ?? null,
      createdVia: row.created_via,
      leftoversLotId: row.leftovers_lot_id,
      ingredients: lines,
      availability,
    };
  });
}

export async function listMeals(ctx: FoodCtx, from: string, to: string): Promise<Meal[]> {
  const { rows } = await ctx.db.query<MealRow>(`${MEAL_SELECT} WHERE m.household_id = $1 AND m.date BETWEEN $2 AND $3 ORDER BY ${MEAL_ORDER}`, [
    ctx.actor.householdId,
    from,
    to,
  ]);
  return build(ctx, rows);
}

async function findMealRow(ctx: FoodCtx, id: string, lock = false): Promise<MealRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Meal not found');
  const { rows } = await ctx.db.query<MealRow>(`${MEAL_SELECT} WHERE m.id = $1 AND m.household_id = $2${lock ? ' FOR UPDATE OF m' : ''}`, [id, ctx.actor.householdId]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Meal not found');
  return rows[0];
}

export async function getMeal(ctx: FoodCtx, id: string): Promise<Meal> {
  return (await build(ctx, [await findMealRow(ctx, id)]))[0]!;
}

/** The recipe's lines, scaled from its servings to `servings`. */
async function recipeCopy(ctx: FoodCtx, recipeId: string, servings: number): Promise<Array<Omit<IngredientRow, 'id' | 'owner_id'>>> {
  const recipe = await getRecipe(ctx, recipeId);
  const scale = servings / recipe.servings;
  return (await recipeIngredients(ctx, recipeId)).map((row) => ({
    product_id: row.product_id,
    lot_id: null,
    name: row.name,
    amount: row.amount === null ? null : round(row.amount * scale),
    unit: row.unit,
    note: row.note,
    optional: row.optional,
    sort: row.sort,
  }));
}

export async function planMeal(ctx: FoodCtx, input: MealInput): Promise<Meal> {
  const recipe = input.recipeId ? await getRecipe(ctx, input.recipeId) : null;
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const servings = input.servings ?? recipe?.servings ?? 2;
    const ingredients = input.ingredients
      ? await resolveIngredients(tx, input.ingredients)
      : recipe
        ? await recipeCopy(tx, recipe.id, servings)
        : [];
    await tx.db.query(
      `INSERT INTO meals (id, household_id, date, time, slot, recipe_id, title, servings, note, created_by, created_via, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
      [id, tx.actor.householdId, input.date, input.time ?? null, input.slot ?? slotFor(input.time), recipe?.id ?? null, input.title ?? recipe!.title, servings, input.note ?? '', tx.actor.userId, tx.actor.via, tx.now],
    );
    await insertIngredientRows(tx, 'meal_ingredients', id, ingredients);
  });
  return getMeal(ctx, id);
}

export async function updateMeal(ctx: FoodCtx, id: string, patch: MealPatch): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    const onlyNote = Object.keys(patch).every((key) => key === 'note');
    if (meal.status === 'done' && !onlyNote) throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    const servings = patch.servings ?? meal.servings;
    let title = patch.title;
    if (patch.recipeId) {
      // A swap: the new recipe's ingredients, at this meal's servings.
      const recipe = await getRecipe(tx, patch.recipeId);
      title ??= recipe.title;
      await insertIngredientRows(tx, 'meal_ingredients', id, await recipeCopy(tx, recipe.id, servings));
    } else if (patch.servings && patch.servings !== meal.servings) {
      await tx.db.query('UPDATE meal_ingredients SET amount = round(amount * $2::numeric, 3) WHERE meal_id = $1 AND amount IS NOT NULL', [id, patch.servings / meal.servings]);
    }
    await tx.db.query(
      `UPDATE meals SET date = coalesce($2, date), time = CASE WHEN $3::boolean THEN $4::time ELSE time END, slot = coalesce($5, slot),
              recipe_id = CASE WHEN $6::boolean THEN $7::uuid ELSE recipe_id END, title = coalesce($8, title), servings = $9,
              note = coalesce($10, note), status = coalesce($11, status), updated_at = $12
        WHERE id = $1`,
      [
        id,
        patch.date ?? null,
        patch.time !== undefined,
        patch.time ?? null,
        patch.slot ?? (patch.time ? slotFor(patch.time) : null),
        patch.recipeId !== undefined,
        patch.recipeId ?? null,
        title ?? null,
        servings,
        patch.note ?? null,
        patch.status ?? null,
        tx.now,
      ],
    );
  });
  return getMeal(ctx, id);
}

export async function setMealIngredients(ctx: FoodCtx, id: string, inputs: MealIngredientInput[]): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    await insertIngredientRows(tx, 'meal_ingredients', id, await resolveIngredients(tx, inputs));
  });
  return getMeal(ctx, id);
}

export interface Shortfall {
  name: string;
  missing: number;
  unit: BaseUnit;
}

/** Cooked: the ingredients leave the kitchen; leftovers, if any, come back as portions. */
export async function completeMeal(ctx: FoodCtx, id: string, input: CompleteMealInput = {}): Promise<{ meal: Meal; shortfalls: Shortfall[] }> {
  const shortfalls: Shortfall[] = [];
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is already done');
    const rows = (await ingredientRows(tx, 'meal_ingredients', [id])).get(id) ?? [];
    for (const row of rows) {
      if (!row.product_id || row.amount === null) continue;
      const product = await findProduct(tx, row.product_id);
      if (!product.trackStock) continue;
      const result = await useStock(tx, { productId: product.id, quantity: row.amount, unit: row.unit ?? product.unit, lotId: row.lot_id ?? undefined, mealId: id });
      if (result.shortfall > 0 && !row.optional) shortfalls.push({ name: row.name, missing: result.shortfall, unit: product.unit });
    }
    let leftoversLotId: string | null = null;
    if (input.leftovers) {
      let product = await resolveProduct(tx, `${meal.title} (leftovers)`, 'pcs');
      if (product.icon === 'basket') {
        product = await updateProduct(tx, product.id, { icon: 'container', category: 'meals', location: 'fridge', shelfLifeDays: 3 });
      }
      const { lot } = await addStock(tx, {
        productId: product.id,
        quantity: input.leftovers.portions,
        unit: 'pcs',
        location: input.leftovers.location ?? 'fridge',
        expiresOn: input.leftovers.expiresOn === undefined ? localDate(tx.now, 3) : input.leftovers.expiresOn,
        note: `From ${meal.title}, ${meal.date}`,
      });
      leftoversLotId = lot.id;
    }
    await tx.db.query(`UPDATE meals SET status = 'done', done_at = $2, leftovers_lot_id = $3, updated_at = $2 WHERE id = $1`, [id, tx.now, leftoversLotId]);
  });
  return { meal: await getMeal(ctx, id), shortfalls };
}

/** Undoes "done": what the meal took goes back into the same lots; untouched leftovers are removed. */
export async function reopenMeal(ctx: FoodCtx, id: string): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status !== 'done') throw new AppError(409, 'NOT_DONE', 'This meal is not marked done');
    const { rows } = await tx.db.query<{ lot_id: string; taken: number }>(
      `SELECT lot_id, -sum(delta)::numeric AS taken FROM stock_events
        WHERE meal_id = $1 AND lot_id IS NOT NULL AND kind IN ('used', 'wasted', 'restored') GROUP BY lot_id`,
      [id],
    );
    await restoreStock(tx, rows.map((row) => ({ lotId: row.lot_id, quantity: row.taken })), { mealId: id, note: `Reopened ${meal.title}` });
    if (meal.leftovers_lot_id) {
      const { rows: lots } = await tx.db.query<{ quantity: number; initial_quantity: number; finished_at: Date | null }>(
        'SELECT quantity, initial_quantity, finished_at FROM stock_lots WHERE id = $1',
        [meal.leftovers_lot_id],
      );
      const lot = lots[0];
      if (lot && !lot.finished_at && lot.quantity === lot.initial_quantity) await removeLot(tx, meal.leftovers_lot_id);
    }
    await tx.db.query(`UPDATE meals SET status = 'planned', done_at = NULL, leftovers_lot_id = NULL, updated_at = $2 WHERE id = $1`, [id, tx.now]);
  });
  return getMeal(ctx, id);
}

export async function deleteMeal(ctx: FoodCtx, id: string): Promise<void> {
  await findMealRow(ctx, id);
  await ctx.db.query('DELETE FROM meals WHERE id = $1', [id]);
}

/** "Cook now" from a recipe: a meal for today, at this time, marked done at once. */
export async function cookRecipe(ctx: FoodCtx, recipeId: string, input: { servings?: number; leftovers?: CompleteMealInput['leftovers'] }) {
  const time = `${String(ctx.now.getHours()).padStart(2, '0')}:${String(ctx.now.getMinutes()).padStart(2, '0')}`;
  const meal = await planMeal(ctx, { date: localDate(ctx.now), time, recipeId, servings: input.servings });
  return completeMeal(ctx, meal.id, { leftovers: input.leftovers });
}
