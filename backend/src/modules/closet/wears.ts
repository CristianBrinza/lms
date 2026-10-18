import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { isUuid } from '../users';
import { checkPerson, itemsById, resolveOwner } from './items';
import { findLook, piecesFor } from './looks';
import type { WearInput, WearPatch } from './schemas';

/**
 * The calendar: what someone wore on a day (a look, or pieces), or planned to. Worn days add up to
 * each piece's wears, its last day worn and its cost per wear; planned ones don't count until
 * they're marked worn.
 */

interface WearRow {
  id: string;
  owner_id: string;
  worn_on: string;
  look_id: string | null;
  item_ids: string[];
  note: string;
  planned: boolean;
  created_at: Date;
}

const toWear = (row: WearRow) => ({
  id: row.id,
  ownerId: row.owner_id,
  wornOn: row.worn_on,
  lookId: row.look_id,
  itemIds: row.item_ids,
  note: row.note,
  planned: row.planned,
  createdAt: row.created_at.toISOString(),
});
export type Wear = ReturnType<typeof toWear>;

const SELECT = `SELECT id, owner_id, worn_on::text, look_id, item_ids, note, planned, created_at
  FROM closet_wears`;

async function findWear(ctx: FoodCtx, id: string): Promise<Wear> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That day isn’t in the calendar');
  const { rows } = await ctx.db.query<WearRow>(`${SELECT} WHERE id = $1 AND household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That day isn’t in the calendar');
  return toWear(rows[0]);
}

/** A month (or any days) of the calendar, with the looks and pieces it names. */
export async function listWears(ctx: FoodCtx, query: { owner?: string; from?: string; to?: string }) {
  const owner = await resolveOwner(ctx, query.owner);
  const values: unknown[] = [ctx.actor.householdId];
  const where = ['household_id = $1'];
  if (owner !== 'all') {
    values.push(owner);
    where.push(`owner_id = $${values.length}`);
  }
  if (query.from) {
    values.push(query.from);
    where.push(`worn_on >= $${values.length}`);
  }
  if (query.to) {
    values.push(query.to);
    where.push(`worn_on <= $${values.length}`);
  }
  const { rows } = await ctx.db.query<WearRow>(
    `${SELECT} WHERE ${where.join(' AND ')} ORDER BY worn_on, created_at LIMIT 2000`,
    values,
  );
  const wears = rows.map(toWear);
  const lookIds = [...new Set(wears.map((w) => w.lookId).filter((id): id is string => Boolean(id)))];
  const looks = await Promise.all(lookIds.map((id) => findLook(ctx, id).catch(() => null)));
  const lookMap = Object.fromEntries(looks.filter((l) => l).map((l) => [l!.id, l!]));
  const pieceIds = [
    ...wears.flatMap((w) => w.itemIds),
    ...Object.values(lookMap).flatMap((l) => l.canvas.items.map((i) => i.itemId)),
  ];
  return { wears, looks: lookMap, pieces: await piecesFor(ctx, pieceIds) };
}

/** The pieces a look holds that still exist. */
async function lookPieces(ctx: FoodCtx, lookId: string) {
  const look = await findLook(ctx, lookId);
  const items = await itemsById(ctx, look.canvas.items.map((i) => i.itemId));
  return { look, ids: look.canvas.items.map((i) => i.itemId).filter((id) => items.has(id)) };
}

async function checkItems(ctx: FoodCtx, ids: string[]) {
  const found = await itemsById(ctx, ids);
  if (found.size !== new Set(ids).size) throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
}

export async function addWear(ctx: FoodCtx, input: WearInput) {
  const ownerId = input.ownerId ?? ctx.actor.userId;
  await checkPerson(ctx, ownerId);
  let itemIds = input.itemIds ?? [];
  await checkItems(ctx, itemIds);
  if (input.lookId) {
    const { ids } = await lookPieces(ctx, input.lookId);
    itemIds = [...new Set([...itemIds, ...ids])];
  }
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO closet_wears (id, household_id, owner_id, worn_on, look_id, item_ids, note, planned,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      id,
      ctx.actor.householdId,
      ownerId,
      input.wornOn ?? localDate(ctx.now),
      input.lookId ?? null,
      itemIds,
      input.note ?? '',
      input.planned ?? false,
      ctx.now,
    ],
  );
  return { wear: await findWear(ctx, id) };
}

export async function updateWear(ctx: FoodCtx, id: string, patch: WearPatch) {
  const before = await findWear(ctx, id);
  const columns: [string, unknown][] = [];
  if (patch.wornOn !== undefined) columns.push(['worn_on', patch.wornOn]);
  if (patch.note !== undefined) columns.push(['note', patch.note]);
  if (patch.planned !== undefined) columns.push(['planned', patch.planned]);
  let itemIds = patch.itemIds;
  if (itemIds) await checkItems(ctx, itemIds);
  if (patch.lookId !== undefined) {
    columns.push(['look_id', patch.lookId]);
    if (patch.lookId && patch.lookId !== before.lookId) {
      const { ids } = await lookPieces(ctx, patch.lookId);
      itemIds = [...new Set([...(itemIds ?? []), ...ids])];
    }
  }
  if (itemIds) columns.push(['item_ids', itemIds]);
  await ctx.db.query(
    `UPDATE closet_wears SET ${columns.map(([column], i) => `${column} = $${i + 1}`).join(', ')},
       updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2}`,
    [...columns.map(([, value]) => value), ctx.now, id],
  );
  return { wear: await findWear(ctx, id) };
}

export async function removeWear(ctx: FoodCtx, id: string) {
  await findWear(ctx, id);
  await ctx.db.query('DELETE FROM closet_wears WHERE id = $1', [id]);
}

/**
 * "Worn today" on a piece (or several): added to the person's day of loose pieces, so a day logged
 * piece by piece stays one day. Each piece counts once a day. Pieces belong to their owner's day.
 */
export async function logWorn(
  ctx: FoodCtx,
  input: { itemIds: string[]; wornOn?: string; ownerId?: string },
) {
  const items = await itemsById(ctx, input.itemIds);
  if (!items.size || items.size !== new Set(input.itemIds).size)
    throw new AppError(404, 'NOT_FOUND', 'That piece isn’t in your closet');
  const day = input.wornOn ?? localDate(ctx.now);
  const byOwner = new Map<string, string[]>();
  for (const item of items.values()) {
    const owner = input.ownerId ?? item.ownerId;
    byOwner.set(owner, [...(byOwner.get(owner) ?? []), item.id]);
  }
  const wears: Wear[] = [];
  await ctx.tx(async (tx) => {
    for (const [ownerId, ids] of byOwner) {
      await checkPerson(tx, ownerId);
      const { rows } = await tx.db.query<WearRow>(
        `${SELECT} WHERE household_id = $1 AND owner_id = $2 AND worn_on = $3 AND NOT planned
           AND look_id IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE`,
        [tx.actor.householdId, ownerId, day],
      );
      if (rows[0]) {
        const merged = [...new Set([...rows[0].item_ids, ...ids])];
        await tx.db.query('UPDATE closet_wears SET item_ids = $2, updated_at = $3 WHERE id = $1', [
          rows[0].id,
          merged,
          tx.now,
        ]);
        wears.push(await findWear(tx, rows[0].id));
      } else {
        wears.push((await addWear(tx, { wornOn: day, itemIds: ids, ownerId })).wear);
      }
    }
  });
  return { wears, items: [...(await itemsById(ctx, input.itemIds)).values()] };
}
