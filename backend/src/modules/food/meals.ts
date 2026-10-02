import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import { allocatePlan, coveringAlternative } from './allocation';
import { describeNeeds, dirtyAfterCooking, listTools, recipeTools, undoDirty, type ToolNeed } from './kitchenware';
import { listRestrictions } from './restrictions';
import { appendIngredientRows, describeLines, ingredientRows, insertIngredientRows, neededBase, resolveIngredients, stockFor, stockSnapshot, type Availability, type IngredientLine, type IngredientRow } from './ingredients';
import type { FoodCtx } from './kitchen';
import type { FoodIcon } from './presets';
import { findProduct, resolveProduct, updateProduct } from './products';
import { getRecipe, recipeIngredients } from './recipes';
import type { CompleteMealInput, MEAL_PART_KINDS, MEAL_SLOTS, MealIngredientInput, MealInput, MealPartInput, MealPartPatch, MealPatch } from './schemas';
import { addStock, localDate, removeLot, restoreStock, useStock } from './stock';
import { round, type BaseUnit } from './units';
import type { Location } from './presets';

/**
 * A meal can be several things: an omelette and a coffee, bread with Philadelphia and salmon on
 * the side, a sauce made apart. Each part comes from a recipe or is just named with its own lines.
 *
 * The plan: meals on a day, at a time or in a slot, from a recipe or just named. A meal keeps its
 * own ingredient list (copied from the recipe and scaled to its servings) so it can be changed for
 * that day alone. Marking it done takes the ingredients from the kitchen — the chosen piece, else
 * first-expiring first — and can put leftovers back as portions. Reopening undoes all of it.
 */

export type Slot = (typeof MEAL_SLOTS)[number];
export type PartKind = (typeof MEAL_PART_KINDS)[number];

export interface MealPart {
  id: string;
  recipeId: string | null;
  title: string;
  kind: PartKind;
  servings: number;
  icon: FoodIcon;
}

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
  /** Packed to take along: it can be prepared (and marked done) the evening before. */
  toGo: boolean;
  doneAt: string | null;
  createdVia: 'app' | 'ai';
  leftoversLotId: string | null;
  /** What the meal is made of; its lines carry the part they belong to (partId). */
  parts: MealPart[];
  /** Kitchenware its parts need, and whether it will be clean by the meal's time. */
  tools: ToolNeed[];
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
  to_go: boolean;
  done_at: Date | null;
  created_via: 'app' | 'ai';
  leftovers_lot_id: string | null;
  dirtied: Array<{ toolId: string; count: number }> | null;
}

