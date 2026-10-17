import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import {
  cleanTranslations,
  mergeTranslations,
  translated,
  type Locale,
  type Translations,
} from '../../lib/i18n';
import type { FoodCtx } from '../food/kitchen';
import { addShoppingItems } from '../food/shopping';
import {
  GROUPS,
  itemApplies,
  itemQuantity,
  PRESET_ITEMS,
  presetTranslations,
  TRAVEL_CATALOG_VERSION,
  type BagKind,
  type GearKind,
  type Kind,
  type Quantity,
  type Rules,
  type Scope,
  type Transport,
  type TripShape,
} from './catalog';
import type { BagInput, GearInput, ItemInput, Money, TripInput, TripPatch } from './schemas';

/**
 * Travel, for the whole household: the bags it owns, its packing list (each item with the rules
 * for when it belongs on a trip) and its trips. A trip's checklist is its own copy of the items
 * that fit it (where, how, how long, how many), kept in step whenever the trip or the list
 * changes; what was ticked stays ticked. Things added to one trip only stay with that trip.
 */

type Ctx = FoodCtx;

/**
 * A record's stored translations merged with an update (per language, per field), as JSON for
 * the query; null when no update was given, so the stored ones stay.
 */
async function nextTranslations(
  ctx: Ctx,
  table: 'travel_bags' | 'travel_gear' | 'travel_items' | 'trips',
  id: string,
  update: Translations | undefined,
): Promise<string | null> {
  if (!update) return null;
  const { rows } = await ctx.db.query<{ translations: Translations }>(
    `SELECT translations FROM ${table} WHERE id = $1 AND household_id = $2`,
    [id, ctx.actor.householdId],
  );
  return JSON.stringify(mergeTranslations(rows[0]?.translations, update));
}

// ---------------------------------------------------------------- bags

export interface Bag {
  id: string;
  name: string;
  kind: BagKind;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  /** Litres, from the measurements. */
  litres: number | null;
  note: string;
  /** The name and note in other languages. */
  translations: Translations;
}

interface BagRow {
  id: string;
  name: string;
  kind: BagKind;
  length_cm: string | null;
  width_cm: string | null;
  height_cm: string | null;
  note: string;
  translations: Translations;
}

const num = (v: string | null) => (v === null ? null : Number(v));

function toBag(row: BagRow): Bag {
  const [l, w, h] = [num(row.length_cm), num(row.width_cm), num(row.height_cm)];
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    lengthCm: l,
    widthCm: w,
    heightCm: h,
    litres: l && w && h ? Math.round((l * w * h) / 1000) : null,
    note: row.note,
    translations: row.translations ?? {},
  };
}

export async function listBags(ctx: Ctx): Promise<Bag[]> {
  const { rows } = await ctx.db.query<BagRow>(
    'SELECT * FROM travel_bags WHERE household_id = $1 ORDER BY created_at',
    [ctx.actor.householdId],
  );
  return rows.map(toBag);
}

