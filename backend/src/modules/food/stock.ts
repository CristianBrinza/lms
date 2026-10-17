import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { Translations } from '../../lib/i18n';
import { variantTranslations, type KindNames } from './catalog-i18n';
import type { FoodCtx } from './kitchen';
import { freezingFor, OPENED_BY_CATEGORY, type Level, type Location } from './presets';
import {
  findProduct,
  PRODUCT_COLUMNS,
  rememberVariant,
  resolveNamed,
  toProduct,
  translateProduct,
  type Product,
  type ProductRow,
} from './products';
import type { AddStockInput, LotPatch, PourInput, UseStockInput } from './schemas';
import { customUnit, round, toBase, UnitMismatchError } from './units';

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
  /** The store's name in other languages ({ ro: { name } }). */
  storeTranslations: Translations;
  tripId: string | null;
  note: string;
  /** A note the server wrote ("From Borscht, 2026-10-16"), as a key and its values; null otherwise. */
  noteKey: ServerNote['key'] | null;
  noteValues: Record<string, string>;
  /** Which kind it is (Cheddar), when the item has kinds. */
  variant: string;
  /** Its kind in other languages, from the catalog: { ro: { variant: 'Neagră' } }. */
  translations: Translations;
  /** The package it came in (jar, bottle, loaf) and what one held, in the base unit; '' and null when loose. */
  package: string;
  packageSize: number | null;
}

/**
 * Notes the server writes into the kitchen's history and onto pieces, in English as stored. The
 * app shows them by key, in its own language:
 * nowByLevel, itemRemoved, removed, pouredOut, pouredIn, undone,
 * reopened { meal }, moved { from, to, until? } (places: fridge, freezer…), level { level },
 * leftoversFrom { meal, date }.
 */
export interface ServerNote {
  key:
    | 'nowByLevel'
    | 'itemRemoved'
    | 'removed'
    | 'pouredOut'
    | 'pouredIn'
    | 'undone'
    | 'reopened'
    | 'moved'
    | 'level'
    | 'leftoversFrom';
  values: Record<string, string>;
}

const FIXED_NOTES: Record<string, ServerNote['key']> = {
  'Now kept by level': 'nowByLevel',
  'Item removed': 'itemRemoved',
  Removed: 'removed',
  'Poured out': 'pouredOut',
  'Poured in': 'pouredIn',
  Undone: 'undone',
};

/** The key of a note the server wrote, with its values; null for what people wrote. */
export function serverNote(note: string, kind?: string): ServerNote | null {
  if (!note) return null;
  const fixed = FIXED_NOTES[note];
  if (fixed) return { key: fixed, values: {} };
  if (kind === 'level' && (note === 'full' || note === 'low' || note === 'out'))
    return { key: 'level', values: { level: note } };
  const moved = /^([a-z]+) → ([a-z]+)(?:, keeps until (\d{4}-\d{2}-\d{2}))?$/.exec(note);
  if (moved && kind !== undefined && kind === 'moved')
    return {
      key: 'moved',
      values: { from: moved[1]!, to: moved[2]!, ...(moved[3] ? { until: moved[3] } : {}) },
    };
  const reopened = /^Reopened (.+)$/.exec(note);
  if (reopened && kind === 'restored') return { key: 'reopened', values: { meal: reopened[1]! } };
  const leftovers = /^From (.+), (\d{4}-\d{2}-\d{2})$/.exec(note);
  if (leftovers && kind === undefined)
    return { key: 'leftoversFrom', values: { meal: leftovers[1]!, date: leftovers[2]! } };
  return null;
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
  store_translations: Translations | null;
  product_name: string | null;
  product_variant_names: KindNames | null;
  trip_id: string | null;
  note: string;
  variant: string;
  package: string;
  package_size: number | null;
  finished_at: Date | null;
}

