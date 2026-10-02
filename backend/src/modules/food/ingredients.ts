import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { LineAllocation, PlannedMealRef } from './allocation';
import type { FoodCtx } from './kitchen';
import type { FoodIcon } from './presets';
import { findProduct, PRODUCT_COLUMNS, resolveProduct, toProduct, type Product, type ProductRow } from './products';
import type { IngredientInput, MealIngredientInput } from './schemas';
import { localDate } from './stock';
import { canConvert, round, toBase, type BaseUnit } from './units';

/**
 * Ingredient lines, for recipes and for planned meals (a meal keeps its own copy, so one dinner
 * can use another tomato without touching the recipe). Availability compares them with the
 * kitchen: what is there, what is enough, what is missing.
 */

export interface IngredientLine {
  id: string;
  productId: string | null;
  /** The exact piece to use (planned meals only). */
  lotId: string | null;
  name: string;
  icon: FoodIcon;
  amount: number | null;
  unit: string | null;
  note: string;
  optional: boolean;
  /** In stock now, in the product's base unit; null when not linked or not counted. */
  inStock: number | null;
  /** For level items: full, low or out. */
  level: 'full' | 'low' | 'out' | null;
  baseUnit: BaseUnit | null;
  /** Enough in stock for this line (null when it isn't checked). */
  enough: boolean | null;
  /** What is missing, in the base unit. */
  missing: number;
  /** In the kitchen, but a planned meal has claimed it (cook it now and that meal goes short). */
  reservedFor: PlannedMealRef | null;
  /** Some of it expires within three days: a reason to cook this soon. */
  expiresSoon: boolean;
}

export interface Availability {
  /** Checked lines that are covered. */
  have: number;
  /** Lines checked against the kitchen (linked, counted, not optional). */
  total: number;
  ready: boolean;
  missing: Array<{ productId: string; name: string; missing: number; unit: BaseUnit }>;
  /** Lines using something that expires within three days. */
  useSoon: number;
}

export interface IngredientRow {
  id: string;
  owner_id: string;
  product_id: string | null;
  lot_id?: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  note: string;
  optional: boolean;
  sort: number;
}

export interface StockInfo {
  product: Product;
  total: number;
  nextExpiry: string | null;
}

/** Every product of the kitchen with its stock total and soonest expiry. */
export async function stockSnapshot(ctx: FoodCtx): Promise<Map<string, StockInfo>> {
  const columns = PRODUCT_COLUMNS.split(', ')
    .map((c) => `p.${c}`)
    .join(', ');
  const { rows } = await ctx.db.query<ProductRow & { total: number; next_expiry: string | null }>(
    `SELECT ${columns}, coalesce(sum(l.quantity), 0)::numeric AS total, min(l.expires_on) AS next_expiry
       FROM products p LEFT JOIN stock_lots l ON l.product_id = p.id AND l.finished_at IS NULL
      WHERE p.household_id = $1 GROUP BY p.id`,
    [ctx.actor.householdId],
  );
  return new Map(rows.map((row) => [row.id, { product: toProduct(row), total: row.total, nextExpiry: row.next_expiry }]));
}

/** The base quantity a line needs at `scale`, or null when it has no amount or the unit doesn't fit. */
export function neededBase(row: Pick<IngredientRow, 'amount' | 'unit'>, product: Product, scale = 1): number | null {
  if (row.amount === null) return null;
  const unit = row.unit ?? product.unit;
  if (!canConvert(unit, product)) return null;
  return toBase(row.amount * scale, unit, product);
}

export interface DescribeOptions {
  /** A planned meal's lines: how the plan played forward covers each one. */
  allocation?: Map<string, LineAllocation>;
  /** For cooking now (a recipe): what planned meals already claim, per product. */
  reserved?: Map<string, { amount: number; first: PlannedMealRef }>;
}

export function describeLines(
  rows: IngredientRow[],
  stock: Map<string, StockInfo>,
  now: Date,
  scale = 1,
  options: DescribeOptions = {},
): { lines: IngredientLine[]; availability: Availability } {
  const soon = localDate(now, 3);
  const lines: IngredientLine[] = [];
  const availability: Availability = { have: 0, total: 0, ready: true, missing: [], useSoon: 0 };
  for (const row of rows) {
    const info = row.product_id ? stock.get(row.product_id) : undefined;
    const mode = info?.product.trackMode ?? 'none';
    // Exact items are measured against stock; level items just need to not be out.
    const counted = mode === 'exact' || mode === 'level';
    const needed = info && mode === 'exact' ? neededBase(row, info.product, scale) : null;
    const total = info?.total ?? 0;
    const planned = options.allocation?.get(row.id);
    const claimed = mode === 'exact' && info ? (options.reserved?.get(info.product.id) ?? null) : null;
    // What is free for this: a planned meal gets its share of the plan; cooking now gets what no plan claims.
    const free = claimed ? Math.max(0, round(total - claimed.amount)) : total;
    let enough = mode === 'level' ? info!.product.level !== 'out' : mode === 'exact' ? (needed === null ? free > 0 : free + 1e-9 >= needed) : null;
    let missing = mode === 'exact' && !enough ? round(needed === null ? 0 : needed - free) : 0;
    let reservedFor: PlannedMealRef | null = claimed && !enough && total + 1e-9 >= (needed ?? 0) ? claimed.first : null;
    if (planned && mode === 'exact') {
      enough = planned.short <= 0;
      missing = planned.short;
      reservedFor = planned.short > 0 ? planned.takenBy : null;
    }
    const expiresSoon = Boolean(info?.nextExpiry && info.nextExpiry <= soon && total > 0);
    lines.push({
      id: row.id,
      productId: row.product_id,
      lotId: row.lot_id ?? null,
      name: row.name,
      icon: info?.product.icon ?? 'basket',
      amount: row.amount === null ? null : round(row.amount * scale),
      unit: row.unit,
      note: row.note,
      optional: row.optional,
      inStock: mode === 'exact' ? total : null,
      level: mode === 'level' ? info!.product.level : null,
      baseUnit: info?.product.unit ?? null,
      enough,
      missing,
      reservedFor,
      expiresSoon,
    });
    if (expiresSoon) availability.useSoon += 1;
    if (!counted || row.optional) continue;
    availability.total += 1;
    if (enough) availability.have += 1;
    else availability.missing.push({ productId: row.product_id!, name: row.name, missing, unit: info!.product.unit });
  }
  availability.ready = availability.have === availability.total;
  return { lines, availability };
}