export async function addBag(ctx: Ctx, input: BagInput): Promise<Bag> {
  const { rows } = await ctx.db.query<BagRow>(
    `INSERT INTO travel_bags (id, household_id, name, kind, length_cm, width_cm, height_cm, note, created_at, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      randomUUID(),
      ctx.actor.householdId,
      input.name,
      input.kind,
      input.lengthCm ?? null,
      input.widthCm ?? null,
      input.heightCm ?? null,
      input.note ?? '',
      ctx.now,
      JSON.stringify(cleanTranslations(input.translations)),
    ],
  );
  return toBag(rows[0]!);
}

export async function updateBag(ctx: Ctx, id: string, patch: Partial<BagInput>): Promise<Bag> {
  const { rows } = await ctx.db.query<BagRow>(
    `UPDATE travel_bags SET
       name = coalesce($3, name), kind = coalesce($4, kind),
       length_cm = CASE WHEN $5::boolean THEN $6 ELSE length_cm END,
       width_cm = CASE WHEN $7::boolean THEN $8 ELSE width_cm END,
       height_cm = CASE WHEN $9::boolean THEN $10 ELSE height_cm END,
       note = coalesce($11, note), translations = coalesce($12::jsonb, translations)
     WHERE id = $1 AND household_id = $2 RETURNING *`,
    [
      id,
      ctx.actor.householdId,
      patch.name ?? null,
      patch.kind ?? null,
      patch.lengthCm !== undefined,
      patch.lengthCm ?? null,
      patch.widthCm !== undefined,
      patch.widthCm ?? null,
      patch.heightCm !== undefined,
      patch.heightCm ?? null,
      patch.note ?? null,
      await nextTranslations(ctx, 'travel_bags', id, patch.translations),
    ],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No such bag');
  return toBag(rows[0]);
}

export async function removeBag(ctx: Ctx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const { rowCount } = await tx.db.query(
      'DELETE FROM travel_bags WHERE id = $1 AND household_id = $2',
      [id, tx.actor.householdId],
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'No such bag');
    await tx.db.query(
      'UPDATE trips SET bag_ids = array_remove(bag_ids, $1) WHERE household_id = $2',
      [id, tx.actor.householdId],
    );
  });
}

// ---------------------------------------------------------------- gear

export interface Gear {
  id: string;
  name: string;
  kind: GearKind;
  connectors: string[];
  count: number;
  note: string;
  /** The name and note in other languages. */
  translations: Translations;
}

const GEAR_COLUMNS = 'id, name, kind, connectors, count, note, translations';

export async function listGear(ctx: Ctx): Promise<Gear[]> {
  const { rows } = await ctx.db.query<Gear>(
    `SELECT ${GEAR_COLUMNS} FROM travel_gear WHERE household_id = $1 ORDER BY kind, created_at`,
    [ctx.actor.householdId],
  );
  return rows;
}

export async function addGear(ctx: Ctx, input: GearInput): Promise<Gear> {
  const { rows } = await ctx.db.query<Gear>(
    `INSERT INTO travel_gear (id, household_id, name, kind, connectors, count, note, created_at, translations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${GEAR_COLUMNS}`,
    [
      randomUUID(),
      ctx.actor.householdId,
      input.name,
      input.kind,
      input.connectors ?? [],
      input.count ?? 1,
      input.note ?? '',
      ctx.now,
      JSON.stringify(cleanTranslations(input.translations)),
    ],
  );
  return rows[0]!;
}

export async function updateGear(ctx: Ctx, id: string, patch: Partial<GearInput>): Promise<Gear> {
  const { rows } = await ctx.db.query<Gear>(
    `UPDATE travel_gear SET name = coalesce($3, name), kind = coalesce($4, kind),
       connectors = coalesce($5, connectors), count = coalesce($6, count), note = coalesce($7, note),
       translations = coalesce($8::jsonb, translations)
     WHERE id = $1 AND household_id = $2 RETURNING ${GEAR_COLUMNS}`,
    [
      id,
      ctx.actor.householdId,
      patch.name ?? null,
      patch.kind ?? null,
      patch.connectors ?? null,
      patch.count ?? null,
      patch.note ?? null,
      await nextTranslations(ctx, 'travel_gear', id, patch.translations),
    ],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No such gear');
  return rows[0];
}

export async function removeGear(ctx: Ctx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const { rowCount } = await tx.db.query(
      'DELETE FROM travel_gear WHERE id = $1 AND household_id = $2',
      [id, tx.actor.householdId],
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'No such gear');
    await tx.db.query(
      `UPDATE trips SET gear = (SELECT coalesce(jsonb_agg(g), '[]'::jsonb) FROM jsonb_array_elements(gear) g WHERE g->>'gearId' <> $1)
       WHERE household_id = $2 AND gear @> jsonb_build_array(jsonb_build_object('gearId', $1::text))`,
      [id, tx.actor.householdId],
    );
  });
}

// ---------------------------------------------------------------- the packing list

export interface PackingItem {
  id: string;
  name: string;
  group: string;
  quantity: Quantity;
  rules: Rules;
  /** Done by so many hours before leaving; null: whenever. */
  dueHours: number | null;
  /** From the starting list (its key), or the household's own. */
  preset: string | null;
  /** The name in other languages. */
  translations: Translations;
}

interface ItemRow {
  id: string;
  name: string;
  grp: string;
  quantity: Quantity;
  rules: Rules;
  preset: string | null;
  sort: number;
  due_hours: number | null;
  translations: Translations;
}

const toItem = (row: ItemRow): PackingItem => ({
  id: row.id,
  name: row.name,
  group: row.grp,
  quantity: row.quantity,
  rules: row.rules,
  dueHours: row.due_hours,
  preset: row.preset,
  translations: row.translations ?? {},
});

const groupIndex = (group: string) => {
  const at = (GROUPS as readonly string[]).indexOf(group);
  return at < 0 ? GROUPS.length : at;
};

/** The starting list, once per household (and its later additions, once each). */
export async function syncTravelCatalog(ctx: Ctx): Promise<void> {
  const { rows } = await ctx.db.query<{ v: number }>(
    'SELECT travel_catalog_version AS v FROM households WHERE id = $1',
    [ctx.actor.householdId],
  );
  if ((rows[0]?.v ?? 0) >= TRAVEL_CATALOG_VERSION) return;
  await ctx.tx(async (tx) => {
    const locked = await tx.db.query<{ v: number }>(
      'SELECT travel_catalog_version AS v FROM households WHERE id = $1 FOR UPDATE',
      [tx.actor.householdId],
    );
    if ((locked.rows[0]?.v ?? 0) >= TRAVEL_CATALOG_VERSION) return;
    for (const [sort, item] of PRESET_ITEMS.entries()) {
      await tx.db.query(
        // The list's words fill in only while the name is still the list's, and the household's
        // own translations win (a renamed item keeps just what the household wrote).
        `INSERT INTO travel_items (id, household_id, preset, name, grp, quantity, rules, sort, created_at, due_hours, translations)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (household_id, preset) WHERE preset IS NOT NULL
         DO UPDATE SET due_hours = coalesce(travel_items.due_hours, EXCLUDED.due_hours),
           translations = CASE WHEN travel_items.name = EXCLUDED.name
             THEN EXCLUDED.translations || travel_items.translations
             ELSE travel_items.translations END`,
        [
          randomUUID(),
          tx.actor.householdId,
          item.key,
          item.name,
          item.group,
          item.quantity ?? 'one',
          JSON.stringify(item.rules ?? {}),
          sort,
          tx.now,
          item.dueHours ?? null,
          JSON.stringify(presetTranslations(item)),
        ],
      );
    }
    await tx.db.query('UPDATE households SET travel_catalog_version = $2 WHERE id = $1', [
      tx.actor.householdId,
      TRAVEL_CATALOG_VERSION,
    ]);
    // What the list learned (deadlines, new things) reaches the trips coming up.
    await syncUpcoming(tx);
  });
}

async function itemRows(ctx: Ctx): Promise<ItemRow[]> {
  const { rows } = await ctx.db.query<ItemRow>(
    'SELECT id, name, grp, quantity, rules, preset, sort, due_hours, translations FROM travel_items WHERE household_id = $1 AND archived_at IS NULL',
    [ctx.actor.householdId],
  );
  return rows.sort(
    (a, b) =>
      groupIndex(a.grp) - groupIndex(b.grp) || a.sort - b.sort || a.name.localeCompare(b.name),
  );
}

export async function listItems(ctx: Ctx): Promise<PackingItem[]> {
  await syncTravelCatalog(ctx);
  return (await itemRows(ctx)).map(toItem);
}

export async function addItem(ctx: Ctx, input: ItemInput): Promise<PackingItem> {
  await syncTravelCatalog(ctx);
  const item = await ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<ItemRow>(
      `INSERT INTO travel_items (id, household_id, name, grp, quantity, rules, sort, created_at, due_hours, translations)
       VALUES ($1, $2, $3, $4, $5, $6, 1000, $7, $8, $9) RETURNING id, name, grp, quantity, rules, preset, sort, due_hours, translations`,
      [
        randomUUID(),
        tx.actor.householdId,
        input.name,
        input.group,
        input.quantity ?? 'one',
        JSON.stringify(input.rules ?? {}),
        tx.now,
        input.dueHours ?? null,
        JSON.stringify(cleanTranslations(input.translations)),
      ],
    );
    await syncUpcoming(tx);
    return rows[0]!;
  });
  return toItem(item);
}

export async function updateItem(
  ctx: Ctx,
  id: string,
  patch: Partial<ItemInput>,
): Promise<PackingItem> {
  return ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<ItemRow>(
      `UPDATE travel_items SET name = coalesce($3, name), grp = coalesce($4, grp),
         quantity = coalesce($5, quantity), rules = coalesce($6::jsonb, rules),
         due_hours = CASE WHEN $7::boolean THEN $8::integer ELSE due_hours END,
         translations = coalesce($9::jsonb, translations)
       WHERE id = $1 AND household_id = $2 AND archived_at IS NULL
       RETURNING id, name, grp, quantity, rules, preset, sort, due_hours, translations`,
      [
        id,
        tx.actor.householdId,
        patch.name ?? null,
        patch.group ?? null,
        patch.quantity ?? null,
        patch.rules ? JSON.stringify(patch.rules) : null,
        patch.dueHours !== undefined,
        patch.dueHours ?? null,
        await nextTranslations(tx, 'travel_items', id, patch.translations),
      ],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No such item on the packing list');
    await syncUpcoming(tx);
    return toItem(rows[0]);
  });
}

/** Off the list for good (trips already over keep what they had). */
export async function removeItem(ctx: Ctx, id: string): Promise<void> {
  await ctx.tx(async (tx) => {
    const { rowCount } = await tx.db.query(
      'UPDATE travel_items SET archived_at = $3 WHERE id = $1 AND household_id = $2 AND archived_at IS NULL',
      [id, tx.actor.householdId, tx.now],
    );
    if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'No such item on the packing list');
    await syncUpcoming(tx);
  });
}

// ---------------------------------------------------------------- trips

export interface Trip {
  id: string;
  name: string;
  destination: string;
  scope: Scope;
  kind: Kind;
  transport: Transport;
  startDate: string;
  endDate: string;
  /** Leaving home, on startDate. */
  departTime: string | null;
  /** Arriving there (a night bus lands the next day). */
  arriveDate: string | null;
  arriveTime: string | null;
  /** Heading back. */
  backDate: string | null;
  backTime: string | null;
  /** Home again, on endDate. */
  returnTime: string | null;
  /** Cash and cards for the trip. */
  money: Money;
  /** Gear to take, and how many. */
  gear: Array<{ gearId: string; count: number }>;
  /** Days, the first and the last included. */
  days: number;
  people: string[];
  guests: number;
  /** Everyone going: the people plus the guests, at least one. */
  travellers: number;
  bagIds: string[];
  /** Packing-list item id → switched on or off for this trip, against its rules. */
  overrides: Record<string, boolean>;
  note: string;
  /** The name, destination and note in other languages. */
  translations: Translations;
  packed: { done: number; total: number };
}

export interface TripCheck {
  id: string;
  /** The packing-list item it came from; null when added to this trip only. */
  itemId: string | null;
  name: string;
  group: string;
  quantity: number;
  checked: boolean;
  /** Done by (local date and time, YYYY-MM-DDTHH:MM): so many hours before leaving. */
  dueAt: string | null;
  /** Not at home: to buy before the trip. */
  toBuy: boolean;
  /** Put on the shopping list (when). */
  listedAt: string | null;
  /** The packing-list item's name in other languages, while the check keeps that name. */
  translations: Translations;
}

interface TripRow {
  id: string;
  name: string;
  destination: string;
  scope: Scope;
  kind: Kind;
  transport: Transport;
  start_date: string;
  end_date: string;
  depart_time: string | null;
  arrive_date: string | null;
  arrive_time: string | null;
  back_date: string | null;
  back_time: string | null;
  return_time: string | null;
  money: Money;
  gear: Array<{ gearId: string; count: number }>;
  people: string[];
  guests: number;
  bag_ids: string[];
  overrides: Record<string, boolean>;
  note: string;
  translations: Translations;
  done?: number;
  total?: number;
}

const TRIP_SELECT = `SELECT t.id, t.name, t.destination, t.scope, t.kind, t.transport,
  t.start_date::text AS start_date, t.end_date::text AS end_date,
  to_char(t.depart_time, 'HH24:MI') AS depart_time, to_char(t.return_time, 'HH24:MI') AS return_time,
  t.arrive_date::text AS arrive_date, to_char(t.arrive_time, 'HH24:MI') AS arrive_time,
  t.back_date::text AS back_date, to_char(t.back_time, 'HH24:MI') AS back_time, t.money, t.gear,
  t.people, t.guests, t.bag_ids, t.overrides, t.note, t.translations,
  (SELECT count(*)::int FROM trip_checks c WHERE c.trip_id = t.id AND c.checked_at IS NOT NULL) AS done,
  (SELECT count(*)::int FROM trip_checks c WHERE c.trip_id = t.id) AS total
  FROM trips t`;

const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;

function shape(
  row: Pick<
    TripRow,
    'scope' | 'kind' | 'transport' | 'start_date' | 'end_date' | 'people' | 'guests'
  >,
): TripShape {
  return {
    scope: row.scope,
    kind: row.kind,
    transport: row.transport,
    days: daysBetween(row.start_date, row.end_date),
    people: Math.max(1, row.people.length + row.guests),
  };
}

function toTrip(row: TripRow): Trip {
  const s = shape(row);
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    scope: row.scope,
    kind: row.kind,
    transport: row.transport,
    startDate: row.start_date,
    endDate: row.end_date,
    departTime: row.depart_time,
    arriveDate: row.arrive_date,
    arriveTime: row.arrive_time,
    backDate: row.back_date,
    backTime: row.back_time,
    returnTime: row.return_time,
    money: row.money,
    gear: row.gear,
    days: s.days,
    people: row.people,
    guests: row.guests,
    travellers: s.people,
    bagIds: row.bag_ids,
    overrides: row.overrides,
    note: row.note,
    translations: row.translations ?? {},
    packed: { done: row.done ?? 0, total: row.total ?? 0 },
  };
}

/** Trips coming up first (soonest first), then the past ones (latest first). */
export async function listTrips(ctx: Ctx, today: string): Promise<Trip[]> {
  const { rows } = await ctx.db.query<TripRow>(
    `${TRIP_SELECT} WHERE t.household_id = $1
      ORDER BY (t.end_date < $2::date), CASE WHEN t.end_date >= $2::date THEN t.start_date END,
               t.start_date DESC`,
    [ctx.actor.householdId, today],
  );
  return rows.map(toTrip);
}

async function tripRow(ctx: Ctx, id: string, lock = false): Promise<TripRow> {
  const { rows } = await ctx.db.query<TripRow>(
    `${TRIP_SELECT} WHERE t.id = $1 AND t.household_id = $2${lock ? ' FOR UPDATE OF t' : ''}`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No such trip');
  return rows[0];
}

export async function getTrip(ctx: Ctx, id: string): Promise<{ trip: Trip; checks: TripCheck[] }> {
  const trip = toTrip(await tripRow(ctx, id));
  const { rows } = await ctx.db.query<{
    id: string;
    item_id: string | null;
    name: string;
    grp: string;
    quantity: number;
    checked_at: Date | null;
    sort: number | null;
    due_hours: number | null;
    to_buy: boolean;
    listed_at: Date | null;
    translations: Translations;
  }>(
    `SELECT c.id, c.item_id, c.name, c.grp, c.quantity, c.checked_at, i.sort, c.due_hours, c.to_buy, c.listed_at,
            ${CHECK_TRANSLATIONS} AS translations
       FROM trip_checks c LEFT JOIN travel_items i ON i.id = c.item_id
      WHERE c.trip_id = $1 ORDER BY c.created_at`,
    [id],
  );
  const checks = rows
    .sort(
      (a, b) =>
        groupIndex(a.grp) - groupIndex(b.grp) ||
        (a.sort ?? 1e6) - (b.sort ?? 1e6) ||
        a.name.localeCompare(b.name),
    )
    .map((r) => ({
      id: r.id,
      itemId: r.item_id,
      name: r.name,
      group: r.grp,
      quantity: r.quantity,
      checked: r.checked_at !== null,
      dueAt: r.due_hours === null ? null : dueAt(trip, r.due_hours),
      toBuy: r.to_buy,
      listedAt: r.listed_at?.toISOString() ?? null,
      translations: r.translations ?? {},
    }));
  return { trip, checks };
}

/** A check's words in other languages: its packing-list item's, unless renamed for this trip. */
const CHECK_TRANSLATIONS = `CASE WHEN i.name = c.name THEN i.translations ELSE '{}'::jsonb END`;

async function checkMembers(ctx: Ctx, people: string[] | undefined, bagIds: string[] | undefined) {
  if (people?.length) {
    const { rows } = await ctx.db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM users WHERE household_id = $1 AND id = ANY($2::uuid[])',
      [ctx.actor.householdId, people],
    );
    if (rows[0]!.n !== new Set(people).size)
      throw new AppError(400, 'VALIDATION', 'Someone there isn’t in this household', {
        fields: { people: 'Unknown person' },
      });
  }
  if (bagIds?.length) {
    const { rows } = await ctx.db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM travel_bags WHERE household_id = $1 AND id = ANY($2::uuid[])',
      [ctx.actor.householdId, bagIds],
    );
    if (rows[0]!.n !== new Set(bagIds).size)
      throw new AppError(400, 'VALIDATION', 'That bag isn’t yours', {
        fields: { bagIds: 'Unknown bag' },
      });
  }
}

/**
 * Brings a trip's checklist in step with its packing list: what fits the trip (or is switched on
 * for it) is there with today's quantity; what no longer fits goes. Ticks stay; things added to
 * this trip only are left alone.
 */
async function syncChecks(ctx: Ctx, trip: TripRow): Promise<void> {
  const s = shape(trip);
  const items = await itemRows(ctx);
  const wanted = items.filter((item) => trip.overrides[item.id] ?? itemApplies(item.rules, s));
  for (const item of wanted) {
    await ctx.db.query(
      `INSERT INTO trip_checks (id, trip_id, item_id, name, grp, quantity, created_at, due_hours)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (trip_id, item_id) WHERE item_id IS NOT NULL
       DO UPDATE SET name = EXCLUDED.name, grp = EXCLUDED.grp, quantity = EXCLUDED.quantity,
         due_hours = EXCLUDED.due_hours`,
      [
        randomUUID(),
        trip.id,
        item.id,
        item.name,
        item.grp,
        itemQuantity(item.quantity, s),
        ctx.now,
        item.due_hours,
      ],
    );
  }
  await ctx.db.query(
    'DELETE FROM trip_checks WHERE trip_id = $1 AND item_id IS NOT NULL AND NOT (item_id = ANY($2::uuid[]))',
    [trip.id, wanted.map((item) => item.id)],
  );
}

/** After the packing list changes: every trip not over yet follows. */
async function syncUpcoming(ctx: Ctx): Promise<void> {
  const today = ctx.now.toISOString().slice(0, 10);
  const { rows } = await ctx.db.query<TripRow>(
    `${TRIP_SELECT} WHERE t.household_id = $1 AND t.end_date >= $2::date - 1`,
    [ctx.actor.householdId, today],
  );
  for (const row of rows) await syncChecks(ctx, row);
}

export async function createTrip(
  ctx: Ctx,
  input: TripInput,
): Promise<{ trip: Trip; checks: TripCheck[] }> {
  await syncTravelCatalog(ctx);
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    await checkMembers(tx, input.people, input.bagIds);
    await tx.db.query(
      `INSERT INTO trips (id, household_id, name, destination, scope, kind, transport, start_date, end_date,
         depart_time, return_time, people, guests, bag_ids, overrides, note, created_by, created_at, updated_at,
         translations)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $18, $19)`,
      [
        id,
        tx.actor.householdId,
        input.name,
        input.destination ?? '',
        input.scope,
        input.kind,
        input.transport,
        input.startDate,
        input.endDate,
        input.departTime ?? null,
        input.returnTime ?? null,
        [...new Set(input.people ?? [tx.actor.userId])],
        input.guests ?? 0,
        [...new Set(input.bagIds ?? [])],
        JSON.stringify(input.overrides ?? {}),
        input.note ?? '',
        tx.actor.userId,
        tx.now,
        JSON.stringify(cleanTranslations(input.translations)),
      ],
    );
    await setLegs(tx, id, input);
    await syncChecks(tx, await tripRow(tx, id));
  });
  return getTrip(ctx, id);
}

export async function updateTrip(
  ctx: Ctx,
  id: string,
  patch: TripPatch,
): Promise<{ trip: Trip; checks: TripCheck[] }> {
  await ctx.tx(async (tx) => {
    const before = await tripRow(tx, id, true);
    const start = patch.startDate ?? before.start_date;
    const end = patch.endDate ?? before.end_date;
    if (end < start)
      throw new AppError(400, 'VALIDATION', 'The trip ends before it starts', {
        fields: { endDate: 'Before the start' },
      });
    await checkMembers(tx, patch.people, patch.bagIds);
    await tx.db.query(
      `UPDATE trips SET
         name = coalesce($3, name), destination = coalesce($4, destination), scope = coalesce($5, scope),
         kind = coalesce($6, kind), transport = coalesce($7, transport), start_date = $8, end_date = $9,
         depart_time = CASE WHEN $10::boolean THEN $11::time ELSE depart_time END,
         return_time = CASE WHEN $12::boolean THEN $13::time ELSE return_time END,
         people = coalesce($14, people), guests = coalesce($15, guests), bag_ids = coalesce($16, bag_ids),
         overrides = coalesce($17::jsonb, overrides), note = coalesce($18, note), updated_at = $19,
         translations = coalesce($20::jsonb, translations)
       WHERE id = $1 AND household_id = $2`,
      [
        id,
        tx.actor.householdId,
        patch.name ?? null,
        patch.destination ?? null,
        patch.scope ?? null,
        patch.kind ?? null,
        patch.transport ?? null,
        start,
        end,
        patch.departTime !== undefined,
        patch.departTime ?? null,
        patch.returnTime !== undefined,
        patch.returnTime ?? null,
        patch.people ? [...new Set(patch.people)] : null,
        patch.guests ?? null,
        patch.bagIds ? [...new Set(patch.bagIds)] : null,
        patch.overrides ? JSON.stringify(patch.overrides) : null,
        patch.note ?? null,
        tx.now,
        await nextTranslations(tx, 'trips', id, patch.translations),
      ],
    );
    await setLegs(tx, id, patch);
    await syncChecks(tx, await tripRow(tx, id));
  });
  return getTrip(ctx, id);
}

/** Arriving there and heading back: what was given (null clears it). */
async function setLegs(
  ctx: Ctx,
  id: string,
  legs: Pick<TripPatch, 'arriveDate' | 'arriveTime' | 'backDate' | 'backTime' | 'money' | 'gear'>,
): Promise<void> {
  const given = (v: unknown) => v !== undefined;
  if (
    ![legs.arriveDate, legs.arriveTime, legs.backDate, legs.backTime, legs.money, legs.gear].some(
      given,
    )
  )
    return;
  if (legs.gear?.length) {
    const ids = [...new Set(legs.gear.map((g) => g.gearId))];
    const { rows } = await ctx.db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM travel_gear WHERE household_id = $1 AND id = ANY($2::uuid[])',
      [ctx.actor.householdId, ids],
    );
    if (rows[0]!.n !== ids.length)
      throw new AppError(400, 'VALIDATION', 'That gear isn’t yours', {
        fields: { gear: 'Unknown gear' },
      });
  }
  await ctx.db.query(
    `UPDATE trips SET
       arrive_date = CASE WHEN $2::boolean THEN $3::date ELSE arrive_date END,
       arrive_time = CASE WHEN $4::boolean THEN $5::time ELSE arrive_time END,
       back_date = CASE WHEN $6::boolean THEN $7::date ELSE back_date END,
       back_time = CASE WHEN $8::boolean THEN $9::time ELSE back_time END,
       money = coalesce($10::jsonb, money),
       gear = coalesce($11::jsonb, gear)
     WHERE id = $1`,
    [
      id,
      given(legs.arriveDate),
      legs.arriveDate ?? null,
      given(legs.arriveTime),
      legs.arriveTime ?? null,
      given(legs.backDate),
      legs.backDate ?? null,
      given(legs.backTime),
      legs.backTime ?? null,
      legs.money ? JSON.stringify(legs.money) : null,
      legs.gear ? JSON.stringify(legs.gear) : null,
    ],
  );
}

export async function removeTrip(ctx: Ctx, id: string): Promise<void> {
  const { rowCount } = await ctx.db.query('DELETE FROM trips WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'No such trip');
}

/**
 * When something is due: so many hours before leaving (the departure time, or 08:00 when the trip
 * has none), as a local date and time.
 */
export function dueAt(trip: Pick<Trip, 'startDate' | 'departTime'>, hours: number): string {
  const leave = Date.parse(`${trip.startDate}T${trip.departTime ?? '08:00'}:00Z`);
  return new Date(leave - hours * 3_600_000).toISOString().slice(0, 16);
}

// ---------------------------------------------------------------- a trip's checklist

/** Something for this trip only (the list itself stays as it is). */
export async function addCheck(
  ctx: Ctx,
  tripId: string,
  input: { name: string; group?: string; quantity?: number },
): Promise<TripCheck> {
  await tripRow(ctx, tripId);
  const { rows } = await ctx.db.query<{ id: string }>(
    `INSERT INTO trip_checks (id, trip_id, name, grp, quantity, created_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [randomUUID(), tripId, input.name, input.group ?? 'For the trip', input.quantity ?? 1, ctx.now],
  );
  return (await getTrip(ctx, tripId)).checks.find((c) => c.id === rows[0]!.id)!;
}

export async function updateCheck(
  ctx: Ctx,
  tripId: string,
  checkId: string,
  patch: { checked?: boolean; name?: string; quantity?: number; toBuy?: boolean },
): Promise<TripCheck> {
  await tripRow(ctx, tripId);
  const { rowCount } = await ctx.db.query(
    `UPDATE trip_checks SET
       checked_at = CASE WHEN $3::boolean IS NULL THEN checked_at WHEN $3 THEN coalesce(checked_at, $6) ELSE NULL END,
       checked_by = CASE WHEN $3::boolean IS NULL THEN checked_by WHEN $3 THEN $7::uuid ELSE NULL END,
       name = coalesce($4, name), quantity = coalesce($5, quantity),
       to_buy = coalesce($8, to_buy),
       listed_at = CASE WHEN $8::boolean IS FALSE THEN NULL ELSE listed_at END
     WHERE id = $1 AND trip_id = $2`,
    [
      checkId,
      tripId,
      patch.checked ?? null,
      patch.name ?? null,
      patch.quantity ?? null,
      ctx.now,
      ctx.actor.userId,
      patch.toBuy ?? null,
    ],
  );
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'No such item on this trip');
  return (await getTrip(ctx, tripId)).checks.find((c) => c.id === checkId)!;
}

