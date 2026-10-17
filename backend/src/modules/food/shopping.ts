import { areaOf, KIND_IN_NAME, kindIcon, sameName } from './presets';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { Translations } from '../../lib/i18n';
import { combine, onlyFields, variantTranslations, type KindNames } from './catalog-i18n';
import type { FoodCtx } from './kitchen';
import type { Category, FoodIcon } from './presets';
import { findProduct, rememberVariant, resolveNamed, type Product } from './products';
import type {
  CheckoutInput,
  Packages,
  ShoppingItemInput,
  MoveShoppingInput,
  ShoppingItemPatch,
  TripItemPatch,
} from './schemas';
import { addStock, baseQuantity, updateLot } from './stock';
import { amountIn, canConvert, round, type CustomUnit, type Unit } from './units';

/**
 * Shopping lists, one per store plus “any store”. A line is ticked into the cart in the shop,
 * optionally with what it cost; finishing the shop (checkout) records a trip with its total and
 * puts every bought line into the kitchen as a lot. Unticked lines stay for next time. Trip
 * lines stay editable, and an edited price follows into the kitchen.
 */

export type ShoppingSource = 'manual' | 'plan' | 'low_stock' | 'recipe' | 'ai';

export interface ShoppingItem {
  id: string;
  storeId: string | null;
  productId: string | null;
  name: string;
  icon: FoodIcon;
  category: Category;
  /** Food or the house: which list it shows on (the Shopping card shows both). */
  area: 'food' | 'house';
  amount: number | null;
  unit: string | null;
  note: string;
  /** Which kind to buy (Cheddar). */
  variant: string;
  /** A brand whose kind is part of its name: the line reads "Coca-Cola Zero". */
  kindInName: boolean;
  /** Important: shown first. */
  priority: boolean;
  /** The day it is needed (a planned meal's day): buy it before. */
  needBy: string | null;
  source: ShoppingSource;
  checked: boolean;
  price: number | null;
  /** The last price paid for this item (this store first), to estimate the bill. */
  lastPrice: {
    price: number;
    storeName: string | null;
    /** The store's name in other languages ({ ro: { name } }). */
    storeTranslations: Translations;
    boughtAt: string;
  } | null;
  /** Expected cost of this line from that last price, when the amount is known. */
  estimate: number | null;
  /** What is needed, at least, in the item's base unit (null: no amount asked). */
  need: number | null;
  /** What was actually bought, package by package (sizes in the base unit), and what they are called. */
  bought: BoughtPackage[] | null;
  package: string;
  /** All of what was bought, in the base unit. */
  boughtTotal: number | null;
  /** The item's base unit, for the amounts above. */
  baseUnit: string | null;
  /** The line's name and kind in other languages ({ ro: { name, variant } }), from its item. */
  translations: Translations;
  createdAt: string;
}

/** A line by name, with its name in other languages ({ ro: { name } }). */
export interface NamedLine {
  name: string;
  translations: Translations;
}

export interface BoughtPackage {
  count: number;
  size: number;
}

interface ItemRow {
  id: string;
  store_id: string | null;
  product_id: string | null;
  name: string;
  icon: FoodIcon | null;
  p_name: string | null;
  category: Category | null;
  amount: number | null;
  unit: string | null;
  note: string;
  variant: string;
  priority: boolean;
  need_by: string | null;
  source: ShoppingSource;
  checked_at: Date | null;
  price: number | null;
  trip_id: string | null;
  lot_id: string | null;
  created_at: Date;
  p_unit: Product['unit'] | null;
  piece_size: number | null;
  piece_unit: 'g' | 'ml' | null;
  p_units: CustomUnit[] | null;
  p_translations: Translations | null;
  p_variant_names: KindNames | null;
  package: string;
  bought: BoughtPackage[] | null;
}

/** A line's name and kind in other languages: its item's, while the line still goes by its name. */
function itemTranslations(
  row: Pick<ItemRow, 'name' | 'p_name' | 'p_translations' | 'p_variant_names' | 'variant'>,
) {
  if (!row.p_name) return {};
  const named = sameName(row.name, row.p_name);
  return combine(
    named ? onlyFields(row.p_translations, ['name']) : {},
    variantTranslations(row.p_name, row.variant, row.p_variant_names),
  );
}

