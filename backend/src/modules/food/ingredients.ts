import { findPreset, kindIcon, sameName } from './presets';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { Translations } from '../../lib/i18n';
import type { LineAllocation, PlannedMealRef } from './allocation';
import { combine, onlyFields, variantTranslations } from './catalog-i18n';
import { warningsFor, type Restriction, type Warning } from './restrictions';
import type { FoodCtx } from './kitchen';
import type { FoodIcon } from './presets';
import {
  findProduct,
  namesOf,
  PRODUCT_COLUMNS,
  rememberVariant,
  resolveNamed,
  toProduct,
  type Product,
  type ProductRow,
} from './products';
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
  /** The meal part it belongs to (meals only). */
  partId: string | null;
  /** Only this type will do (Finlandia); '' for any. */
  variant: string;
  /** Or one of these instead, in order. */
  alternatives: Array<{
    productId: string | null;
    name: string;
    /** Its name and type in other languages ({ ro: { name, variant } }). */
    translations: Translations;
    icon: FoodIcon;
    amount: number | null;
    unit: string | null;
    variant: string;
    enough: boolean | null;
    /** How much of it is missing, in its own base unit. */
    missing: number;
    inStock: number | null;
    baseUnit: BaseUnit | null;
  }>;
  /** Enough of the main item itself (whatever is chosen), and how much of it is missing. */
  mainEnough: boolean | null;
  mainMissing: number;
  /** Which option was chosen for this meal: 0 the main item, 1… an alternative; null: the first there is. */
  choice: number | null;
  /** The option that will be used: the chosen one, else the first with enough. */
  chosen: number;
  /** Short because what there is goes off before the meal (planned meals). */
  spoilsBefore: boolean;
  /** Covered by one of the alternatives rather than the main item (null: the main item, or nothing). */
  using: { productId: string; name: string; translations: Translations; icon: FoodIcon } | null;
  name: string;
  /**
   * The line's name and type in other languages ({ ro: { name, variant } }): the item's own names
   * when the line calls it by its name ("Tomatoes", "roșii"), else none (what the recipe says).
   */
  translations: Translations;
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
  /** Someone is allergic to it, or avoids it. */
  warnings: Warning[];
  /** Some of it expires within three days: a reason to cook this soon. */
  expiresSoon: boolean;
}

export interface Availability {
  /** Checked lines that are covered. */
  have: number;
  /** Lines checked against the kitchen (linked, counted, not optional). */
  total: number;
  ready: boolean;
  missing: Array<{
    productId: string;
    name: string;
    translations: Translations;
    missing: number;
    unit: BaseUnit;
  }>;
  /** Lines using something that expires within three days. */
  useSoon: number;
  /** Everyone this dish is a problem for (allergy first), from its ingredients. */
  warnings: Array<Warning & { item: string; translations: Translations }>;
}

/**
 * A line's name (and type) in other languages: the item's names when the line calls it by one of
 * them or by its catalog name; a line that says more ("Finlandia vodka") keeps its own words.
 */
export function lineTranslations(
  name: string,
  product: Product | undefined,
  variant: string | undefined,
): Translations {
  if (!product) return {};
  const preset = findPreset(name);
  const same =
    namesOf(product).some((other) => sameName(other, name)) ||
    (preset !== null && preset.name === product.name);
  return combine(
    same ? onlyFields(product.translations, ['name']) : {},
    variantTranslations(product.name, variant),
  );
}

export interface IngredientRow {
  id: string;
  owner_id: string;
  product_id: string | null;
  lot_id?: string | null;
  /** Which part of a meal the line belongs to (meals only; null: the meal's own). */
  part_id?: string | null;
  name: string;
  /** Only this type will do; '' for any. */
  variant?: string;
  /** Or one of these instead, in order (an amount of null: the same as the main one). */
  alternatives?: Alternative[];
  /** Planned meals: which option was picked (0 the main item, 1… an alternative); null: automatic. */
  choice?: number | null;
  amount: number | null;
  unit: string | null;
  note: string;
  optional: boolean;
  sort: number;
}

export interface Alternative {
  product_id: string | null;
  name: string;
  amount: number | null;
  unit: string | null;
  variant: string;
}

