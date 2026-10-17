import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { avatarUrl, isUuid } from '../users';
import type { Category, DrinkInput, DrinkPatch, ListQuery, StockInput } from './schemas';

/**
 * Drinks: the household's cellar and tasting journal. A drink is one specific version (a wine's
 * vintage, Jack Daniel's Tennessee Honey); versions of a family share a line. Bottles at home are
 * counted here; tastings (tastings.ts) and photos (photos.ts) hang off the drink.
 */

interface DrinkRow {
  id: string;
  created_by: string | null;
  category: Category;
  name: string;
  producer: string;
  line: string;
  variant: string;
  vintage: number | null;
  produced_on: string | null;
  age_years: number | null;
  abv: string | null;
  volume_ml: number | null;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  color: string;
  style: string;
  cask: string;
  label_text: string;
  tags: string[];
  notes: string;
  price: string | null;
  currency: string;
  bought_at: string;
  stock: number;
  location: string;
  opened: boolean;
  bought_on: string | null;
  wanted: boolean;
  created_at: Date;
  updated_at: Date;
  avg_rating: number | null;
  ratings: number;
  tastings: number;
  last_tasted: string | null;
  my_rating: number | null;
  cover_id: string | null;
  photos: number;
}

/** A drink with what its tastings add up to and its cover photo, for the household. */
const SELECT = `SELECT d.id, d.created_by, d.category, d.name, d.producer, d.line, d.variant, d.vintage,
    d.produced_on::text, d.age_years, d.abv::text, d.volume_ml, d.country, d.region, d.appellation,
    d.grapes, d.color, d.style, d.cask, d.label_text, d.tags, d.notes, d.price::text, d.currency,
    d.bought_at, d.stock, d.location, d.opened, d.bought_on::text, d.wanted, d.created_at, d.updated_at,
    t.avg_rating, coalesce(t.ratings, 0) AS ratings, coalesce(t.tastings, 0) AS tastings,
    t.last_tasted, mine.rating AS my_rating, cover.id AS cover_id, coalesce(pc.photos, 0) AS photos
  FROM drinks d
  LEFT JOIN LATERAL (
    SELECT avg(rating)::float AS avg_rating, count(rating)::int AS ratings, count(*)::int AS tastings,
      max(tasted_on)::text AS last_tasted
    FROM drink_tastings WHERE drink_id = d.id
  ) t ON true
  LEFT JOIN LATERAL (
    SELECT rating FROM drink_tastings
    WHERE drink_id = d.id AND user_id = $2 AND rating IS NOT NULL
    ORDER BY tasted_on DESC, created_at DESC LIMIT 1
  ) mine ON true
  LEFT JOIN LATERAL (
    SELECT id FROM drink_photos WHERE drink_id = d.id
    ORDER BY (tasting_id IS NOT NULL), position, created_at LIMIT 1
  ) cover ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS photos FROM drink_photos WHERE drink_id = d.id
  ) pc ON true`;

export const photoUrl = (id: string, size: 'full' | 'thumb') => `/api/drinks/photos/${id}/${size}`;

const num = (value: string | null) => (value === null ? null : Number(value));