const ITEM_SELECT = `SELECT i.id, i.store_id, i.product_id, i.name, p.icon, p.name AS p_name, p.category, i.amount, i.unit, i.note, i.variant, i.priority,
       to_char(i.need_by, 'YYYY-MM-DD') AS need_by, i.source, i.checked_at,
       i.price, i.trip_id, i.lot_id, i.created_at, i.package, i.bought, p.unit AS p_unit, p.piece_size, p.piece_unit, p.units AS p_units,
       p.translations AS p_translations, p.variant_names AS p_variant_names
  FROM shopping_items i LEFT JOIN products p ON p.id = i.product_id`;

interface PriceRow {
  product_id: string;
  store_id: string | null;
  store_name: string | null;
  store_translations: Translations | null;
  price: number;
  initial_quantity: number;
  added_at: Date;
}

/** The base quantity a line stands for, or null when it has no amount or the unit doesn't fit. */
function lineBase(
  row: Pick<ItemRow, 'amount' | 'unit' | 'p_unit' | 'piece_size' | 'piece_unit' | 'p_units'>,
): number | null {
  if (row.amount === null || !row.p_unit) return null;
  const product = {
    unit: row.p_unit,
    pieceSize: row.piece_size,
    pieceUnit: row.piece_unit,
    units: row.p_units ?? [],
  };
  const unit = row.unit ?? row.p_unit;
  return canConvert(unit, product) ? baseQuantity(row.amount, unit, product as Product) : null;
}

const boughtTotal = (bought: BoughtPackage[] | null) =>
  bought ? round(bought.reduce((sum, pack) => sum + pack.count * pack.size, 0)) : null;

function toItem(row: ItemRow, prices: PriceRow[]): ShoppingItem {
  const mine = prices.filter((p) => p.product_id === row.product_id);
  const last =
    mine.find((p) => p.store_id === row.store_id) ??
    mine.sort((a, b) => b.added_at.getTime() - a.added_at.getTime())[0];
  const need = lineBase(row);
  const got = boughtTotal(row.bought);
  const base = got ?? need;
  return {
    id: row.id,
    storeId: row.store_id,
    productId: row.product_id,
    name: row.name,
    icon:
      row.icon && row.p_name
        ? kindIcon({ name: row.p_name, icon: row.icon }, row.variant)
        : (row.icon ?? 'basket'),
    category: row.category ?? 'other',
    area: areaOf(row.category ?? 'other'),
    amount: row.amount,
    unit: row.unit,
    note: row.note,
    variant: row.variant,
    kindInName: row.p_name !== null && KIND_IN_NAME.has(row.p_name),
    priority: row.priority,
    needBy: row.need_by,
    source: row.source,
    checked: row.checked_at !== null,
    price: row.price,
    lastPrice: last
      ? {
          price: last.price,
          storeName: last.store_name,
          storeTranslations: last.store_translations ?? {},
          boughtAt: last.added_at.toISOString(),
        }
      : null,
    estimate:
      last && base !== null && last.initial_quantity > 0
        ? Math.round((last.price / last.initial_quantity) * base * 100) / 100
        : null,
    need,
    bought: row.bought,
    package: row.package,
    boughtTotal: got,
    baseUnit: row.p_unit,
    translations: itemTranslations(row),
    createdAt: row.created_at.toISOString(),
  };
}

async function lastPrices(ctx: FoodCtx, productIds: string[]): Promise<PriceRow[]> {
  if (!productIds.length) return [];
  const { rows } = await ctx.db.query<PriceRow>(
    `SELECT DISTINCT ON (l.product_id, l.store_id) l.product_id, l.store_id, s.name AS store_name, s.translations AS store_translations, l.price, l.initial_quantity, l.added_at
       FROM stock_lots l LEFT JOIN stores s ON s.id = l.store_id
      WHERE l.household_id = $1 AND l.product_id = ANY($2::uuid[]) AND l.price IS NOT NULL
      ORDER BY l.product_id, l.store_id, l.added_at DESC`,
    [ctx.actor.householdId, productIds],
  );
  return rows;
}

async function withPrices(ctx: FoodCtx, rows: ItemRow[]): Promise<ShoppingItem[]> {
  const prices = await lastPrices(ctx, [
    ...new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id))),
  ]);
  return rows.map((row) => toItem(row, prices));
}