export interface StockInfo {
  product: Product;
  total: number;
  nextExpiry: string | null;
  /** Stock per type, by lowercase type name. */
  byVariant: Map<string, number>;
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
  const map = new Map(
    rows.map((row) => [
      row.id,
      {
        product: toProduct(row),
        total: row.total,
        nextExpiry: row.next_expiry,
        byVariant: new Map<string, number>(),
      },
    ]),
  );
  const { rows: kinds } = await ctx.db.query<{
    product_id: string;
    variant: string;
    total: number;
  }>(
    `SELECT product_id, lower(variant) AS variant, sum(quantity)::numeric AS total FROM stock_lots
      WHERE household_id = $1 AND finished_at IS NULL AND variant <> '' GROUP BY product_id, lower(variant)`,
    [ctx.actor.householdId],
  );
  for (const kind of kinds) map.get(kind.product_id)?.byVariant.set(kind.variant, kind.total);
  return map;
}

/** What there is of what a line asks for: one type when it names one, else everything. */
export function stockFor(info: StockInfo, variant: string | undefined): number {
  return variant ? (info.byVariant.get(variant.toLowerCase()) ?? 0) : info.total;
}

/** The base quantity a line needs at `scale`, or null when it has no amount or the unit doesn't fit. */
export function neededBase(
  row: Pick<IngredientRow, 'amount' | 'unit'>,
  product: Product,
  scale = 1,
): number | null {
  if (row.amount === null) return null;
  const unit = row.unit ?? product.unit;
  if (!canConvert(unit, product)) return null;
  return toBase(row.amount * scale, unit, product);
}

