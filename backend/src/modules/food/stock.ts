import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { FoodCtx } from './kitchen';
import type { Location } from './presets';
import { findProduct, PRODUCT_COLUMNS, resolveProduct, toProduct, type Product, type ProductRow } from './products';
import type { AddStockInput, LotPatch, UseStockInput } from './schemas';
import { round, toBase, UnitMismatchError, type Unit } from './units';

/**
 * Stock is kept as lots: one physical batch each — a 1.3 kg steak, another of 2 kg, a pack of six
 * eggs. Using stock takes from the lot you point at, or else opened lots first, then the one that
 * expires soonest, then the oldest. Stock never goes below zero: a shortfall is reported instead.
 * Every change is written to stock_events, which is the kitchen's history.
 */

export interface Lot {
  id: string;
  productId: string;
  /** What is left, in the product's base unit. */
  quantity: number;
  initialQuantity: number;
  location: Location;
  addedAt: string;
  expiresOn: string | null;
  openedAt: string | null;
  /** What was paid for the whole lot. */
  price: number | null;
  storeId: string | null;
  storeName: string | null;
  tripId: string | null;
  note: string;
}

interface LotRow {
  id: string;
  product_id: string;
  quantity: number;
  initial_quantity: number;
  location: Location;
  added_at: Date;
  expires_on: string | null;
  opened_at: Date | null;
  price: number | null;
  store_id: string | null;
  store_name: string | null;
  trip_id: string | null;
  note: string;
  finished_at: Date | null;
}

const LOT_SELECT = `SELECT l.id, l.product_id, l.quantity, l.initial_quantity, l.location, l.added_at, l.expires_on, l.opened_at,
       l.price, l.store_id, s.name AS store_name, l.trip_id, l.note, l.finished_at
  FROM stock_lots l LEFT JOIN stores s ON s.id = l.store_id`;

/** Opened first, then soonest to expire, then oldest: the order stock is used in. */
export const LOT_ORDER = 'l.opened_at IS NULL, l.expires_on NULLS LAST, l.added_at, l.id';

export function toLot(row: LotRow): Lot {
  return {
    id: row.id,
    productId: row.product_id,
    quantity: row.quantity,
    initialQuantity: row.initial_quantity,
    location: row.location,
    addedAt: row.added_at.toISOString(),
    expiresOn: row.expires_on,
    openedAt: row.opened_at?.toISOString() ?? null,
    price: row.price,
    storeId: row.store_id,
    storeName: row.store_name,
    tripId: row.trip_id,
    note: row.note,
  };
}

/** A calendar day in the server's time zone (TZ, e.g. Europe/Chisinau), `days` from now. */
export function localDate(now: Date, days = 0): string {
  const date = new Date(now.getTime() + days * 86_400_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** toBase, answering 400 (not 500) when the unit doesn't fit the item. */
export function baseQuantity(quantity: number, unit: Unit | undefined | null, product: Product, field = 'unit'): number {
  try {
    return toBase(quantity, unit ?? product.unit, product);
  } catch (error) {
    if (error instanceof UnitMismatchError) throw new AppError(400, 'VALIDATION', error.message, { fields: { [field]: error.message } });
    throw error;
  }
}

export async function recordEvent(
  ctx: FoodCtx,
  event: { productId: string; lotId: string | null; kind: 'added' | 'used' | 'wasted' | 'adjusted' | 'moved' | 'restored'; delta: number; mealId?: string | null; note?: string },
): Promise<void> {
  await ctx.db.query(
    `INSERT INTO stock_events (household_id, product_id, lot_id, kind, delta, meal_id, actor_id, via, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [ctx.actor.householdId, event.productId, event.lotId, event.kind, round(event.delta), event.mealId ?? null, ctx.actor.userId, ctx.actor.via, event.note ?? '', ctx.now],
  );
}

async function findLot(ctx: FoodCtx, id: string, lock = false): Promise<LotRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That piece is not in your kitchen');
  const { rows } = await ctx.db.query<LotRow>(`${LOT_SELECT} WHERE l.id = $1 AND l.household_id = $2${lock ? ' FOR UPDATE OF l' : ''}`, [id, ctx.actor.householdId]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That piece is not in your kitchen');
  return rows[0];
}

/** Puts something in the kitchen: a new lot, with its expiry from the product's shelf life unless given. */
export async function addStock(ctx: FoodCtx, input: AddStockInput & { tripId?: string | null }): Promise<{ product: Product; lot: Lot }> {
  return ctx.tx(async (tx) => {
    let product = input.productId ? await findProduct(tx, input.productId, { lock: true }) : await resolveProduct(tx, input.name!, input.unit);
    if (product.archived) {
      await tx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [product.id, tx.now]);
      product = { ...product, archived: false };
    }
    if (input.storeId) {
      const { rowCount } = await tx.db.query('SELECT 1 FROM stores WHERE id = $1 AND household_id = $2', [input.storeId, tx.actor.householdId]);
      if (!rowCount) throw new AppError(400, 'VALIDATION', 'That store is not in your kitchen', { fields: { storeId: 'Unknown store' } });
    }
    const quantity = baseQuantity(input.quantity, input.unit, product);
    const expiresOn = input.expiresOn === undefined ? (product.shelfLifeDays ? localDate(tx.now, product.shelfLifeDays) : null) : input.expiresOn;
    const id = randomUUID();
    await tx.db.query(
      `INSERT INTO stock_lots (id, household_id, product_id, quantity, initial_quantity, location, added_at, expires_on, price, store_id, trip_id, note, created_by)
       VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, tx.actor.householdId, product.id, quantity, input.location ?? product.location, tx.now, expiresOn, input.price ?? null, input.storeId ?? null, input.tripId ?? null, input.note ?? '', tx.actor.userId],
    );
    await recordEvent(tx, { productId: product.id, lotId: id, kind: 'added', delta: quantity });
    return { product, lot: toLot(await findLot(tx, id)) };
  });
}