/** Every open line, on every list (the app groups them by store). */
export async function listShopping(ctx: FoodCtx): Promise<ShoppingItem[]> {
  const { rows } = await ctx.db.query<ItemRow>(
    `${ITEM_SELECT} WHERE i.household_id = $1 AND i.trip_id IS NULL ORDER BY i.checked_at NULLS FIRST, i.need_by NULLS LAST, i.priority DESC, i.created_at`,
    [ctx.actor.householdId],
  );
  return withPrices(ctx, rows);
}

async function findItem(ctx: FoodCtx, id: string, lock = false): Promise<ItemRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That line is not on your lists');
  const { rows } = await ctx.db.query<ItemRow>(
    `${ITEM_SELECT} WHERE i.id = $1 AND i.household_id = $2${lock ? ' FOR UPDATE OF i' : ''}`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That line is not on your lists');
  return rows[0];
}

async function getItem(ctx: FoodCtx, id: string): Promise<ShoppingItem> {
  return (await withPrices(ctx, [await findItem(ctx, id)]))[0]!;
}

async function checkStore(ctx: FoodCtx, storeId: string | null | undefined): Promise<void> {
  if (!storeId) return;
  const { rowCount } = await ctx.db.query(
    'SELECT 1 FROM stores WHERE id = $1 AND household_id = $2',
    [storeId, ctx.actor.householdId],
  );
  if (!rowCount)
    throw new AppError(400, 'VALIDATION', 'That store is not in your kitchen', {
      fields: { storeId: 'Unknown store' },
    });
}

/**
 * Adds lines. A name finds (or creates) the product; the line goes to the given store, else the
 * product's usual one. The same product already waiting on that list is topped up, not repeated.
 */
export async function addShoppingItems(
  ctx: FoodCtx,
  inputs: ShoppingItemInput[],
  source: ShoppingSource = 'manual',
): Promise<ShoppingItem[]> {
  const ids = await ctx.tx(async (tx) => {
    const out: string[] = [];
    for (const input of inputs) {
      const named = input.productId
        ? null
        : await resolveNamed(tx, input.name!, input.unit ?? undefined, {
            level: 'out',
            area: input.area,
          });
      const product = named ? named.product : await findProduct(tx, input.productId!);
      const variant = input.variant || named?.variant || '';
      await rememberVariant(tx, product, variant);
      const storeId = input.storeId === undefined ? product.storeId : input.storeId;
      await checkStore(tx, storeId);
      const unit = input.amount ? (input.unit ?? product.unit) : null;
      if (unit && input.amount && product.trackMode === 'exact')
        baseQuantity(input.amount, unit, product);

      const { rows: same } = await tx.db.query<ItemRow>(
        `${ITEM_SELECT} WHERE i.household_id = $1 AND i.product_id = $2 AND i.store_id IS NOT DISTINCT FROM $3 AND i.trip_id IS NULL AND i.checked_at IS NULL FOR UPDATE OF i`,
        [tx.actor.householdId, product.id, storeId ?? null],
      );
      const existing = same[0];
      if (existing) {
        // Top up: "2 tomatoes" plus "3 tomatoes" is "5 tomatoes".
        const before = lineBase(existing);
        if (unit && input.amount && before !== null) {
          const total = before + baseQuantity(input.amount, unit, product);
          const shown = (existing.unit ?? product.unit) as Unit;
          await tx.db.query(
            'UPDATE shopping_items SET amount = $2, updated_at = $3 WHERE id = $1',
            [existing.id, amountIn(total, shown, product), tx.now],
          );
        } else if (unit && input.amount && existing.amount === null) {
          await tx.db.query(
            'UPDATE shopping_items SET amount = $2, unit = $3, updated_at = $4 WHERE id = $1',
            [existing.id, input.amount, unit, tx.now],
          );
        }
        out.push(existing.id);
        continue;
      }
      const id = randomUUID();
      await tx.db.query(
        `INSERT INTO shopping_items (id, household_id, store_id, product_id, name, amount, unit, note, source, created_by, created_at, updated_at, variant, priority, need_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14)`,
        [
          id,
          tx.actor.householdId,
          storeId ?? null,
          product.id,
          product.name,
          input.amount ?? null,
          unit,
          input.note ?? '',
          tx.actor.via === 'ai' ? 'ai' : source,
          tx.actor.userId,
          tx.now,
          variant,
          input.priority ?? false,
          input.needBy ?? null,
        ],
      );
      out.push(id);
    }
    return out;
  });
  const items = await listShopping(ctx);
  return ids.map((id) => items.find((item) => item.id === id)!);
}