export interface DescribeOptions {
  /** A planned meal's lines: how the plan played forward covers each one (and with which alternative). */
  allocation?: Map<string, LineAllocation>;
  /** For cooking now (a recipe): what planned meals already claim, per product. */
  reserved?: Map<string, { amount: number; first: PlannedMealRef }>;
  /** Allergies and foods people avoid in this kitchen. */
  restrictions?: Restriction[];
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
  const availability: Availability = {
    have: 0,
    total: 0,
    ready: true,
    missing: [],
    useSoon: 0,
    warnings: [],
  };
  for (const row of rows) {
    const info = row.product_id ? stock.get(row.product_id) : undefined;
    const mode = info?.product.trackMode ?? 'none';
    // Exact items are measured against stock; level items just need to not be out.
    const counted = mode === 'exact' || mode === 'level';
    const needed = info && mode === 'exact' ? neededBase(row, info.product, scale) : null;
    const total = info ? stockFor(info, row.variant) : 0;
    const planned = options.allocation?.get(row.id);
    const claimed =
      mode === 'exact' && info ? (options.reserved?.get(info.product.id) ?? null) : null;
    // What is free for this: a planned meal gets its share of the plan; cooking now gets what no plan claims.
    const free = claimed ? Math.max(0, round(total - claimed.amount)) : total;
    let enough =
      mode === 'level'
        ? info!.product.level !== 'out'
        : mode === 'exact'
          ? needed === null
            ? free > 0
            : free + 1e-9 >= needed
          : null;
    let missing = mode === 'exact' && !enough ? round(needed === null ? 0 : needed - free) : 0;
    let reservedFor: PlannedMealRef | null =
      claimed && !enough && total + 1e-9 >= (needed ?? 0) ? claimed.first : null;
    if (planned && mode === 'exact') {
      enough = planned.short <= 0;
      missing = planned.short;
      reservedFor = planned.short > 0 ? planned.takenBy : null;
    }
    // The other options (milk, or whipped cream), each with whether there is enough of it.
    const mainEnough = enough;
    const mainMissing = missing;
    const alternatives = (row.alternatives ?? []).map((alt, index) => {
      const altInfo = alt.product_id ? stock.get(alt.product_id) : undefined;
      const altMode = altInfo?.product.trackMode ?? 'none';
      const altNeeded =
        altInfo && altMode === 'exact'
          ? neededBase(alt.amount === null ? row : alt, altInfo.product, scale)
          : null;
      const altClaimed =
        altMode === 'exact' && altInfo
          ? (options.reserved?.get(altInfo.product.id)?.amount ?? 0)
          : 0;
      const altTotal = altInfo ? stockFor(altInfo, alt.variant) : 0;
      const altFree = Math.max(0, round(altTotal - altClaimed));
      let altEnough =
        altMode === 'level'
          ? altInfo!.product.level !== 'out'
          : altMode === 'exact'
            ? altNeeded === null
              ? altFree > 0
              : altFree + 1e-9 >= altNeeded
            : null;
      let altMissing =
        altMode === 'exact' && !altEnough && altNeeded !== null ? round(altNeeded - altFree) : 0;
      // A planned meal that uses this one: the plan says how it is covered.
      if (planned && planned.option === index + 1) {
        altEnough = planned.short <= 0;
        altMissing = planned.short;
      }
      return {
        productId: alt.product_id,
        name: alt.name,
        translations: lineTranslations(alt.name, altInfo?.product, alt.variant),
        icon: altInfo ? kindIcon(altInfo.product, alt.variant) : 'basket',
        amount: alt.amount === null ? null : round(alt.amount * scale),
        unit: alt.unit,
        variant: alt.variant,
        enough: altEnough,
        missing: altMissing,
        inStock: altMode === 'exact' ? altTotal : null,
        baseUnit: altInfo?.product.unit ?? null,
      };
    });
    // Chosen for this meal, or how the plan covered it, or the first option there is enough of.
    const choice =
      row.choice !== undefined && row.choice !== null && row.choice <= alternatives.length
        ? row.choice
        : null;
    const auto = mainEnough === false ? alternatives.findIndex((alt) => alt.enough) + 1 : 0;
    const chosen = choice ?? (planned ? (planned.option ?? 0) : auto);
    let using: IngredientLine['using'] = null;
    const pick = chosen > 0 ? alternatives[chosen - 1] : undefined;
    if (pick?.productId) {
      using = {
        productId: pick.productId,
        name: pick.name,
        translations: pick.translations,
        icon: pick.icon,
      };
      enough = pick.enough;
      missing = pick.missing;
      reservedFor = null;
    }
    const expiresSoon = Boolean(info?.nextExpiry && info.nextExpiry <= soon && total > 0);
    const translations = lineTranslations(row.name, info?.product, row.variant);
    lines.push({
      id: row.id,
      productId: row.product_id,
      lotId: row.lot_id ?? null,
      partId: row.part_id ?? null,
      variant: row.variant ?? '',
      alternatives,
      mainEnough,
      mainMissing,
      choice,
      chosen,
      using,
      spoilsBefore: Boolean(planned?.spoils && !using),
      name: row.name,
      translations,
      icon: info ? kindIcon(info.product, row.variant) : 'basket',
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
      warnings: warningsFor(options.restrictions ?? [], info?.product),
    });
    if (expiresSoon) availability.useSoon += 1;
    for (const warning of warningsFor(options.restrictions ?? [], info?.product))
      availability.warnings.push({
        ...warning,
        item: row.name,
        translations: onlyFields(translations, ['name'], { name: 'item' }),
      });
    if (!counted || row.optional) continue;
    availability.total += 1;
    if (enough) availability.have += 1;
    else if (pick?.productId)
      availability.missing.push({
        productId: pick.productId,
        name: pick.name,
        translations: onlyFields(pick.translations, ['name']),
        missing,
        unit: pick.baseUnit ?? info!.product.unit,
      });
    else
      availability.missing.push({
        productId: row.product_id!,
        name: row.name,
        translations: onlyFields(translations, ['name']),
        missing,
        unit: info!.product.unit,
      });
  }
  availability.ready = availability.have === availability.total;
  return { lines, availability };
}

/**
 * Turns input lines into rows: each name finds (or creates) its product unless `link` is false, and
 * an amount must be in a unit the product can be counted in.
 */