const LOT_SELECT = `SELECT l.id, l.product_id, l.quantity, l.initial_quantity, l.location, l.added_at, l.expires_on, l.opened_at,
       l.price, l.store_id, s.name AS store_name, s.translations AS store_translations, lp.name AS product_name, lp.variant_names AS product_variant_names, l.trip_id, l.note, l.variant, l.package, l.package_size, l.finished_at
  FROM stock_lots l LEFT JOIN stores s ON s.id = l.store_id LEFT JOIN products lp ON lp.id = l.product_id`;

/** Opened first, then soonest to expire, then oldest: the order stock is used in. */
export const LOT_ORDER = 'l.opened_at IS NULL, l.expires_on NULLS LAST, l.added_at, l.id';

export function toLot(row: LotRow): Lot {
  const note = serverNote(row.note);
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
    storeTranslations: row.store_translations ?? {},
    tripId: row.trip_id,
    note: row.note,
    noteKey: note?.key ?? null,
    noteValues: note?.values ?? {},
    variant: row.variant,
    translations: row.product_name
      ? variantTranslations(row.product_name, row.variant, row.product_variant_names)
      : {},
    package: row.package,
    packageSize: row.package_size,
  };
}

/** A calendar day in the server's time zone (TZ, e.g. Europe/Chisinau), `days` from now. */
export function localDate(now: Date, days = 0): string {
  // Calendar days, not 24-hour blocks: a day with a clock change has 23 or 25 hours.
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** toBase, answering 400 (not 500) when the unit doesn't fit the item. */
export function baseQuantity(
  quantity: number,
  unit: string | undefined | null,
  product: Product,
  field = 'unit',
): number {
  try {
    return toBase(quantity, unit ?? product.unit, product);
  } catch (error) {
    if (error instanceof UnitMismatchError)
      throw new AppError(400, 'VALIDATION', error.message, { fields: { [field]: error.message } });
    throw error;
  }
}

export async function recordEvent(
  ctx: FoodCtx,
  event: {
    productId: string;
    lotId: string | null;
    kind: 'added' | 'used' | 'wasted' | 'adjusted' | 'moved' | 'restored' | 'level';
    delta: number;
    mealId?: string | null;
    note?: string;
  },
): Promise<number> {
  const { rows } = await ctx.db.query<{ id: number }>(
    `INSERT INTO stock_events (household_id, product_id, lot_id, kind, delta, meal_id, actor_id, via, note, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      ctx.actor.householdId,
      event.productId,
      event.lotId,
      event.kind,
      round(event.delta),
      event.mealId ?? null,
      ctx.actor.userId,
      ctx.actor.via,
      event.note ?? '',
      ctx.now,
    ],
  );
  return rows[0]!.id;
}

async function findLot(ctx: FoodCtx, id: string, lock = false): Promise<LotRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That piece is not in your kitchen');
  const { rows } = await ctx.db.query<LotRow>(
    `${LOT_SELECT} WHERE l.id = $1 AND l.household_id = $2${lock ? ' FOR UPDATE OF l' : ''}`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That piece is not in your kitchen');
  return rows[0];
}

/** Puts something in the kitchen: a new lot, with its expiry from the product's shelf life unless given. */
/** Expiry for a lot put in `location`: frozen food keeps its frozen days, else the shelf life. */
function defaultExpiry(product: Product, location: Location, now: Date): string | null {
  // Growing on the balcony: no best-before.
  if (location === 'garden') return null;
  if (location === 'freezer' && product.location !== 'freezer') {
    const { freezerDays } = freezingFor(product);
    if (freezerDays) return localDate(now, freezerDays);
  }
  return product.shelfLifeDays ? localDate(now, product.shelfLifeDays) : null;
}

/**
 * Sets a level item's level (full, low, out). Level items have no lots: buying one makes it full,
 * and people say when it runs low or out.
 */
export async function setLevel(ctx: FoodCtx, productId: string, level: Level): Promise<Product> {
  return ctx.tx(async (tx) => {
    const product = await findProduct(tx, productId, { lock: true });
    if (product.trackMode !== 'level')
      throw new AppError(
        409,
        'NOT_LEVEL',
        `${product.name} is counted in amounts; change it to “full / low / out” first`,
      );
    await tx.db.query(
      'UPDATE products SET level = $2, level_at = $3, archived_at = NULL WHERE id = $1',
      [product.id, level, tx.now],
    );
    await recordEvent(tx, {
      productId: product.id,
      lotId: null,
      kind: 'level',
      delta: 0,
      note: level,
    });
    return { ...product, level, levelAt: tx.now.toISOString(), archived: false };
  });
}

/** What an addition becomes: one lot per package size ("2 cans of 300 g" and "1 of 1 kg"), or one loose lot. */
function piecesOf(
  input: AddStockInput,
  product: Product,
): Array<{ quantity: number; package: string; packageSize: number | null }> {
  const named = input.unit ? customUnit(input.unit, product) : null;
  if (input.packages) {
    const name = input.package?.trim() || named?.name || product.units[0]?.name || '';
    return input.packages.map((pack) => {
      const size = pack.sizeUnit
        ? baseQuantity(pack.size, pack.sizeUnit, product, 'packages')
        : round(pack.size);
      return { quantity: round(pack.count * size), package: name, packageSize: size };
    });
  }
  const quantity = input.quantity!;
  if (named) {
    // "A jar of 14": this jar's own count rather than the usual jar size.
    const size = input.each ?? named.size;
    return [{ quantity: round(quantity * size), package: named.name, packageSize: size }];
  }
  return [
    {
      quantity: baseQuantity(quantity, input.unit, product),
      package: input.package?.trim() ?? '',
      packageSize: null,
    },
  ];
}

export async function addStock(
  ctx: FoodCtx,
  input: AddStockInput & { tripId?: string | null },
): Promise<{ product: Product; lot: Lot | null; lots: Lot[] }> {
  return ctx.tx(async (tx) => {
    const named = input.productId
      ? null
      : await resolveNamed(tx, input.name!, input.unit, { area: input.area });
    let product = named ? named.product : await findProduct(tx, input.productId!, { lock: true });
    const variant = input.variant || named?.variant || '';
    product = await rememberVariant(tx, product, variant);
    // An assistant adding "Plăcinte" names it, and its kinds, in every language at once.
    if (input.translations) product = await translateProduct(tx, product, input.translations);
    if (product.archived) {
      await tx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [
        product.id,
        tx.now,
      ]);
      product = { ...product, archived: false };
    }
    if (input.storeId) {
      const { rowCount } = await tx.db.query(
        'SELECT 1 FROM stores WHERE id = $1 AND household_id = $2',
        [input.storeId, tx.actor.householdId],
      );
      if (!rowCount)
        throw new AppError(400, 'VALIDATION', 'That store is not in your kitchen', {
          fields: { storeId: 'Unknown store' },
        });
    }
    // A level item bought is simply full again; it keeps no lots.
    if (product.trackMode === 'level')
      return { product: await setLevel(tx, product.id, 'full'), lot: null, lots: [] };
    const pieces = piecesOf(input, product);
    const location = input.location ?? product.location;
    const expiresOn =
      input.expiresOn === undefined ? defaultExpiry(product, location, tx.now) : input.expiresOn;
    // The price is for everything; each lot carries its share by amount.
    const total = pieces.reduce((sum, piece) => sum + piece.quantity, 0);
    let priceLeft = input.price ?? null;
    const lots: Lot[] = [];
    for (const [index, piece] of pieces.entries()) {
      const last = index === pieces.length - 1;
      const price =
        priceLeft === null
          ? null
          : last
            ? priceLeft
            : Math.round(((input.price! * piece.quantity) / (total || 1)) * 100) / 100;
      if (priceLeft !== null && price !== null)
        priceLeft = Math.round((priceLeft - price) * 100) / 100;
      const id = randomUUID();
      await tx.db.query(
        `INSERT INTO stock_lots (id, household_id, product_id, quantity, initial_quantity, location, added_at, expires_on, price, store_id, trip_id, note, created_by, variant, package, package_size)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          id,
          tx.actor.householdId,
          product.id,
          piece.quantity,
          location,
          tx.now,
          expiresOn,
          price,
          input.storeId ?? null,
          input.tripId ?? null,
          input.note ?? '',
          tx.actor.userId,
          variant,
          piece.package,
          piece.packageSize,
        ],
      );
      await recordEvent(tx, {
        productId: product.id,
        lotId: id,
        kind: 'added',
        delta: piece.quantity,
      });
      lots.push(toLot(await findLot(tx, id)));
    }
    return { product, lot: lots[0] ?? null, lots };
  });
}