export async function updateShoppingItem(
  ctx: FoodCtx,
  id: string,
  patch: ShoppingItemPatch,
): Promise<ShoppingItem> {
  await ctx.tx(async (tx) => {
    const item = await findItem(tx, id, true);
    if (item.trip_id)
      throw new AppError(409, 'BOUGHT', 'That line was already checked out; edit it in the trip');
    await checkStore(tx, patch.storeId);
    const amount = patch.amount === undefined ? item.amount : patch.amount;
    const unit = patch.unit === undefined ? item.unit : patch.unit;
    const product = item.product_id ? await findProduct(tx, item.product_id) : null;
    if (amount !== null && product?.trackMode === 'exact')
      baseQuantity(amount, unit ?? product.unit, product, 'amount');
    const bought =
      patch.bought === undefined
        ? undefined
        : patch.bought && product
          ? boughtIn(patch.bought, product)
          : null;
    await tx.db.query(
      `UPDATE shopping_items SET
         checked_at = CASE WHEN $2::boolean IS NULL THEN checked_at WHEN $2 THEN coalesce(checked_at, $9) ELSE NULL END,
         amount = $3, unit = $4,
         price = CASE WHEN $5::boolean THEN $6 ELSE price END,
         store_id = CASE WHEN $7::boolean THEN $8 ELSE store_id END,
         note = coalesce($10, note),
         variant = coalesce($11, variant),
         priority = coalesce($12, priority),
         need_by = CASE WHEN $13::boolean THEN $14::date ELSE need_by END,
         package = coalesce($15, package),
         bought = CASE WHEN $16::boolean THEN $17::jsonb ELSE bought END,
         updated_at = $9
       WHERE id = $1`,
      [
        id,
        patch.checked ?? null,
        amount,
        amount === null ? null : unit,
        patch.price !== undefined,
        patch.price ?? null,
        patch.storeId !== undefined,
        patch.storeId ?? null,
        tx.now,
        patch.note ?? null,
        patch.variant ?? null,
        patch.priority ?? null,
        patch.needBy !== undefined,
        patch.needBy ?? null,
        patch.package ?? null,
        bought !== undefined,
        bought ? JSON.stringify(bought) : null,
      ],
    );
  });
  return getItem(ctx, id);
}

/**
 * Lines to another store (Metro didn't have them: the rest of the list to Linella). Only lines
 * still on a list move: ones already checked out stay with their trip.
 */
export async function moveShoppingItems(
  ctx: FoodCtx,
  input: MoveShoppingInput,
): Promise<{ moved: number }> {
  return ctx.tx(async (tx) => {
    await checkStore(tx, input.storeId);
    const { rowCount } = await tx.db.query(
      `UPDATE shopping_items SET store_id = $3, updated_at = $4
        WHERE household_id = $1 AND id = ANY($2::uuid[]) AND trip_id IS NULL
          AND store_id IS DISTINCT FROM $3`,
      [tx.actor.householdId, input.ids, input.storeId, tx.now],
    );
    return { moved: rowCount ?? 0 };
  });
}

/** Packages as given ("2 × 0.3 kg") in the item's base unit ("2 × 300 g"). */
function boughtIn(packages: Packages, product: Product): BoughtPackage[] {
  return packages.map((pack) => ({
    count: pack.count,
    size: pack.sizeUnit
      ? baseQuantity(pack.size, pack.sizeUnit, product, 'bought')
      : round(pack.size),
  }));
}

export async function removeShoppingItem(ctx: FoodCtx, id: string): Promise<void> {
  const item = await findItem(ctx, id);
  if (item.trip_id) throw new AppError(409, 'BOUGHT', 'That line was already checked out');
  await ctx.db.query('DELETE FROM shopping_items WHERE id = $1', [id]);
}

export interface Trip {
  id: string;
  storeId: string | null;
  storeName: string;
  /** The store's name in other languages ({ ro: { name } }). */
  storeTranslations: Translations;
  total: number | null;
  itemCount: number;
  finishedAt: string;
}