export async function resolveIngredients(
  ctx: FoodCtx,
  inputs: Array<IngredientInput | MealIngredientInput>,
): Promise<Array<Omit<IngredientRow, 'id' | 'owner_id'>>> {
  const out: Array<Omit<IngredientRow, 'id' | 'owner_id'>> = [];
  for (const [index, input] of inputs.entries()) {
    let product: Product | null = null;
    let variant = input.variant ?? '';
    if (input.productId) product = await findProduct(ctx, input.productId);
    else if (input.link !== false) {
      // "Finlandia vodka" is Vodka, only Finlandia.
      const named = await resolveNamed(ctx, input.name, input.unit ?? undefined);
      product = named.product;
      variant ||= named.variant;
    }
    if (product && variant) product = await rememberVariant(ctx, product, variant);
    const unit = input.amount ? (input.unit ?? product?.unit ?? null) : null;
    // Only measured items need a unit they can be counted in ("2 tsp" of a spice kept by level is fine).
    if (product && product.trackMode === 'exact' && unit && !canConvert(unit, product)) {
      const message = `${product.name} is counted in ${product.unit}; ${unit} can’t be converted`;
      throw new AppError(400, 'VALIDATION', message, {
        fields: { [`ingredients.${index}.unit`]: message },
      });
    }
    let lotId: string | null = null;
    if ('lotId' in input && input.lotId) {
      const { rows } = await ctx.db.query<{ product_id: string }>(
        'SELECT product_id FROM stock_lots WHERE id = $1 AND household_id = $2',
        [input.lotId, ctx.actor.householdId],
      );
      if (!rows[0] || rows[0].product_id !== product?.id) {
        throw new AppError(400, 'VALIDATION', 'That piece is not this ingredient', {
          fields: { [`ingredients.${index}.lotId`]: 'Wrong piece' },
        });
      }
      lotId = input.lotId;
    }
    const partId = 'partId' in input ? (input.partId ?? null) : null;
    const alternatives: Alternative[] = [];
    for (const alt of input.or ?? []) {
      const named = alt.productId
        ? { product: await findProduct(ctx, alt.productId), variant: '' }
        : await resolveNamed(ctx, alt.name, alt.unit ?? undefined);
      const altUnit = alt.amount ? (alt.unit ?? named.product.unit) : null;
      alternatives.push({
        product_id: named.product.id,
        name: alt.name,
        amount: alt.amount ?? null,
        unit: altUnit,
        variant: alt.variant || named.variant,
      });
    }
    const choice =
      'choice' in input &&
      input.choice !== undefined &&
      input.choice !== null &&
      input.choice <= alternatives.length
        ? input.choice
        : null;
    out.push({
      product_id: product?.id ?? null,
      lot_id: lotId,
      part_id: partId,
      variant,
      alternatives,
      choice,
      name: input.name,
      amount: input.amount ?? null,
      unit,
      note: input.note ?? '',
      optional: input.optional ?? false,
      sort: index,
    });
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
  await appendIngredientRows(ctx, table, ownerId, rows);
}

/** Adds lines without touching the ones already there (a new part of a meal). */
export async function appendIngredientRows(
  ctx: FoodCtx,
  table: 'recipe_ingredients' | 'meal_ingredients',
  ownerId: string,
  rows: Array<Omit<IngredientRow, 'id' | 'owner_id'>>,
): Promise<void> {
  for (const row of rows) {
    if (table === 'recipe_ingredients') {
      await ctx.db.query(
        `INSERT INTO recipe_ingredients (id, recipe_id, product_id, name, amount, unit, note, optional, sort, variant, alternatives) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          randomUUID(),
          ownerId,
          row.product_id,
          row.name,
          row.amount,
          row.unit,
          row.note,
          row.optional,
          row.sort,
          row.variant ?? '',
          JSON.stringify(row.alternatives ?? []),
        ],
      );
    } else {
      await ctx.db.query(
        `INSERT INTO meal_ingredients (id, meal_id, product_id, lot_id, name, amount, unit, note, optional, sort, part_id, variant, alternatives, choice)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          randomUUID(),
          ownerId,
          row.product_id,
          row.lot_id ?? null,
          row.name,
          row.amount,
          row.unit,
          row.note,
          row.optional,
          row.sort,
          row.part_id ?? null,
          row.variant ?? '',
          JSON.stringify(row.alternatives ?? []),
          row.choice ?? null,
        ],
      );
    }
  }
}

export async function ingredientRows(
  ctx: FoodCtx,
  table: 'recipe_ingredients' | 'meal_ingredients',
  ownerIds: string[],
): Promise<Map<string, IngredientRow[]>> {
  const map = new Map<string, IngredientRow[]>();
  if (!ownerIds.length) return map;
  const owner = table === 'recipe_ingredients' ? 'recipe_id' : 'meal_id';
  const lot = table === 'meal_ingredients' ? ', lot_id, part_id, choice' : '';
  const { rows } = await ctx.db.query<IngredientRow>(
    `SELECT id, ${owner} AS owner_id, product_id${lot}, name, variant, alternatives, amount, unit, note, optional, sort FROM ${table} WHERE ${owner} = ANY($1::uuid[]) ORDER BY sort, id`,
    [ownerIds],
  );
  for (const row of rows) {
    const list = map.get(row.owner_id) ?? [];
    list.push(row);
    map.set(row.owner_id, list);
  }
  return map;
}