const MEAL_SELECT = `SELECT m.id, m.date, to_char(m.time, 'HH24:MI') AS time, m.slot, m.recipe_id, r.icon AS recipe_icon, m.title, m.servings, m.status, m.note,
       m.to_go, m.done_at, m.created_via, m.leftovers_lot_id, m.dirtied
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

async function partsOf(ctx: FoodCtx, mealIds: string[]): Promise<Map<string, MealPart[]>> {
  const map = new Map<string, MealPart[]>();
  if (!mealIds.length) return map;
  const { rows } = await ctx.db.query<{ id: string; meal_id: string; recipe_id: string | null; title: string; kind: PartKind; servings: number; icon: FoodIcon | null }>(
    `SELECT p.id, p.meal_id, p.recipe_id, p.title, p.kind, p.servings, r.icon FROM meal_parts p LEFT JOIN recipes r ON r.id = p.recipe_id
      WHERE p.meal_id = ANY($1::uuid[]) ORDER BY array_position(ARRAY['dish', 'side', 'sauce', 'drink'], p.kind), p.sort, p.id`,
    [mealIds],
  );
  for (const row of rows) {
    const part: MealPart = { id: row.id, recipeId: row.recipe_id, title: row.title, kind: row.kind, servings: row.servings, icon: row.icon ?? PART_ICON[row.kind] };
    map.set(row.meal_id, [...(map.get(row.meal_id) ?? []), part]);
  }
  return map;
}

/** Scales the amounts an ingredient's alternatives give (by $2), leaving "the same amount" ones alone. */
const SCALE_ALTERNATIVES = `alternatives = (SELECT coalesce(jsonb_agg(CASE WHEN a->>'amount' IS NULL THEN a ELSE jsonb_set(a, '{amount}', to_jsonb(round((a->>'amount')::numeric * $2::numeric, 3))) END), '[]'::jsonb) FROM jsonb_array_elements(alternatives) a)`;

const PART_ICON: Record<PartKind, FoodIcon> = { dish: 'pot', side: 'bowl', sauce: 'sauce', drink: 'tea' };

const SLOT_HOUR: Record<Slot, string> = { breakfast: '08:00', lunch: '13:00', snack: '16:30', dinner: '19:00' };

/** When a meal is eaten, local time. */
const mealTime = (row: Pick<MealRow, 'date' | 'time' | 'slot'>) => new Date(`${row.date}T${row.time ?? SLOT_HOUR[row.slot]}:00`);

/** What the meal's parts need, per part's recipe. */
async function mealNeeds(ctx: FoodCtx, parts: Map<string, MealPart[]>): Promise<Map<string, Array<{ toolId: string; count: number }>>> {
  const recipes = await recipeTools(ctx, [...new Set([...parts.values()].flat().flatMap((p) => (p.recipeId ? [p.recipeId] : [])))]);
  return new Map([...parts].map(([mealId, list]) => [mealId, list.flatMap((part) => (part.recipeId ? (recipes.get(part.recipeId) ?? []) : []))]));
}

async function build(ctx: FoodCtx, rows: MealRow[]): Promise<Meal[]> {
  const stock = await stockSnapshot(ctx);
  const parts = await partsOf(ctx, rows.map((r) => r.id));
  const needs = await mealNeeds(ctx, parts);
  const tools = [...needs.values()].some((n) => n.length) ? await listTools(ctx) : [];
  const ingredients = await ingredientRows(ctx, 'meal_ingredients', rows.map((r) => r.id));
  // Planned meals from today on share the kitchen in eating order.
  const allocation = await allocatePlan(ctx, stock, localDate(ctx.now));
  const restrictions = await listRestrictions(ctx);
  return rows.map((row) => {
    const { lines, availability } = describeLines(ingredients.get(row.id) ?? [], stock, ctx.now, 1, { allocation: allocation.lines, restrictions });
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
      toGo: row.to_go,
      doneAt: row.done_at?.toISOString() ?? null,
      createdVia: row.created_via,
      leftoversLotId: row.leftovers_lot_id,
      parts: parts.get(row.id) ?? [],
      tools: row.status === 'planned' ? describeNeeds(tools, needs.get(row.id) ?? [], mealTime(row)) : [],
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
    variant: row.variant ?? '',
    alternatives: (row.alternatives ?? []).map((alt) => ({ ...alt, amount: alt.amount === null ? null : round(alt.amount * scale) })),
    amount: row.amount === null ? null : round(row.amount * scale),
    unit: row.unit,
    note: row.note,
    optional: row.optional,
    sort: row.sort,
  }));
}

/** Adds a part to a meal: a recipe's lines scaled to its servings, or its own lines. */
async function insertPart(ctx: FoodCtx, mealId: string, input: MealPartInput, mealServings: number, extra?: MealIngredientInput[]): Promise<string> {
  const recipe = input.recipeId ? await getRecipe(ctx, input.recipeId) : null;
  const servings = input.servings ?? mealServings;
  const id = randomUUID();
  const { rows } = await ctx.db.query<{ next: number }>('SELECT coalesce(max(sort) + 1, 0) AS next FROM meal_parts WHERE meal_id = $1', [mealId]);
  const sort = rows[0]?.next ?? 0;
  await ctx.db.query('INSERT INTO meal_parts (id, meal_id, recipe_id, title, kind, servings, sort) VALUES ($1, $2, $3, $4, $5, $6, $7)', [
    id,
    mealId,
    recipe?.id ?? null,
    input.title ?? recipe!.title,
    input.kind ?? 'dish',
    servings,
    sort,
  ]);
  const lines = extra ? await resolveIngredients(ctx, extra) : input.ingredients ? await resolveIngredients(ctx, input.ingredients) : recipe ? await recipeCopy(ctx, recipe.id, servings) : [];
  // Lines keep their part's place in the meal: the first part's lines first.
  await appendIngredientRows(ctx, 'meal_ingredients', mealId, lines.map((line, index) => ({ ...line, part_id: id, sort: sort * 100 + index })));
  return id;
}

/** The meal's own recipe link follows its first dish made from a recipe. */
async function syncMainRecipe(ctx: FoodCtx, mealId: string): Promise<void> {
  await ctx.db.query(
    `UPDATE meals SET recipe_id = (SELECT recipe_id FROM meal_parts WHERE meal_id = $1 AND recipe_id IS NOT NULL ORDER BY (kind = 'dish') DESC, sort LIMIT 1) WHERE id = $1`,
    [mealId],
  );
}

export async function planMeal(ctx: FoodCtx, input: MealInput): Promise<Meal> {
  const recipe = input.recipeId ? await getRecipe(ctx, input.recipeId) : null;
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const servings = input.servings ?? recipe?.servings ?? 2;
    const parts: MealPartInput[] = [...(recipe ? [{ recipeId: recipe.id, servings }] : []), ...(input.parts ?? [])];
    const partRecipes = await Promise.all(parts.map((part) => (part.recipeId ? getRecipe(tx, part.recipeId) : null)));
    const title = input.title ?? recipe?.title ?? parts.map((part, index) => part.title ?? partRecipes[index]!.title).join(' + ');
    await tx.db.query(
      `INSERT INTO meals (id, household_id, date, time, slot, recipe_id, title, servings, note, created_by, created_via, created_at, updated_at, to_go)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13)`,
      [
        id,
        tx.actor.householdId,
        input.date,
        input.time ?? null,
        input.slot ?? slotFor(input.time),
        null,
        title.slice(0, 120),
        servings,
        input.note ?? '',
        tx.actor.userId,
        tx.actor.via,
        tx.now,
        // A recipe tagged "to go" is packed by default.
        input.toGo ?? partRecipes.some((r) => r?.tags.some((tag) => tag === 'to go' || tag === 'to-go' || tag === 'lunchbox')),
      ],
    );
    for (const [index, part] of parts.entries()) {
      // Lines given for the meal replace the first recipe's (the older way to change a meal's lines).
      await insertPart(tx, id, part, servings, index === 0 && recipe && input.ingredients ? input.ingredients : undefined);
    }
    if (!recipe && input.ingredients) await appendIngredientRows(tx, 'meal_ingredients', id, await resolveIngredients(tx, input.ingredients));
    await syncMainRecipe(tx, id);
  });
  return getMeal(ctx, id);
}

export async function addMealPart(ctx: FoodCtx, mealId: string, input: MealPartInput): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, mealId, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    await insertPart(tx, mealId, input, meal.servings);
    await syncMainRecipe(tx, mealId);
  });
  return getMeal(ctx, mealId);
}

async function findPart(ctx: FoodCtx, mealId: string, partId: string): Promise<{ id: string; servings: number; recipe_id: string | null }> {
  if (!isUuid(partId)) throw new AppError(404, 'NOT_FOUND', 'That part is not in this meal');
  const { rows } = await ctx.db.query<{ id: string; servings: number; recipe_id: string | null }>('SELECT id, servings, recipe_id FROM meal_parts WHERE id = $1 AND meal_id = $2', [partId, mealId]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That part is not in this meal');
  return rows[0];
}

export async function updateMealPart(ctx: FoodCtx, mealId: string, partId: string, patch: MealPartPatch): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, mealId, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    const part = await findPart(tx, mealId, partId);
    if (patch.servings && patch.servings !== part.servings) {
      await tx.db.query(`UPDATE meal_ingredients SET amount = CASE WHEN amount IS NULL THEN NULL ELSE round(amount * $2::numeric, 3) END, ${SCALE_ALTERNATIVES} WHERE part_id = $1`, [
        partId,
        patch.servings / part.servings,
      ]);
    }
    await tx.db.query('UPDATE meal_parts SET title = coalesce($2, title), kind = coalesce($3, kind), servings = coalesce($4, servings) WHERE id = $1', [
      partId,
      patch.title ?? null,
      patch.kind ?? null,
      patch.servings ?? null,
    ]);
    await syncMainRecipe(tx, mealId);
  });
  return getMeal(ctx, mealId);
}

export async function removeMealPart(ctx: FoodCtx, mealId: string, partId: string): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, mealId, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    await findPart(tx, mealId, partId);
    // Its lines go with it (ON DELETE CASCADE).
    await tx.db.query('DELETE FROM meal_parts WHERE id = $1', [partId]);
    await syncMainRecipe(tx, mealId);
  });
  return getMeal(ctx, mealId);
}

export async function updateMeal(ctx: FoodCtx, id: string, patch: MealPatch): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    const onlyNote = Object.keys(patch).every((key) => key === 'note');
    if (meal.status === 'done' && !onlyNote) throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    const servings = patch.servings ?? meal.servings;
    let title = patch.title;
    if (patch.recipeId) {
      // A swap: the main dish becomes the new recipe, its lines at this meal's servings; other parts stay.
      const recipe = await getRecipe(tx, patch.recipeId);
      title ??= recipe.title;
      const { rows: main } = await tx.db.query<{ id: string }>(
        `SELECT id FROM meal_parts WHERE meal_id = $1 ORDER BY (kind = 'dish') DESC, (recipe_id IS NOT NULL) DESC, sort LIMIT 1`,
        [id],
      );
      if (main[0]) await tx.db.query('DELETE FROM meal_parts WHERE id = $1', [main[0].id]);
      else await tx.db.query('DELETE FROM meal_ingredients WHERE meal_id = $1 AND part_id IS NULL', [id]);
      const partId = await insertPart(tx, id, { recipeId: recipe.id, servings }, servings);
      // The main dish goes first.
      await tx.db.query('UPDATE meal_parts SET sort = -1 WHERE id = $1', [partId]);
      await tx.db.query('UPDATE meal_ingredients SET sort = sort - 100000 WHERE part_id = $1', [partId]);
    } else if (patch.servings && patch.servings !== meal.servings) {
      const factor = patch.servings / meal.servings;
      await tx.db.query(`UPDATE meal_ingredients SET amount = CASE WHEN amount IS NULL THEN NULL ELSE round(amount * $2::numeric, 3) END, ${SCALE_ALTERNATIVES} WHERE meal_id = $1`, [id, factor]);
      await tx.db.query('UPDATE meal_parts SET servings = greatest(1, least(100, round(servings * $2::numeric))) WHERE meal_id = $1', [id, factor]);
    }
    await tx.db.query(
      `UPDATE meals SET date = coalesce($2, date), time = CASE WHEN $3::boolean THEN $4::time ELSE time END, slot = coalesce($5, slot),
              recipe_id = CASE WHEN $6::boolean AND $7::uuid IS NULL THEN NULL ELSE recipe_id END, title = coalesce($8, title), servings = $9,
              note = coalesce($10, note), status = coalesce($11, status), updated_at = $12, to_go = coalesce($13, to_go)
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
        patch.toGo ?? null,
      ],
    );
    if (patch.recipeId) await syncMainRecipe(tx, id);
  });
  return getMeal(ctx, id);
}