export interface UseResult {
  productId: string;
  /** How much was taken, in the product's base unit. */
  used: number;
  /** How much was asked for but not there. */
  shortfall: number;
  lots: Array<{ lotId: string; taken: number; left: number }>;
}

/**
 * Takes stock: from `lotId` first when given, then in LOT_ORDER. Records "used" or "wasted",
 * linked to a meal when cooking.
 */
export async function useStock(ctx: FoodCtx, input: UseStockInput & { mealId?: string | null }): Promise<UseResult> {
  return ctx.tx(async (tx) => {
    const product = await findProduct(tx, input.productId, { lock: true });
    const wanted = baseQuantity(input.quantity, input.unit, product);
    if (input.lotId) {
      const lot = await findLot(tx, input.lotId);
      if (lot.product_id !== product.id) throw new AppError(400, 'VALIDATION', 'That piece belongs to another item', { fields: { lotId: 'Wrong item' } });
    }
    const { rows } = await tx.db.query<LotRow>(
      `${LOT_SELECT} WHERE l.product_id = $1 AND l.household_id = $2 AND l.finished_at IS NULL
        ORDER BY (l.id = $3) DESC, ${LOT_ORDER} FOR UPDATE OF l`,
      [product.id, tx.actor.householdId, input.lotId ?? null],
    );
    let remaining = wanted;
    const touched: UseResult['lots'] = [];
    for (const lot of rows) {
      if (remaining <= 0) break;
      const taken = round(Math.min(lot.quantity, remaining));
      if (taken <= 0) continue;
      const left = round(lot.quantity - taken);
      // A lot that is started is opened; opening shortens its expiry to the product's "once opened" days.
      await tx.db.query(
        `UPDATE stock_lots SET quantity = $2, finished_at = $3, opened_at = COALESCE(opened_at, $4),
                expires_on = CASE WHEN opened_at IS NULL AND $5::date IS NOT NULL THEN LEAST(COALESCE(expires_on, $5::date), $5::date) ELSE expires_on END
          WHERE id = $1`,
        [lot.id, left, left === 0 ? tx.now : null, left === 0 ? null : tx.now, left > 0 && product.openedDays ? localDate(tx.now, product.openedDays) : null],
      );
      await recordEvent(tx, { productId: product.id, lotId: lot.id, kind: input.wasted ? 'wasted' : 'used', delta: -taken, mealId: input.mealId, note: input.note });
      touched.push({ lotId: lot.id, taken, left });
      remaining = round(remaining - taken);
    }
    return { productId: product.id, used: round(wanted - remaining), shortfall: remaining, lots: touched };
  });
}