export interface UseResult {
  productId: string;
  /** How much was taken, in the product's base unit. */
  used: number;
  /** How much was asked for but not there. */
  shortfall: number;
  lots: Array<{
    lotId: string;
    taken: number;
    left: number;
    /** Opened by this use: it now keeps until `expiresOn`, in `location`. */
    opened: boolean;
    expiresOn: string | null;
    location: Location;
  }>;
  /** The history entries this use wrote: pass them to undo it (once). */
  events: number[];
}

/**
 * Takes stock: from `lotId` first when given, then in LOT_ORDER. Records "used" or "wasted",
 * linked to a meal when cooking.
 */
export async function useStock(
  ctx: FoodCtx,
  input: UseStockInput & { mealId?: string | null },
): Promise<UseResult> {
  return ctx.tx(async (tx) => {
    const product = await findProduct(tx, input.productId, { lock: true });
    // Level items aren't measured: using some leaves them as they are.
    if (product.trackMode !== 'exact')
      return { productId: product.id, used: 0, shortfall: 0, lots: [], events: [] };
    const wanted = baseQuantity(input.quantity, input.unit, product);
    if (input.lotId) {
      const lot = await findLot(tx, input.lotId);
      if (lot.product_id !== product.id)
        throw new AppError(400, 'VALIDATION', 'That piece belongs to another item', {
          fields: { lotId: 'Wrong item' },
        });
    }
    const { rows } = await tx.db.query<LotRow>(
      `${LOT_SELECT} WHERE l.product_id = $1 AND l.household_id = $2 AND l.finished_at IS NULL
         AND ($4::text IS NULL OR l.id = $3 OR lower(l.variant) = lower($4))
        ORDER BY (l.id = $3) DESC, ${LOT_ORDER} FOR UPDATE OF l`,
      [product.id, tx.actor.householdId, input.lotId ?? null, input.variant ?? null],
    );
    let remaining = wanted;
    const touched: UseResult['lots'] = [];
    const events: number[] = [];
    for (const lot of rows) {
      if (remaining <= 0) break;
      const taken = round(Math.min(lot.quantity, remaining));
      if (taken <= 0) continue;
      const left = round(lot.quantity - taken);
      // A lot that is started is opened: its expiry shortens to the "once opened" days (a package's
      // kind decides when the item doesn't), and it moves to where it is kept once open.
      const opening = left > 0 && !lot.opened_at;
      const openedDays =
        product.openedDays ?? (lot.package ? (OPENED_BY_CATEGORY[product.category] ?? null) : null);
      const openedUntil = opening && openedDays ? localDate(tx.now, openedDays) : null;
      const expiresOn =
        openedUntil && (!lot.expires_on || openedUntil < lot.expires_on)
          ? openedUntil
          : lot.expires_on;
      const location =
        opening && product.openedLocation && lot.location !== 'freezer'
          ? product.openedLocation
          : lot.location;
      await tx.db.query(
        `UPDATE stock_lots SET quantity = $2, finished_at = $3, opened_at = COALESCE(opened_at, $4), expires_on = $5, location = $6 WHERE id = $1`,
        [lot.id, left, left === 0 ? tx.now : null, left === 0 ? null : tx.now, expiresOn, location],
      );
      events.push(
        await recordEvent(tx, {
          productId: product.id,
          lotId: lot.id,
          kind: input.wasted ? 'wasted' : 'used',
          delta: -taken,
          mealId: input.mealId,
          note: input.note,
        }),
      );
      touched.push({ lotId: lot.id, taken, left, opened: opening, expiresOn, location });
      remaining = round(remaining - taken);
    }
    return {
      productId: product.id,
      used: round(wanted - remaining),
      shortfall: remaining,
      lots: touched,
      events,
    };
  });
}

