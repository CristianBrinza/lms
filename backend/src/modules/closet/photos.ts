import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { decodePhoto, encodePhoto, imageSize, sniff } from '../drinks/photos';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { findItem, photoUrl } from './items';
import type { PHOTO_KINDS, PhotoInput, PhotoKind } from './schemas';

/**
 * A piece's photos: front, back, the care label, details; and a look's own backdrop. Each upload
 * is re-encoded like the drinks' label photos (WebP, 1600 px and a 480 px thumb, in Postgres),
 * transparency kept, so a cut-out stays a cut-out.
 *
 * Photos sent from a chat still have their background: they're flagged needsCutout, and the app
 * offers "Remove background", which runs in the browser and uploads the cut-out with `replaces`.
 * The cut-out takes the original's place; the original is kept (superseded) and comes back if the
 * cut-out is deleted.
 */

/** Past this the household is warned; past the hard cap new photos are refused. */
export const STORAGE_WARN = 1024 ** 3;
export const STORAGE_MAX = 2 * 1024 ** 3;
/** A picture bigger than this is refused before it's decoded (a 50 MP photo is ~200 MB raw). */
const MAX_PIXELS = 50_000_000;

/** The household's closet photo bytes, and whether that's past the warning. */
export async function photoStorage(ctx: FoodCtx) {
  const { rows } = await ctx.db.query<{ bytes: string }>(
    'SELECT coalesce(sum(bytes), 0)::text AS bytes FROM closet_photos WHERE household_id = $1',
    [ctx.actor.householdId],
  );
  const bytes = Number(rows[0]?.bytes ?? 0);
  return { bytes, warn: bytes >= STORAGE_WARN, full: bytes >= STORAGE_MAX };
}

/** Whether the picture has an alpha channel (PNG with alpha or tRNS, WebP with alpha). */
export function hasAlpha(bytes: Buffer): boolean {
  try {
    const mime = sniff(bytes);
    if (mime === 'image/png') {
      const colorType = bytes[25];
      if (colorType === 4 || colorType === 6) return true;
      return bytes.includes(Buffer.from('tRNS', 'latin1'));
    }
    if (mime === 'image/webp') {
      const chunk = bytes.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8X') return (bytes[20]! & 0x10) !== 0;
      if (chunk === 'VP8L') return (bytes[24]! & 0x10) !== 0;
    }
  } catch {
    // a truncated header
  }
  return false;
}

interface PhotoRow {
  id: string;
  item_id: string | null;
  look_id: string | null;
  position: number;
  kind: PhotoKind;
  width: number | null;
  height: number | null;
  bytes: number;
  has_alpha: boolean;
  needs_cutout: boolean;
  cutout_of: string | null;
  superseded: boolean;
  created_at: Date;
}

export const toPhoto = (row: PhotoRow) => ({
  id: row.id,
  kind: row.kind,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  hasAlpha: row.has_alpha,
  needsCutout: row.needs_cutout,
  cutoutOf: row.cutout_of,
  superseded: row.superseded,
  thumb: photoUrl(row.id, 'thumb'),
  full: photoUrl(row.id, 'full'),
  createdAt: row.created_at.toISOString(),
});
export type Photo = ReturnType<typeof toPhoto>;

const COLUMNS = `p.id, p.item_id, p.look_id, p.position, p.kind, p.width, p.height, p.bytes,
  p.has_alpha, p.needs_cutout, p.cutout_of, p.superseded, p.created_at`;

/**
 * A piece's photos, the cover first and the label last; then the originals cut-outs replaced
 * (superseded), for "show the original".
 */