interface TripRow {
  id: string;
  store_id: string | null;
  store_name: string;
  store_translations: Translations | null;
  total: number | null;
  item_count: number;
  finished_at: Date;
}

const toTrip = (row: TripRow): Trip => ({
  id: row.id,
  storeId: row.store_id,
  storeName: row.store_name,
  storeTranslations: row.store_translations ?? {},
  total: row.total,
  itemCount: row.item_count,
  finishedAt: row.finished_at.toISOString(),
});

/**
 * Finishes a shop: every line in that list's cart is bought. Each goes into the kitchen as a lot
 * (with its price, store and expiry) unless told otherwise; a line without an amount counts as one
 * piece when the item has a piece size, else it is recorded but not stocked.
 */
export async function checkout(
  ctx: FoodCtx,
  input: CheckoutInput,
): Promise<{
  trip: Trip;
  stocked: number;
  notStocked: string[];
  leftOver: string[];
  /** The same lines, each with its name in other languages: [{ name, translations: { ro: { name } } }]. */
  notStockedItems: NamedLine[];
  leftOverItems: NamedLine[];
}> {
  return ctx.tx(async (tx) => {
    await checkStore(tx, input.storeId);
    const { rows: cart } = await tx.db.query<ItemRow>(
      `${ITEM_SELECT} WHERE i.household_id = $1 AND i.store_id IS NOT DISTINCT FROM $2 AND i.trip_id IS NULL AND i.checked_at IS NOT NULL ORDER BY i.checked_at FOR UPDATE OF i`,
      [tx.actor.householdId, input.storeId],
    );
    if (!cart.length) throw new AppError(409, 'EMPTY_CART', 'Tick what you bought first');
    const lines = new Map(input.lines.map((line) => [line.id, line]));
    for (const id of lines.keys()) {
      if (!cart.some((row) => row.id === id))
        throw new AppError(400, 'VALIDATION', 'A line is not in this cart', {
          fields: { lines: 'Unknown line' },
        });
    }
    const { rows: store } = await tx.db.query<{ name: string }>(
      'SELECT name FROM stores WHERE id = $1',
      [input.storeId],
    );
    const tripId = randomUUID();
    await tx.db.query(
      'INSERT INTO shopping_trips (id, household_id, store_id, store_name, item_count, finished_at, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        tripId,
        tx.actor.householdId,
        input.storeId,
        store[0]?.name ?? '',
        cart.length,
        tx.now,
        tx.actor.userId,
      ],
    );

    let stocked = 0;
    const notStocked: string[] = [];
    const leftOver: string[] = [];
    const notStockedItems: NamedLine[] = [];
    const leftOverItems: NamedLine[] = [];
    const named = (row: ItemRow): NamedLine => ({
      name: row.name,
      translations: onlyFields(itemTranslations(row), ['name']),
    });
    for (const row of cart) {
      const line = lines.get(row.id);
      const price = line?.price === undefined ? row.price : line.price;
      let amount = line?.amount === undefined ? row.amount : line.amount;
      let unit = line?.unit === undefined ? row.unit : line.unit;
      const variant = line?.variant ?? row.variant;
      const packageName = line?.package ?? row.package;
      const product = row.product_id ? await findProduct(tx, row.product_id) : null;
      const bought =
        line?.bought === undefined
          ? row.bought
          : line.bought && product
            ? boughtIn(line.bought, product)
            : null;
      let lotId: string | null = null;
      if (product && line?.addToKitchen !== false) {
        const where = {
          productId: product.id,
          price,
          storeId: input.storeId,
          tripId,
          variant,
          ...(line?.expiresOn !== undefined ? { expiresOn: line.expiresOn } : {}),
          ...(line?.location ? { location: line.location } : {}),
        };
        if (bought && product.trackMode === 'exact') {
          // What was really bought: "2 cans of 300 g" for "at least 500 g".
          const { lot } = await addStock(tx, {
            ...where,
            package: packageName || undefined,
            packages: bought,
          });
          lotId = lot?.id ?? null;
          stocked += 1;
          const got = boughtTotal(bought) ?? 0;
          const need = lineBase(row);
          if (need !== null && got < need && line?.keepRest !== false) {
            // Less than needed: the rest stays on this store's list.
            const shown = row.unit ?? product.unit;
            await tx.db.query(
              `INSERT INTO shopping_items (id, household_id, store_id, product_id, name, amount, unit, note, source, created_by, created_at, updated_at, variant, priority, need_by)
               SELECT $2, household_id, store_id, product_id, name, $3, $4, note, source, $5, $6, $6, variant, priority, need_by FROM shopping_items WHERE id = $1`,
              [
                row.id,
                randomUUID(),
                amountIn(round(need - got), shown, product),
                shown,
                tx.actor.userId,
                tx.now,
              ],
            );
            leftOver.push(row.name);
            leftOverItems.push(named(row));
          }
          amount = got;
          unit = product.unit;
        } else {
          // Level items are simply full again; others need an amount (one piece when they come in pieces).
          const quantity =
            product.trackMode === 'level'
              ? 1
              : (amount ?? (product.unit === 'pcs' || product.pieceSize ? 1 : null));
          const quantityUnit =
            product.trackMode === 'level' ? product.unit : amount ? (unit ?? product.unit) : 'pcs';
          if (quantity !== null) {
            const { lot } = await addStock(tx, { ...where, quantity, unit: quantityUnit });
            lotId = lot?.id ?? null;
            stocked += 1;
          } else {
            notStocked.push(row.name);
            notStockedItems.push(named(row));
          }
        }
      } else {
        notStocked.push(row.name);
        notStockedItems.push(named(row));
      }
      await tx.db.query(
        'UPDATE shopping_items SET trip_id = $2, price = $3, amount = $4, unit = $5, lot_id = $6, updated_at = $7, variant = $8, package = $9, bought = $10 WHERE id = $1',
        [
          row.id,
          tripId,
          price,
          amount,
          amount === null ? null : unit,
          lotId,
          tx.now,
          variant,
          packageName,
          bought ? JSON.stringify(bought) : null,
        ],
      );
    }
    const trip = await refreshTripTotal(tx, tripId);
    return { trip, stocked, notStocked, leftOver, notStockedItems, leftOverItems };
  });
}