export async function setMealIngredients(ctx: FoodCtx, id: string, inputs: MealIngredientInput[]): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    const { rows: parts } = await tx.db.query<{ id: string }>('SELECT id FROM meal_parts WHERE meal_id = $1', [id]);
    for (const [index, input] of inputs.entries()) {
      if (input.partId && !parts.some((part) => part.id === input.partId)) {
        throw new AppError(400, 'VALIDATION', 'That part is not in this meal', { fields: { [`ingredients.${index}.partId`]: 'Unknown part' } });
      }
    }
    await insertIngredientRows(tx, 'meal_ingredients', id, await resolveIngredients(tx, inputs));
  });
  return getMeal(ctx, id);
}

export interface Shortfall {
  name: string;
  missing: number;
  unit: BaseUnit;
}

/** A package cooking opened: what is left of it, until when, and where it now is. */
export interface Opened {
  productId: string;
  lotId: string;
  name: string;
  left: number;
  unit: BaseUnit;
  expiresOn: string | null;
  location: Location;
}

/** Cooked: the ingredients leave the kitchen; leftovers, if any, come back as portions. */
export async function completeMeal(ctx: FoodCtx, id: string, input: CompleteMealInput = {}): Promise<{ meal: Meal; shortfalls: Shortfall[]; opened: Opened[] }> {
  const shortfalls: Shortfall[] = [];
  const opened: Opened[] = [];
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is already done');
    const rows = (await ingredientRows(tx, 'meal_ingredients', [id])).get(id) ?? [];
    const stock = await stockSnapshot(tx);
    for (const row of rows) {
      if (!row.product_id || row.amount === null) continue;
      const product = await findProduct(tx, row.product_id);
      if (product.trackMode !== 'exact') continue;
      // The option picked for this meal; not picked and not enough of it: the first alternative
      // there is enough of (milk, or whipped cream).
      const need = neededBase(row, product);
      const main = stock.get(product.id);
      const picked = row.choice ? (row.alternatives ?? [])[row.choice - 1] : undefined;
      const pickedInfo = picked?.product_id ? stock.get(picked.product_id) : undefined;
      if (picked && pickedInfo && pickedInfo.product.trackMode === 'exact') {
        const pickedNeed = neededBase(picked.amount === null ? row : picked, pickedInfo.product);
        if (pickedNeed !== null) {
          const result = await useStock(tx, { productId: pickedInfo.product.id, quantity: pickedNeed, unit: pickedInfo.product.unit, variant: picked.variant || undefined, mealId: id });
          if (result.shortfall > 0 && !row.optional) shortfalls.push({ name: pickedInfo.product.name, missing: result.shortfall, unit: pickedInfo.product.unit });
          for (const lot of result.lots) {
            if (lot.opened) opened.push({ productId: pickedInfo.product.id, lotId: lot.lotId, name: pickedInfo.product.name, left: lot.left, unit: pickedInfo.product.unit, expiresOn: lot.expiresOn, location: lot.location });
          }
          continue;
        }
      }
      const automatic = row.choice === null || row.choice === undefined;
      if (automatic && need !== null && main && stockFor(main, row.variant) + 1e-9 < need) {
        const alt = coveringAlternative(row, stock, (productId, amount, variant) => stockFor(stock.get(productId)!, variant) + 1e-9 >= amount);
        if (alt) {
          const altProduct = stock.get(alt.productId)!.product;
          const result = await useStock(tx, { productId: alt.productId, quantity: alt.need, unit: altProduct.unit, variant: alt.variant, mealId: id });
          for (const lot of result.lots) {
            if (lot.opened) opened.push({ productId: alt.productId, lotId: lot.lotId, name: altProduct.name, left: lot.left, unit: altProduct.unit, expiresOn: lot.expiresOn, location: lot.location });
          }
          continue;
        }
      }
      const result = await useStock(tx, {
        productId: product.id,
        quantity: row.amount,
        unit: row.unit ?? product.unit,
        lotId: row.lot_id ?? undefined,
        variant: row.variant || undefined,
        mealId: id,
      });
      if (result.shortfall > 0 && !row.optional) shortfalls.push({ name: row.name, missing: result.shortfall, unit: product.unit });
      for (const lot of result.lots) {
        if (lot.opened) opened.push({ productId: product.id, lotId: lot.lotId, name: product.name, left: lot.left, unit: product.unit, expiresOn: lot.expiresOn, location: lot.location });
      }
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
      leftoversLotId = lot?.id ?? null;
    }
    // What it was cooked with is dirty now.
    const needs = (await mealNeeds(tx, await partsOf(tx, [id]))).get(id) ?? [];
    const dirtied = needs.length ? await dirtyAfterCooking(tx, needs) : [];
    await tx.db.query(`UPDATE meals SET status = 'done', done_at = $2, leftovers_lot_id = $3, updated_at = $2, dirtied = $4 WHERE id = $1`, [
      id,
      tx.now,
      leftoversLotId,
      dirtied.length ? JSON.stringify(dirtied) : null,
    ]);
  });
  return { meal: await getMeal(ctx, id), shortfalls, opened };
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
    if (meal.dirtied) await undoDirty(tx, meal.dirtied);
    await tx.db.query(`UPDATE meals SET status = 'planned', done_at = NULL, leftovers_lot_id = NULL, dirtied = NULL, updated_at = $2 WHERE id = $1`, [id, tx.now]);
  });
  return getMeal(ctx, id);
}

