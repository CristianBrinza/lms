import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { age } from '../profile';
import { avatarUrl, isUuid } from '../users';
import type { FoodCtx } from './kitchen';
import type { Category } from './presets';
import { findProduct, resolveProduct } from './products';

/**
 * What someone in the kitchen can't or won't eat: an allergy (a hazard, shown in red) or something
 * they avoid (shown as a warning). Either names one item (Honey) or a whole kind (fish, dairy).
 * Recipes and planned meals flag every ingredient that hits one.
 */

export interface Restriction {
  id: string;
  userId: string;
  person: string;
  kind: 'allergy' | 'avoid';
  productId: string | null;
  productName: string | null;
  category: Category | null;
  note: string;
}

export interface KitchenPerson {
  id: string;
  name: string;
  surname: string;
  gender: 'female' | 'male' | 'other' | null;
  birthDate: string | null;
  age: number | null;
  heightCm: number | null;
  avatarUrl: string | null;
}

/** Everyone in the household, with what the profile says (who is who: for plans, menus and Claude). */
export async function kitchenPeople(ctx: FoodCtx): Promise<KitchenPerson[]> {
  const { rows } = await ctx.db.query<{
    id: string;
    name: string;
    surname: string;
    gender: KitchenPerson['gender'];
    birth_date: string | null;
    height_cm: number | null;
    avatar_at: Date | null;
  }>(
    `SELECT id, name, surname, gender, birth_date::text AS birth_date, height_cm, avatar_at
       FROM users WHERE household_id = $1 AND is_active ORDER BY created_at`,
    [ctx.actor.householdId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    surname: row.surname,
    gender: row.gender,
    birthDate: row.birth_date,
    age: age(row.birth_date, ctx.now),
    heightCm: row.height_cm,
    avatarUrl: avatarUrl(row.id, row.avatar_at),
  }));
}

export async function listRestrictions(ctx: FoodCtx): Promise<Restriction[]> {
  const { rows } = await ctx.db.query<{
    id: string;
    user_id: string;
    person: string;
    kind: Restriction['kind'];
    product_id: string | null;
    product_name: string | null;
    category: Category | null;
    note: string;
  }>(
    `SELECT r.id, r.user_id, u.name AS person, r.kind, r.product_id, p.name AS product_name, r.category, r.note
       FROM food_restrictions r JOIN users u ON u.id = r.user_id LEFT JOIN products p ON p.id = r.product_id
      WHERE r.household_id = $1 ORDER BY u.name, r.kind, coalesce(p.name, r.category)`,
    [ctx.actor.householdId],
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    person: r.person,
    kind: r.kind,
    productId: r.product_id,
    productName: r.product_name,
    category: r.category,
    note: r.note,
  }));
}

export async function addRestriction(
  ctx: FoodCtx,
  input: {
    userId: string;
    kind: Restriction['kind'];
    productId?: string;
    name?: string;
    category?: Category;
    note?: string;
  },
): Promise<Restriction> {
  if (!isUuid(input.userId) || !(await kitchenPeople(ctx)).some((p) => p.id === input.userId)) {
    throw new AppError(400, 'VALIDATION', 'That person isn’t in this kitchen', {
      fields: { userId: 'Unknown person' },
    });
  }
  const product = input.productId
    ? await findProduct(ctx, input.productId)
    : input.name
      ? await resolveProduct(ctx, input.name)
      : null;
  if (!product && !input.category)
    throw new AppError(400, 'VALIDATION', 'Say which food', { fields: { name: 'Say which food' } });
  const id = randomUUID();
  await ctx.db.query(
    'INSERT INTO food_restrictions (id, household_id, user_id, product_id, category, kind, note, created_by, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [
      id,
      ctx.actor.householdId,
      input.userId,
      product?.id ?? null,
      product ? null : input.category,
      input.kind,
      input.note ?? '',
      ctx.actor.userId,
      ctx.now,
    ],
  );
  return (await listRestrictions(ctx)).find((r) => r.id === id)!;
}

export async function removeRestriction(ctx: FoodCtx, id: string): Promise<void> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Not found');
  const { rowCount } = await ctx.db.query(
    'DELETE FROM food_restrictions WHERE id = $1 AND household_id = $2',
    [id, ctx.actor.householdId],
  );
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Not found');
}

export interface Warning {
  person: string;
  kind: 'allergy' | 'avoid';
}

/** The warnings for one item: anyone allergic to it or avoiding it, by name or by kind. */
export function warningsFor(
  restrictions: Restriction[],
  product: { id: string; category: Category } | null | undefined,
): Warning[] {
  if (!product) return [];
  return restrictions
    .filter((r) => r.productId === product.id || (r.category && r.category === product.category))
    .map((r) => ({ person: r.person, kind: r.kind }))
    .sort((a, b) =>
      a.kind === b.kind ? a.person.localeCompare(b.person) : a.kind === 'allergy' ? -1 : 1,
    );
}