/** Off this trip's list. One from the packing list is switched off for this trip, so it stays off. */
export async function removeCheck(ctx: Ctx, tripId: string, checkId: string): Promise<void> {
  await ctx.tx(async (tx) => {
    await tripRow(tx, tripId, true);
    const { rows } = await tx.db.query<{ item_id: string | null }>(
      'DELETE FROM trip_checks WHERE id = $1 AND trip_id = $2 RETURNING item_id',
      [checkId, tripId],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No such item on this trip');
    if (rows[0].item_id)
      await tx.db.query(
        `UPDATE trips SET overrides = overrides || jsonb_build_object($2::text, false) WHERE id = $1`,
        [tripId, rows[0].item_id],
      );
  });
}

/** The shopping list's note: which trip it's for. */
const FOR_TRIP: Record<Locale, (trip: string) => string> = {
  en: (trip) => `For ${trip}`,
  ro: (trip) => `Pentru călătoria „${trip}”`,
  ru: (trip) => `Для поездки «${trip}»`,
};

/**
 * What still has to be bought for a trip, onto the shopping list (the house's, unless the name is
 * a known food): needed by the day before leaving, with the trip in the note. Each thing once.
 */
export async function shopForTrip(
  ctx: Ctx,
  tripId: string,
  locale: Locale = 'en',
): Promise<{ listed: number }> {
  const trip = toTrip(await tripRow(ctx, tripId));
  const { rows } = await ctx.db.query<{
    id: string;
    name: string;
    quantity: number;
    translations: Translations;
  }>(
    `SELECT c.id, c.name, c.quantity, ${CHECK_TRANSLATIONS} AS translations
       FROM trip_checks c LEFT JOIN travel_items i ON i.id = c.item_id
      WHERE c.trip_id = $1 AND c.to_buy AND c.listed_at IS NULL AND c.checked_at IS NULL
      ORDER BY c.created_at`,
    [tripId],
  );
  const tripName = translated({ name: trip.name, translations: trip.translations }, 'name', locale);
  if (!rows.length) return { listed: 0 };
  const dayBefore = new Date(Date.parse(`${trip.startDate}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  await ctx.tx(async (tx) => {
    await addShoppingItems(
      tx,
      rows.map((r) => ({
        name: translated(r, 'name', locale),
        area: 'house' as const,
        note: `${FOR_TRIP[locale](tripName)}${r.quantity > 1 ? ` · ${r.quantity}` : ''}`,
        needBy: dayBefore,
      })),
    );
    await tx.db.query('UPDATE trip_checks SET listed_at = $2 WHERE id = ANY($1::uuid[])', [
      rows.map((r) => r.id),
      tx.now,
    ]);
  });
  return { listed: rows.length };
}