/**
 * Puts taken stock back into the lots it came from: the undo for a use, and for a cooked meal
 * reopened. Each lot gets back at most what it started with.
 */
export async function restoreStock(
  ctx: FoodCtx,
  lots: Array<{ lotId: string; quantity: number }>,
  options: { mealId?: string | null; note?: string } = {},
): Promise<void> {
  await ctx.tx(async (tx) => {
    for (const { lotId, quantity } of lots) {
      if (quantity <= 0) continue;
      const lot = await findLot(tx, lotId, true);
      const back = round(Math.min(quantity, lot.initial_quantity - lot.quantity));
      if (back <= 0) continue;
      await tx.db.query(
        'UPDATE stock_lots SET quantity = quantity + $2, finished_at = NULL WHERE id = $1',
        [lotId, back],
      );
      await recordEvent(tx, {
        productId: lot.product_id,
        lotId,
        kind: 'restored',
        delta: back,
        mealId: options.mealId,
        note: options.note ?? 'Undone',
      });
    }
  });
}

/**
 * Undoes uses by their history entries: each one goes back into its lot exactly once (a double tap
 * or a retried request changes nothing the second time). Returns how many were undone.
 */
export async function undoEvents(ctx: FoodCtx, ids: number[]): Promise<number> {
  return ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<{
      id: number;
      lot_id: string | null;
      delta: number;
      meal_id: string | null;
    }>(
      `SELECT id, lot_id, delta, meal_id FROM stock_events
        WHERE id = ANY($1::bigint[]) AND household_id = $2 AND kind IN ('used', 'wasted') AND undone_at IS NULL
        FOR UPDATE`,
      [ids, tx.actor.householdId],
    );
    for (const event of rows) {
      if (event.lot_id)
        await restoreStock(tx, [{ lotId: event.lot_id, quantity: -event.delta }], {
          mealId: event.meal_id,
        });
      await tx.db.query('UPDATE stock_events SET undone_at = $2 WHERE id = $1', [event.id, tx.now]);
    }
    return rows.length;
  });
}