/**
 * Turns input lines into rows: each name finds (or creates) its product unless `link` is false, and
 * an amount must be in a unit the product can be counted in.
 */
export async function resolveIngredients(ctx: FoodCtx, inputs: Array<IngredientInput | MealIngredientInput>): Promise<Array<Omit<IngredientRow, 'id' | 'owner_id'>>> {
  const out: Array<Omit<IngredientRow, 'id' | 'owner_id'>> = [];
  for (const [index, input] of inputs.entries()) {
    let product: Product | null = null;
    if (input.productId) product = await findProduct(ctx, input.productId);
    else if (input.link !== false) product = await resolveProduct(ctx, input.name, input.unit ?? undefined);
    const unit = input.amount ? (input.unit ?? product?.unit ?? null) : null;
    // Only measured items need a unit they can be counted in ("2 tsp" of a spice kept by level is fine).
    if (product && product.trackMode === 'exact' && unit && !canConvert(unit, product)) {
      const message = `${product.name} is counted in ${product.unit}; ${unit} can’t be converted`;
      throw new AppError(400, 'VALIDATION', message, { fields: { [`ingredients.${index}.unit`]: message } });
    }
    let lotId: string | null = null;
    if ('lotId' in input && input.lotId) {
      const { rows } = await ctx.db.query<{ product_id: string }>('SELECT product_id FROM stock_lots WHERE id = $1 AND household_id = $2', [input.lotId, ctx.actor.householdId]);
      if (!rows[0] || rows[0].product_id !== product?.id) {
        throw new AppError(400, 'VALIDATION', 'That piece is not this ingredient', { fields: { [`ingredients.${index}.lotId`]: 'Wrong piece' } });
      }
      lotId = input.lotId;
    }
    out.push({ product_id: product?.id ?? null, lot_id: lotId, name: input.name, amount: input.amount ?? null, unit, note: input.note ?? '', optional: input.optional ?? false, sort: index });
  }
  return out;
}

export async function insertIngredientRows(
  ctx: FoodCtx,
  table: 'recipe_ingredients' | 'meal_ingredients',
  ownerId: string,
  rows: Array<Omit<IngredientRow, 'id' | 'owner_id'>>,
): Promise<void> {
  const owner = table === 'recipe_ingredients' ? 'recipe_id' : 'meal_id';
  await ctx.db.query(`DELETE FROM ${table} WHERE ${owner} = $1`, [ownerId]);
  for (const row of rows) {
    if (table === 'recipe_ingredients') {
      await ctx.db.query(`INSERT INTO recipe_ingredients (id, recipe_id, product_id, name, amount, unit, note, optional, sort) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
        randomUUID(),
        ownerId,
        row.product_id,
        row.name,
        row.amount,
        row.unit,
        row.note,
        row.optional,
        row.sort,
      ]);
    } else {
      await ctx.db.query(
        `INSERT INTO meal_ingredients (id, meal_id, product_id, lot_id, name, amount, unit, note, optional, sort) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [randomUUID(), ownerId, row.product_id, row.lot_id ?? null, row.name, row.amount, row.unit, row.note, row.optional, row.sort],
      );
    }
  }
}

export async function ingredientRows(ctx: FoodCtx, table: 'recipe_ingredients' | 'meal_ingredients', ownerIds: string[]): Promise<Map<string, IngredientRow[]>> {
  const map = new Map<string, IngredientRow[]>();
  if (!ownerIds.length) return map;
  const owner = table === 'recipe_ingredients' ? 'recipe_id' : 'meal_id';
  const lot = table === 'meal_ingredients' ? ', lot_id' : '';
  const { rows } = await ctx.db.query<IngredientRow>(
    `SELECT id, ${owner} AS owner_id, product_id${lot}, name, amount, unit, note, optional, sort FROM ${table} WHERE ${owner} = ANY($1::uuid[]) ORDER BY sort, id`,
    [ownerIds],
  );
  for (const row of rows) {
    const list = map.get(row.owner_id) ?? [];
    list.push(row);
    map.set(row.owner_id, list);
  }
  return map;
}
