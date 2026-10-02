import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { FoodCtx } from './kitchen';
import { findPreset, normalizeName, sameName, type Category, type FoodIcon, type Location } from './presets';
import type { ProductInput } from './schemas';
import { canConvert, type BaseUnit, type Measured, type Unit } from './units';

/** A thing the kitchen keeps or buys: tomatoes, a beef steak, water. Stock lives in its lots. */
export interface Product extends Measured {
  id: string;
  name: string;
  icon: FoodIcon;
  category: Category;
  location: Location;
  shelfLifeDays: number | null;
  /** Days it keeps once opened (milk: 5); opening shortens its expiry to this. */
  openedDays: number | null;
  /** False for staples that are simply always there (salt): never deducted or put on a list. */
  trackStock: boolean;
  minStock: number | null;
  storeId: string | null;
  note: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductRow {
  id: string;
  name: string;
  icon: FoodIcon;
  category: Category;
  unit: BaseUnit;
  piece_size: number | null;
  piece_unit: 'g' | 'ml' | null;
  location: Location;
  shelf_life_days: number | null;
  opened_days: number | null;
  track_stock: boolean;
  min_stock: number | null;
  store_id: string | null;
  note: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export const PRODUCT_COLUMNS =
  'id, name, icon, category, unit, piece_size, piece_unit, location, shelf_life_days, opened_days, track_stock, min_stock, store_id, note, archived_at, created_at, updated_at';

export const productColumns = (alias: string) =>
  PRODUCT_COLUMNS.split(', ')
    .map((column) => `${alias}.${column}`)
    .join(', ');

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    category: row.category,
    unit: row.unit,
    pieceSize: row.piece_size,
    pieceUnit: row.piece_unit,
    location: row.location,
    shelfLifeDays: row.shelf_life_days,
    openedDays: row.opened_days,
    trackStock: row.track_stock,
    minStock: row.min_stock,
    storeId: row.store_id,
    note: row.note,
    archived: row.archived_at !== null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findProduct(ctx: FoodCtx, id: string, options: { lock?: boolean } = {}): Promise<Product> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Item not found');
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE id = $1 AND household_id = $2${options.lock ? ' FOR UPDATE' : ''}`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Item not found');
  return toProduct(rows[0]);
}

/** Catalog search: every product the kitchen knows, best name matches first. */
export async function listProducts(ctx: FoodCtx, q = ''): Promise<Product[]> {
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE household_id = $1 AND archived_at IS NULL ORDER BY lower(name)`,
    [ctx.actor.householdId],
  );
  const products = rows.map(toProduct);
  const query = normalizeName(q);
  if (!query) return products;
  return products
    .map((product) => ({ product, name: normalizeName(product.name) }))
    .filter(({ name, product }) => name.includes(query) || sameName(product.name, q))
    .sort((a, b) => Number(!a.name.startsWith(query)) - Number(!b.name.startsWith(query)))
    .map(({ product }) => product);
}

async function ensureStore(ctx: FoodCtx, storeId: string | null | undefined): Promise<void> {
  if (!storeId) return;
  const { rowCount } = await ctx.db.query('SELECT 1 FROM stores WHERE id = $1 AND household_id = $2', [storeId, ctx.actor.householdId]);
  if (!rowCount) throw new AppError(400, 'VALIDATION', 'That store is not in your kitchen', { fields: { storeId: 'Unknown store' } });
}

function checkPiece(input: { unit?: BaseUnit; pieceSize?: number | null; pieceUnit?: 'g' | 'ml' | null }) {
  if (input.unit && input.unit !== 'pcs' && input.pieceUnit && input.pieceUnit !== input.unit) {
    throw new AppError(400, 'VALIDATION', 'A piece of this item is measured in its own unit', { fields: { pieceUnit: `Use ${input.unit}` } });
  }
}

/** The product with a name like this one (tomato ↔ Tomatoes), including an archived one. */
async function findByName(ctx: FoodCtx, name: string): Promise<ProductRow | null> {
  const { rows } = await ctx.db.query<ProductRow>(`SELECT ${PRODUCT_COLUMNS} FROM products WHERE household_id = $1`, [ctx.actor.householdId]);
  return rows.find((row) => normalizeName(row.name) === normalizeName(name)) ?? rows.find((row) => sameName(row.name, name)) ?? null;
}

/** A unit hint ("kg") tells a new product how it is counted when nothing else does. */
function baseFor(unit: Unit | undefined): BaseUnit {
  if (unit === 'g' || unit === 'kg') return 'g';
  if (unit === 'ml' || unit === 'l' || unit === 'tsp' || unit === 'tbsp' || unit === 'cup') return 'ml';
  return 'pcs';
}

