import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { householdPeople } from '../drinks/drinks';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { listPlaces, placeTree, findPlace, storageFor } from './places';
import { CATEGORIES, type Care, type Category, type ItemInput, type ItemPatch, type ListQuery, type Status } from './schemas';

/**
 * The closet's pieces. Each belongs to one person of the household; everyone at home can see
 * (and help keep) each other's closets. Photos (photos.ts), days worn (wears.ts) and looks hang
 * off a piece; a deleted piece leaves its looks and days as they were.
 */

export const photoUrl = (id: string, size: 'full' | 'thumb') => `/api/closet/photos/${id}/${size}`;

interface ItemRow {
  id: string;
  owner_id: string;
  owner_name: string;
  created_by: string | null;
  name: string;
  category: Category | '';
  subcategory: string;
  colors: string[];
  materials: { material: string; percent?: number | null }[];
  size: string;
  size_system: string;
  brand: string;
  price: string | null;
  currency: string;
  bought_on: string | null;
  store: string;
  seasons: string[];
  occasions: string[];
  fit: string;
  condition: string;
  issues: string[];
  condition_notes: string;
  tags: string[];
  notes: string;
  url: string;
  status: Status;
  lent_to: string;
  favorite: boolean;
  place_id: string | null;
  storage: string;
  care: Care | null;
  storage_advice: string;
  made_in: string;
  label_text: string;
  created_at: Date;
  updated_at: Date;
  cover_id: string | null;
  cover_alpha: boolean | null;
  photos: number;
  cutouts: number;
  has_label: boolean;
  wears: number;
  last_worn: string | null;
  vector_requested_at: Date | null;
  tryon_status: string;
}

/** A piece with its cover, photo counts and how often it was worn. */
const SELECT = `SELECT i.id, i.owner_id, u.name AS owner_name, i.created_by, i.name, i.category,
    i.subcategory, i.colors, i.materials, i.size, i.size_system, i.brand, i.price::text, i.currency,
    i.bought_on::text, i.store, i.seasons, i.occasions, i.fit, i.condition, i.issues,
    i.condition_notes, i.tags, i.notes, i.url, i.status, i.lent_to, i.favorite, i.place_id,
    i.storage, i.care, i.storage_advice, i.made_in, i.label_text, i.vector_requested_at, i.tryon_status, i.created_at, i.updated_at,
    cover.id AS cover_id, cover.has_alpha AS cover_alpha, coalesce(pc.photos, 0) AS photos,
    coalesce(pc.cutouts, 0) AS cutouts, coalesce(pc.label, false) AS has_label,
    coalesce(w.wears, 0) AS wears, w.last_worn
  FROM closet_items i
  JOIN users u ON u.id = i.owner_id
  LEFT JOIN LATERAL (
    SELECT id, has_alpha FROM closet_photos WHERE item_id = i.id AND NOT superseded AND kind <> 'tryon'
    ORDER BY (kind = 'label'), position, created_at LIMIT 1
  ) cover ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS photos, count(*) FILTER (WHERE needs_cutout)::int AS cutouts,
      bool_or(kind = 'label') AS label
    FROM closet_photos WHERE item_id = i.id AND NOT superseded AND kind <> 'tryon'
  ) pc ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS wears, max(worn_on)::text AS last_worn FROM closet_wears
    WHERE household_id = i.household_id AND item_ids @> ARRAY[i.id] AND NOT planned
  ) w ON true`;

const num = (value: string | null) => (value === null ? null : Number(value));

export const toItem = (row: ItemRow) => {
  const price = num(row.price);
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    colors: row.colors,
    materials: row.materials.map((m) => ({ material: m.material, percent: m.percent ?? null })),
    size: row.size,
    sizeSystem: row.size_system,
    brand: row.brand,
    price,
    currency: row.currency,
    boughtOn: row.bought_on,
    store: row.store,
    seasons: row.seasons,
    occasions: row.occasions,
    fit: row.fit,
    condition: row.condition,
    issues: row.issues,
    conditionNotes: row.condition_notes,
    tags: row.tags,
    notes: row.notes,
    url: row.url,
    status: row.status,
    lentTo: row.lent_to,
    favorite: row.favorite,
    placeId: row.place_id,
    storage: row.storage,
    care: row.care,
    storageAdvice: row.storage_advice,
    madeIn: row.made_in,
    labelText: row.label_text,
    cover: row.cover_id
      ? {
          id: row.cover_id,
          thumb: photoUrl(row.cover_id, 'thumb'),
          full: photoUrl(row.cover_id, 'full'),
          hasAlpha: Boolean(row.cover_alpha),
        }
      : null,
    photos: row.photos,
    needsCutout: row.cutouts > 0,
    hasLabel: row.has_label,
    vectorRequested: row.vector_requested_at !== null,
    tryonStatus: row.tryon_status,
    wears: row.wears,
    lastWorn: row.last_worn,
    costPerWear: price !== null && row.wears > 0 ? Math.round((price / row.wears) * 100) / 100 : null,
    needsDetails: !row.category || !row.name.trim() || row.colors.length === 0,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
};
export type Item = ReturnType<typeof toItem>;

