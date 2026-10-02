import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import type { FoodCtx } from './kitchen';
import type { STORE_TONES, StoreInput, StorePatch } from './schemas';

/** Where the kitchen shops (Linella, Metro…). Each has its own list. */
export interface Store {
  id: string;
  name: string;
  tone: (typeof STORE_TONES)[number];
  sort: number;
  /** Lines on its list not yet in the cart. */
  open: number;
  /** Lines in the cart, not yet checked out. */
  inCart: number;
  createdAt: string;
}

interface StoreRow {
  id: string;
  name: string;
  tone: Store['tone'];
  sort: number;
  open: number;
  in_cart: number;
  created_at: Date;
}

const toStore = (row: StoreRow): Store => ({ id: row.id, name: row.name, tone: row.tone, sort: row.sort, open: row.open, inCart: row.in_cart, createdAt: row.created_at.toISOString() });

export async function listStores(ctx: FoodCtx): Promise<Store[]> {
  const { rows } = await ctx.db.query<StoreRow>(
    `SELECT s.id, s.name, s.tone, s.sort, s.created_at,
            count(i.id) FILTER (WHERE i.checked_at IS NULL)::int AS open,
            count(i.id) FILTER (WHERE i.checked_at IS NOT NULL)::int AS in_cart
       FROM stores s LEFT JOIN shopping_items i ON i.store_id = s.id AND i.trip_id IS NULL
      WHERE s.household_id = $1
      GROUP BY s.id ORDER BY s.sort, s.created_at`,
    [ctx.actor.householdId],
  );
  return rows.map(toStore);
}

export async function findStore(ctx: FoodCtx, id: string): Promise<Store> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Store not found');
  const store = (await listStores(ctx)).find((s) => s.id === id);
  if (!store) throw new AppError(404, 'NOT_FOUND', 'Store not found');
  return store;
}

async function nameTaken(ctx: FoodCtx, name: string, except?: string): Promise<boolean> {
  const { rowCount } = await ctx.db.query('SELECT 1 FROM stores WHERE household_id = $1 AND lower(name) = lower($2) AND id IS DISTINCT FROM $3', [
    ctx.actor.householdId,
    name,
    except ?? null,
  ]);
  return Boolean(rowCount);
}

export async function createStore(ctx: FoodCtx, input: z.infer<typeof StoreInput>): Promise<Store> {
  if (await nameTaken(ctx, input.name)) throw new AppError(409, 'EXISTS', `${input.name} is already a store`, { fields: { name: 'You already have this store' } });
  const { rows } = await ctx.db.query<{ next: number }>('SELECT coalesce(max(sort) + 1, 0)::int AS next FROM stores WHERE household_id = $1', [ctx.actor.householdId]);
  const id = randomUUID();
  await ctx.db.query('INSERT INTO stores (id, household_id, name, tone, sort, created_at) VALUES ($1, $2, $3, $4, $5, $6)', [
    id,
    ctx.actor.householdId,
    input.name,
    input.tone ?? 'butter',
    rows[0]!.next,
    ctx.now,
  ]);
  return findStore(ctx, id);
}

export async function updateStore(ctx: FoodCtx, id: string, patch: z.infer<typeof StorePatch>): Promise<Store> {
  await findStore(ctx, id);
  if (patch.name && (await nameTaken(ctx, patch.name, id))) throw new AppError(409, 'EXISTS', `${patch.name} is already a store`, { fields: { name: 'You already have this store' } });
  await ctx.db.query('UPDATE stores SET name = coalesce($2, name), tone = coalesce($3, tone), sort = coalesce($4, sort) WHERE id = $1', [
    id,
    patch.name ?? null,
    patch.tone ?? null,
    patch.sort ?? null,
  ]);
  return findStore(ctx, id);
}

/** Removes a store: its open lines move to “any store”; past trips keep its name. */
export async function deleteStore(ctx: FoodCtx, id: string): Promise<void> {
  await findStore(ctx, id);
  await ctx.db.query('DELETE FROM stores WHERE id = $1 AND household_id = $2', [id, ctx.actor.householdId]);
}
