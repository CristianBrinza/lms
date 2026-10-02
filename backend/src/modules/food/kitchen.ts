import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { AppDeps, AppEnv } from '../../context';
import type { Queryable } from '../../db';
import type { User } from '../users';

/**
 * Food belongs to a kitchen (a household), not to one person: family members who share a fridge
 * share its stock, recipes, lists and plan. Everyone gets their own kitchen the first time they
 * open Food; the admin can seat people in the same one.
 */

/** Who is acting, on which kitchen, and how (in the app or through an AI access key). */
export interface Actor {
  householdId: string;
  userId: string;
  via: 'app' | 'ai';
  currency: string;
}

export interface Kitchen {
  id: string;
  name: string;
  currency: string;
}

/** The person's kitchen, created on first use. Safe under concurrent first requests. */
export async function ensureKitchen(deps: AppDeps, user: Pick<User, 'id' | 'name'>): Promise<Kitchen> {
  return deps.db.tx(async (tx) => {
    const { rows } = await tx.query<{ household_id: string | null }>('SELECT household_id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
    let id = rows[0]?.household_id ?? null;
    if (!id) {
      id = randomUUID();
      await tx.query('INSERT INTO households (id, name) VALUES ($1, $2)', [id, `${user.name}’s kitchen`]);
      await tx.query('UPDATE users SET household_id = $2 WHERE id = $1', [user.id, id]);
    }
    const kitchen = await tx.query<Kitchen>('SELECT id, name, currency FROM households WHERE id = $1', [id]);
    return kitchen.rows[0]!;
  });
}

/** After requireAuth: resolves the caller's kitchen and sets `actor` for the food services. */
export function requireKitchen(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    const kitchen = await ensureKitchen(deps, user);
    c.set('actor', { householdId: kitchen.id, userId: user.id, via: c.get('via') ?? 'app', currency: kitchen.currency });
    await next();
  });
}

/**
 * What every food service gets: the database (the pool, or the open transaction), who acts, and
 * the time. `tx` runs work in one transaction, or simply inside the one already open.
 */
export interface FoodCtx {
  db: Queryable;
  actor: Actor;
  now: Date;
  tx<T>(work: (ctx: FoodCtx) => Promise<T>): Promise<T>;
}

export function foodCtx(deps: AppDeps, actor: Actor): FoodCtx {
  const ctx: FoodCtx = {
    db: deps.db,
    actor,
    now: deps.now(),
    tx: (work) =>
      deps.db.tx((client) => {
        const inner: FoodCtx = { db: client, actor, now: ctx.now, tx: (nested) => nested(inner) };
        return work(inner);
      }),
  };
  return ctx;
}
