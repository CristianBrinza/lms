import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { isUuid } from '../users';
import { findDrink, photoUrl } from './drinks';
import { sheetKind, type TastingInput, type TastingPatch, type TastingSheet } from './schemas';

/**
 * Tastings: one person's moment with a drink — when, where, with whom, how good — kept for good so
 * "did I drink that, and what did I think?" has an answer years later. Each is a person's own; the
 * household sees them all.
 */

interface TastingRow {
  id: string;
  drink_id: string;
  user_id: string;
  user_name: string;
  created_by: string | null;
  tasted_on: string;
  place: string;
  occasion: string;
  country: string;
  with_people: string[];
  with_others: string;
  rating: number | null;
  score: number | null;
  buy_again: boolean | null;
  comment: string;
  pairing: string;
  mode: 'quick' | 'full';
  sheet: TastingSheet | null;
  created_at: Date;
  updated_at: Date;
  photo_ids: string[] | null;
}

const SELECT = `SELECT t.id, t.drink_id, t.user_id, u.name AS user_name, t.created_by, t.tasted_on::text,
    t.place, t.occasion, t.country, t.with_people, t.with_others, t.rating, t.score, t.buy_again,
    t.comment, t.pairing, t.mode, t.sheet, t.created_at, t.updated_at,
    (SELECT array_agg(p.id ORDER BY p.position, p.created_at) FROM drink_photos p WHERE p.tasting_id = t.id)
      AS photo_ids
  FROM drink_tastings t JOIN users u ON u.id = t.user_id`;

