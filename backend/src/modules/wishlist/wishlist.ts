import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { dateField, priceField } from '../food/schemas';
import { isUuid } from '../users';

/**
 * The priority buy list: bigger things someone wants to buy one day (a cordless vacuum, a monitor),
 * in the order that matters. The household's by default; one person's when kept private. Ranked by
 * hand (position), with how soon it's needed, a price, a link and a note; bought ones stay below
 * with what they cost.
 */

export const URGENCIES = ['now', 'soon', 'someday'] as const;
export const WISH_STATUSES = ['wanted', 'bought', 'dropped'] as const;

const nameField = z.string().trim().min(1, 'Say what to buy').max(120, 'Keep it under 120 characters');
const urlField = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Use a web address (https://…)');
const currencyField = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'A currency like MDL, EUR or USD');

export const WishInput = z.object({
  name: nameField,
  note: z.string().trim().max(2000).optional().describe('Why, which model, what to look for'),
  url: urlField.optional().describe('Where to buy it or read about it'),
  price: priceField.nullable().optional().describe('What it should cost, about'),
  currency: currencyField.optional().describe('Default: the kitchen’s currency'),
  urgency: z.enum(URGENCIES).optional().describe('now: needed soon; soon (default); someday'),
  category: z.string().trim().max(40).optional().describe('Free words: Home, Tech, Kitchen…'),
  shared: z
    .boolean()
    .optional()
    .describe('true (default): everyone at home sees it; false: only the person who adds it'),
  top: z.boolean().optional().describe('Put it first instead of last'),
});
export type WishInput = z.infer<typeof WishInput>;

