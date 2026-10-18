import { storage } from '@/lib/storage';
import { nearestColor, type ClosetColor } from './catalog';
import { refineCutout, type Raster } from './refine';
import { autoDeskew } from './straighten';

/**
 * Photos of pieces, all in the browser: turned upright and shrunk, the background lifted off (the
 * model is loaded only on the cut-out screen, see cutout.ts), cropped to the piece with a little air,
 * its main colours named, and sent as WebP (transparency kept). Nothing leaves the phone but the
 * finished picture.
 */

const MAX_SIDE = 1600;
const MODEL_KEY = 'lms:closet-cutout-model';

export interface Prepared {
  /** The photo upright and at most 1600 px, as a blob the cut-out takes. */
  blob: Blob;
  width: number;
  height: number;
  url: string;
}

function canvas(width: number, height: number) {
  const node = document.createElement('canvas');
  node.width = width;
  node.height = height;
  return node;
}

const toBlob = (node: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob | null>((resolve) => node.toBlob(resolve, type, quality));

export const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });

/** A phone photo, upright and at most 1600 px on its long side. */
export async function preparePhoto(file: Blob): Promise<Prepared> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const node = canvas(width, height);
    node.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
    const blob = (await toBlob(node, 'image/jpeg', 0.92)) ?? file;
    return { blob, width, height, url: URL.createObjectURL(blob) };
  } finally {
    bitmap.close();
  }
}

/** The box around every pixel at least this opaque, or null when nothing is. */
export function alphaBox(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  threshold = 24,
): { x: number; y: number; w: number; h: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * The main colours of the piece: its opaque pixels (the middle of the photo when there's no
 * transparency), grouped by k-means, named by the nearest closet colour; the biggest first, each
 * named once, only those covering a real share.
 */
export function dominantColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  opaqueOnly: boolean,
): ClosetColor[] {
  const samples: [number, number, number][] = [];
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 5000)));
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      if (!opaqueOnly && (x < width * 0.2 || x > width * 0.8 || y < height * 0.2 || y > height * 0.8)) continue;
      const i = (y * width + x) * 4;
      if (opaqueOnly && data[i + 3]! < 200) continue;
      samples.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
  if (!samples.length) return [];
  const k = Math.min(4, samples.length);
  let centres = Array.from({ length: k }, (_, n) => samples[Math.floor(((n + 0.5) * samples.length) / k)]!);
  let counts = new Array<number>(k).fill(0);
  for (let round = 0; round < 8; round++) {
    const sums = centres.map(() => [0, 0, 0] as [number, number, number]);
    counts = new Array<number>(k).fill(0);
    for (const s of samples) {
      let best = 0;
      let distance = Infinity;
      centres.forEach((c, n) => {
        const d = (s[0] - c[0]) ** 2 + (s[1] - c[1]) ** 2 + (s[2] - c[2]) ** 2;
        if (d < distance) {
          distance = d;
          best = n;
        }
      });
      counts[best]!++;
      sums[best]![0] += s[0];
      sums[best]![1] += s[1];
      sums[best]![2] += s[2];
    }
    centres = centres.map((c, n) =>
      counts[n] ? [sums[n]![0]! / counts[n]!, sums[n]![1]! / counts[n]!, sums[n]![2]! / counts[n]!] : c,
    );
  }
  const named = new Map<ClosetColor, number>();
  centres.forEach((c, n) => {
    const name = nearestColor(c[0], c[1], c[2]);
    named.set(name, (named.get(name) ?? 0) + counts[n]!);
  });
  return [...named.entries()]
    .filter(([, count]) => count / samples.length >= 0.18)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
}

export const decodeRaster = async (blob: Blob): Promise<Raster> => {
  const bitmap = await createImageBitmap(blob);
  try {
    const node = canvas(bitmap.width, bitmap.height);
    const context = node.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, node.width, node.height);
    return { data, width, height };
  } finally {
    bitmap.close();
  }
};

export async function encodeRaster(raster: Raster): Promise<Blob> {
  const node = canvas(raster.width, raster.height);
  node.getContext('2d')!.putImageData(new ImageData(raster.data as Uint8ClampedArray<ArrayBuffer>, raster.width, raster.height), 0, 0);
  const blob = await toBlob(node, 'image/png');
  if (!blob) throw new Error('png');
  return blob;
}

/**
 * The cut-out after the model: clean mask (strips of towel or bed at the edges gone), colour corrected from the original photo's background,
 * cropped, and straightened. A transparent PNG.
 */
export async function polishCutout(original: Blob, cut: Blob): Promise<Blob> {
  const [photo, mask] = await Promise.all([decodeRaster(original), decodeRaster(cut)]);
  const refined = autoDeskew(refineCutout(mask, photo));
  return encodeRaster(refined);
}

export interface Finished {
  dataUrl: string;
  previewUrl: string;
  colors: ClosetColor[];
  hasAlpha: boolean;
}

/**
 * The picture to upload: a cut-out cropped to the piece (6% air around it), or the photo as it
 * was; WebP when the browser can write it (PNG for a cut-out otherwise, JPEG for a photo).
 */
export async function finish(source: Blob, cutout: boolean): Promise<Finished> {
  const bitmap = await createImageBitmap(source);
  try {
    const full = canvas(bitmap.width, bitmap.height);
    const context = full.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, full.width, full.height);
    let out = full;
    let colorsFrom = pixels;
    if (cutout) {
      const box = alphaBox(pixels.data, full.width, full.height);
      if (box) {
        const pad = Math.round(Math.max(box.w, box.h) * 0.06);
        const w = box.w + pad * 2;
        const h = box.h + pad * 2;
        out = canvas(w, h);
        out.getContext('2d')!.drawImage(full, box.x, box.y, box.w, box.h, pad, pad, box.w, box.h);
        colorsFrom = out.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h);
      }
    }
    const colors = dominantColors(colorsFrom.data, colorsFrom.width, colorsFrom.height, cutout);
    let blob = await toBlob(out, 'image/webp', 0.86);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(out, cutout ? 'image/png' : 'image/jpeg', 0.88);
    const finalBlob = blob ?? source;
    return {
      dataUrl: await readAsDataUrl(finalBlob),
      previewUrl: URL.createObjectURL(finalBlob),
      colors,
      hasAlpha: cutout,
    };
  } finally {
    bitmap.close();
  }
}

/** Whether this device already has the cut-out model (so the first-download note can stay quiet). */
export const modelReady = () => storage.get(MODEL_KEY) === '1';
export const markModelReady = () => storage.set(MODEL_KEY, '1');

/**
 * The matte of a stored photo from the server: BiRefNet on a free Hugging Face Space, a cut-out
 * PNG at the photo's full size. Null when the server or the Space can't do it right now.
 */
async function serverCutOut(photoId: string): Promise<Blob | null> {
  try {
    const response = await fetch(`/api/closet/photos/${photoId}/matte`, {
      method: 'POST',
      credentials: 'same-origin',
      signal: AbortSignal.timeout(130_000),
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.type === 'image/png' && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Lifts the piece off its background. A stored photo (`photoId`) goes to the server's BiRefNet
 * first; when that fails, or for a photo not uploaded yet, the browser's own model does it. The
 * library and model are fetched only the first time (a separate chunk) and cached after that.
 */
export async function cutOut(
  source: Blob,
  onProgress: (fraction: number) => void,
  photoId?: string,
): Promise<Blob> {
  if (photoId) {
    const matte = await serverCutOut(photoId);
    if (matte) return matte;
  }
  const { removeBackground } = await import('./cutout');
  const blob = await removeBackground(source, onProgress);
  markModelReady();
  return blob;
}
