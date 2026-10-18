import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import type { PlaceInput, PlaceKind, PlacePatch } from './schemas';

/**
 * Where clothes are kept, the household's: Bedroom › Wardrobe › Shelf 2 (left). Rooms hold
 * furniture, furniture holds sections. Shelves are numbered from the bottom, as people count them
 * standing in front of a wardrobe; drawers from the top.
 */

interface PlaceRow {
  id: string;
  parent_id: string | null;
  kind: PlaceKind;
  name: string;
  number: number | null;
  side: '' | 'left' | 'middle' | 'right';
  position: number;
  items: number;
}

const toPlace = (row: PlaceRow) => ({
  id: row.id,
  parentId: row.parent_id,
  kind: row.kind,
  name: row.name,
  number: row.number,
  side: row.side,
  position: row.position,
  items: row.items,
});
export type Place = ReturnType<typeof toPlace>;

const SELECT = `SELECT p.id, p.parent_id, p.kind, p.name, p.number, p.side, p.position,
    (SELECT count(*)::int FROM closet_items i WHERE i.place_id = p.id
      AND i.status NOT IN ('wishlist', 'sold', 'donated', 'archived')) AS items
  FROM closet_places p`;

/** Every place of the household, parents before children, in their order. */
export async function listPlaces(ctx: FoodCtx): Promise<Place[]> {
  const { rows } = await ctx.db.query<PlaceRow>(
    `${SELECT} WHERE p.household_id = $1 ORDER BY p.position, p.number NULLS LAST, p.created_at`,
    [ctx.actor.householdId],
  );
  return rows.map(toPlace);
}