export const WishPatch = WishInput.omit({ top: true })
  .partial()
  .extend({
    status: z.enum(WISH_STATUSES).optional(),
    boughtPrice: priceField.nullable().optional().describe('What it really cost'),
    boughtOn: dateField.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type WishPatch = z.infer<typeof WishPatch>;

export const WishOrder = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

interface WishRow {
  id: string;
  owner_id: string;
  owner_name: string;
  shared: boolean;
  name: string;
  note: string;
  url: string;
  price: string | null;
  currency: string;
  urgency: (typeof URGENCIES)[number];
  category: string;
  position: number;
  status: (typeof WISH_STATUSES)[number];
  bought_price: string | null;
  bought_on: string | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT = `SELECT w.id, w.owner_id, u.name AS owner_name, w.shared, w.name, w.note, w.url, w.price::text,
    w.currency, w.urgency, w.category, w.position, w.status, w.bought_price::text, w.bought_on::text,
    w.created_at, w.updated_at
  FROM wishlist_items w JOIN users u ON u.id = w.owner_id`;
/** What the caller may see: the household's shared things and their own private ones. */
const VISIBLE = `w.household_id = $1 AND (w.shared OR w.owner_id = $2)`;

const toWish = (row: WishRow, userId: string) => ({
  id: row.id,
  name: row.name,
  note: row.note,
  url: row.url,
  price: row.price === null ? null : Number(row.price),
  currency: row.currency,
  urgency: row.urgency,
  category: row.category,
  position: row.position,
  status: row.status,
  boughtPrice: row.bought_price === null ? null : Number(row.bought_price),
  boughtOn: row.bought_on,
  shared: row.shared,
  owner: { id: row.owner_id, name: row.owner_name },
  mine: row.owner_id === userId,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Wish = ReturnType<typeof toWish>;

export async function listWishes(ctx: FoodCtx) {
  const { householdId, userId } = ctx.actor;
  const { rows } = await ctx.db.query<WishRow>(
    `${SELECT} WHERE ${VISIBLE} ORDER BY (w.status = 'wanted') DESC, w.position, w.updated_at DESC`,
    [householdId, userId],
  );
  const items = rows.map((row) => toWish(row, userId));
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();
  return { items, categories, currency: ctx.actor.currency };
}

async function findWish(ctx: FoodCtx, id: string): Promise<WishRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That item isn’t on the list');
  const { rows } = await ctx.db.query<WishRow>(`${SELECT} WHERE w.id = $3 AND ${VISIBLE}`, [
    ctx.actor.householdId,
    ctx.actor.userId,
    id,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That item isn’t on the list');
  return rows[0];
}

export async function addWish(ctx: FoodCtx, input: WishInput) {
  const { householdId, userId, currency } = ctx.actor;
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<{ low: number | null; high: number | null }>(
      `SELECT min(position) AS low, max(position) AS high FROM wishlist_items
        WHERE household_id = $1 AND status = 'wanted'`,
      [householdId],
    );
    const position = input.top ? (rows[0]?.low ?? 1) - 1 : (rows[0]?.high ?? 0) + 1;
    await tx.db.query(
      `INSERT INTO wishlist_items (id, household_id, owner_id, shared, name, note, url, price, currency,
         urgency, category, position, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'wanted', $13, $13)`,
      [
        id,
        householdId,
        userId,
        input.shared ?? true,
        input.name,
        input.note ?? '',
        input.url ?? '',
        input.price ?? null,
        input.currency ?? currency,
        input.urgency ?? 'soon',
        input.category ?? '',
        position,
        tx.now,
      ],
    );
  });
  return { item: toWish(await findWish(ctx, id), userId) };
}

export async function updateWish(ctx: FoodCtx, id: string, patch: WishPatch) {
  const row = await findWish(ctx, id);
  // A private item stays its owner's to change.
  if (!row.shared && row.owner_id !== ctx.actor.userId)
    throw new AppError(404, 'NOT_FOUND', 'That item isn’t on the list');
  const bought = patch.status === 'bought' && row.status !== 'bought';
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (patch.name !== undefined) set('name', patch.name);
  if (patch.note !== undefined) set('note', patch.note);
  if (patch.url !== undefined) set('url', patch.url);
  if (patch.price !== undefined) set('price', patch.price);
  if (patch.currency !== undefined) set('currency', patch.currency);
  if (patch.urgency !== undefined) set('urgency', patch.urgency);
  if (patch.category !== undefined) set('category', patch.category);
  if (patch.shared !== undefined && row.owner_id === ctx.actor.userId) set('shared', patch.shared);
  if (patch.status !== undefined) set('status', patch.status);
  if (patch.boughtPrice !== undefined) set('bought_price', patch.boughtPrice);
  if (patch.boughtOn !== undefined) set('bought_on', patch.boughtOn);
  // Bought now: the day, and the price it was expected at unless a real one is given.
  if (bought && patch.boughtOn === undefined) set('bought_on', ctx.now.toISOString().slice(0, 10));
  if (bought && patch.boughtPrice === undefined && row.price !== null)
    set('bought_price', Number(row.price));
  // Back on the list: it goes last, not where it was.
  if (patch.status === 'wanted' && row.status !== 'wanted') {
    const { rows } = await ctx.db.query<{ high: number | null }>(
      `SELECT max(position) AS high FROM wishlist_items WHERE household_id = $1 AND status = 'wanted'`,
      [ctx.actor.householdId],
    );
    set('position', (rows[0]?.high ?? 0) + 1);
    set('bought_on', null);
    set('bought_price', null);
  }
  set('updated_at', ctx.now);
  values.push(id);
  await ctx.db.query(
    `UPDATE wishlist_items SET ${sets.join(', ')} WHERE id = $${values.length}`,
    values,
  );
  return { item: toWish(await findWish(ctx, id), ctx.actor.userId) };
}

export async function removeWish(ctx: FoodCtx, id: string) {
  const row = await findWish(ctx, id);
  if (!row.shared && row.owner_id !== ctx.actor.userId)
    throw new AppError(404, 'NOT_FOUND', 'That item isn’t on the list');
  await ctx.db.query('DELETE FROM wishlist_items WHERE id = $1', [id]);
}

/** The new order of what's still wanted, first to last. Ids the caller can't see are ignored. */
export async function reorderWishes(ctx: FoodCtx, ids: string[]) {
  await ctx.tx(async (tx) => {
    for (const [index, id] of ids.entries())
      await tx.db.query(
        `UPDATE wishlist_items w SET position = $3, updated_at = updated_at
          WHERE w.id = $4 AND ${VISIBLE}`,
        [tx.actor.householdId, tx.actor.userId, index + 1, id],
      );
  });
  return listWishes(ctx);
}
