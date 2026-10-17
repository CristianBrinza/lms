import { nutritionOf, type NutritionEntry } from './nutrition';
import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { LOCALES, mergeTranslations, type Translations } from '../../lib/i18n';
import { isUuid } from '../users';
import {
  combine,
  fieldIn,
  presetLocalNames,
  presetTranslations,
  variantForms,
  variantsTranslations,
} from './catalog-i18n';
import type { FoodCtx } from './kitchen';
import {
  findPreset,
  normalizeName,
  PRESETS,
  presetByKey,
  presetOrGuess,
  sameName,
  variantIconsFor,
  KIND_IN_NAME,
  areaOf,
  type Category,
  type FoodIcon,
  type Level,
  type Location,
  type TrackMode,
} from './presets';
import type { ProductInput } from './schemas';
import { canConvert, type BaseUnit, type CustomUnit, type Measured } from './units';

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
  /** Where it goes once opened (an opened can: the fridge); null: it stays where it is. */
  openedLocation: Location | null;
  /** exact: amounts and dates; level: full / low / out; none: always there (never counted or listed). */
  trackMode: TrackMode;
  /** For level items: how much is left, roughly. */
  level: Level;
  levelAt: string | null;
  /** False for staples that are always there; kept for older clients (trackMode none). */
  trackStock: boolean;
  /** Days it keeps frozen, and once thawed (null: the kind's default). */
  freezerDays: number | null;
  thawedDays: number | null;
  /** Its own units (a slice, a pack), sizes in the base unit. */
  units: CustomUnit[];
  /** Kinds of it (cheese: cheddar, parmesan); each piece in stock can say which. */
  variants: string[];
  /** A picture per kind, where the catalog has one (keys in lower case): Zero → a black can. */
  variantIcons: Record<string, string>;
  /** A brand whose kind is part of its name: Coca-Cola + Zero reads "Coca-Cola Zero". */
  kindInName: boolean;
  /** Food (the kitchen) or the house (bathroom, cleaning…), from its category. */
  area: 'food' | 'house';
  /** The household's own nutrition values (null: the catalog's typical ones count). */
  ownNutrition: NutritionEntry | null;
  /** The values that count, and whose they are. */
  nutrition: { entry: NutritionEntry; source: 'own' | 'catalog' } | null;
  minStock: number | null;
  storeId: string | null;
  note: string;
  archived: boolean;
  /**
   * Its name and note in other languages ({ ro: { name, note }, ru: …, en: … }): the catalog's for
   * a catalog item, else what the household wrote. `variants` (read only) are its kinds in that
   * language, in the same order as `variants`.
   */
  translations: Translations;
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
  opened_location: Location | null;
  track_stock: boolean;
  track_mode: TrackMode;
  level: Level;
  level_at: Date | null;
  freezer_days: number | null;
  thawed_days: number | null;
  units: CustomUnit[];
  variants: string[];
  min_stock: number | null;
  store_id: string | null;
  note: string;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
  nutrition: NutritionEntry | null;
  translations: Translations | null;
}

export const PRODUCT_COLUMNS =
  'id, name, icon, category, unit, piece_size, piece_unit, location, shelf_life_days, opened_days, opened_location, track_stock, track_mode, level, level_at, freezer_days, thawed_days, units, variants, min_stock, store_id, note, archived_at, created_at, updated_at, nutrition, translations';

/** What is stored: the fields people translate, not the kinds the catalog adds when read. */
export function storedTranslations(value: Translations | null | undefined): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value?.[locale];
    if (!entry) continue;
    const { variants: _variants, variant: _variant, ...rest } = entry;
    if (Object.keys(rest).length) out[locale] = rest;
  }
  return out;
}

/**
 * The catalog's names for a new item named like a catalog item ("Tomatoes", or "Roșii"): all three
 * languages, with the name as written kept in its own language. Aliases don't count ("fish" isn't
 * "Fish fillet"), so nothing is renamed by a loose match.
 */
export function catalogSeed(name: string): Translations {
  const preset = findPreset(name);
  if (!preset) return {};
  const catalog = presetTranslations(preset.name);
  if (!catalog.en) return {};
  const [ro, ru] = presetLocalNames(preset.name);
  const own = name.trim();
  if (sameName(preset.name, name)) return combine(catalog, { en: { name: own } });
  if (ro && sameName(ro, name)) return combine(catalog, { ro: { name: own } });
  if (ru && sameName(ru, name)) return combine(catalog, { ru: { name: own } });
  return {};
}