export async function findPlace(ctx: FoodCtx, id: string): Promise<Place> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That place isn’t in your home');
  const { rows } = await ctx.db.query<PlaceRow>(`${SELECT} WHERE p.id = $1 AND p.household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That place isn’t in your home');
  return toPlace(rows[0]);
}

export const placeTree = (places: Place[]) => new Map(places.map((p) => [p.id, p]));

/** How a piece is usually kept in a kind of place: hanging on a rail, folded on a shelf. */
export function storageFor(kind: PlaceKind): '' | 'hanging' | 'drawer' | 'box' | 'folded' {
  if (kind === 'rail' || kind === 'hook') return 'hanging';
  if (kind === 'drawer') return 'drawer';
  if (kind === 'box') return 'box';
  if (kind === 'shelf') return 'folded';
  return '';
}

const SIDE_WORDS = { left: 'left', middle: 'middle', right: 'right' } as const;

/** A place's own name, in English (Claude reads it): "Bedroom", "Shelf 2 (left)", "Rail". */
export function placeLabel(place: Pick<Place, 'kind' | 'name' | 'number' | 'side'>): string {
  const base =
    place.name.trim() ||
    `${place.kind[0]!.toUpperCase()}${place.kind.slice(1)}${place.number ? ` ${place.number}` : ''}`;
  return place.side ? `${base} (${SIDE_WORDS[place.side]})` : base;
}

/** Room › furniture › section, from the top. */
export function placePath(places: Map<string, Place>, id: string | null): Place[] {
  const path: Place[] = [];
  const seen = new Set<string>();
  let current = id ? places.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? places.get(current.parentId) : undefined;
  }
  return path;
}

export const pathText = (places: Map<string, Place>, id: string | null) =>
  placePath(places, id).map(placeLabel).join(' › ');

/** What a place may sit in: rooms on their own; furniture in a room; sections in anything. */
function checkParent(kind: PlaceKind, parent: Place | null) {
  if (kind === 'room' && parent)
    throw new AppError(400, 'VALIDATION', 'A room can’t be inside another place');
  if (kind === 'furniture' && parent && parent.kind !== 'room')
    throw new AppError(400, 'VALIDATION', 'Furniture goes in a room');
}

export async function addPlace(ctx: FoodCtx, input: PlaceInput) {
  const parent = input.parentId ? await findPlace(ctx, input.parentId) : null;
  checkParent(input.kind, parent);
  if ((input.kind === 'room' || input.kind === 'furniture') && !input.name?.trim())
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { name: 'Name it' },
    });
  let position = input.position;
  if (position === undefined) {
    const { rows } = await ctx.db.query<{ high: number | null }>(
      `SELECT max(position) AS high FROM closet_places
        WHERE household_id = $1 AND parent_id IS NOT DISTINCT FROM $2`,
      [ctx.actor.householdId, parent?.id ?? null],
    );
    position = (rows[0]?.high ?? -1) + 1;
  }
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO closet_places (id, household_id, parent_id, kind, name, number, side, position,
       created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      id,
      ctx.actor.householdId,
      parent?.id ?? null,
      input.kind,
      input.name ?? '',
      input.number ?? null,
      input.side ?? '',
      position,
      ctx.now,
    ],
  );
  return { place: await findPlace(ctx, id) };
}

export async function updatePlace(ctx: FoodCtx, id: string, patch: PlacePatch) {
  const before = await findPlace(ctx, id);
  const kind = patch.kind ?? before.kind;
  let parent: Place | null = null;
  const parentId = patch.parentId === undefined ? before.parentId : patch.parentId;
  if (parentId) {
    parent = await findPlace(ctx, parentId);
    // Never inside itself, or inside something it holds.
    const tree = placeTree(await listPlaces(ctx));
    if (placePath(tree, parentId).some((p) => p.id === id))
      throw new AppError(400, 'VALIDATION', 'A place can’t go inside itself');
  }
  checkParent(kind, parent);
  const columns: [string, unknown][] = [];
  if (patch.kind !== undefined) columns.push(['kind', patch.kind]);
  if (patch.name !== undefined) columns.push(['name', patch.name]);
  if (patch.parentId !== undefined) columns.push(['parent_id', patch.parentId]);
  if (patch.number !== undefined) columns.push(['number', patch.number]);
  if (patch.side !== undefined) columns.push(['side', patch.side]);
  if (patch.position !== undefined) columns.push(['position', patch.position]);
  await ctx.db.query(
    `UPDATE closet_places SET ${columns.map(([column], i) => `${column} = $${i + 1}`).join(', ')},
       updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2}`,
    [...columns.map(([, value]) => value), ctx.now, id],
  );
  return { place: await findPlace(ctx, id) };
}

/** Removes a place and what's inside it; the pieces kept there lose their place, nothing else. */
export async function removePlace(ctx: FoodCtx, id: string) {
  await findPlace(ctx, id);
  await ctx.db.query('DELETE FROM closet_places WHERE id = $1 AND household_id = $2', [
    id,
    ctx.actor.householdId,
  ]);
}

/** Children in a new order (drag on the map). */
export async function reorderPlaces(ctx: FoodCtx, ids: string[]) {
  const places = placeTree(await listPlaces(ctx));
  if (ids.some((id) => !places.has(id))) throw new AppError(404, 'NOT_FOUND', 'That place isn’t in your home');
  await ctx.tx(async (tx) => {
    for (const [index, id] of ids.entries())
      await tx.db.query('UPDATE closet_places SET position = $2, updated_at = $3 WHERE id = $1', [
        id,
        index,
        tx.now,
      ]);
  });
  return { places: await listPlaces(ctx) };
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A place from words, the way people say it: "Bedroom > Wardrobe > Shelf 2 left". Each part is
 * matched by name, or by kind and number ("shelf 2", "rail", "drawer 1") among the last one's
 * children. Null when nothing fits.
 */
export function findByPath(places: Place[], path: string): Place | null {
  const parts = path
    .split(/›|>|\//)
    .map(norm)
    .filter(Boolean);
  let parentId: string | null | undefined;
  let found: Place | null = null;
  for (const part of parts) {
    const pool = places.filter((p) =>
      parentId === undefined ? true : p.parentId === parentId,
    );
    const side = /\b(left|middle|right)\b/.exec(part)?.[1] ?? '';
    const bare = part.replace(/[()]/g, ' ').replace(/\b(left|middle|right)\b/, '').trim().replace(/\s+/g, ' ');
    const numbered = /^([a-z]+)\s*(\d+)?$/.exec(bare);
    const match =
      pool.find((p) => norm(placeLabel(p)) === part) ??
      pool.find((p) => p.name && norm(p.name) === bare && (!side || p.side === side)) ??
      (numbered
        ? pool.find(
            (p) =>
              !p.name &&
              p.kind === numbered[1] &&
              (numbered[2] ? p.number === Number(numbered[2]) : true) &&
              (!side || p.side === side),
          )
        : undefined);
    if (!match) return null;
    found = match;
    parentId = match.id;
  }
  return found;
}