/** Corrects a lot: what is left, where it is, when it expires, whether it is open, its price. */
export async function updateLot(ctx: FoodCtx, id: string, patch: LotPatch): Promise<Lot> {
  return ctx.tx(async (tx) => {
    const lot = await findLot(tx, id, true);
    const product = await findProduct(tx, lot.product_id);
    if (patch.quantity !== undefined) {
      const quantity =
        patch.quantity === 0 ? 0 : baseQuantity(patch.quantity, patch.unit, product, 'quantity');
      const delta = round(quantity - lot.quantity);
      if (delta !== 0) {
        await tx.db.query(
          'UPDATE stock_lots SET quantity = $2, initial_quantity = GREATEST(initial_quantity, $2), finished_at = $3 WHERE id = $1',
          [id, quantity, quantity === 0 ? tx.now : null],
        );
        await recordEvent(tx, {
          productId: product.id,
          lotId: id,
          kind: 'adjusted',
          delta,
          note: patch.note,
        });
      }
    }
    if (patch.location && patch.location !== lot.location) {
      // Freezing restarts the clock with the frozen days; thawing gives it the thawed days.
      const { freezerDays, thawedDays } = freezingFor(product);
      const days =
        patch.location === 'freezer' ? freezerDays : lot.location === 'freezer' ? thawedDays : null;
      const expiry = patch.expiresOn === undefined && days ? localDate(tx.now, days) : null;
      await tx.db.query(
        'UPDATE stock_lots SET location = $2, expires_on = COALESCE($3::date, expires_on) WHERE id = $1',
        [id, patch.location, expiry],
      );
      const note = `${lot.location} → ${patch.location}${expiry ? `, keeps until ${expiry}` : ''}`;
      await recordEvent(tx, { productId: product.id, lotId: id, kind: 'moved', delta: 0, note });
    }
    if (patch.expiresOn !== undefined)
      await tx.db.query('UPDATE stock_lots SET expires_on = $2 WHERE id = $1', [
        id,
        patch.expiresOn,
      ]);
    if (patch.opened !== undefined) {
      const opening = patch.opened && !lot.opened_at;
      const openedDays =
        product.openedDays ?? (lot.package ? (OPENED_BY_CATEGORY[product.category] ?? null) : null);
      const shorten =
        opening && openedDays && patch.expiresOn === undefined
          ? localDate(tx.now, openedDays)
          : null;
      // Opened by hand: same as by use — shorter keeping, and to where it is kept once open.
      const moveTo =
        opening &&
        product.openedLocation &&
        patch.location === undefined &&
        lot.location !== 'freezer'
          ? product.openedLocation
          : null;
      await tx.db.query(
        `UPDATE stock_lots SET opened_at = $2,
                expires_on = CASE WHEN $3::date IS NOT NULL THEN LEAST(COALESCE(expires_on, $3::date), $3::date) ELSE expires_on END,
                location = coalesce($4, location)
          WHERE id = $1`,
        [id, patch.opened ? (lot.opened_at ?? tx.now) : null, shorten, moveTo],
      );
    }
    if (patch.price !== undefined)
      await tx.db.query('UPDATE stock_lots SET price = $2 WHERE id = $1', [id, patch.price]);
    if (patch.note !== undefined && patch.quantity === undefined)
      await tx.db.query('UPDATE stock_lots SET note = $2 WHERE id = $1', [id, patch.note]);
    return toLot(await findLot(tx, id));
  });
}