export async function deleteMeal(ctx: FoodCtx, id: string): Promise<void> {
  await findMealRow(ctx, id);
  await ctx.db.query('DELETE FROM meals WHERE id = $1', [id]);
}

/** "Cook now" from a recipe: a meal for today, at this time, marked done at once. */
export async function cookRecipe(
  ctx: FoodCtx,
  recipeId: string,
  input: { servings?: number; leftovers?: CompleteMealInput['leftovers']; choices?: Record<string, number> },
) {
  const time = `${String(ctx.now.getHours()).padStart(2, '0')}:${String(ctx.now.getMinutes()).padStart(2, '0')}`;
  // One transaction: a failed cook leaves no stray planned meal behind.
  return ctx.tx(async (tx) => {
    const planned = await planMeal(tx, { date: localDate(tx.now), time, recipeId, servings: input.servings });
    if (input.choices && Object.keys(input.choices).length) {
      // Milk or whipped cream, as picked: by the ingredient's place in the recipe.
      for (const [position, choice] of Object.entries(input.choices)) {
        await tx.db.query('UPDATE meal_ingredients SET choice = $3 WHERE meal_id = $1 AND sort = $2 AND jsonb_array_length(alternatives) >= $3', [planned.id, Number(position), choice]);
      }
      // What was picked must be there: cooking with whipped cream there isn't is refused, not half-done.
      const meal = await getMeal(tx, planned.id);
      const short = meal.ingredients.filter((line) => line.choice !== null && line.enough === false && !line.optional);
      if (short.length) {
        const names = short.map((line) => (line.using ? line.using.name : line.name)).join(', ');
        throw new AppError(409, 'NOT_ENOUGH', `Not enough ${names.toLowerCase()} for what you picked`, { fields: { choices: names } });
      }
    }
    return completeMeal(tx, planned.id, { leftovers: input.leftovers });
  });
}