const toTasting = (row: TastingRow, userId: string) => ({
  id: row.id,
  drinkId: row.drink_id,
  person: { id: row.user_id, name: row.user_name },
  mine: row.user_id === userId,
  tastedOn: row.tasted_on,
  place: row.place,
  occasion: row.occasion,
  country: row.country,
  withPeople: row.with_people,
  withOthers: row.with_others,
  rating: row.rating,
  score: row.score,
  buyAgain: row.buy_again,
  comment: row.comment,
  pairing: row.pairing,
  mode: row.mode,
  sheet: row.sheet,
  photos: (row.photo_ids ?? []).map((id) => ({
    id,
    thumb: photoUrl(id, 'thumb'),
    full: photoUrl(id, 'full'),
  })),
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Tasting = ReturnType<typeof toTasting>;

export async function drinkTastings(ctx: FoodCtx, drinkId: string) {
  const { rows } = await ctx.db.query<TastingRow>(
    `${SELECT} WHERE t.drink_id = $1 AND t.household_id = $2 ORDER BY t.tasted_on DESC, t.created_at DESC`,
    [drinkId, ctx.actor.householdId],
  );
  return rows.map((row) => toTasting(row, ctx.actor.userId));
}

async function findTasting(ctx: FoodCtx, id: string): Promise<TastingRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That tasting isn’t in the journal');
  const { rows } = await ctx.db.query<TastingRow>(
    `${SELECT} WHERE t.id = $1 AND t.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That tasting isn’t in the journal');
  return rows[0];
}

/** Only people of this household can be in it. */
async function checkPeople(ctx: FoodCtx, ids: string[]) {
  if (!ids.length) return;
  const { rows } = await ctx.db.query<{ id: string }>(
    'SELECT id FROM users WHERE id = ANY ($1::uuid[]) AND household_id = $2',
    [ids, ctx.actor.householdId],
  );
  if (rows.length !== new Set(ids).size)
    throw new AppError(400, 'VALIDATION', 'Pick people from your household', {
      fields: { withPeople: 'Not in your household' },
    });
}

/** A sheet must be the one the drink's kind uses (a beer sheet for a beer). */
function checkSheet(sheet: TastingSheet | null | undefined, category: Parameters<typeof sheetKind>[0]) {
  if (sheet && sheet.kind !== sheetKind(category))
    throw new AppError(400, 'VALIDATION', 'That tasting sheet doesn’t fit this drink', {
      fields: { sheet: `Use the ${sheetKind(category)} sheet` },
    });
}

/** Quick is a rating, a comment and a few aromas; anything more of the sheet makes it full. */
const fullSheet = (sheet: TastingSheet | null | undefined): 'quick' | 'full' =>
  sheet && ['appearance', 'palate', 'conclusions', 'scores'].some((key) => key in sheet)
    ? 'full'
    : 'quick';

export async function addTasting(ctx: FoodCtx, drinkId: string, input: TastingInput) {
  const drink = await findDrink(ctx, drinkId);
  const person = input.personId ?? ctx.actor.userId;
  await checkPeople(ctx, [person]);
  const withPeople = [...new Set(input.withPeople ?? [])].filter((id) => id !== person);
  await checkPeople(ctx, withPeople);
  checkSheet(input.sheet, drink.category);
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    await tx.db.query(
      `INSERT INTO drink_tastings (id, drink_id, household_id, user_id, created_by, tasted_on, place,
         occasion, country, with_people, with_others, rating, score, buy_again, comment, pairing, mode,
         sheet, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $19)`,
      [
        id,
        drinkId,
        tx.actor.householdId,
        person,
        tx.actor.userId,
        input.tastedOn ?? localDate(tx.now),
        input.place ?? '',
        input.occasion ?? '',
        input.country ?? '',
        withPeople,
        input.withOthers ?? '',
        input.rating ?? null,
        input.score ?? null,
        input.buyAgain ?? null,
        input.comment ?? '',
        input.pairing ?? '',
        input.mode ?? fullSheet(input.sheet),
        input.sheet ? JSON.stringify(input.sheet) : null,
        tx.now,
      ],
    );
    // Tasted: it is no longer only on the want-to-try list.
    await tx.db.query('UPDATE drinks SET wanted = false, updated_at = $2 WHERE id = $1', [
      drinkId,
      tx.now,
    ]);
  });
  return { tasting: toTasting(await findTasting(ctx, id), ctx.actor.userId) };
}

/** Each person's tasting is theirs to change (or whoever wrote it down for them). */
function mayChange(ctx: FoodCtx, row: TastingRow) {
  if (row.user_id !== ctx.actor.userId && row.created_by !== ctx.actor.userId)
    throw new AppError(403, 'FORBIDDEN', 'Only the person who tasted it can change this');
}

export async function updateTasting(ctx: FoodCtx, id: string, patch: TastingPatch) {
  const row = await findTasting(ctx, id);
  mayChange(ctx, row);
  if (patch.sheet) checkSheet(patch.sheet, (await findDrink(ctx, row.drink_id)).category);
  if (patch.withPeople) await checkPeople(ctx, patch.withPeople);
  const column = {
    tastedOn: 'tasted_on',
    place: 'place',
    occasion: 'occasion',
    country: 'country',
    withPeople: 'with_people',
    withOthers: 'with_others',
    rating: 'rating',
    score: 'score',
    buyAgain: 'buy_again',
    comment: 'comment',
    pairing: 'pairing',
    mode: 'mode',
    sheet: 'sheet',
  } as const;
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values.push(key === 'sheet' && value !== null ? JSON.stringify(value) : value);
    sets.push(`${column[key as keyof typeof column]} = $${values.length}`);
  }
  values.push(ctx.now);
  sets.push(`updated_at = $${values.length}`);
  values.push(id);
  await ctx.db.query(
    `UPDATE drink_tastings SET ${sets.join(', ')} WHERE id = $${values.length}`,
    values,
  );
  return { tasting: toTasting(await findTasting(ctx, id), ctx.actor.userId) };
}

export async function removeTasting(ctx: FoodCtx, id: string) {
  const row = await findTasting(ctx, id);
  mayChange(ctx, row);
  await ctx.db.query('DELETE FROM drink_tastings WHERE id = $1', [id]);
}

/** The journal: every tasting at home, newest first, with the drink it was. */
export async function timeline(ctx: FoodCtx, options: { limit?: number; before?: string } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const values: unknown[] = [ctx.actor.householdId, limit];
  let before = '';
  if (options.before && /^\d{4}-\d{2}-\d{2}$/.test(options.before)) {
    values.push(options.before);
    before = `AND t.tasted_on < $${values.length}`;
  }
  const { rows } = await ctx.db.query<
    TastingRow & { drink_name: string; drink_category: string; drink_vintage: number | null; cover_id: string | null }
  >(
    `SELECT x.*, d.name AS drink_name, d.category AS drink_category, d.vintage AS drink_vintage,
        (SELECT p.id FROM drink_photos p WHERE p.drink_id = d.id
          ORDER BY (p.tasting_id IS NOT NULL), p.position, p.created_at LIMIT 1) AS cover_id
       FROM (${SELECT} WHERE t.household_id = $1 ${before}
             ORDER BY t.tasted_on DESC, t.created_at DESC LIMIT $2) x
       JOIN drinks d ON d.id = x.drink_id
      ORDER BY x.tasted_on DESC, x.created_at DESC`,
    values,
  );
  return {
    tastings: rows.map((row) => ({
      ...toTasting(row, ctx.actor.userId),
      drink: {
        id: row.drink_id,
        name: row.drink_name,
        category: row.drink_category,
        vintage: row.drink_vintage,
        cover: row.cover_id ? photoUrl(row.cover_id, 'thumb') : null,
      },
    })),
  };
}

/** What a drink's tastings add up to: the average, how often, by whom. */
export function insights(tastings: Tasting[]) {
  const rated = tastings.filter((t) => t.rating !== null);
  const average = (list: Tasting[]) =>
    list.length
      ? Math.round((list.reduce((sum, t) => sum + (t.rating ?? 0), 0) / list.length) * 10) / 10
      : null;
  const people = new Map<string, { id: string; name: string; tastings: Tasting[] }>();
  for (const tasting of tastings) {
    const entry = people.get(tasting.person.id) ?? { ...tasting.person, tastings: [] };
    entry.tastings.push(tasting);
    people.set(tasting.person.id, entry);
  }
  const yes = tastings.filter((t) => t.buyAgain === true).length;
  const asked = tastings.filter((t) => t.buyAgain !== null).length;
  return {
    rating: average(rated),
    ratings: rated.length,
    tastings: tastings.length,
    firstTasted: tastings.at(-1)?.tastedOn ?? null,
    lastTasted: tastings[0]?.tastedOn ?? null,
    best: rated.length ? Math.max(...rated.map((t) => t.rating ?? 0)) : null,
    buyAgain: asked ? { yes, of: asked } : null,
    people: [...people.values()].map((p) => ({
      id: p.id,
      name: p.name,
      tastings: p.tastings.length,
      rating: average(p.tastings.filter((t) => t.rating !== null)),
      last: p.tastings[0]!.tastedOn,
    })),
  };
}
