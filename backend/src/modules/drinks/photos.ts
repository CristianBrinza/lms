import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { isUuid } from '../users';
import { findDrink, photoUrl } from './drinks';
import type { PhotoInput, PHOTO_KINDS } from './schemas';

/**
 * Label photos, kept small: every upload is re-encoded by vipsthumbnail (in the production image)
 * to a WebP of at most 1600 px and a 480 px thumb, both stored in Postgres next to the drink, so a
 * backup has them and nothing lives on disk. Without vips (tests, a dev machine) a small JPEG, PNG
 * or WebP is kept as it came; anything bigger is refused rather than stored huge.
 */

type PhotoKind = (typeof PHOTO_KINDS)[number];

const run = promisify(execFile);
const MAX_UPLOAD = 12 * 1024 * 1024;
const MAX_AS_IS = 1.5 * 1024 * 1024;
/** One thread per photo: the server is small and shared (the API container has 1 GB). */
const VIPS_ENV = { ...process.env, VIPS_CONCURRENCY: '1' };

let vipsPath: Promise<string | null> | null = null;
/** Where vipsthumbnail is, looked up once (PATH can't change while the server runs). */
function findVips(): Promise<string | null> {
  vipsPath ??= (async () => {
    for (const dir of (process.env.PATH ?? '').split(delimiter).filter(Boolean)) {
      const path = join(dir, 'vipsthumbnail');
      try {
        await access(path, constants.X_OK);
        return path;
      } catch {
        // not in this one
      }
    }
    return null;
  })();
  return vipsPath;
}

/** One photo at a time: the server has two cores, and a 12 MB HEIC keeps one busy for a while. */
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

type Mime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic' | 'image/avif';

/** What the bytes really are, by their first bytes (never by the label the client put on them). */
export function sniff(bytes: Buffer): Mime | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png';
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp';
  if (bytes.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(brand))
      return 'image/heic';
  }
  return null;
}

/** A data URL or bare base64 → the bytes and what they are. */
export function decodePhoto(image: string): { bytes: Buffer; mime: Mime } {
  const match = /^data:([\w/+.-]+);base64,(.*)$/s.exec(image.trim());
  const base64 = (match ? match[2]! : image).replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw new AppError(400, 'VALIDATION', 'Use a JPEG, PNG, WebP or HEIC photo', {
      fields: { image: 'Not a picture' },
    });
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length > MAX_UPLOAD)
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That photo is too large', {
      fields: { image: 'Too large' },
    });
  const mime = sniff(bytes);
  if (!mime)
    throw new AppError(400, 'VALIDATION', 'Use a JPEG, PNG, WebP or HEIC photo', {
      fields: { image: 'Not a picture' },
    });
  return { bytes, mime };
}

/** Width and height from the file's header (PNG, JPEG, WebP); null when it can't tell. */
export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  try {
    const mime = sniff(bytes);
    if (mime === 'image/png') return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (mime === 'image/webp') {
      const chunk = bytes.subarray(12, 16).toString('latin1');
      if (chunk === 'VP8 ')
        return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff };
      if (chunk === 'VP8L') {
        const [b0, b1, b2, b3] = [bytes[21]!, bytes[22]!, bytes[23]!, bytes[24]!];
        return {
          width: 1 + (((b1 & 0x3f) << 8) | b0),
          height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        };
      }
      if (chunk === 'VP8X')
        return { width: 1 + bytes.readUIntLE(24, 3), height: 1 + bytes.readUIntLE(27, 3) };
      return null;
    }
    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) return null;
        const marker = bytes[offset + 1]!;
        const length = bytes.readUInt16BE(offset + 2);
        // Start of frame (any but DHT, JPG and DAC, which share the range).
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
        offset += 2 + length;
      }
    }
  } catch {
    // a truncated header
  }
  return null;
}

interface Encoded {
  mime: string;
  full: Buffer;
  thumb: Buffer;
  width: number | null;
  height: number | null;
}

