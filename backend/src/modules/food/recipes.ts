import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import { allocatePlan } from './allocation';
import {
  describeNeeds,
  listTools,
  recipeTools,
  setRecipeTools,
  type ToolNeed,
} from './kitchenware';
import { listRestrictions } from './restrictions';
import { localDate } from './stock';
import {
  describeLines,
  ingredientRows,
  insertIngredientRows,
  resolveIngredients,
  stockSnapshot,
  type Availability,
  type IngredientLine,
  type StockInfo,
} from './ingredients';
import type { FoodCtx } from './kitchen';
import type { FoodIcon } from './presets';
import type { RecipeInput } from './schemas';

/**
 * Recipes: ingredients linked to kitchen items, steps, servings. Each comes with how ready it is
 * to cook from what is in the kitchen, and how much of it would use up food about to expire.
 */

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  steps: string[];
  icon: FoodIcon;
  sourceUrl: string;
  notes: string;
  favorite: boolean;
  createdVia: 'app' | 'ai';
  createdAt: string;
  updatedAt: string;
  /** Servings the ingredient amounts and availability are shown for. */
  shownServings: number;
  ingredients: IngredientLine[];
  availability: Availability;
  /** Kitchenware it needs, and whether it is clean now. */
  tools: ToolNeed[];
  timesCooked: number;
  lastCooked: string | null;
}

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  steps: string[];
  icon: FoodIcon;
  source_url: string;
  notes: string;
  favorite: boolean;
  created_via: 'app' | 'ai';
  created_at: Date;
  updated_at: Date;
  times_cooked: number;
  last_cooked: string | null;
}

const RECIPE_SELECT = `SELECT r.id, r.title, r.description, r.servings, r.prep_minutes, r.cook_minutes, r.tags, r.steps, r.icon, r.source_url, r.notes,
       r.favorite, r.created_via, r.created_at, r.updated_at,
       (SELECT count(*)::int FROM meals m WHERE m.recipe_id = r.id AND m.status = 'done') AS times_cooked,
       (SELECT max(m.date) FROM meals m WHERE m.recipe_id = r.id AND m.status = 'done') AS last_cooked
  FROM recipes r`;

function toRecipe(
  row: RecipeRow,
  lines: ReturnType<typeof describeLines>,
  shownServings: number,
  tools: ToolNeed[],
): Recipe {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    tags: row.tags,
    steps: row.steps,
    icon: row.icon,
    sourceUrl: row.source_url,
    notes: row.notes,
    favorite: row.favorite,
    createdVia: row.created_via,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    shownServings,
    ingredients: lines.lines,
    availability: lines.availability,
    tools,
    timesCooked: row.times_cooked,
    lastCooked: row.last_cooked,
  };
}

async function build(
  ctx: FoodCtx,
  rows: RecipeRow[],
  stock?: Map<string, StockInfo>,
  servings?: number,
): Promise<Recipe[]> {
  const snapshot = stock ?? (await stockSnapshot(ctx));
  const ingredients = await ingredientRows(
    ctx,
    'recipe_ingredients',
    rows.map((r) => r.id),
  );
  // Cooking now may only use what planned meals haven't claimed.
  const { reserved } = await allocatePlan(ctx, snapshot, localDate(ctx.now));
  const restrictions = await listRestrictions(ctx);
  const needs = await recipeTools(
    ctx,
    rows.map((r) => r.id),
  );
  const tools = needs.size ? await listTools(ctx) : [];
  return rows.map((row) => {
    const shown = servings ?? row.servings;
    const lines = describeLines(
      ingredients.get(row.id) ?? [],
      snapshot,
      ctx.now,
      shown / row.servings,
      { reserved, restrictions },
    );
    return toRecipe(
      row,
      lines,
      shown,
      describeNeeds(
        tools,
        (needs.get(row.id) ?? []).map((need) => ({ ...need, servings: shown })),
        ctx.now,
      ),
    );
  });
}

/** All recipes: favourites first, then ready to cook, then by name. */
export async function listRecipes(ctx: FoodCtx): Promise<Recipe[]> {
  const { rows } = await ctx.db.query<RecipeRow>(
    `${RECIPE_SELECT} WHERE r.household_id = $1 AND r.archived_at IS NULL ORDER BY lower(r.title)`,
    [ctx.actor.householdId],
  );
  return build(ctx, rows);
}

export async function getRecipe(ctx: FoodCtx, id: string, servings?: number): Promise<Recipe> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Recipe not found');
  const { rows } = await ctx.db.query<RecipeRow>(
    `${RECIPE_SELECT} WHERE r.id = $1 AND r.household_id = $2 AND r.archived_at IS NULL`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Recipe not found');
  return (await build(ctx, rows, undefined, servings))[0]!;
}

export async function createRecipe(ctx: FoodCtx, input: RecipeInput): Promise<Recipe> {
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const ingredients = await resolveIngredients(tx, input.ingredients ?? []);
    await tx.db.query(
      `INSERT INTO recipes (id, household_id, title, description, servings, prep_minutes, cook_minutes, tags, steps, icon, source_url, notes, favorite,
                            created_by, created_via, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
      [
        id,
        tx.actor.householdId,
        input.title,
        input.description ?? '',
        input.servings ?? 2,
        input.prepMinutes ?? null,
        input.cookMinutes ?? null,
        input.tags ?? [],
        input.steps ?? [],
        input.icon ?? 'pot',
        input.sourceUrl ?? '',
        input.notes ?? '',
        input.favorite ?? false,
        tx.actor.userId,
        tx.actor.via,
        tx.now,
      ],
    );
    await insertIngredientRows(tx, 'recipe_ingredients', id, ingredients);
    if (input.tools) await setRecipeTools(tx, id, input.tools);
  });
  return getRecipe(ctx, id);
}

/** Changes what is given; `ingredients`, when given, replace the list. */
export async function updateRecipe(
  ctx: FoodCtx,
  id: string,
  patch: Partial<RecipeInput>,
): Promise<Recipe> {
  await getRecipe(ctx, id);
  await ctx.tx(async (tx) => {
    const columns: Record<string, unknown> = {
      title: patch.title,
      description: patch.description,
      servings: patch.servings,
      prep_minutes: patch.prepMinutes,
      cook_minutes: patch.cookMinutes,
      tags: patch.tags,
      steps: patch.steps,
      icon: patch.icon,
      source_url: patch.sourceUrl,
      notes: patch.notes,
      favorite: patch.favorite,
    };
    const sets: string[] = [];
    const values: unknown[] = [id];
    for (const [column, value] of Object.entries(columns)) {
      if (value === undefined) continue;
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
    values.push(tx.now);
    sets.push(`updated_at = $${values.length}`);
    await tx.db.query(`UPDATE recipes SET ${sets.join(', ')} WHERE id = $1`, values);
    if (patch.ingredients)
      await insertIngredientRows(
        tx,
        'recipe_ingredients',
        id,
        await resolveIngredients(tx, patch.ingredients),
      );
    if (patch.tools) await setRecipeTools(tx, id, patch.tools);
  });
  return getRecipe(ctx, id);
}

/** Archives a recipe: planned and past meals keep their own copy of it. */
export async function deleteRecipe(ctx: FoodCtx, id: string): Promise<void> {
  await getRecipe(ctx, id);
  await ctx.db.query('UPDATE recipes SET archived_at = $2, favorite = false WHERE id = $1', [
    id,
    ctx.now,
  ]);
}

export async function recipeIngredients(ctx: FoodCtx, id: string) {
  return (await ingredientRows(ctx, 'recipe_ingredients', [id])).get(id) ?? [];
}