/**
 * Puts taken stock back into the lots it came from: the undo for a use, and for a cooked meal
 * reopened. Each lot gets back at most what it started with.
 */
export async function restoreStock(ctx: FoodCtx, lots: Array<{ lotId: string; quantity: number }>, options: { mealId?: string | null; note?: string } = {}): Promise<void> {
  await ctx.tx(async (tx) => {
    for (const { lotId, quantity } of lots) {
      if (quantity <= 0) continue;
      const lot = await findLot(tx, lotId, true);
      const back = round(Math.min(quantity, lot.initial_quantity - lot.quantity));
      if (back <= 0) continue;
      await tx.db.query('UPDATE stock_lots SET quantity = quantity + $2, finished_at = NULL WHERE id = $1', [lotId, back]);
      await recordEvent(tx, { productId: lot.product_id, lotId, kind: 'restored', delta: back, mealId: options.mealId, note: options.note ?? 'Undone' });
    }
  });
}

/** Corrects a lot: what is left, where it is, when it expires, whether it is open, its price. */
export async function updateLot(ctx: FoodCtx, id: string, patch: LotPatch): Promise<Lot> {
  return ctx.tx(async (tx) => {
    const lot = await findLot(tx, id, true);
    const product = await findProduct(tx, lot.product_id);
    if (patch.quantity !== undefined) {
      const quantity = patch.quantity === 0 ? 0 : baseQuantity(patch.quantity, patch.unit, product, 'quantity');
      const delta = round(quantity - lot.quantity);
      if (delta !== 0) {
        await tx.db.query('UPDATE stock_lots SET quantity = $2, initial_quantity = GREATEST(initial_quantity, $2), finished_at = $3 WHERE id = $1', [
          id,
          quantity,
          quantity === 0 ? tx.now : null,
        ]);
        await recordEvent(tx, { productId: product.id, lotId: id, kind: 'adjusted', delta, note: patch.note });
      }
    }
    if (patch.location && patch.location !== lot.location) {
      await tx.db.query('UPDATE stock_lots SET location = $2 WHERE id = $1', [id, patch.location]);
      await recordEvent(tx, { productId: product.id, lotId: id, kind: 'moved', delta: 0, note: `${lot.location} → ${patch.location}` });
    }
    if (patch.expiresOn !== undefined) await tx.db.query('UPDATE stock_lots SET expires_on = $2 WHERE id = $1', [id, patch.expiresOn]);
    if (patch.opened !== undefined) {
      const shorten = patch.opened && !lot.opened_at && product.openedDays && patch.expiresOn === undefined ? localDate(tx.now, product.openedDays) : null;
      await tx.db.query(
        `UPDATE stock_lots SET opened_at = $2,
                expires_on = CASE WHEN $3::date IS NOT NULL THEN LEAST(COALESCE(expires_on, $3::date), $3::date) ELSE expires_on END
          WHERE id = $1`,
        [id, patch.opened ? (lot.opened_at ?? tx.now) : null, shorten],
      );
    }
    if (patch.price !== undefined) await tx.db.query('UPDATE stock_lots SET price = $2 WHERE id = $1', [id, patch.price]);
    if (patch.note !== undefined && patch.quantity === undefined) await tx.db.query('UPDATE stock_lots SET note = $2 WHERE id = $1', [id, patch.note]);
    return toLot(await findLot(tx, id));
  });
}

/** Removes a lot added by mistake (or gone without a trace). Its history stays. */
export async function removeLot(ctx: FoodCtx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const lot = await findLot(tx, id, true);
    if (lot.finished_at) return;
    await tx.db.query('UPDATE stock_lots SET quantity = 0, finished_at = $2 WHERE id = $1', [id, tx.now]);
    await recordEvent(tx, { productId: lot.product_id, lotId: id, kind: 'adjusted', delta: -lot.quantity, note: 'Removed' });
  });
}

export interface StockedProduct extends Product {
  /** Everything in stock, in the base unit. */
  total: number;
  lots: Lot[];
  nextExpiry: string | null;
  /** Below its "running low" amount (minStock). */
  low: boolean;
}