async function refreshTripTotal(ctx: FoodCtx, tripId: string): Promise<Trip> {
  const { rows } = await ctx.db.query<TripRow>(
    `UPDATE shopping_trips t SET total = (SELECT sum(price) FROM shopping_items WHERE trip_id = t.id)
      WHERE t.id = $1 RETURNING t.id, t.store_id, t.store_name, t.total, t.item_count, t.finished_at,
                (SELECT s.translations FROM stores s WHERE s.id = t.store_id) AS store_translations`,
    [tripId],
  );
  return toTrip(rows[0]!);
}

export async function listTrips(ctx: FoodCtx, limit = 30): Promise<Trip[]> {
  const { rows } = await ctx.db.query<TripRow>(
    `SELECT t.id, t.store_id, coalesce(s.name, t.store_name) AS store_name, s.translations AS store_translations, t.total, t.item_count, t.finished_at
       FROM shopping_trips t LEFT JOIN stores s ON s.id = t.store_id
      WHERE t.household_id = $1 ORDER BY t.finished_at DESC LIMIT $2`,
    [ctx.actor.householdId, limit],
  );
  return rows.map(toTrip);
}

export async function getTrip(
  ctx: FoodCtx,
  id: string,
): Promise<{ trip: Trip; items: ShoppingItem[] }> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  const { rows } = await ctx.db.query<TripRow>(
    `SELECT t.id, t.store_id, coalesce(s.name, t.store_name) AS store_name, s.translations AS store_translations, t.total, t.item_count, t.finished_at
       FROM shopping_trips t LEFT JOIN stores s ON s.id = t.store_id WHERE t.id = $1 AND t.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  const { rows: items } = await ctx.db.query<ItemRow>(
    `${ITEM_SELECT} WHERE i.trip_id = $1 ORDER BY i.checked_at, i.created_at`,
    [id],
  );
  return { trip: toTrip(rows[0]), items: items.map((row) => toItem(row, [])) };
}

/**
 * Undoes a shop finished by mistake: what it put in the kitchen comes out again, and its lines go
 * back into the cart, ticked, with what was bought. Refused once any of it has been used or opened
 * (fix those lines instead). Level items stay as they are: there is no earlier level to go back to.
 */
export async function undoTrip(ctx: FoodCtx, id: string): Promise<{ returned: number }> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
  return ctx.tx(async (tx) => {
    const { rows: trip } = await tx.db.query(
      'SELECT id FROM shopping_trips WHERE id = $1 AND household_id = $2 FOR UPDATE',
      [id, tx.actor.householdId],
    );
    if (!trip[0]) throw new AppError(404, 'NOT_FOUND', 'Trip not found');
    const { rows: lots } = await tx.db.query<{ id: string; name: string; touched: boolean }>(
      `SELECT l.id, p.name, (l.quantity < l.initial_quantity OR l.opened_at IS NOT NULL OR l.finished_at IS NOT NULL) AS touched
         FROM stock_lots l JOIN products p ON p.id = l.product_id WHERE l.trip_id = $1 FOR UPDATE OF l`,
      [id],
    );
    const used = [...new Set(lots.filter((lot) => lot.touched).map((lot) => lot.name))];
    if (used.length)
      throw new AppError(
        409,
        'ALREADY_USED',
        `Already used or opened: ${used.join(', ')}. Correct those lines instead.`,
      );
    const lotIds = lots.map((lot) => lot.id);
    await tx.db.query(
      `DELETE FROM stock_events WHERE lot_id = ANY($1::uuid[]) AND kind = 'added'`,
      [lotIds],
    );
    await tx.db.query('UPDATE shopping_items SET lot_id = NULL WHERE lot_id = ANY($1::uuid[])', [
      lotIds,
    ]);
    await tx.db.query('DELETE FROM stock_lots WHERE id = ANY($1::uuid[])', [lotIds]);
    const { rowCount } = await tx.db.query(
      'UPDATE shopping_items SET trip_id = NULL, updated_at = $2 WHERE trip_id = $1',
      [id, tx.now],
    );
    await tx.db.query('DELETE FROM shopping_trips WHERE id = $1', [id]);
    return { returned: rowCount ?? 0 };
  });
}

/** Corrects a bought line later; the price and amount follow into the kitchen lot it became. */
export async function updateTripItem(
  ctx: FoodCtx,
  tripId: string,
  itemId: string,
  patch: TripItemPatch,
): Promise<{ trip: Trip; items: ShoppingItem[] }> {
  await ctx.tx(async (tx) => {
    const item = await findItem(tx, itemId, true);
    if (item.trip_id !== tripId)
      throw new AppError(404, 'NOT_FOUND', 'That line is not in this trip');
    const amount = patch.amount ?? item.amount;
    const unit = patch.unit ?? item.unit;
    await tx.db.query(
      'UPDATE shopping_items SET price = CASE WHEN $2::boolean THEN $3 ELSE price END, amount = $4, unit = $5, updated_at = $6 WHERE id = $1',
      [
        itemId,
        patch.price !== undefined,
        patch.price ?? null,
        amount,
        amount === null ? null : unit,
        tx.now,
      ],
    );
    if (item.lot_id) {
      const { rows } = await tx.db.query<{
        quantity: number;
        initial_quantity: number;
        finished_at: Date | null;
      }>('SELECT quantity, initial_quantity, finished_at FROM stock_lots WHERE id = $1', [
        item.lot_id,
      ]);
      const lot = rows[0];
      if (patch.price !== undefined)
        await tx.db.query('UPDATE stock_lots SET price = $2 WHERE id = $1', [
          item.lot_id,
          patch.price,
        ]);
      if (lot && patch.amount !== undefined && item.product_id) {
        // A correction of how much was bought moves what is left by the same difference.
        const product = await findProduct(tx, item.product_id);
        const bought = baseQuantity(amount!, unit ?? product.unit, product, 'amount');
        const left = Math.max(0, round(lot.quantity + bought - lot.initial_quantity));
        await tx.db.query('UPDATE stock_lots SET initial_quantity = $2 WHERE id = $1', [
          item.lot_id,
          bought,
        ]);
        if (!lot.finished_at || left > 0)
          await updateLot(tx, item.lot_id, { quantity: left, unit: product.unit });
      }
    }
    await refreshTripTotal(tx, tripId);
  });
  return getTrip(ctx, tripId);
}