/**
 * Whose closet: "me" (or nothing) is the caller, "all" the whole household, else a person of the
 * household by id.
 */
export async function resolveOwner(ctx: FoodCtx, owner?: string | null): Promise<string | 'all'> {
  if (!owner || owner === 'me') return ctx.actor.userId;
  if (owner === 'all') return 'all';
  await checkPerson(ctx, owner);
  return owner;
}

/** A person of this household (active), or 400. */
export async function checkPerson(ctx: FoodCtx, id: string): Promise<void> {
  if (id === ctx.actor.userId) return;
  if (!isUuid(id)) throw new AppError(400, 'VALIDATION', 'Not in your household');
  const { rows } = await ctx.db.query(
    'SELECT 1 FROM users WHERE id = $1 AND household_id = $2 AND is_active',
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(400, 'VALIDATION', 'Not in your household');
}

const escapeLike = (word: string) => word.replace(/[%_\\]/g, (c) => `\\${c}`);

/** A person's pieces (or the household's), or what a search and filters leave. */
export async function listItems(ctx: FoodCtx, query: ListQuery = {}): Promise<Item[]> {
  const owner = await resolveOwner(ctx, query.owner);
  const values: unknown[] = [ctx.actor.householdId];
  const where = ['i.household_id = $1'];
  const add = (sql: (n: string) => string, value: unknown) => {
    values.push(value);
    where.push(sql(`$${values.length}`));
  };
  if (owner !== 'all') add((n) => `i.owner_id = ${n}`, owner);
  if (query.q)
    for (const word of query.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6))
      add(
        (n) =>
          `lower(concat_ws(' ', i.name, i.brand, i.category, replace(i.subcategory, '_', ' '),
            array_to_string(i.colors, ' '), array_to_string(i.tags, ' '), i.size, i.store, i.notes,
            i.lent_to)) LIKE '%' || ${n} || '%'`,
        escapeLike(word),
      );
  if (query.category) add((n) => `i.category = ${n}`, query.category);
  if (query.status) add((n) => `i.status = ${n}`, query.status);
  if (query.color) add((n) => `${n} = ANY (i.colors)`, query.color);
  if (query.season) add((n) => `(${n} = ANY (i.seasons) OR 'all_year' = ANY (i.seasons))`, query.season);
  if (query.placeId)
    add(
      (n) => `i.place_id IN (
        WITH RECURSIVE under AS (
          SELECT id FROM closet_places WHERE id = ${n} AND household_id = $1
          UNION ALL SELECT p.id FROM closet_places p JOIN under ON p.parent_id = under.id
        ) SELECT id FROM under)`,
      query.placeId,
    );
  if (query.needsDetails !== undefined)
    where.push(
      `${query.needsDetails ? '' : 'NOT '}(i.category = '' OR btrim(i.name) = '' OR cardinality(i.colors) = 0)`,
    );
  if (query.cursor) {
    const [at, id] = query.cursor.split('|');
    if (!at || !id || !isUuid(id) || Number.isNaN(Date.parse(at)))
      throw new AppError(400, 'VALIDATION', 'Some fields need attention', { fields: { cursor: 'Not a page' } });
    values.push(at, id);
    where.push(`(i.created_at, i.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  if (query.limit) values.push(query.limit);
  const { rows } = await ctx.db.query<ItemRow>(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC, i.id DESC${
      query.limit ? ` LIMIT $${values.length}` : ''
    }`,
    values,
  );
  return rows.map(toItem);
}

/** A page of pieces, and where the next one starts (null at the end). */
export async function pageItems(ctx: FoodCtx, query: ListQuery) {
  const limit = query.limit ?? 120;
  const items = await listItems(ctx, { ...query, limit });
  const last = items.at(-1);
  return { items, next: items.length === limit && last ? `${last.createdAt}|${last.id}` : null };
}

export async function findItem(ctx: FoodCtx, id: string): Promise<Item> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
  const { rows } = await ctx.db.query<ItemRow>(
    `${SELECT} WHERE i.id = $1 AND i.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
  return toItem(rows[0]);
}

/** Pieces by id for this household (looks, days and trips name them); missing ones left out. */
export async function itemsById(ctx: FoodCtx, ids: string[]): Promise<Map<string, Item>> {
  const unique = [...new Set(ids.filter(isUuid))];
  if (!unique.length) return new Map();
  const { rows } = await ctx.db.query<ItemRow>(
    `${SELECT} WHERE i.household_id = $1 AND i.id = ANY ($2::uuid[])`,
    [ctx.actor.householdId, unique],
  );
  return new Map(rows.map((row) => [row.id, toItem(row)]));
}

/** The closet screen: a person's pieces (or everyone's), the people, the places. */
export async function closetOverview(ctx: FoodCtx, owner?: string) {
  const items = await listItems(ctx, { owner });
  const places = await listPlaces(ctx);
  return {
    owner: await resolveOwner(ctx, owner),
    items,
    people: await householdPeople(ctx),
    places,
    tags: [...new Set(items.flatMap((i) => i.tags))].sort((a, b) => a.localeCompare(b)),
    brands: [...new Set(items.map((i) => i.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    currency: ctx.actor.currency,
  };
}

/** Field name → column, for inserts and updates alike. */
const COLUMNS = {
  name: 'name',
  category: 'category',
  subcategory: 'subcategory',
  colors: 'colors',
  materials: 'materials',
  size: 'size',
  sizeSystem: 'size_system',
  brand: 'brand',
  price: 'price',
  currency: 'currency',
  boughtOn: 'bought_on',
  store: 'store',
  seasons: 'seasons',
  occasions: 'occasions',
  fit: 'fit',
  condition: 'condition',
  issues: 'issues',
  conditionNotes: 'condition_notes',
  tags: 'tags',
  notes: 'notes',
  url: 'url',
  status: 'status',
  lentTo: 'lent_to',
  favorite: 'favorite',
  placeId: 'place_id',
  storage: 'storage',
  care: 'care',
  storageAdvice: 'storage_advice',
  madeIn: 'made_in',
  labelText: 'label_text',
  ownerId: 'owner_id',
} as const;
type Field = keyof typeof COLUMNS;
const JSON_FIELDS = new Set<Field>(['materials', 'care']);

/** A value as the column takes it: JSON columns as JSON text. */
const columnValue = (key: Field, value: unknown) =>
  JSON_FIELDS.has(key) && value !== null ? JSON.stringify(value) : value;

/** The materials' percentages can't add up to more than 100. */
function checkMaterials(materials: ItemInput['materials']) {
  if (!materials) return;
  const total = materials.reduce((sum, m) => sum + (m.percent ?? 0), 0);
  if (total > 100)
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { materials: 'The materials add up to more than 100%' },
    });
}

/** The subcategory has to be one of its category's. */
function checkKind(category: string | undefined, subcategory: string | undefined) {
  if (!subcategory) return;
  const list = category ? (CATEGORIES as Record<string, readonly string[]>)[category] : undefined;
  if (category && list && !list.includes(subcategory))
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { subcategory: 'Pick a kind from the list' },
    });
}

export async function addItem(ctx: FoodCtx, input: ItemInput) {
  const fields: Partial<Record<Field, unknown>> = {};
  for (const [key, value] of Object.entries(input))
    if (value !== undefined) fields[key as Field] = value;
  fields.ownerId ??= ctx.actor.userId;
  await checkPerson(ctx, String(fields.ownerId));
  fields.currency ??= ctx.actor.currency;
  checkMaterials(input.materials);
  checkKind(input.category, input.subcategory);
  if (input.placeId) {
    const place = await findPlace(ctx, input.placeId);
    if (input.storage === undefined) fields.storage = storageFor(place.kind);
  }
  if (input.status === 'lent' && input.storage === undefined) fields.storage = 'lent';
  const id = randomUUID();
  const columns = Object.keys(fields) as Field[];
  await ctx.db.query(
    `INSERT INTO closet_items (id, household_id, created_by, created_at, updated_at, ${columns
      .map((key) => COLUMNS[key])
      .join(', ')})
     VALUES ($1, $2, $3, $4, $4, ${columns.map((_, i) => `$${i + 5}`).join(', ')})`,
    [
      id,
      ctx.actor.householdId,
      ctx.actor.userId,
      ctx.now,
      ...columns.map((key) => columnValue(key, fields[key])),
    ],
  );
  return { item: await findItem(ctx, id) };
}

export async function updateItem(ctx: FoodCtx, id: string, patch: ItemPatch) {
  const before = await findItem(ctx, id);
  const fields: Partial<Record<Field, unknown>> = {};
  for (const [key, value] of Object.entries(patch))
    if (value !== undefined) fields[key as Field] = value;
  if (patch.ownerId) await checkPerson(ctx, patch.ownerId);
  checkMaterials(patch.materials);
  checkKind(patch.category ?? before.category, patch.subcategory);
  // A new category drops a subcategory that isn't one of its own.
  if (patch.category !== undefined && patch.subcategory === undefined && before.subcategory) {
    const list = (CATEGORIES as Record<string, readonly string[]>)[patch.category] ?? [];
    if (!list.includes(before.subcategory)) fields.subcategory = '';
  }
  if (patch.placeId && patch.placeId !== before.placeId) {
    const place = await findPlace(ctx, patch.placeId);
    if (patch.storage === undefined) fields.storage = storageFor(place.kind);
  }
  // Back from being lent: nobody has it any more.
  if (patch.status && patch.status !== 'lent' && before.status === 'lent' && patch.lentTo === undefined)
    fields.lentTo = '';
  const columns = Object.keys(fields) as Field[];
  if (!columns.length) return { item: before };
  const values = columns.map((key) => columnValue(key, fields[key]));
  values.push(ctx.now, id);
  await ctx.db.query(
    `UPDATE closet_items SET ${columns.map((key, i) => `${COLUMNS[key]} = $${i + 1}`).join(', ')},
       updated_at = $${columns.length + 1}
     WHERE id = $${columns.length + 2}`,
    values,
  );
  return { item: await findItem(ctx, id) };
}

export async function removeItem(ctx: FoodCtx, id: string) {
  await findItem(ctx, id);
  // Looks and days keep the piece's id: they show a placeholder with its name.
  await ctx.db.query('DELETE FROM closet_items WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

/** Many pieces at once: moved, washed, put away, lent. */
export async function bulkUpdate(
  ctx: FoodCtx,
  ids: string[],
  patch: Pick<ItemPatch, 'status' | 'placeId' | 'storage' | 'seasons' | 'favorite' | 'lentTo' | 'category'>,
) {
  const found = await itemsById(ctx, ids);
  if (found.size !== new Set(ids).size)
    throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
  await ctx.tx(async (tx) => {
    for (const id of found.keys()) await updateItem(tx, id, patch);
  });
  return { items: [...(await itemsById(ctx, ids)).values()] };
}

/** Washed: back to clean, out of the laundry basket and back to its place. */
export async function markWashed(ctx: FoodCtx, input: { ids?: string[]; all?: boolean; owner?: string }) {
  let ids = input.ids ?? [];
  if (input.all) {
    const owner = await resolveOwner(ctx, input.owner);
    ids = (await listItems(ctx, { owner, status: 'to_wash' })).map((i) => i.id);
  }
  const found = await itemsById(ctx, ids);
  const places = placeTree(await listPlaces(ctx));
  await ctx.tx(async (tx) => {
    for (const item of found.values()) {
      if (item.status !== 'to_wash' && item.status !== 'at_cleaners') continue;
      const place = item.placeId ? places.get(item.placeId) : undefined;
      await updateItem(tx, item.id, {
        status: 'clean',
        ...(item.storage === 'laundry' || item.storage === 'worn'
          ? { storage: place ? storageFor(place.kind) : '' }
          : {}),
      });
    }
  });
  return { items: [...(await itemsById(ctx, [...found.keys()])).values()] };
}

/** Asks Claude for a vector drawing of the piece (or takes the request back). */
export async function setVectorRequest(ctx: FoodCtx, id: string, requested: boolean) {
  await findItem(ctx, id);
  await ctx.db.query(
    'UPDATE closet_items SET vector_requested_at = $2 WHERE id = $1 AND household_id = $3',
    [id, requested ? ctx.now : null, ctx.actor.householdId],
  );
  return { item: await findItem(ctx, id) };
}
