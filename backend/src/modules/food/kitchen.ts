import { randomUUID } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import type { AppDeps, AppEnv } from '../../context';
import type { Queryable } from '../../db';
import type { User } from '../users';
import { CATALOG_VERSION } from './presets';
import { refreshFromCatalog } from './products';

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
  /** The catalog its items were last brought up to (CATALOG_VERSION). */
  catalogVersion: number;
}

/** The person's kitchen, created on first use. Safe under concurrent first requests. */
export async function ensureKitchen(
  deps: AppDeps,
  user: Pick<User, 'id' | 'name' | 'householdId'>,
): Promise<Kitchen> {
  // Almost always the person already has one: no transaction, no lock.
  if (user.householdId) {
    const { rows } = await deps.db.query<Kitchen>(
      'SELECT id, name, currency, catalog_version AS "catalogVersion" FROM households WHERE id = $1',
      [user.householdId],
    );
    if (rows[0]) return rows[0];
  }
  return deps.db.tx(async (tx) => {
    const { rows } = await tx.query<{ household_id: string | null }>(
      'SELECT household_id FROM users WHERE id = $1 FOR UPDATE',
      [user.id],
    );
    let id = rows[0]?.household_id ?? null;
    if (!id) {
      id = randomUUID();
      await tx.query('INSERT INTO households (id, name) VALUES ($1, $2)', [
        id,
        `${user.name}’s kitchen`,
      ]);
      await tx.query('UPDATE users SET household_id = $2 WHERE id = $1', [user.id, id]);
    }
    const kitchen = await tx.query<Kitchen>(
      'SELECT id, name, currency, catalog_version AS "catalogVersion" FROM households WHERE id = $1',
      [id],
    );
    return kitchen.rows[0]!;
  });
}

/** After requireAuth: resolves the caller's kitchen and sets `actor` for the food services. */
export function requireKitchen(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const user = c.get('user');
    const kitchen = await ensureKitchen(deps, user);
    const actor: Actor = {
      householdId: kitchen.id,
      userId: user.id,
      via: c.get('via') ?? 'app',
      currency: kitchen.currency,
    };
    // A newer catalog (more packages, types, keeping times): bring the kitchen's own items up to it, once.
    if (kitchen.catalogVersion < CATALOG_VERSION) {
      await refreshFromCatalog(foodCtx(deps, actor));
      await deps.db.query(
        'UPDATE households SET catalog_version = $2 WHERE id = $1 AND catalog_version < $2',
        [kitchen.id, CATALOG_VERSION],
      );
    }
    c.set('actor', actor);
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