export async function itemPhotos(ctx: FoodCtx, itemId: string) {
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${COLUMNS} FROM closet_photos p WHERE p.item_id = $1 AND p.household_id = $2
      ORDER BY p.superseded, (p.kind = 'label'), p.position, p.created_at`,
    [itemId, ctx.actor.householdId],
  );
  const photos = rows.map(toPhoto);
  return { photos: photos.filter((p) => !p.superseded), originals: photos.filter((p) => p.superseded) };
}

/** Several pieces' photos at once (a look's canvas picks any of them). */
export async function photosOf(ctx: FoodCtx, itemIds: string[]) {
  const map = new Map<string, Photo[]>();
  if (!itemIds.length) return map;
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${COLUMNS} FROM closet_photos p
      WHERE p.household_id = $1 AND p.item_id = ANY ($2::uuid[]) AND NOT p.superseded AND p.kind <> 'label'
      ORDER BY p.position, p.created_at`,
    [ctx.actor.householdId, itemIds],
  );
  for (const row of rows) {
    const list = map.get(row.item_id!) ?? [];
    list.push(toPhoto(row));
    map.set(row.item_id!, list);
  }
  return map;
}

async function findPhoto(ctx: FoodCtx, id: string): Promise<PhotoRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${COLUMNS} FROM closet_photos p WHERE p.id = $1 AND p.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}

