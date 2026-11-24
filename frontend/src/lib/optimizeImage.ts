/**
 * Every photo upload goes through here, so a 20–50 MB phone or camera picture still uploads. In the
 * browser, before anything is sent:
 * - the picture is turned upright by its EXIF;
 * - it's sent as it came when it already fits (size, long edge and a format the server reads);
 * - otherwise the long edge is capped by use (avatars 2048 px, other photos 4000 px, never
 *   enlarged), and it's encoded as WebP, or JPEG where the browser can't write WebP (PNG only for
 *   a transparent picture), at the highest quality between 0.98 and 0.6 that fits;
 * - when even 0.6 is too big, it's scaled by 0.85 and searched again.
 * A format the browser can't draw (HEIC on most desktops) goes as it is, up to MAX_RAW: the server
 * converts it with libvips and still checks the result's size.
 */

/** The most an upload may weigh after this: the app's limit. */
export const UPLOAD_LIMIT = 8 * 1024 * 1024;
/** A picture the browser can't read goes as it came, up to this (the server converts it). */
export const MAX_RAW = 45 * 1024 * 1024;
export const MAX_SIDE = { avatar: 2048, photo: 4000 } as const;

const QUALITY_TOP = 0.98;
const QUALITY_FLOOR = 0.6;
const STEP = 0.85;

export class PhotoTooLarge extends Error {}

export interface Sized {
  size: number;
}

export interface Fitted<T> {
  out: T;
  width: number;
  height: number;
  quality: number;
}

/**
 * The search, apart from the browser so it can be tested: `encode` makes the picture at a size and a
 * quality; the answer is the largest size, then the highest quality, that fits `maxBytes`.
 */
export async function fitToLimit<T extends Sized>(
  width: number,
  height: number,
  encode: (width: number, height: number, quality: number) => Promise<T>,
  { maxSide, maxBytes = UPLOAD_LIMIT, lossy = true }: { maxSide: number; maxBytes?: number; lossy?: boolean },
): Promise<Fitted<T>> {
  let scale = Math.min(1, maxSide / Math.max(width, height));
  for (let round = 0; round < 20; round++) {
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const top = await encode(w, h, lossy ? QUALITY_TOP : 1);
    if (top.size <= maxBytes) return { out: top, width: w, height: h, quality: lossy ? QUALITY_TOP : 1 };
    if (lossy) {
      const floor = await encode(w, h, QUALITY_FLOOR);
      if (floor.size <= maxBytes) {
        let best = { out: floor, quality: QUALITY_FLOOR };
        let low = QUALITY_FLOOR;
        let high = QUALITY_TOP;
        while (high - low > 0.02) {
          const quality = Math.round(((low + high) / 2) * 1000) / 1000;
          const out = await encode(w, h, quality);
          if (out.size <= maxBytes) {
            best = { out, quality };
            low = quality;
          } else high = quality;
        }
        return { ...best, width: w, height: h };
      }
    }
    if (w === 1 && h === 1) break;
    scale *= STEP;
  }
  throw new PhotoTooLarge();
}

let webp: Promise<boolean> | null = null;
/** Whether this browser writes WebP (Safari before 17 quietly gives PNG instead). */
function writesWebp(): Promise<boolean> {
  webp ??= new Promise((resolve) => {
    const node = document.createElement('canvas');
    node.width = node.height = 1;
    node.toBlob((blob) => resolve(blob?.type === 'image/webp'), 'image/webp', 0.9);
  });
  return webp;
}

/** Whether any pixel is see-through, checked on a small copy. */
function transparent(bitmap: ImageBitmap): boolean {
  const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
  const node = document.createElement('canvas');
  node.width = Math.max(1, Math.round(bitmap.width * scale));
  node.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = node.getContext('2d', { willReadFrequently: true });
  if (!context) return false;
  context.drawImage(bitmap, 0, 0, node.width, node.height);
  const { data } = context.getImageData(0, 0, node.width, node.height);
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 255) return true;
  return false;
}

export interface Optimized {
  blob: Blob;
  /** False when the picture went as it came. */
  optimized: boolean;
}

/**
 * The picture to upload, at most `maxBytes` (or as it came, for a format the browser can't draw).
 * `onWork` runs when a picture needs shrinking, for the "Optimizing photo…" note.
 */
export async function optimizeImage(
  file: Blob,
  { maxSide = MAX_SIDE.photo, maxBytes = UPLOAD_LIMIT, onWork }: { maxSide?: number; maxBytes?: number; onWork?: () => void } = {},
): Promise<Optimized> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (file.size > MAX_RAW) throw new PhotoTooLarge();
    return { blob: file, optimized: false };
  }
  try {
    const plain = /^image\/(jpeg|png|webp)$/.test(file.type);
    if (plain && file.size <= maxBytes && Math.max(bitmap.width, bitmap.height) <= maxSide)
      return { blob: file, optimized: false };
    if (file.size > maxBytes) onWork?.();
    const alpha = file.type !== 'image/jpeg' && transparent(bitmap);
    const type = (await writesWebp()) ? 'image/webp' : alpha ? 'image/png' : 'image/jpeg';
    const node = document.createElement('canvas');
    const context = node.getContext('2d');
    if (!context) throw new Error('no canvas');
    const encode = async (width: number, height: number, quality: number) => {
      if (node.width !== width || node.height !== height) {
        node.width = width;
        node.height = height;
        context.imageSmoothingQuality = 'high';
        if (type === 'image/jpeg') {
          context.fillStyle = '#fff';
          context.fillRect(0, 0, width, height);
        }
        context.drawImage(bitmap, 0, 0, width, height);
      }
      const blob = await new Promise<Blob | null>((resolve) => node.toBlob(resolve, type, quality));
      if (!blob) throw new Error('encode failed');
      return blob;
    };
    const fitted = await fitToLimit(bitmap.width, bitmap.height, encode, {
      maxSide,
      maxBytes,
      lossy: type !== 'image/png',
    });
    return { blob: fitted.out, optimized: true };
  } finally {
    bitmap.close();
  }
}

export const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });
