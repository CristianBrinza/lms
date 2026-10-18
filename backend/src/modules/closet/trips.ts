import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { checkPerson, itemsById, resolveOwner, updateItem } from './items';
import { findLook, piecesFor } from './looks';
import type { TripInput, TripPatch } from './schemas';

/**
 * Packing lists: a trip, the pieces going (with the looks they came from), ticked as they go in
 * the bag. "Back from the trip" puts everything that went in the laundry basket.
 */

interface TripRow {
  id: string;
  owner_id: string;
  name: string;
  destination: string;
  starts_on: string | null;
  ends_on: string | null;
  notes: string;
  look_ids: string[];
  back_at: Date | null;
  created_at: Date;
  updated_at: Date;
  items: number;
  packed: number;
}

const toTrip = (row: TripRow) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  destination: row.destination,
  startsOn: row.starts_on,
  endsOn: row.ends_on,
  notes: row.notes,
  lookIds: row.look_ids,
  backAt: row.back_at?.toISOString() ?? null,
  items: row.items,
  packed: row.packed,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Trip = ReturnType<typeof toTrip>;

const SELECT = `SELECT t.id, t.owner_id, t.name, t.destination, t.starts_on::text, t.ends_on::text,
    t.notes, t.look_ids, t.back_at, t.created_at, t.updated_at,
    (SELECT count(*)::int FROM closet_trip_items x WHERE x.trip_id = t.id) AS items,
    (SELECT count(*)::int FROM closet_trip_items x WHERE x.trip_id = t.id AND x.packed) AS packed
  FROM closet_trips t`;

export async function listTrips(ctx: FoodCtx, owner?: string) {
  const who = await resolveOwner(ctx, owner);
  const { rows } = await ctx.db.query<TripRow>(
    `${SELECT} WHERE t.household_id = $1 ${who === 'all' ? '' : 'AND t.owner_id = $2'}
      ORDER BY (t.back_at IS NOT NULL), t.starts_on NULLS LAST, t.created_at DESC`,
    who === 'all' ? [ctx.actor.householdId] : [ctx.actor.householdId, who],
  );
  return { trips: rows.map(toTrip) };
}

async function findTrip(ctx: FoodCtx, id: string): Promise<Trip> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That packing list isn’t here');
  const { rows } = await ctx.db.query<TripRow>(`${SELECT} WHERE t.id = $1 AND t.household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That packing list isn’t here');
  return toTrip(rows[0]);
}

export async function tripDetail(ctx: FoodCtx, id: string) {
  const trip = await findTrip(ctx, id);
  const { rows } = await ctx.db.query<{ item_id: string; packed: boolean }>(
    'SELECT item_id, packed FROM closet_trip_items WHERE trip_id = $1 ORDER BY position, item_id',
    [id],
  );
  return {
    trip,
    lines: rows.map((row) => ({ itemId: row.item_id, packed: row.packed })),
    pieces: await piecesFor(ctx, rows.map((row) => row.item_id)),
  };
}

/** The pieces of these ids and looks that exist, in order, each once. */
async function piecesToAdd(ctx: FoodCtx, itemIds: string[] = [], lookIds: string[] = []) {
  const ids = [...itemIds];
  for (const lookId of lookIds) {
    const look = await findLook(ctx, lookId);
    ids.push(...look.canvas.items.map((i) => i.itemId));
  }
  const found = await itemsById(ctx, ids);
  if (itemIds.some((id) => !found.has(id))) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
  return [...new Set(ids)].filter((id) => found.has(id));
}

async function insertLines(ctx: FoodCtx, tripId: string, ids: string[]) {
  const { rows } = await ctx.db.query<{ high: number | null }>(
    'SELECT max(position) AS high FROM closet_trip_items WHERE trip_id = $1',
    [tripId],
  );
  let position = (rows[0]?.high ?? -1) + 1;
  for (const id of ids)
    await ctx.db.query(
      `INSERT INTO closet_trip_items (trip_id, item_id, position) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [tripId, id, position++],
    );
}