/** Stores an upload for a piece (or a look's backdrop) and returns it. */
async function store(
  ctx: FoodCtx,
  target: { itemId: string } | { lookId: string },
  image: string,
  options: { kind: PhotoKind; needsCutout?: boolean; position?: number; cutoutOf?: string | null },
) {
  const { bytes, mime } = decodePhoto(image);
  const dims = imageSize(bytes);
  if (dims && dims.width * dims.height > MAX_PIXELS)
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That photo is too large', {
      fields: { image: 'Too large' },
    });
  if ((await photoStorage(ctx)).full)
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'The closet’s photo storage is full');
  const alpha = hasAlpha(bytes);
  const encoded = await encodePhoto(bytes, mime);
  const id = randomUUID();
  const itemId = 'itemId' in target ? target.itemId : null;
  const lookId = 'lookId' in target ? target.lookId : null;
  let position = options.position;
  if (position === undefined) {
    const { rows } = await ctx.db.query<{ high: number | null }>(
      `SELECT max(position) AS high FROM closet_photos
        WHERE item_id IS NOT DISTINCT FROM $1 AND look_id IS NOT DISTINCT FROM $2`,
      [itemId, lookId],
    );
    position = (rows[0]?.high ?? -1) + 1;
  }
  // A chat's photo of the piece itself still has its background; the label and details are fine.
  const needsCutout =
    options.needsCutout ?? ((options.kind === 'front' || options.kind === 'back') && !alpha);
  await ctx.db.query(
    `INSERT INTO closet_photos (id, household_id, item_id, look_id, position, kind, mime, "full",
       thumb, width, height, bytes, has_alpha, needs_cutout, cutout_of, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
    [
      id,
      ctx.actor.householdId,
      itemId,
      lookId,
      position,
      options.kind,
      encoded.mime,
      encoded.full,
      encoded.thumb,
      encoded.width,
      encoded.height,
      encoded.full.length + (encoded.thumb === encoded.full ? 0 : encoded.thumb.length),
      alpha,
      needsCutout,
      options.cutoutOf ?? null,
      ctx.now,
    ],
  );
  return toPhoto(await findPhoto(ctx, id));
}

export async function addPhoto(ctx: FoodCtx, itemId: string, input: PhotoInput) {
  await findItem(ctx, itemId);
  let photo: Photo;
  if (input.rotates) {
    // The same photo, turned: it takes the old one's place, flags and links; the old file goes.
    const old = await findPhoto(ctx, input.rotates);
    if (old.item_id !== itemId) throw new AppError(404, 'NOT_FOUND', 'No picture');
    photo = await store(ctx, { itemId }, input.image, {
      kind: old.kind,
      needsCutout: old.needs_cutout,
      position: old.position,
      cutoutOf: old.cutout_of,
    });
    await ctx.db.query('UPDATE closet_photos SET superseded = $2 WHERE id = $1', [photo.id, old.superseded]);
    await ctx.db.query('UPDATE closet_photos SET cutout_of = $2 WHERE cutout_of = $1', [old.id, photo.id]);
    await ctx.db.query('DELETE FROM closet_photos WHERE id = $1', [old.id]);
    photo = { ...photo, superseded: old.superseded };
  } else if (input.replaces) {
    // A cut-out (or a better photo) in the original's place; the original is kept.
    const original = await findPhoto(ctx, input.replaces);
    if (original.item_id !== itemId) throw new AppError(404, 'NOT_FOUND', 'No picture');
    photo = await store(ctx, { itemId }, input.image, {
      kind: input.kind ?? (original.kind === 'backdrop' ? 'front' : original.kind),
      needsCutout: input.needsCutout ?? false,
      position: original.position,
      cutoutOf: original.id,
    });
    await ctx.db.query(
      'UPDATE closet_photos SET superseded = true, needs_cutout = false WHERE id = $1',
      [original.id],
    );
  } else {
    photo = await store(ctx, { itemId }, input.image, {
      kind: input.kind ?? 'front',
      needsCutout: input.needsCutout,
    });
  }
  await ctx.db.query('UPDATE closet_items SET updated_at = $2 WHERE id = $1', [itemId, ctx.now]);
  return { photo, storage: await photoStorage(ctx) };
}

/** A look's own backdrop photo (replacing the one it had). */
export async function addBackdrop(ctx: FoodCtx, lookId: string, image: string) {
  const { rows: old } = await ctx.db.query<{ id: string }>(
    "SELECT id FROM closet_photos WHERE look_id = $1 AND kind = 'backdrop'",
    [lookId],
  );
  const photo = await store(ctx, { lookId }, image, { kind: 'backdrop', needsCutout: false });
  if (old.length)
    await ctx.db.query('DELETE FROM closet_photos WHERE id = ANY ($1::uuid[])', [old.map((r) => r.id)]);
  return photo;
}

/** A photo's kind, the cover (first), or its "needs a cut-out" flag. */
export async function updatePhoto(
  ctx: FoodCtx,
  id: string,
  patch: { kind?: (typeof PHOTO_KINDS)[number]; cover?: true; needsCutout?: boolean },
) {
  const row = await findPhoto(ctx, id);
  if (!row.item_id) throw new AppError(404, 'NOT_FOUND', 'No picture');
  if (patch.kind) await ctx.db.query('UPDATE closet_photos SET kind = $2 WHERE id = $1', [id, patch.kind]);
  if (patch.needsCutout !== undefined)
    await ctx.db.query('UPDATE closet_photos SET needs_cutout = $2 WHERE id = $1', [id, patch.needsCutout]);
  if (patch.cover)
    await ctx.db.query(
      `UPDATE closet_photos SET position = (
          SELECT coalesce(min(position), 0) - 1 FROM closet_photos WHERE item_id = $2
        ) WHERE id = $1`,
      [id, row.item_id],
    );
  return { photo: toPhoto(await findPhoto(ctx, id)) };
}

/** Deletes a photo. Deleting a cut-out brings its original back. */
export async function removePhoto(ctx: FoodCtx, id: string) {
  const row = await findPhoto(ctx, id);
  await ctx.tx(async (tx) => {
    if (row.cutout_of)
      await tx.db.query('UPDATE closet_photos SET superseded = false WHERE id = $1', [row.cutout_of]);
    await tx.db.query('DELETE FROM closet_photos WHERE id = $1', [id]);
  });
}

/** The picture's bytes for the household: the full one or its thumb. */
export async function photoBytes(ctx: FoodCtx, id: string, size: 'full' | 'thumb') {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<{ mime: string; data: Buffer }>(
    `SELECT mime, ${size === 'full' ? '"full"' : 'thumb'} AS data FROM closet_photos
      WHERE id = $1 AND household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}
