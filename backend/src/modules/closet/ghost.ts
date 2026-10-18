import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { findVips } from '../drinks/photos';

/**
 * "3D effect" (ghost mannequin): the try-on's picture of the garment worn, cut down to the clothes
 * alone with a free clothes-parsing Space (U2-Net: upper body, lower body, full body; the face,
 * hair, skin, arms, legs and the background are none of the three), so what is left is the
 * garment in its worn shape with nobody inside. Pixel work on plain arrays, tested without vips.
 */
export const PARSING_SPACE = 'wildoctopus/cloth-segmentation';
export const PARSING_ENDPOINT = '/run';

export type Part = 'upper' | 'lower' | 'full';

/** Which parts of the parsing a category of piece keeps (null: not a garment worn on the body). */
export function partsFor(category: string): Part[] | null {
  if (category === 'tops' || category === 'outerwear') return ['upper', 'full'];
  if (category === 'bottoms') return ['lower', 'full'];
  if (category === 'dresses') return ['upper', 'lower', 'full'];
  return null;
}

/** The part a parsing pixel belongs to, by its colour (black: none; red upper, green lower, else full). */
export function partOf(r: number, g: number, b: number): Part | null {
  if (r < 48 && g < 48 && b < 48) return null;
  if (r >= g && r >= b) return 'upper';
  if (g >= r && g >= b) return 'lower';
  return 'full';
}

export interface Rgba {
  data: Uint8Array;
  width: number;
  height: number;
}

/** 4-connected blobs of a mask, big ones kept (at least `share` of the largest), the rest dropped. */
function keepBlobs(mask: Uint8Array, width: number, height: number, share: number) {
  const n = width * height;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const sizes: number[] = [0];
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    while (top) {
      const p = stack[--top]!;
      size++;
      const x = p % width;
      const visit = (q: number) => {
        if (mask[q] && !label[q]) {
          label[q] = next;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (p >= width) visit(p - width);
      if (p < n - width) visit(p + width);
    }
    sizes.push(size);
  }
  const biggest = Math.max(0, ...sizes);
  for (let p = 0; p < n; p++) if (mask[p] && sizes[label[p]!]! < biggest * share) mask[p] = 0;
}

/** Fills holes of the mask that touch no edge and are no bigger than `limit` pixels. */
function fillHoles(mask: Uint8Array, width: number, height: number, limit: number) {
  const n = width * height;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (mask[start] || seen[start]) continue;
    let top = 0;
    let count = 0;
    let edge = false;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const p = stack[--top]!;
      members[count++] = p;
      const x = p % width;
      const y = (p - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
      const visit = (q: number) => {
        if (!mask[q] && !seen[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    if (!edge && count <= limit) for (let k = 0; k < count; k++) mask[members[k]!] = 1;
  }
}

/**
 * The worn garment as RGBA: `rgb` is the try-on picture (3 bands) and `parsing` the colour map
 * (3 bands) of the same size. Keeps the wanted parts (or all clothes when those are nearly empty),
 * drops specks, fills pinholes, trims a pixel of fringe, softens the edge and crops with air.
 */
export function ghostRaster(
  rgb: Uint8Array,
  parsing: Uint8Array,
  width: number,
  height: number,
  parts: Part[],
): Rgba | null {
  const n = width * height;
  const wanted = new Uint8Array(n);
  const any = new Uint8Array(n);
  let wantedCount = 0;
  let anyCount = 0;
  for (let p = 0; p < n; p++) {
    const part = partOf(parsing[p * 3]!, parsing[p * 3 + 1]!, parsing[p * 3 + 2]!);
    if (!part) continue;
    any[p] = 1;
    anyCount++;
    if (parts.includes(part)) {
      wanted[p] = 1;
      wantedCount++;
    }
  }
  if (anyCount < n * 0.01) return null; // no clothes found
  const mask = wantedCount >= n * 0.015 ? wanted : any;
  keepBlobs(mask, width, height, 0.1);
  fillHoles(mask, width, height, Math.max(20, Math.round(n * 0.002)));
  // One pixel of fringe off (the parsing's edge sits on skin and background), then a soft edge.
  const eroded = mask.slice();
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!mask[p]) continue;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || !mask[p - 1] || !mask[p + 1] || !mask[p - width] || !mask[p + width])
        eroded[p] = 0;
    }
  const alpha = new Uint8Array(n);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let cells = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy;
          const xx = x + dx;
          if (yy < 0 || yy >= height || xx < 0 || xx >= width) continue;
          sum += eroded[yy * width + xx]!;
          cells++;
        }
      alpha[y * width + x] = Math.round((sum / cells) * 255);
    }
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return null;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const air = Math.round(Math.max(w, h) * 0.04);
  const outW = w + air * 2;
  const outH = h + air * 2;
  const out = new Uint8Array(outW * outH * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = (minY + y) * width + minX + x;
      const to = ((y + air) * outW + x + air) * 4;
      out[to] = rgb[from * 3]!;
      out[to + 1] = rgb[from * 3 + 1]!;
      out[to + 2] = rgb[from * 3 + 2]!;
      out[to + 3] = alpha[from]!;
    }
  return { data: out, width: outW, height: outH };
}

// ------------------------------------------------------------------ vips

const run = promisify(execFile);
const ENV = { ...process.env, VIPS_CONCURRENCY: '1' };

const vipsBinary = async () => join(dirname((await findVips()) ?? ''), 'vips');

/** Decodes a picture to raw RGB bytes (alpha flattened on white) and its size, with vips. */
async function toRaw(dir: string, name: string, bytes: Buffer) {
  const vips = await vipsBinary();
  const source = join(dir, `${name}.img`);
  await writeFile(source, bytes);
  const flat = join(dir, `${name}-flat.png`);
  await run(vips, ['flatten', source, flat, '--background', '255 255 255'], { env: ENV }).catch(() =>
    run(vips, ['copy', source, flat], { env: ENV }),
  );
  const three = join(dir, `${name}-3.png`);
  await run(vips, ['extract_band', flat, three, '0', '--n', '3'], { env: ENV });
  const raw = join(dir, `${name}.raw`);
  await run(vips, ['rawsave', three, raw], { env: ENV });
  const width = Number((await run(vips, ['header', '-f', 'width', three], { env: ENV })).stdout);
  const height = Number((await run(vips, ['header', '-f', 'height', three], { env: ENV })).stdout);
  return { data: new Uint8Array(await readFile(raw)), width, height };
}

/** Writes RGBA bytes as a PNG with vips. */
async function fromRaw(dir: string, image: Rgba): Promise<Buffer> {
  const vips = await vipsBinary();
  const raw = join(dir, 'out.raw');
  const out = join(dir, 'out.png');
  await writeFile(raw, image.data);
  await run(vips, ['rawload', raw, out, String(image.width), String(image.height), '4'], { env: ENV });
  return readFile(out);
}

/**
 * The ghost-mannequin cut-out as a PNG: the try-on picture and the parsing map in, the worn
 * garment alone out. Null when the parsing found no clothes (or vips is missing).
 */
export async function ghostPng(person: Buffer, parsing: Buffer, parts: Part[]): Promise<Buffer | null> {
  if (!(await findVips())) return null;
  const dir = await mkdtemp(join(tmpdir(), 'lms-ghost-'));
  try {
    const photo = await toRaw(dir, 'photo', person);
    const map = await toRaw(dir, 'map', parsing);
    if (photo.width !== map.width || photo.height !== map.height) return null;
    const result = ghostRaster(photo.data, map.data, photo.width, photo.height, parts);
    return result ? await fromRaw(dir, result) : null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