/**
 * Pours from one piece into another of the same item: the big oil bottle into the small one on the
 * desk, a 5 l jug into a bottle. The total stays; the source is opened, the new piece starts open.
 */
export async function pourLot(
  ctx: FoodCtx,
  fromId: string,
  input: PourInput,
): Promise<{ from: Lot; into: Lot }> {
  return ctx.tx(async (tx) => {
    const from = await findLot(tx, fromId, true);
    if (from.finished_at) throw new AppError(409, 'FINISHED', 'That piece is used up');
    const product = await findProduct(tx, from.product_id);
    const amount = baseQuantity(input.quantity, input.unit, product, 'quantity');
    if (amount > from.quantity + 1e-9) {
      throw new AppError(400, 'VALIDATION', 'There isn’t that much in it', {
        fields: { quantity: `At most ${from.quantity} ${product.unit}` },
      });
    }
    let intoId = input.intoLotId;
    if (intoId) {
      const into = await findLot(tx, intoId, true);
      if (into.product_id !== from.product_id || into.id === from.id)
        throw new AppError(400, 'VALIDATION', 'Pour into another piece of the same item', {
          fields: { intoLotId: 'Wrong piece' },
        });
      const quantity = round(into.quantity + amount);
      await tx.db.query(
        `UPDATE stock_lots SET quantity = $2, initial_quantity = greatest(initial_quantity, $2), finished_at = NULL, opened_at = coalesce(opened_at, $3),
                expires_on = CASE WHEN $4::date IS NOT NULL AND (expires_on IS NULL OR $4::date < expires_on) THEN $4::date ELSE expires_on END
          WHERE id = $1`,
        [intoId, quantity, tx.now, from.expires_on],
      );
    } else {
      intoId = randomUUID();
      await tx.db.query(
        `INSERT INTO stock_lots (id, household_id, product_id, quantity, initial_quantity, location, added_at, expires_on, opened_at, note, created_by, variant, package, package_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $7, $9, $10, $11, $12, $13)`,
        [
          intoId,
          tx.actor.householdId,
          product.id,
          amount,
          Math.max(amount, input.packageSize ?? 0),
          input.location ?? from.location,
          tx.now,
          from.expires_on,
          input.note ?? '',
          tx.actor.userId,
          from.variant,
          input.package ?? '',
          input.packageSize ?? null,
        ],
      );
    }
    const left = round(from.quantity - amount);
    await tx.db.query(
      'UPDATE stock_lots SET quantity = $2, finished_at = $3, opened_at = coalesce(opened_at, $4) WHERE id = $1',
      [from.id, left, left === 0 ? tx.now : null, tx.now],
    );
    await recordEvent(tx, {
      productId: product.id,
      lotId: from.id,
      kind: 'moved',
      delta: -amount,
      note: 'Poured out',
    });
    await recordEvent(tx, {
      productId: product.id,
      lotId: intoId,
      kind: 'moved',
      delta: amount,
      note: 'Poured in',
    });
    return { from: toLot(await findLot(tx, from.id)), into: toLot(await findLot(tx, intoId)) };
  });
}

