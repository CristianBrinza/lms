import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { decodePhoto, encodePhoto, imageSize } from '../drinks/photos';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { findMedicine, photoUrl } from './cabinet';
import type { PHOTO_KINDS, PhotoInput } from './schemas';

/**
 * A medicine's photos (the box, the blister, the leaflet), shrunk on upload by the same helpers as
 * the drinks' labels and the closet's pieces: WebP, 1600 px and a 480 px thumb, kept in Postgres.
 */

/** A picture bigger than this is refused before it's decoded. */
const MAX_PIXELS = 50_000_000;

interface PhotoRow {
  id: string;
  medicine_id: string;
  position: number;
  kind: (typeof PHOTO_KINDS)[number];
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: Date;
}

const toPhoto = (row: PhotoRow) => ({
  id: row.id,
  kind: row.kind,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  thumb: photoUrl(row.id, 'thumb'),
  full: photoUrl(row.id, 'full'),
  createdAt: row.created_at.toISOString(),
});
export type Photo = ReturnType<typeof toPhoto>;

const COLUMNS = 'p.id, p.medicine_id, p.position, p.kind, p.width, p.height, p.bytes, p.created_at';

export async function medicinePhotos(ctx: FoodCtx, medicineId: string) {
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${COLUMNS} FROM medication_photos p WHERE p.medicine_id = $1 AND p.household_id = $2
      ORDER BY p.position, p.created_at`,
    [medicineId, ctx.actor.householdId],
  );
  return rows.map(toPhoto);
}

async function findPhoto(ctx: FoodCtx, id: string): Promise<PhotoRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${COLUMNS} FROM medication_photos p WHERE p.id = $1 AND p.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}

export async function addPhoto(ctx: FoodCtx, medicineId: string, input: PhotoInput) {
  await findMedicine(ctx, medicineId);
  const { bytes, mime } = decodePhoto(input.image);
  const dims = imageSize(bytes);
  if (dims && dims.width * dims.height > MAX_PIXELS)
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That photo is too large', {
      fields: { image: 'Too large' },
    });
  const encoded = await encodePhoto(bytes, mime);
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<{ high: number | null }>(
      'SELECT max(position) AS high FROM medication_photos WHERE medicine_id = $1',
      [medicineId],
    );
    await tx.db.query(
      `INSERT INTO medication_photos (id, household_id, medicine_id, position, kind, mime, "full", thumb,
         width, height, bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        ctx.actor.householdId,
        medicineId,
        (rows[0]?.high ?? -1) + 1,
        input.kind ?? 'front',
        encoded.mime,
        encoded.full,
        encoded.thumb,
        encoded.width,
        encoded.height,
        encoded.full.length + (encoded.thumb === encoded.full ? 0 : encoded.thumb.length),
        tx.now,
      ],
    );
    await tx.db.query('UPDATE medication_medicines SET updated_at = $2 WHERE id = $1', [medicineId, tx.now]);
  });
  return { photo: toPhoto(await findPhoto(ctx, id)) };
}

/** A photo's kind, or makes it the cover (first of the medicine's photos). */
export async function updatePhoto(
  ctx: FoodCtx,
  id: string,
  patch: { kind?: (typeof PHOTO_KINDS)[number]; cover?: true },
) {
  const row = await findPhoto(ctx, id);
  if (patch.kind) await ctx.db.query('UPDATE medication_photos SET kind = $2 WHERE id = $1', [id, patch.kind]);
  if (patch.cover)
    await ctx.db.query(
      `UPDATE medication_photos SET position = (
          SELECT coalesce(min(position), 0) - 1 FROM medication_photos WHERE medicine_id = $2
        ) WHERE id = $1`,
      [id, row.medicine_id],
    );
  return { photo: toPhoto(await findPhoto(ctx, id)) };
}

export async function removePhoto(ctx: FoodCtx, id: string) {
  await findPhoto(ctx, id);
  await ctx.db.query('DELETE FROM medication_photos WHERE id = $1', [id]);
}

export async function photoBytes(ctx: FoodCtx, id: string, size: 'full' | 'thumb') {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<{ mime: string; data: Buffer }>(
    `SELECT p.mime, ${size === 'full' ? 'p."full"' : 'p.thumb'} AS data
       FROM medication_photos p WHERE p.id = $1 AND p.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}