async function shrink(vips: string, bytes: Buffer, mime: Mime): Promise<Encoded> {
  const dir = await mkdtemp(join(tmpdir(), 'lms-drink-'));
  try {
    const source = join(dir, `in.${mime.split('/')[1]}`);
    const full = join(dir, 'full.webp');
    const thumb = join(dir, 'thumb.webp');
    await writeFile(source, bytes);
    // ">" only ever shrinks; vipsthumbnail turns the picture upright by its EXIF and strips it.
    await run(vips, [source, '--size', '1600x1600>', '-o', `${full}[Q=78,strip]`], {
      timeout: 120_000,
      env: VIPS_ENV,
    });
    await run(vips, [full, '--size', '480x480>', '-o', `${thumb}[Q=78,strip]`], {
      timeout: 60_000,
      env: VIPS_ENV,
    });
    const out = await readFile(full);
    const size = imageSize(out);
    return {
      mime: 'image/webp',
      full: out,
      thumb: await readFile(thumb),
      width: size?.width ?? null,
      height: size?.height ?? null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, 'VALIDATION', 'That photo couldn’t be read', {
      fields: { image: 'Not a picture' },
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * An SVG drawing as a transparent PNG about 1600 px on the long side (librsvg through vips).
 * The caller has already checked the SVG is safe.
 */
export async function rasterizeSvg(bytes: Buffer): Promise<Buffer> {
  const vips = await findVips();
  if (!vips)
    throw new AppError(501, 'UNAVAILABLE', 'Vector drawings need the image tools on the server');
  return oneAtATime(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lms-svg-'));
    try {
      const source = join(dir, 'in.svg');
      const out = join(dir, 'out.png');
      await writeFile(source, bytes);
      await run(vips, [source, '--size', '1600x1600', '-o', out], { timeout: 120_000, env: VIPS_ENV });
      return await readFile(out);
    } catch {
      throw new AppError(400, 'VALIDATION', 'That drawing couldn’t be read', {
        fields: { image: 'Not a drawing' },
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
}

/** The upload as it will be stored: shrunk by vips, or kept as is when that's small and plain. */
export async function encodePhoto(bytes: Buffer, mime: Mime): Promise<Encoded> {
  const vips = await findVips();
  if (vips) return oneAtATime(() => shrink(vips, bytes, mime));
  const plain = mime === 'image/jpeg' || mime === 'image/png' || mime === 'image/webp';
  if (!plain || bytes.length > MAX_AS_IS)
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That photo is too large', {
      fields: { image: 'Too large' },
    });
  const size = imageSize(bytes);
  return { mime, full: bytes, thumb: bytes, width: size?.width ?? null, height: size?.height ?? null };
}

interface PhotoRow {
  id: string;
  drink_id: string;
  tasting_id: string | null;
  position: number;
  kind: PhotoKind;
  width: number | null;
  height: number | null;
  bytes: number;
  created_at: Date;
}

const toPhoto = (row: PhotoRow) => ({
  id: row.id,
  tastingId: row.tasting_id,
  kind: row.kind,
  width: row.width,
  height: row.height,
  bytes: row.bytes,
  thumb: photoUrl(row.id, 'thumb'),
  full: photoUrl(row.id, 'full'),
  createdAt: row.created_at.toISOString(),
});
export type Photo = ReturnType<typeof toPhoto>;

const PHOTO_COLUMNS =
  'p.id, p.drink_id, p.tasting_id, p.position, p.kind, p.width, p.height, p.bytes, p.created_at';

/** A drink's photos: the bottle's first (the first is the cover), then each tasting's. */
export async function drinkPhotos(ctx: FoodCtx, drinkId: string) {
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${PHOTO_COLUMNS} FROM drink_photos p WHERE p.drink_id = $1
      ORDER BY (p.tasting_id IS NOT NULL), p.position, p.created_at`,
    [drinkId],
  );
  return rows.map(toPhoto);
}

async function findPhoto(ctx: FoodCtx, id: string): Promise<PhotoRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<PhotoRow>(
    `SELECT ${PHOTO_COLUMNS} FROM drink_photos p JOIN drinks d ON d.id = p.drink_id
      WHERE p.id = $1 AND d.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}

export async function addPhoto(ctx: FoodCtx, drinkId: string, input: PhotoInput) {
  await findDrink(ctx, drinkId);
  if (input.tastingId) {
    const { rows } = await ctx.db.query(
      'SELECT 1 FROM drink_tastings WHERE id = $1 AND drink_id = $2',
      [input.tastingId, drinkId],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'That tasting isn’t in the journal');
  }
  const { bytes, mime } = decodePhoto(input.image);
  const encoded = await encodePhoto(bytes, mime);
  const id = randomUUID();
  await ctx.tx(async (tx) => {
    const { rows } = await tx.db.query<{ high: number | null }>(
      `SELECT max(position) AS high FROM drink_photos
        WHERE drink_id = $1 AND tasting_id IS NOT DISTINCT FROM $2`,
      [drinkId, input.tastingId ?? null],
    );
    await tx.db.query(
      `INSERT INTO drink_photos (id, drink_id, tasting_id, position, kind, mime, "full", thumb, width,
         height, bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        drinkId,
        input.tastingId ?? null,
        (rows[0]?.high ?? -1) + 1,
        input.kind ?? (input.tastingId ? 'other' : 'front'),
        encoded.mime,
        encoded.full,
        encoded.thumb,
        encoded.width,
        encoded.height,
        encoded.full.length + (encoded.thumb === encoded.full ? 0 : encoded.thumb.length),
        tx.now,
      ],
    );
    await tx.db.query('UPDATE drinks SET updated_at = $2 WHERE id = $1', [drinkId, tx.now]);
  });
  return { photo: toPhoto(await findPhoto(ctx, id)) };
}

/** A photo's kind, or makes it the cover (first of the bottle's photos). */
export async function updatePhoto(
  ctx: FoodCtx,
  id: string,
  patch: { kind?: PhotoKind; cover?: true },
) {
  const row = await findPhoto(ctx, id);
  if (patch.kind) await ctx.db.query('UPDATE drink_photos SET kind = $2 WHERE id = $1', [id, patch.kind]);
  if (patch.cover)
    await ctx.db.query(
      `UPDATE drink_photos SET position = (
          SELECT coalesce(min(position), 0) - 1 FROM drink_photos
           WHERE drink_id = $2 AND tasting_id IS NOT DISTINCT FROM $3
        ) WHERE id = $1`,
      [id, row.drink_id, row.tasting_id],
    );
  return { photo: toPhoto(await findPhoto(ctx, id)) };
}

export async function removePhoto(ctx: FoodCtx, id: string) {
  await findPhoto(ctx, id);
  await ctx.db.query('DELETE FROM drink_photos WHERE id = $1', [id]);
}

/** The picture's bytes for the household: the full one or its thumb. */
export async function photoBytes(ctx: FoodCtx, id: string, size: 'full' | 'thumb') {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No picture');
  const { rows } = await ctx.db.query<{ mime: string; data: Buffer }>(
    `SELECT p.mime, ${size === 'full' ? 'p."full"' : 'p.thumb'} AS data
       FROM drink_photos p JOIN drinks d ON d.id = p.drink_id
      WHERE p.id = $1 AND d.household_id = $2`,
    [id, ctx.actor.householdId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No picture');
  return rows[0];
}