/** Removes a lot added by mistake (or gone without a trace). Its history stays. */
export async function removeLot(ctx: FoodCtx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const lot = await findLot(tx, id, true);
    if (lot.finished_at) return;
    await tx.db.query('UPDATE stock_lots SET quantity = 0, finished_at = $2 WHERE id = $1', [
      id,
      tx.now,
    ]);
    await recordEvent(tx, {
      productId: lot.product_id,
      lotId: id,
      kind: 'adjusted',
      delta: -lot.quantity,
      note: 'Removed',
    });
  });
}

export interface StockedProduct extends Product {
  /** Everything in stock, in the base unit (every place, even in a one-place view). */
  total: number;
  /** In a one-place view: what is in that place. */
  totalHere?: number;
  lots: Lot[];
  nextExpiry: string | null;
  /** Below its "running low" amount (minStock). */
  low: boolean;
}

/**
 * The kitchen: products with stock, plus staples that ran out and everything kept by level. With a
 * location, only items with something there, but totals still count every place (so cheese in the
 * freezer isn't "out" in the fridge view).
 */
export async function kitchen(
  ctx: FoodCtx,
  filter: { location?: Location; area?: 'food' | 'house' } = {},
): Promise<StockedProduct[]> {
  const { rows: lotRows } = await ctx.db.query<LotRow>(
    `${LOT_SELECT} WHERE l.household_id = $1 AND l.finished_at IS NULL ORDER BY ${LOT_ORDER}`,
    [ctx.actor.householdId],
  );
  const lotsByProduct = new Map<string, Lot[]>();
  for (const row of lotRows) {
    const list = lotsByProduct.get(row.product_id) ?? [];
    list.push(toLot(row));
    lotsByProduct.set(row.product_id, list);
  }
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products
      WHERE household_id = $1 AND archived_at IS NULL AND (id = ANY($2::uuid[]) OR min_stock > 0 OR track_mode = 'level')
      ORDER BY lower(name)`,
    [ctx.actor.householdId, [...lotsByProduct.keys()]],
  );
  const all = rows
    .map((row) => stocked(toProduct(row), lotsByProduct.get(row.id) ?? []))
    .filter((p) => !filter.area || p.area === filter.area);
  if (!filter.location) return all;
  return all
    .filter((p) =>
      p.lots.length
        ? p.lots.some((lot) => lot.location === filter.location)
        : p.location === filter.location,
    )
    .map((p) => {
      const here = p.lots.filter((lot) => lot.location === filter.location);
      return {
        ...p,
        lots: here,
        totalHere: round(here.reduce((sum, lot) => sum + lot.quantity, 0)),
      };
    });
}

export function stocked(product: Product, lots: Lot[]): StockedProduct {
  const total = round(lots.reduce((sum, lot) => sum + lot.quantity, 0));
  const nextExpiry =
    lots
      .map((lot) => lot.expiresOn)
      .filter((date): date is string => Boolean(date))
      .sort()[0] ?? null;
  const low =
    product.trackMode === 'level'
      ? product.level !== 'full'
      : product.minStock !== null && product.minStock > 0 && total < product.minStock;
  return { ...product, total, lots, nextExpiry, low };
}

export interface StockEvent {
  id: number;
  kind: string;
  delta: number;
  lotId: string | null;
  mealId: string | null;
  note: string;
  /** A note the server wrote ("Poured out", "fridge → freezer"), as a key and values (ServerNote). */
  noteKey: ServerNote['key'] | null;
  noteValues: Record<string, string>;
  via: 'app' | 'ai';
  actor: string | null;
  createdAt: string;
}

export interface PricePoint {
  storeId: string | null;
  storeName: string | null;
  /** The store's name in other languages ({ ro: { name } }). */
  storeTranslations: Translations;
  price: number;
  quantity: number;
  /** Price per kg, per l or per piece. */
  unitPrice: number;
  boughtAt: string;
}

/** One product: its lots, the last 30 changes, and the last price paid at each store. */
export async function productDetail(
  ctx: FoodCtx,
  id: string,
): Promise<{ product: StockedProduct; events: StockEvent[]; prices: PricePoint[] }> {
  const product = await findProduct(ctx, id);
  const { rows: lots } = await ctx.db.query<LotRow>(
    `${LOT_SELECT} WHERE l.product_id = $1 AND l.finished_at IS NULL ORDER BY ${LOT_ORDER}`,
    [id],
  );
  const { rows: events } = await ctx.db.query<{
    id: number;
    kind: string;
    delta: number;
    lot_id: string | null;
    meal_id: string | null;
    note: string;
    via: 'app' | 'ai';
    actor: string | null;
    created_at: Date;
  }>(
    `SELECT e.id, e.kind, e.delta, e.lot_id, e.meal_id, e.note, e.via, u.name AS actor, e.created_at
       FROM stock_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.product_id = $1 ORDER BY e.created_at DESC, e.id DESC LIMIT 30`,
    [id],
  );
  const { rows: prices } = await ctx.db.query<{
    store_id: string | null;
    store_name: string | null;
    store_translations: Translations | null;
    price: number;
    initial_quantity: number;
    added_at: Date;
  }>(
    `SELECT DISTINCT ON (l.store_id) l.store_id, s.name AS store_name, s.translations AS store_translations, l.price, l.initial_quantity, l.added_at
       FROM stock_lots l LEFT JOIN stores s ON s.id = l.store_id
      WHERE l.product_id = $1 AND l.price IS NOT NULL AND l.initial_quantity > 0
      ORDER BY l.store_id, l.added_at DESC`,
    [id],
  );
  const per = product.unit === 'pcs' ? 1 : 1000;
  return {
    product: stocked(product, lots.map(toLot)),
    events: events.map((e) => {
      const note = serverNote(e.note, e.kind);
      return {
        id: e.id,
        kind: e.kind,
        delta: e.delta,
        lotId: e.lot_id,
        mealId: e.meal_id,
        note: e.note,
        noteKey: note?.key ?? null,
        noteValues: note?.values ?? {},
        via: e.via,
        actor: e.actor,
        createdAt: e.created_at.toISOString(),
      };
    }),
    prices: prices
      .map((p) => ({
        storeId: p.store_id,
        storeName: p.store_name,
        storeTranslations: p.store_translations ?? {},
        price: p.price,
        quantity: p.initial_quantity,
        unitPrice: Math.round((p.price / p.initial_quantity) * per * 100) / 100,
        boughtAt: p.added_at.toISOString(),
      }))
      .sort((a, b) => b.boughtAt.localeCompare(a.boughtAt)),
  };
}