export async function addTrip(ctx: FoodCtx, input: TripInput) {
  const ownerId = input.ownerId ?? ctx.actor.userId;
  await checkPerson(ctx, ownerId);
  const ids = await piecesToAdd(ctx, input.itemIds, input.lookIds);
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    await tx.db.query(
      `INSERT INTO closet_trips (id, household_id, owner_id, name, destination, starts_on, ends_on,
         notes, look_ids, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
      [
        id,
        tx.actor.householdId,
        ownerId,
        input.name,
        input.destination ?? '',
        input.startsOn ?? null,
        input.endsOn ?? null,
        input.notes ?? '',
        [...new Set(input.lookIds ?? [])],
        tx.now,
      ],
    );
    await insertLines(tx, id, ids);
  });
  return tripDetail(ctx, id);
}

export async function updateTrip(ctx: FoodCtx, id: string, patch: TripPatch) {
  await findTrip(ctx, id);
  const columns: [string, unknown][] = [];
  if (patch.name !== undefined) columns.push(['name', patch.name]);
  if (patch.destination !== undefined) columns.push(['destination', patch.destination]);
  if (patch.startsOn !== undefined) columns.push(['starts_on', patch.startsOn]);
  if (patch.endsOn !== undefined) columns.push(['ends_on', patch.endsOn]);
  if (patch.notes !== undefined) columns.push(['notes', patch.notes]);
  await ctx.db.query(
    `UPDATE closet_trips SET ${columns.map(([column], i) => `${column} = $${i + 1}`).join(', ')},
       updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2}`,
    [...columns.map(([, value]) => value), ctx.now, id],
  );
  return tripDetail(ctx, id);
}

export async function removeTrip(ctx: FoodCtx, id: string) {
  await findTrip(ctx, id);
  await ctx.db.query('DELETE FROM closet_trips WHERE id = $1', [id]);
}

export async function addTripItems(ctx: FoodCtx, id: string, input: { itemIds?: string[]; lookIds?: string[] }) {
  const trip = await findTrip(ctx, id);
  const ids = await piecesToAdd(ctx, input.itemIds, input.lookIds);
  await ctx.tx(async (tx) => {
    await insertLines(tx, id, ids);
    if (input.lookIds?.length)
      await tx.db.query('UPDATE closet_trips SET look_ids = $2, updated_at = $3 WHERE id = $1', [
        id,
        [...new Set([...trip.lookIds, ...input.lookIds])],
        tx.now,
      ]);
  });
  return tripDetail(ctx, id);
}

export async function setPacked(ctx: FoodCtx, id: string, itemId: string, packed: boolean) {
  if (!isUuid(itemId)) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t on the list');
  await findTrip(ctx, id);
  const { rowCount } = await ctx.db.query(
    'UPDATE closet_trip_items SET packed = $3 WHERE trip_id = $1 AND item_id = $2',
    [id, itemId, packed],
  );
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t on the list');
  return tripDetail(ctx, id);
}

export async function removeTripItem(ctx: FoodCtx, id: string, itemId: string) {
  if (!isUuid(itemId)) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t on the list');
  await findTrip(ctx, id);
  await ctx.db.query('DELETE FROM closet_trip_items WHERE trip_id = $1 AND item_id = $2', [id, itemId]);
  return tripDetail(ctx, id);
}

/** Home again: everything that went (packed) goes in the laundry basket. */
export async function backFromTrip(ctx: FoodCtx, id: string) {
  const detail = await tripDetail(ctx, id);
  const went = detail.lines.filter((l) => l.packed).map((l) => l.itemId);
  const ids = went.length ? went : detail.lines.map((l) => l.itemId);
  await ctx.tx(async (tx) => {
    for (const itemId of ids)
      await updateItem(tx, itemId, { status: 'to_wash', storage: 'laundry' });
    await tx.db.query('UPDATE closet_trips SET back_at = $2, updated_at = $2 WHERE id = $1', [id, tx.now]);
  });
  return tripDetail(ctx, id);
}