/** Translations without one field in every language (a renamed item's old `name`). */
export function withoutField(value: Translations, field: string): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value[locale];
    if (!entry) continue;
    const { [field]: _dropped, ...rest } = entry;
    if (Object.keys(rest).length) out[locale] = rest;
  }
  return out;
}

/** Every name an item goes by: its own, and its name in each language. */
export function namesOf(product: { name: string; translations?: Translations | null }): string[] {
  const names = [product.name];
  for (const locale of LOCALES) {
    const name = fieldIn(product.translations, 'name', locale);
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

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
    openedLocation: row.opened_location,
    trackMode: row.track_mode,
    level: row.level,
    levelAt: row.level_at?.toISOString() ?? null,
    trackStock: row.track_mode !== 'none',
    freezerDays: row.freezer_days,
    thawedDays: row.thawed_days,
    units: row.units ?? [],
    variants: row.variants ?? [],
    variantIcons: variantIconsFor(row.name),
    kindInName: KIND_IN_NAME.has(row.name),
    area: areaOf(row.category),
    ownNutrition: row.nutrition ?? null,
    nutrition: nutritionOf({ name: row.name, ownNutrition: row.nutrition ?? null }),
    minStock: row.min_stock,
    storeId: row.store_id,
    note: row.note,
    archived: row.archived_at !== null,
    translations: combine(
      storedTranslations(row.translations),
      variantsTranslations(row.name, row.variants ?? []),
    ),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Several of the household's items at once (missing ids are left out). */
export async function productsByIds(ctx: FoodCtx, ids: string[]): Promise<Product[]> {
  if (!ids.length) return [];
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE household_id = $1 AND id = ANY($2::uuid[])`,
    [ctx.actor.householdId, ids],
  );
  return rows.map(toProduct);
}

export async function findProduct(
  ctx: FoodCtx,
  id: string,
  options: { lock?: boolean } = {},
): Promise<Product> {
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
  // Any of its names counts: "roș" and "помид" find Tomatoes.
  return products
    .map((product) => ({ product, names: namesOf(product).map(normalizeName) }))
    .filter(
      ({ names, product }) =>
        names.some((name) => name.includes(query)) ||
        namesOf(product).some((name) => sameName(name, q)),
    )
    .sort(
      (a, b) =>
        Number(!a.names.some((name) => name.startsWith(query))) -
        Number(!b.names.some((name) => name.startsWith(query))),
    )
    .map(({ product }) => product);
}

async function ensureStore(ctx: FoodCtx, storeId: string | null | undefined): Promise<void> {
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

function checkPiece(input: {
  unit?: BaseUnit;
  pieceSize?: number | null;
  pieceUnit?: 'g' | 'ml' | null;
}) {
  if (input.unit && input.unit !== 'pcs' && input.pieceUnit && input.pieceUnit !== input.unit) {
    throw new AppError(400, 'VALIDATION', 'A piece of this item is measured in its own unit', {
      fields: { pieceUnit: `Use ${input.unit}` },
    });
  }
}

/** The product with a name like this one (tomato ↔ Tomatoes), including an archived one. */
async function findByName(ctx: FoodCtx, name: string): Promise<ProductRow | null> {
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE household_id = $1`,
    [ctx.actor.householdId],
  );
  return (
    rows.find((row) => normalizeName(row.name) === normalizeName(name)) ??
    rows.find((row) => sameName(row.name, name)) ??
    // Its name in another language: "Humus de casă" is the household's "Homemade hummus".
    rows.find((row) => namesOf(row).some((other) => sameName(other, name))) ??
    null
  );
}

/** A unit hint ("kg") tells a new product how it is counted when nothing else does. */
function baseFor(unit: string | undefined): BaseUnit {
  if (unit === 'g' || unit === 'kg') return 'g';
  if (unit === 'ml' || unit === 'l' || unit === 'tsp' || unit === 'tbsp' || unit === 'cup')
    return 'ml';
  return 'pcs';
}

/** The tracking mode a product input asks for (trackStock: false is the older way to say none). */
function modeOf(input: Pick<ProductInput, 'trackMode' | 'trackStock'>): TrackMode | undefined {
  // trackStock is the older field: only `false` (always there) says anything about the mode.
  return input.trackMode ?? (input.trackStock === false ? 'none' : undefined);
}

async function insertProduct(
  ctx: FoodCtx,
  input: ProductInput & { unit: BaseUnit },
): Promise<Product> {
  const preset = presetOrGuess(input.name);
  const mode = modeOf(input) ?? preset?.track ?? 'exact';
  const { rows } = await ctx.db.query<ProductRow>(
    `INSERT INTO products (id, household_id, name, icon, category, unit, piece_size, piece_unit, location, shelf_life_days, min_stock, store_id, note, created_by, created_at, updated_at,
                           opened_days, track_stock, track_mode, level, freezer_days, thawed_days, units, variants, opened_location, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
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
      mode !== 'none',
      mode,
      // A level item nobody has said anything about yet is assumed there (a recipe's salt).
      input.level ?? 'full',
      input.freezerDays ?? preset?.freezerDays ?? null,
      input.thawedDays ?? preset?.thawedDays ?? null,
      JSON.stringify(
        input.units ?? (preset && preset.unit === input.unit ? (preset.units ?? []) : []),
      ),
      input.variants ?? preset?.variants ?? [],
      input.openedLocation === undefined ? (preset?.openedLocation ?? null) : input.openedLocation,
      // A catalog item arrives with its names in all three languages.
      JSON.stringify(
        storedTranslations(mergeTranslations(catalogSeed(input.name), input.translations)),
      ),
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
    throw new AppError(409, 'EXISTS', `${existing.name} is already in your kitchen`, {
      fields: { name: 'You already have this item' },
    });
  }
  if (existing) {
    await ctx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [
      existing.id,
      ctx.now,
    ]);
    return updateProduct(ctx, existing.id, input);
  }
  const preset = presetOrGuess(input.name);
  return insertProduct(ctx, { ...input, unit: input.unit ?? preset?.unit ?? 'pcs' });
}

/**
 * The product a name refers to: an existing one (brought back if archived), else a new one from the
 * built-in catalog, else a plain new item counted the way `unitHint` suggests. Used wherever people
 * or the assistant type a name: adding stock, shopping lines, recipe ingredients.
 */
export async function resolveProduct(
  ctx: FoodCtx,
  name: string,
  unitHint?: string,
  options: { level?: Level; area?: 'food' | 'house' } = {},
): Promise<Product> {
  return (await resolveNamed(ctx, name, unitHint, options)).product;
}

/**
 * Like resolveProduct, and also the type a name says: "apple juice" is Juice, Apple; "Coca-Cola
 * Zero" is Coca-Cola, Zero; "Borjomi" is Mineral water, Borjomi. Only items that come in types
 * are split this way, so "cherry tomatoes" or "olive oil" stay items of their own.
 */
export async function resolveNamed(
  ctx: FoodCtx,
  name: string,
  unitHint?: string,
  options: { level?: Level; area?: 'food' | 'house' } = {},
): Promise<{ product: Product; variant: string }> {
  const direct = findPreset(name) ?? (await findByName(ctx, name));
  if (!direct) {
    const split = await splitVariant(ctx, name);
    if (split) {
      const product = await resolveExact(ctx, split.item, unitHint, options);
      return {
        product,
        variant:
          variantNamed(product, split.variant) ?? variantNamed(product, name) ?? split.variant,
      };
    }
  }
  const product = await resolveExact(ctx, name, unitHint, options);
  return { product, variant: variantNamed(product, name) ?? '' };
}

/** A type of an item named in any language ("de mere" or "яблочный" is Juice's "Apple"). */
function typeNamed(item: string, variants: readonly string[], word: string): string | undefined {
  const wanted = normalizeName(word);
  return variants.find((v) => variantForms(item, v).some((form) => normalizeName(form) === wanted));
}

/** The item's own type a word names ("mango peach" is its "Mango-peach"), if it has one. */
function variantNamed(product: Product, word: string): string | null {
  return typeNamed(product.name, product.variants, word) ?? null;
}

/** "mango peach juice" → Juice + "Mango peach", when Juice is an item that comes in types. */
export async function splitVariant(
  ctx: FoodCtx,
  name: string,
): Promise<{ item: string; variant: string } | null> {
  const words = normalizeName(name).split(' ');
  const { rows } = await ctx.db.query<{
    name: string;
    variants: string[];
    translations: Translations | null;
  }>(
    `SELECT name, variants, translations FROM products WHERE household_id = $1 AND cardinality(variants) > 0`,
    [ctx.actor.householdId],
  );
  const typed = [
    ...rows.map((row) => ({ item: row.name, forms: namesOf(row), variants: row.variants })),
    ...PRESETS.filter((preset) => preset.variants?.length).map((preset) => ({
      item: preset.name,
      forms: [preset.name, ...(preset.aliases ?? []), ...presetLocalNames(preset.name)],
      variants: preset.variants!,
    })),
  ];
  // A type on its own ("Absolut", "Cheddar") finds its item, when only one item has it. Only as
  // written in the catalog: "ananas" alone is a pineapple, not Topic's Pineapple.
  const owners = new Set(
    typed
      .filter((t) => t.variants.some((v) => normalizeName(v) === words.join(' ')))
      .map((t) => normalizeName(t.item)),
  );
  if (owners.size === 1) {
    const owner = typed.find((t) => owners.has(normalizeName(t.item)))!;
    return {
      item: owner.item,
      variant: owner.variants.find((v) => normalizeName(v) === words.join(' '))!,
    };
  }
  if (words.length < 2) return null;
  // The longest name wins; between equals, the name at the end ("apple juice" is juice, not apples).
  let best: { item: string; variant: string; score: number } | null = null;
  for (const { item, forms, variants } of typed) {
    for (const form of forms) {
      const size = normalizeName(form).split(' ').length;
      if (size >= words.length) continue;
      // The item's name at the end ("apple juice") or the start ("coca cola zero").
      const cuts = [
        { head: words.slice(words.length - size), rest: words.slice(0, words.length - size) },
        { head: words.slice(0, size), rest: words.slice(size) },
      ];
      cuts.forEach(({ head, rest }, index) => {
        if (rest.length > 3 || !sameName(head.join(' '), form)) return;
        // Through a loose alias ("oil"), only a type the item knows: "pumpkin seed oil" is its own item.
        if (form !== item && !typeNamed(item, variants, rest.join(' '))) return;
        const score = size * 2 + (index === 0 ? 1 : 0);
        if (best && score <= best.score) return;
        const variant = rest.join(' ');
        best = { item, variant: variant.charAt(0).toUpperCase() + variant.slice(1), score };
      });
    }
  }
  const found = best as { item: string; variant: string } | null;
  return found && { item: found.item, variant: found.variant };
}

/** Remembers a type the first time it is used, so it is offered from then on. */
export async function rememberVariant(
  ctx: FoodCtx,
  product: Product,
  variant: string | undefined,
): Promise<Product> {
  const name = variant?.trim().slice(0, 40);
  if (!name || variantNamed(product, name)) return product;
  await ctx.db.query(
    'UPDATE products SET variants = array_append(variants, $2), updated_at = $3 WHERE id = $1',
    [product.id, name, ctx.now],
  );
  return { ...product, variants: [...product.variants, name] };
}

/**
 * Brings the catalog's newer knowledge to items already in the kitchen: its package units (when the
 * item has none and counts the same way), its types (added to the item's own), how long it keeps
 * and where it goes once opened. Never changes how an item is counted. Returns how many items changed.
 */
/** Icons a catalog item may still carry from before it had its own. */
const OUTGROWN_ICONS = new Set(['basket', 'soda-can', 'roll', 'detergent']);

export async function refreshFromCatalog(ctx: FoodCtx): Promise<number> {
  const { rows } = await ctx.db.query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS} FROM products WHERE household_id = $1`,
    [ctx.actor.householdId],
  );
  let changed = 0;
  for (const row of rows) {
    const product = toProduct(row);
    const preset = findPreset(product.name);
    if (!preset) continue;
    const sameCount =
      preset.unit === product.unit && (preset.pieceSize ?? null) === (product.pieceSize ?? null);
    const units = !product.units.length && sameCount && preset.units?.length ? preset.units : null;
    const known = new Set(product.variants.map((v) => normalizeName(v)));
    const variants = (preset.variants ?? []).filter((v) => !known.has(normalizeName(v)));
    const openedLocation =
      !product.openedLocation && preset.openedLocation ? preset.openedLocation : null;
    const openedDays = product.openedDays === null && preset.openedDays ? preset.openedDays : null;
    // A picture the catalog has since replaced (the generic can on Sprite) or the fallback basket.
    const icon =
      preset.icon !== product.icon && OUTGROWN_ICONS.has(product.icon) ? preset.icon : null;
    // House things once all under "household" move to their own kind (bathroom, cleaning…) and place.
    const category =
      product.category === 'household' && preset.category !== 'household' ? preset.category : null;
    const location = category && product.location === 'other' ? preset.location : null;
    // Its names in Romanian and Russian, for a catalog item (by its key, the catalog's own name)
    // that has none yet; what the household wrote stays.
    const stored = storedTranslations(row.translations);
    const named = presetByKey(row.name) && !stored.ro?.name && !stored.ru?.name;
    const translations = named ? mergeTranslations(presetTranslations(row.name), stored) : null;
    if (
      !units &&
      !variants.length &&
      !openedLocation &&
      !openedDays &&
      !icon &&
      !category &&
      !translations
    )
      continue;
    await ctx.db.query(
      `UPDATE products SET units = coalesce($2::jsonb, units), variants = variants || $3::text[], opened_location = coalesce($4, opened_location),
              opened_days = coalesce($6, opened_days), icon = coalesce($7, icon), category = coalesce($8, category),
              location = coalesce($9, location), translations = coalesce($10::jsonb, translations), updated_at = $5 WHERE id = $1`,
      [
        product.id,
        units ? JSON.stringify(units) : null,
        variants,
        openedLocation,
        ctx.now,
        openedDays,
        icon,
        category,
        location,
        translations ? JSON.stringify(translations) : null,
      ],
    );
    changed += 1;
  }
  return changed;
}

async function resolveExact(
  ctx: FoodCtx,
  name: string,
  unitHint?: string,
  options: { level?: Level; area?: 'food' | 'house' } = {},
): Promise<Product> {
  const preset = findPreset(name);
  // "roșii" and "steak" find the Tomatoes and Beef steak already in the kitchen.
  const existing =
    (await findByName(ctx, name)) ?? (preset ? await findByName(ctx, preset.name) : null);
  if (existing) {
    if (existing.archived_at)
      await ctx.db.query('UPDATE products SET archived_at = NULL, updated_at = $2 WHERE id = $1', [
        existing.id,
        ctx.now,
      ]);
    return toProduct({ ...existing, archived_at: null });
  }
  const known = preset ?? presetOrGuess(name);
  const measured: Measured | null = known
    ? {
        unit: known.unit,
        pieceSize: known.pieceSize ?? null,
        pieceUnit: known.pieceUnit ?? null,
        units: known.units,
      }
    : null;
  const unit =
    known && measured && (!unitHint || canConvert(unitHint, measured))
      ? known.unit
      : baseFor(unitHint);
  const tidy = name.trim().replace(/\s+/g, ' ');
  // A catalog item keeps the catalog's name ("roșii" becomes Tomatoes); anything else keeps what was typed.
  return insertProduct(ctx, {
    name:
      preset && unit === preset.unit ? preset.name : tidy.charAt(0).toUpperCase() + tidy.slice(1),
    unit,
    level: options.level,
    // Added from the House: something the catalog doesn't know is a house thing, not food.
    ...(options.area === 'house' && !preset && areaOf(known?.category ?? 'other') === 'food'
      ? { category: 'household' as const, location: 'storage' as const }
      : {}),
  });
}

export async function updateProduct(
  ctx: FoodCtx,
  id: string,
  patch: Partial<ProductInput>,
): Promise<Product> {
  const product = await findProduct(ctx, id, { lock: true });
  checkPiece({
    unit: patch.unit ?? product.unit,
    pieceSize: patch.pieceSize,
    pieceUnit: patch.pieceUnit,
  });
  await ensureStore(ctx, patch.storeId);
  const nextMode = modeOf(patch);
  if (nextMode === 'level' && product.trackMode !== 'level') {
    // To level: what was weighed becomes simply "full" (or "out" if there was none).
    const { rows: lots } = await ctx.db.query<{ id: string; quantity: number }>(
      'SELECT id, quantity FROM stock_lots WHERE product_id = $1 AND finished_at IS NULL',
      [id],
    );
    for (const lot of lots) {
      await ctx.db.query(
        `INSERT INTO stock_events (household_id, product_id, lot_id, kind, delta, actor_id, via, note, created_at) VALUES ($1, $2, $3, 'adjusted', $4, $5, $6, 'Now kept by level', $7)`,
        [
          ctx.actor.householdId,
          id,
          lot.id,
          -lot.quantity,
          ctx.actor.userId,
          ctx.actor.via,
          ctx.now,
        ],
      );
    }
    await ctx.db.query(
      'UPDATE stock_lots SET quantity = 0, finished_at = $2 WHERE product_id = $1 AND finished_at IS NULL',
      [id, ctx.now],
    );
    if (patch.level === undefined)
      patch = { ...patch, level: lots.some((lot) => lot.quantity > 0) ? 'full' : 'out' };
  }
  if (patch.unit && patch.unit !== product.unit) {
    const { rowCount } = await ctx.db.query(
      'SELECT 1 FROM stock_lots WHERE product_id = $1 AND finished_at IS NULL LIMIT 1',
      [id],
    );
    if (rowCount)
      throw new AppError(
        409,
        'HAS_STOCK',
        'Use up or remove its stock before changing how it is counted',
        { fields: { unit: 'It still has stock' } },
      );
  }
  const renamed = Boolean(
    patch.name && normalizeName(patch.name) !== normalizeName(product.name),
  );
  if (renamed) {
    const clash = await findByName(ctx, patch.name!);
    if (clash && clash.id !== id && normalizeName(clash.name) === normalizeName(patch.name!)) {
      throw new AppError(409, 'EXISTS', `${clash.name} is already in your kitchen`, {
        fields: { name: 'Another item has this name' },
      });
    }
  }
  // Renamed: the old name's translations no longer fit (a catalog name brings its own).
  const before = storedTranslations(product.translations);
  const base = renamed
    ? mergeTranslations(withoutField(before, 'name'), catalogSeed(patch.name!))
    : before;
  const translations =
    renamed || patch.translations !== undefined
      ? JSON.stringify(storedTranslations(mergeTranslations(base, patch.translations)))
      : undefined;
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
    opened_location: patch.openedLocation,
    track_stock: modeOf(patch) === undefined ? undefined : modeOf(patch) !== 'none',
    track_mode: modeOf(patch),
    level: patch.level,
    level_at: patch.level === undefined ? undefined : ctx.now,
    freezer_days: patch.freezerDays,
    thawed_days: patch.thawedDays,
    units: patch.units === undefined ? undefined : JSON.stringify(patch.units),
    variants: patch.variants,
    min_stock: patch.minStock,
    store_id: patch.storeId,
    note: patch.note,
    translations,
    // null clears the household's own values: the catalog's count again.
    nutrition:
      patch.nutrition === undefined
        ? undefined
        : patch.nutrition === null
          ? 'null'
          : JSON.stringify(patch.nutrition),
  };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(
      column === 'nutrition' || column === 'translations'
        ? `${column} = $${values.length}::jsonb`
        : `${column} = $${values.length}`,
    );
  }
  values.push(ctx.now);
  sets.push(`updated_at = $${values.length}`);
  const { rows } = await ctx.db.query<ProductRow>(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $1 RETURNING ${PRODUCT_COLUMNS}`,
    values,
  );
  return toProduct(rows[0]!);
}

/** Hides a product from the catalog and clears its remaining stock (history stays). */
export async function archiveProduct(ctx: FoodCtx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    await findProduct(tx, id, { lock: true });
    const { rows } = await tx.db.query<{ id: string; quantity: number }>(
      'SELECT id, quantity FROM stock_lots WHERE product_id = $1 AND finished_at IS NULL',
      [id],
    );
    for (const lot of rows) {
      await tx.db.query(
        `INSERT INTO stock_events (household_id, product_id, lot_id, kind, delta, actor_id, via, note, created_at) VALUES ($1, $2, $3, 'adjusted', $4, $5, $6, 'Item removed', $7)`,
        [tx.actor.householdId, id, lot.id, -lot.quantity, tx.actor.userId, tx.actor.via, tx.now],
      );
    }
    await tx.db.query(
      'UPDATE stock_lots SET quantity = 0, finished_at = $2 WHERE product_id = $1 AND finished_at IS NULL',
      [id, tx.now],
    );
    await tx.db.query('UPDATE products SET archived_at = $2, updated_at = $2 WHERE id = $1', [
      id,
      tx.now,
    ]);
  });
}