const toDrink = (row: DrinkRow) => ({
  id: row.id,
  category: row.category,
  name: row.name,
  producer: row.producer,
  line: row.line,
  variant: row.variant,
  vintage: row.vintage,
  producedOn: row.produced_on,
  ageYears: row.age_years,
  abv: num(row.abv),
  volumeMl: row.volume_ml,
  country: row.country,
  region: row.region,
  appellation: row.appellation,
  grapes: row.grapes,
  color: row.color,
  style: row.style,
  cask: row.cask,
  labelText: row.label_text,
  tags: row.tags,
  notes: row.notes,
  price: num(row.price),
  currency: row.currency,
  boughtAt: row.bought_at,
  stock: row.stock,
  location: row.location,
  opened: row.opened,
  boughtOn: row.bought_on,
  wanted: row.wanted,
  rating: row.avg_rating === null ? null : Math.round(row.avg_rating * 10) / 10,
  ratings: row.ratings,
  tastings: row.tastings,
  lastTasted: row.last_tasted,
  myRating: row.my_rating,
  cover: row.cover_id
    ? { id: row.cover_id, thumb: photoUrl(row.cover_id, 'thumb'), full: photoUrl(row.cover_id, 'full') }
    : null,
  photos: row.photos,
  createdBy: row.created_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Drink = ReturnType<typeof toDrink>;

/** The household's people, for "who was there" and whose tasting. */
export async function householdPeople(ctx: FoodCtx) {
  const { rows } = await ctx.db.query<{
    id: string;
    name: string;
    surname: string;
    avatar_at: Date | null;
  }>(
    `SELECT id, name, surname, avatar_at FROM users
      WHERE household_id = $1 AND is_active ORDER BY (id = $2) DESC, name`,
    [ctx.actor.householdId, ctx.actor.userId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    surname: row.surname,
    avatarUrl: avatarUrl(row.id, row.avatar_at),
  }));
}
export type DrinkPerson = Awaited<ReturnType<typeof householdPeople>>[number];

const SORTS: Record<NonNullable<ListQuery['sort']>, string> = {
  recent: 'greatest(d.updated_at, coalesce(t.last_tasted::timestamptz, d.created_at)) DESC',
  rating: 't.avg_rating DESC NULLS LAST, t.tastings DESC NULLS LAST, d.name',
  name: 'lower(d.name), d.vintage NULLS LAST',
  vintage: 'd.vintage DESC NULLS LAST, lower(d.name)',
};

/** Everything in the household, or what a search and filters leave. */
export async function listDrinks(ctx: FoodCtx, query: ListQuery = {}) {
  const { householdId, userId } = ctx.actor;
  const values: unknown[] = [householdId, userId];
  const where = ['d.household_id = $1'];
  const add = (sql: (n: string) => string, value: unknown) => {
    values.push(value);
    where.push(sql(`$${values.length}`));
  };
  if (query.q) {
    // Every word has to appear somewhere: name, producer, line, region, grapes, tags, notes.
    for (const word of query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6))
      add(
        (n) =>
          `lower(concat_ws(' ', d.name, d.producer, d.line, d.variant, d.region, d.appellation, d.style,
            d.cask, d.country, d.vintage::text, array_to_string(d.grapes, ' '), array_to_string(d.tags, ' '),
            d.notes)) LIKE '%' || ${n} || '%'`,
        word.replace(/[%_\\]/g, (c) => `\\${c}`),
      );
  }
  if (query.category) add((n) => `d.category = ${n}`, query.category);
  if (query.country) add((n) => `d.country = ${n}`, query.country);
  if (query.tag) add((n) => `${n} = ANY (d.tags)`, query.tag);
  if (query.minRating) add((n) => `t.avg_rating >= ${n}`, query.minRating);
  if (query.shelf === 'cellar') where.push('d.stock > 0');
  if (query.shelf === 'tried') where.push('coalesce(t.tastings, 0) > 0');
  if (query.shelf === 'wanted') where.push('d.wanted');
  const { rows } = await ctx.db.query<DrinkRow>(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY ${SORTS[query.sort ?? 'recent']}`,
    values,
  );
  return rows.map(toDrink);
}

/** The list screen: every drink, the people, and the tags and countries in use. */
export async function drinksOverview(ctx: FoodCtx) {
  const drinks = await listDrinks(ctx);
  return {
    drinks,
    people: await householdPeople(ctx),
    tags: [...new Set(drinks.flatMap((d) => d.tags))].sort((a, b) => a.localeCompare(b)),
    countries: [...new Set(drinks.map((d) => d.country).filter(Boolean))].sort(),
    currency: ctx.actor.currency,
  };
}

export async function findDrink(ctx: FoodCtx, id: string): Promise<Drink> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That drink isn’t in your cellar');
  const { rows } = await ctx.db.query<DrinkRow>(`${SELECT} WHERE d.id = $3 AND d.household_id = $1`, [
    ctx.actor.householdId,
    ctx.actor.userId,
    id,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That drink isn’t in your cellar');
  return toDrink(rows[0]);
}

/** Field name → column, for inserts and updates alike. */
const COLUMNS = {
  category: 'category',
  name: 'name',
  producer: 'producer',
  line: 'line',
  variant: 'variant',
  vintage: 'vintage',
  producedOn: 'produced_on',
  ageYears: 'age_years',
  abv: 'abv',
  volumeMl: 'volume_ml',
  country: 'country',
  region: 'region',
  appellation: 'appellation',
  grapes: 'grapes',
  color: 'color',
  style: 'style',
  cask: 'cask',
  labelText: 'label_text',
  tags: 'tags',
  notes: 'notes',
  price: 'price',
  currency: 'currency',
  boughtAt: 'bought_at',
  stock: 'stock',
  location: 'location',
  opened: 'opened',
  boughtOn: 'bought_on',
  wanted: 'wanted',
} as const;
type Field = keyof typeof COLUMNS;

/** What a new version takes from the one it starts from: the family's facts, not this bottle's. */
const INHERITED: Field[] = [
  'category',
  'producer',
  'line',
  'country',
  'region',
  'appellation',
  'grapes',
  'color',
  'style',
  'cask',
  'abv',
  'volumeMl',
  'tags',
];

async function recordPrice(
  ctx: FoodCtx,
  drinkId: string,
  price: number,
  currency: string,
  boughtAt: string,
  boughtOn: string | null,
) {
  await ctx.db.query(
    `INSERT INTO drink_prices (id, drink_id, price, currency, bought_at, bought_on, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [randomUUID(), drinkId, price, currency, boughtAt, boughtOn, ctx.now],
  );
}

export async function addDrink(ctx: FoodCtx, input: DrinkInput) {
  const { fromId, ...given } = input;
  const fields: Partial<Record<Field, unknown>> = {};
  if (fromId) {
    const from = await findDrink(ctx, fromId);
    for (const key of INHERITED) fields[key] = from[key];
  }
  for (const [key, value] of Object.entries(given))
    if (value !== undefined) fields[key as Field] = value;
  fields.currency ??= ctx.actor.currency;
  const id = randomUUID();
  const columns = Object.keys(fields) as Field[];
  const values = columns.map((key) => fields[key]);
  await ctx.tx(async (tx) => {
    await tx.db.query(
      `INSERT INTO drinks (id, household_id, created_by, created_at, updated_at, ${columns
        .map((key) => COLUMNS[key])
        .join(', ')})
       VALUES ($1, $2, $3, $4, $4, ${columns.map((_, i) => `$${i + 5}`).join(', ')})`,
      [id, tx.actor.householdId, tx.actor.userId, tx.now, ...values],
    );
    if (typeof fields.price === 'number')
      await recordPrice(
        tx,
        id,
        fields.price,
        String(fields.currency),
        String(fields.boughtAt ?? ''),
        (fields.boughtOn as string | null | undefined) ?? null,
      );
  });
  return { drink: await findDrink(ctx, id) };
}

export async function updateDrink(ctx: FoodCtx, id: string, patch: DrinkPatch) {
  const before = await findDrink(ctx, id);
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${COLUMNS[key as Field]} = $${values.length}`);
  }
  values.push(ctx.now);
  sets.push(`updated_at = $${values.length}`);
  values.push(id);
  await ctx.tx(async (tx) => {
    await tx.db.query(`UPDATE drinks SET ${sets.join(', ')} WHERE id = $${values.length}`, values);
    // A new price is one more line in its price history.
    if (typeof patch.price === 'number' && (patch.price !== before.price || patch.currency))
      await recordPrice(
        tx,
        id,
        patch.price,
        patch.currency ?? before.currency,
        patch.boughtAt ?? before.boughtAt,
        patch.boughtOn ?? before.boughtOn,
      );
  });
  return { drink: await findDrink(ctx, id) };
}

export async function removeDrink(ctx: FoodCtx, id: string) {
  await findDrink(ctx, id);
  await ctx.db.query('DELETE FROM drinks WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

/** Bottles at home: a count or a change (+1 bought, −1 finished), where, open, wanted. */
export async function setStock(ctx: FoodCtx, id: string, input: StockInput) {
  const before = await findDrink(ctx, id);
  const stock =
    input.stock !== undefined
      ? input.stock
      : input.delta !== undefined
        ? Math.max(0, before.stock + input.delta)
        : before.stock;
  const patch: DrinkPatch = { stock };
  if (input.location !== undefined) patch.location = input.location;
  // The last bottle gone: nothing is open any more.
  if (input.opened !== undefined) patch.opened = input.opened;
  else if (stock === 0) patch.opened = false;
  if (input.wanted !== undefined) patch.wanted = input.wanted;
  // Bought more: the day it came home (today unless told), and it's no longer only wanted.
  const added = stock > before.stock;
  if (input.boughtOn !== undefined) patch.boughtOn = input.boughtOn;
  else if (added) patch.boughtOn = localDate(ctx.now);
  if (added && input.wanted === undefined) patch.wanted = false;
  if (input.price !== undefined) patch.price = input.price;
  if (input.boughtAt !== undefined) patch.boughtAt = input.boughtAt;
  return updateDrink(ctx, id, patch);
}

/** Other versions of the same family (same line, any case), newest vintage first. */
export async function familyOf(ctx: FoodCtx, drink: Drink) {
  if (!drink.line.trim()) return [];
  const { rows } = await ctx.db.query<DrinkRow>(
    `${SELECT} WHERE d.household_id = $1 AND lower(d.line) = lower($3) AND d.id <> $4
      ORDER BY d.vintage DESC NULLS LAST, lower(d.name)`,
    [ctx.actor.householdId, ctx.actor.userId, drink.line.trim(), drink.id],
  );
  return rows.map(toDrink);
}

export async function priceHistory(ctx: FoodCtx, drinkId: string) {
  const { rows } = await ctx.db.query<{
    id: string;
    price: string;
    currency: string;
    bought_at: string;
    bought_on: string | null;
    created_at: Date;
  }>(
    `SELECT id, price::text, currency, bought_at, bought_on::text, created_at FROM drink_prices
      WHERE drink_id = $1 ORDER BY coalesce(bought_on, created_at::date), created_at`,
    [drinkId],
  );
  return rows.map((row) => ({
    id: row.id,
    price: Number(row.price),
    currency: row.currency,
    boughtAt: row.bought_at,
    boughtOn: row.bought_on ?? row.created_at.toISOString().slice(0, 10),
  }));
}