/** The kitchen: products with stock (in a location, if given), plus staples that ran out. */
export async function kitchen(ctx: FoodCtx, filter: { location?: Location } = {}): Promise<StockedProduct[]> {
  const { rows: lotRows } = await ctx.db.query<LotRow>(
    `${LOT_SELECT} WHERE l.household_id = $1 AND l.finished_at IS NULL${filter.location ? ' AND l.location = $2' : ''} ORDER BY ${LOT_ORDER}`,
    filter.location ? [ctx.actor.householdId, filter.location] : [ctx.actor.householdId],
  );
  const lotsByProduct = new Map<string, Lot[]>();
  for (const row of lotRows) {
    const list = lotsByProduct.get(row.product_id) ?? [];
    list.push(toLot(row));
    lotsByProduct.set(row.product_id, list);
  }
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products
      WHERE household_id = $1 AND archived_at IS NULL AND (id = ANY($2::uuid[]) OR (min_stock > 0${filter.location ? ' AND location = $3' : ''}))
      ORDER BY lower(name)`,
    filter.location ? [ctx.actor.householdId, [...lotsByProduct.keys()], filter.location] : [ctx.actor.householdId, [...lotsByProduct.keys()]],
  );
  return rows.map((row) => stocked(toProduct(row), lotsByProduct.get(row.id) ?? []));
}

export function stocked(product: Product, lots: Lot[]): StockedProduct {
  const total = round(lots.reduce((sum, lot) => sum + lot.quantity, 0));
  const nextExpiry = lots.map((lot) => lot.expiresOn).filter((date): date is string => Boolean(date)).sort()[0] ?? null;
  return { ...product, total, lots, nextExpiry, low: product.minStock !== null && product.minStock > 0 && total < product.minStock };
}

export interface StockEvent {
  id: number;
  kind: string;
  delta: number;
  lotId: string | null;
  mealId: string | null;
  note: string;
  via: 'app' | 'ai';
  actor: string | null;
  createdAt: string;
}

export interface PricePoint {
  storeId: string | null;
  storeName: string | null;
  price: number;
  quantity: number;
  /** Price per kg, per l or per piece. */
  unitPrice: number;
  boughtAt: string;
}

/** One product: its lots, the last 30 changes, and the last price paid at each store. */
export async function productDetail(ctx: FoodCtx, id: string): Promise<{ product: StockedProduct; events: StockEvent[]; prices: PricePoint[] }> {
  const product = await findProduct(ctx, id);
  const { rows: lots } = await ctx.db.query<LotRow>(`${LOT_SELECT} WHERE l.product_id = $1 AND l.finished_at IS NULL ORDER BY ${LOT_ORDER}`, [id]);
  const { rows: events } = await ctx.db.query<{ id: number; kind: string; delta: number; lot_id: string | null; meal_id: string | null; note: string; via: 'app' | 'ai'; actor: string | null; created_at: Date }>(
    `SELECT e.id, e.kind, e.delta, e.lot_id, e.meal_id, e.note, e.via, u.name AS actor, e.created_at
       FROM stock_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.product_id = $1 ORDER BY e.created_at DESC, e.id DESC LIMIT 30`,
    [id],
  );
  const { rows: prices } = await ctx.db.query<{ store_id: string | null; store_name: string | null; price: number; initial_quantity: number; added_at: Date }>(
    `SELECT DISTINCT ON (l.store_id) l.store_id, s.name AS store_name, l.price, l.initial_quantity, l.added_at
       FROM stock_lots l LEFT JOIN stores s ON s.id = l.store_id
      WHERE l.product_id = $1 AND l.price IS NOT NULL AND l.initial_quantity > 0
      ORDER BY l.store_id, l.added_at DESC`,
    [id],
  );
  const per = product.unit === 'pcs' ? 1 : 1000;
  return {
    product: stocked(product, lots.map(toLot)),
    events: events.map((e) => ({ id: e.id, kind: e.kind, delta: e.delta, lotId: e.lot_id, mealId: e.meal_id, note: e.note, via: e.via, actor: e.actor, createdAt: e.created_at.toISOString() })),
    prices: prices
      .map((p) => ({
        storeId: p.store_id,
        storeName: p.store_name,
        price: p.price,
        quantity: p.initial_quantity,
        unitPrice: Math.round((p.price / p.initial_quantity) * per * 100) / 100,
        boughtAt: p.added_at.toISOString(),
      }))
      .sort((a, b) => b.boughtAt.localeCompare(a.boughtAt)),
  };
}