async function insertProduct(ctx: FoodCtx, input: ProductInput & { unit: BaseUnit }): Promise<Product> {
  const preset = findPreset(input.name);
  const { rows } = await ctx.db.query<ProductRow>(
    `INSERT INTO products (id, household_id, name, icon, category, unit, piece_size, piece_unit, location, shelf_life_days, min_stock, store_id, note, created_by, created_at, updated_at, opened_days, track_stock)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17)
     RETURNING ${PRODUCT_COLUMNS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      input.name,
      input.icon ?? preset?.icon ?? 'basket',
      input.category ?? preset?.category ?? 'other',
      input.unit,
      input.pieceSize ?? (preset && preset.unit === input.unit ? (preset.pieceSize ?? null) : null),
      input.pieceUnit ?? (preset && preset.unit === input.unit ? (preset.pieceUnit ?? null) : null),
      input.location ?? preset?.location ?? 'pantry',
      input.shelfLifeDays === undefined ? (preset?.shelfLifeDays ?? null) : input.shelfLifeDays,
      input.minStock ?? null,
      input.storeId ?? null,
      input.note ?? '',
      ctx.actor.userId,
      ctx.now,
      input.openedDays === undefined ? (preset?.openedDays ?? null) : input.openedDays,
      input.trackStock ?? preset?.trackStock ?? true,
    ],
  );
  return toProduct(rows[0]!);
}

/** Creates a product. Built-in defaults fill whatever the input leaves out. */
export async function createProduct(ctx: FoodCtx, input: ProductInput): Promise<Product> {
  checkPiece(input);
  await ensureStore(ctx, input.storeId);
  const existing = await findByName(ctx, input.name);
  if (existing && !existing.archived_at) {
    throw new AppError(409, 'EXISTS', `${existing.name} is already in your kitchen`, { fields: { name: 'You already have this item' } });
  }
  if (existing) {
    await ctx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [existing.id, ctx.now]);
    return updateProduct(ctx, existing.id, input);
  }
  const preset = findPreset(input.name);
  return insertProduct(ctx, { ...input, unit: input.unit ?? preset?.unit ?? 'pcs' });
}

/**
 * The product a name refers to: an existing one (brought back if archived), else a new one from the
 * built-in catalog, else a plain new item counted the way `unitHint` suggests. Used wherever people
 * or the assistant type a name: adding stock, shopping lines, recipe ingredients.
 */
export async function resolveProduct(ctx: FoodCtx, name: string, unitHint?: Unit): Promise<Product> {
  const preset = findPreset(name);
  // "roșii" and "steak" find the Tomatoes and Beef steak already in the kitchen.
  const existing = (await findByName(ctx, name)) ?? (preset ? await findByName(ctx, preset.name) : null);
  if (existing) {
    if (existing.archived_at) await ctx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [existing.id, ctx.now]);
    return toProduct({ ...existing, archived_at: null });
  }
  const measured: Measured | null = preset ? { unit: preset.unit, pieceSize: preset.pieceSize ?? null, pieceUnit: preset.pieceUnit ?? null } : null;
  const unit = preset && measured && (!unitHint || canConvert(unitHint, measured)) ? preset.unit : baseFor(unitHint);
  const tidy = name.trim().replace(/\s+/g, ' ');
  // A catalog item keeps the catalog's name ("roșii" becomes Tomatoes); anything else keeps what was typed.
  return insertProduct(ctx, { name: preset && unit === preset.unit ? preset.name : tidy.charAt(0).toUpperCase() + tidy.slice(1), unit });
}

export async function updateProduct(ctx: FoodCtx, id: string, patch: Partial<ProductInput>): Promise<Product> {
  const product = await findProduct(ctx, id, { lock: true });
  checkPiece({ unit: patch.unit ?? product.unit, pieceSize: patch.pieceSize, pieceUnit: patch.pieceUnit });
  await ensureStore(ctx, patch.storeId);
  if (patch.unit && patch.unit !== product.unit) {
    const { rowCount } = await ctx.db.query('SELECT 1 FROM stock_lots WHERE product_id = $1 AND finished_at IS NULL LIMIT 1', [id]);
    if (rowCount) throw new AppError(409, 'HAS_STOCK', 'Use up or remove its stock before changing how it is counted', { fields: { unit: 'It still has stock' } });
  }
  if (patch.name && normalizeName(patch.name) !== normalizeName(product.name)) {
    const clash = await findByName(ctx, patch.name);
    if (clash && clash.id !== id && normalizeName(clash.name) === normalizeName(patch.name)) {
      throw new AppError(409, 'EXISTS', `${clash.name} is already in your kitchen`, { fields: { name: 'Another item has this name' } });
    }
  }
  const columns: Record<string, unknown> = {
    name: patch.name,
    icon: patch.icon,
    category: patch.category,
    unit: patch.unit,
    piece_size: patch.pieceSize,
    piece_unit: patch.pieceUnit,
    location: patch.location,
    shelf_life_days: patch.shelfLifeDays,
    opened_days: patch.openedDays,
    track_stock: patch.trackStock,
    min_stock: patch.minStock,
    store_id: patch.storeId,
    note: patch.note,
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  }
  values.push(ctx.now);
  sets.push(`updated_at = $${values.length}`);
  const { rows } = await ctx.db.query<ProductRow>(`UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PRODUCT_COLUMNS}`, values);
  return toProduct(rows[0]!);
}

/** Hides a product from the catalog and clears its remaining stock (history stays). */
export async function archiveProduct(ctx: FoodCtx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    await findProduct(tx, id, { lock: true });
    const { rows } = await tx.db.query<{ id: string; quantity: number }>('SELECT id, quantity FROM stock_lots WHERE product_id = $1 AND finished_at IS NULL', [id]);
    for (const lot of rows) {
      await tx.db.query(
        `INSERT INTO stock_events (household_id, product_id, lot_id, kind, delta, actor_id, via, note, created_at) VALUES ($1, $2, $3, 'adjusted', $4, $5, $6, 'Item removed', $7)`,
        [tx.actor.householdId, id, lot.id, -lot.quantity, tx.actor.userId, tx.actor.via, tx.now],
      );
    }
    await tx.db.query('UPDATE stock_lots SET quantity = 0, finished_at = $2 WHERE product_id = $1 AND finished_at IS NULL', [id, tx.now]);
    await tx.db.query('UPDATE products SET archived_at = $2, updated_at = $2 WHERE id = $1', [id, tx.now]);
  });
}