/** Picks which option a planned meal's line takes (0 the main item, 1… an alternative), or back to automatic. */
export async function setLineChoice(ctx: FoodCtx, mealId: string, lineId: string, choice: number | null): Promise<Meal> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, mealId, true);
    if (meal.status === 'done') throw new AppError(409, 'DONE', 'This meal is done; reopen it to change it');
    if (!isUuid(lineId)) throw new AppError(404, 'NOT_FOUND', 'That line is not in this meal');
    const { rows } = await tx.db.query<{ options: number }>('SELECT jsonb_array_length(alternatives) AS options FROM meal_ingredients WHERE id = $1 AND meal_id = $2', [lineId, mealId]);
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That line is not in this meal');
    if (choice !== null && choice > rows[0].options) throw new AppError(400, 'VALIDATION', 'That line has no such option', { fields: { choice: 'No such option' } });
    await tx.db.query('UPDATE meal_ingredients SET choice = $3 WHERE id = $1 AND meal_id = $2', [lineId, mealId, choice]);
  });
  return getMeal(ctx, mealId);
}

/** The undo for "Cook now": everything goes back into the kitchen and the meal is gone. */
export async function uncookMeal(ctx: FoodCtx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const meal = await findMealRow(tx, id, true);
    if (meal.status === 'done') await reopenMeal(tx, id);
    await tx.db.query('DELETE FROM meals WHERE id = $1', [id]);
  });
}
