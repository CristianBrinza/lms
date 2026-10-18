import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { checkPerson, itemsById, photoUrl, resolveOwner, type Item } from './items';
import { addBackdrop, photosOf, type Photo } from './photos';
import type { Backdrop, Canvas, LookInput, LookPatch } from './schemas';

/**
 * Looks: pieces laid out on a canvas, on a backdrop. The canvas names pieces by id, so a piece
 * deleted later leaves a placeholder with the name it had (label), never a broken look.
 */

interface LookRow {
  id: string;
  owner_id: string;
  name: string;
  canvas: Canvas;
  backdrop: Backdrop;
  seasons: string[];
  occasions: string[];
  notes: string;
  wears: number;
  last_worn: string | null;
  created_at: Date;
  updated_at: Date;
}

const toLook = (row: LookRow) => ({
  id: row.id,
  ownerId: row.owner_id,
  name: row.name,
  canvas: row.canvas,
  backdrop: {
    ...row.backdrop,
    ...(row.backdrop.photoId
      ? { url: photoUrl(row.backdrop.photoId, 'full'), thumb: photoUrl(row.backdrop.photoId, 'thumb') }
      : {}),
  },
  seasons: row.seasons,
  occasions: row.occasions,
  notes: row.notes,
  wears: row.wears,
  lastWorn: row.last_worn,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
export type Look = ReturnType<typeof toLook>;

const SELECT = `SELECT l.id, l.owner_id, l.name, l.canvas, l.backdrop, l.seasons, l.occasions, l.notes,
    l.created_at, l.updated_at, coalesce(w.wears, 0) AS wears, w.last_worn
  FROM closet_looks l
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS wears, max(worn_on)::text AS last_worn FROM closet_wears
    WHERE look_id = l.id AND NOT planned
  ) w ON true`;

/** What a look (or a day, or a trip) shows of a piece: its name, kind and photos. */
export const pieceOf = (item: Item, photos: Photo[]) => ({
  id: item.id,
  ownerId: item.ownerId,
  name: item.name,
  category: item.category,
  subcategory: item.subcategory,
  colors: item.colors,
  status: item.status,
  placeId: item.placeId,
  cover: item.cover,
  photos: photos.map((p) => ({ id: p.id, kind: p.kind, thumb: p.thumb, full: p.full, hasAlpha: p.hasAlpha })),
});
export type Piece = ReturnType<typeof pieceOf>;

/** The pieces these ids name, with their photos; a deleted one is simply absent. */
export async function piecesFor(ctx: FoodCtx, ids: string[]): Promise<Record<string, Piece>> {
  const items = await itemsById(ctx, ids);
  const photos = await photosOf(ctx, [...items.keys()]);
  const out: Record<string, Piece> = {};
  for (const item of items.values()) out[item.id] = pieceOf(item, photos.get(item.id) ?? []);
  return out;
}

const idsOf = (looks: { canvas: Canvas }[]) => looks.flatMap((l) => l.canvas.items.map((i) => i.itemId));

export async function listLooks(ctx: FoodCtx, owner?: string) {
  const who = await resolveOwner(ctx, owner);
  const { rows } = await ctx.db.query<LookRow>(
    `${SELECT} WHERE l.household_id = $1 ${who === 'all' ? '' : 'AND l.owner_id = $2'}
      ORDER BY l.updated_at DESC`,
    who === 'all' ? [ctx.actor.householdId] : [ctx.actor.householdId, who],
  );
  const looks = rows.map(toLook);
  return { looks, pieces: await piecesFor(ctx, idsOf(looks)) };
}

export async function findLook(ctx: FoodCtx, id: string): Promise<Look> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That look isn’t here');
  const { rows } = await ctx.db.query<LookRow>(`${SELECT} WHERE l.id = $1 AND l.household_id = $2`, [
    id,
    ctx.actor.householdId,
  ]);
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That look isn’t here');
  return toLook(rows[0]);
}

export async function lookDetail(ctx: FoodCtx, id: string) {
  const look = await findLook(ctx, id);
  return { look, pieces: await piecesFor(ctx, idsOf([look])) };
}

/** Where a kind of piece goes when Claude (or a shuffle) lays out a look: a person, roughly. */
const SPOTS: Record<string, [number, number, number]> = {
  outerwear: [0.62, 0.3, 1.05],
  tops: [0.4, 0.3, 0.95],
  dresses: [0.42, 0.42, 1.25],
  formal: [0.4, 0.32, 1],
  sport: [0.4, 0.32, 0.95],
  swimwear: [0.4, 0.36, 0.8],
  underwear: [0.4, 0.36, 0.8],
  bottoms: [0.42, 0.64, 1.05],
  shoes: [0.42, 0.9, 0.6],
  bags: [0.8, 0.62, 0.7],
  accessories: [0.8, 0.2, 0.5],
  jewellery: [0.82, 0.38, 0.4],
  other: [0.5, 0.5, 0.8],
};

export function autoLayout(items: Item[]): Canvas {
  const used = new Map<string, number>();
  return {
    v: 1,
    items: items.map((item, index) => {
      const spot = SPOTS[item.category || 'other'] ?? SPOTS.other!;
      const n = used.get(item.category) ?? 0;
      used.set(item.category, n + 1);
      return {
        itemId: item.id,
        x: Math.min(0.9, spot[0] + n * 0.08),
        y: Math.min(0.94, spot[1] + n * 0.06),
        scale: spot[2],
        rotation: 0,
        z: index,
        label: item.name,
        category: item.category,
      };
    }),
  };
}

/** Writes each piece's current name into the canvas, so a deleted piece keeps its name there. */
async function labelled(ctx: FoodCtx, canvas: Canvas): Promise<Canvas> {
  const items = await itemsById(ctx, canvas.items.map((i) => i.itemId));
  return {
    v: 1,
    items: canvas.items.map((entry) => {
      const item = items.get(entry.itemId);
      return item ? { ...entry, label: item.name, category: item.category } : entry;
    }),
  };
}

async function checkBackdrop(ctx: FoodCtx, lookId: string | null, backdrop: Backdrop | undefined) {
  if (!backdrop?.photoId) return;
  const { rows } = await ctx.db.query(
    "SELECT 1 FROM closet_photos WHERE id = $1 AND household_id = $2 AND kind = 'backdrop' AND look_id IS NOT DISTINCT FROM $3",
    [backdrop.photoId, ctx.actor.householdId, lookId],
  );
  if (!rows[0]) throw new AppError(400, 'VALIDATION', 'No picture');
}

export async function addLook(ctx: FoodCtx, input: LookInput) {
  const ownerId = input.ownerId ?? ctx.actor.userId;
  await checkPerson(ctx, ownerId);
  let canvas = input.canvas;
  if (!canvas && input.itemIds?.length) {
    const items = await itemsById(ctx, input.itemIds);
    canvas = autoLayout(input.itemIds.map((id) => items.get(id)).filter((i): i is Item => Boolean(i)));
  }
  canvas = await labelled(ctx, canvas ?? { v: 1, items: [] });
  const backdrop = input.backdrop?.photoId ? { kind: 'studio' as const } : (input.backdrop ?? { kind: 'studio' as const });
  const id = randomUUID();
  await ctx.db.query(
    `INSERT INTO closet_looks (id, household_id, owner_id, name, canvas, backdrop, seasons, occasions,
       notes, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      ctx.actor.householdId,
      ownerId,
      input.name ?? '',
      JSON.stringify(canvas),
      JSON.stringify(backdrop),
      input.seasons ?? [],
      input.occasions ?? [],
      input.notes ?? '',
      ctx.now,
    ],
  );
  return lookDetail(ctx, id);
}

export async function updateLook(ctx: FoodCtx, id: string, patch: LookPatch) {
  await findLook(ctx, id);
  await checkBackdrop(ctx, id, patch.backdrop);
  const columns: [string, unknown][] = [];
  if (patch.name !== undefined) columns.push(['name', patch.name]);
  if (patch.canvas !== undefined) columns.push(['canvas', JSON.stringify(await labelled(ctx, patch.canvas))]);
  if (patch.backdrop !== undefined) columns.push(['backdrop', JSON.stringify(patch.backdrop)]);
  if (patch.seasons !== undefined) columns.push(['seasons', patch.seasons]);
  if (patch.occasions !== undefined) columns.push(['occasions', patch.occasions]);
  if (patch.notes !== undefined) columns.push(['notes', patch.notes]);
  await ctx.db.query(
    `UPDATE closet_looks SET ${columns.map(([column], i) => `${column} = $${i + 1}`).join(', ')},
       updated_at = $${columns.length + 1} WHERE id = $${columns.length + 2}`,
    [...columns.map(([, value]) => value), ctx.now, id],
  );
  return lookDetail(ctx, id);
}

/** A copy to change: same pieces and backdrop (a photo backdrop stays with the original). */
export async function cloneLook(ctx: FoodCtx, id: string) {
  const look = await findLook(ctx, id);
  return addLook(ctx, {
    name: look.name,
    canvas: look.canvas,
    backdrop: look.backdrop.photoId ? { kind: 'studio' } : { kind: look.backdrop.kind, tone: look.backdrop.tone },
    seasons: look.seasons as LookInput['seasons'],
    occasions: look.occasions as LookInput['occasions'],
    notes: look.notes,
    ownerId: look.ownerId,
  });
}

export async function removeLook(ctx: FoodCtx, id: string) {
  await findLook(ctx, id);
  // Days worn keep their pieces; they just no longer name the look.
  await ctx.db.query('DELETE FROM closet_looks WHERE id = $1', [id]);
}

/** The look's own photo as its backdrop. */
export async function setBackdropPhoto(ctx: FoodCtx, id: string, image: string) {
  const look = await findLook(ctx, id);
  const photo = await addBackdrop(ctx, id, image);
  await ctx.db.query('UPDATE closet_looks SET backdrop = $2, updated_at = $3 WHERE id = $1', [
    id,
    JSON.stringify({ kind: 'photo', photoId: photo.id, ...(look.backdrop.tone ? { tone: look.backdrop.tone } : {}) }),
    ctx.now,
  ]);
  return lookDetail(ctx, id);
}
