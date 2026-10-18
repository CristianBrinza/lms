import type { Raster } from './refine';

/** Pixel tools for the touch-up editor: brushes and the magic wand, on an RGBA raster in place. */

/** Soft brush falloff: 1 inside 80% of the radius, fading to 0 at the edge. */
const falloff = (distance: number, radius: number) => {
  const inner = radius * 0.8;
  return distance <= inner ? 1 : distance >= radius ? 0 : 1 - (distance - inner) / (radius - inner);
};

export interface Dirty {
  x: number;
  y: number;
  w: number;
  h: number;
}

function box(raster: Raster, cx: number, cy: number, radius: number): Dirty {
  const x = Math.max(0, Math.floor(cx - radius));
  const y = Math.max(0, Math.floor(cy - radius));
  return { x, y, w: Math.min(raster.width, Math.ceil(cx + radius) + 1) - x, h: Math.min(raster.height, Math.ceil(cy + radius) + 1) - y };
}

/** Rubs out: alpha goes toward 0 under the brush. */
export function erase(raster: Raster, cx: number, cy: number, radius: number): Dirty {
  const area = box(raster, cx, cy, radius);
  for (let y = area.y; y < area.y + area.h; y++)
    for (let x = area.x; x < area.x + area.w; x++) {
      const f = falloff(Math.hypot(x + 0.5 - cx, y + 0.5 - cy), radius);
      if (f <= 0) continue;
      const i = (y * raster.width + x) * 4 + 3;
      raster.data[i] = Math.round(raster.data[i]! * (1 - f));
    }
  return area;
}

/** Brings pixels back from `base` (the cut-out as it was opened) under the brush. */
export function restore(raster: Raster, base: Raster, cx: number, cy: number, radius: number): Dirty {
  const area = box(raster, cx, cy, radius);
  for (let y = area.y; y < area.y + area.h; y++)
    for (let x = area.x; x < area.x + area.w; x++) {
      const f = falloff(Math.hypot(x + 0.5 - cx, y + 0.5 - cy), radius);
      if (f <= 0) continue;
      const i = (y * raster.width + x) * 4;
      const target = Math.round(base.data[i + 3]! * f);
      if (target <= raster.data[i + 3]!) continue;
      raster.data[i] = base.data[i]!;
      raster.data[i + 1] = base.data[i + 1]!;
      raster.data[i + 2] = base.data[i + 2]!;
      raster.data[i + 3] = target;
    }
  return area;
}

/**
 * Magic wand: from the tapped pixel, removes the connected (4-neighbour) opaque area whose colour
 * is within `tolerance` (0–100, a share of the RGB range) of the tapped pixel's. Returns the
 * number of pixels removed (0 when the tap was on transparent).
 */
export function wandErase(raster: Raster, x0: number, y0: number, tolerance: number): number {
  const { data, width, height } = raster;
  const start = y0 * width + x0;
  if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height || data[start * 4 + 3]! < 16) return 0;
  const sr = data[start * 4]!;
  const sg = data[start * 4 + 1]!;
  const sb = data[start * 4 + 2]!;
  const limit = (tolerance / 100) * 441.67 * 0.5; // sqrt(3 * 255²) is the longest RGB distance
  const seen = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  let removed = 0;
  stack[top++] = start;
  seen[start] = 1;
  while (top) {
    const p = stack[--top]!;
    data[p * 4 + 3] = 0;
    removed++;
    const x = p % width;
    const y = (p - x) / width;
    const visit = (q: number) => {
      if (seen[q] || data[q * 4 + 3]! < 16) return;
      seen[q] = 1;
      if (Math.hypot(data[q * 4]! - sr, data[q * 4 + 1]! - sg, data[q * 4 + 2]! - sb) <= limit) stack[top++] = q;
    };
    if (x > 0) visit(p - 1);
    if (x < width - 1) visit(p + 1);
    if (y > 0) visit(p - width);
    if (y < height - 1) visit(p + width);
  }
  return removed;
}

/** The alpha channel alone, for the undo history (a quarter of the memory of a full copy). */
export function alphaOf(raster: Raster): Uint8Array {
  const out = new Uint8Array(raster.width * raster.height);
  for (let i = 0; i < out.length; i++) out[i] = raster.data[i * 4 + 3]!;
  return out;
}

/** Puts an alpha snapshot back (colours of pixels it revives come from `base`). */
export function setAlpha(raster: Raster, alpha: Uint8Array, base: Raster) {
  for (let i = 0; i < alpha.length; i++) {
    const was = raster.data[i * 4 + 3]!;
    if (alpha[i] !== was && was === 0) {
      raster.data[i * 4] = base.data[i * 4]!;
      raster.data[i * 4 + 1] = base.data[i * 4 + 1]!;
      raster.data[i * 4 + 2] = base.data[i * 4 + 2]!;
    }
    raster.data[i * 4 + 3] = alpha[i]!;
  }
}

/** A bounded undo/redo history of alpha snapshots. */
export class History {
  private past: Uint8Array[] = [];
  private future: Uint8Array[] = [];
  constructor(private readonly limit = 20) {}
  push(snapshot: Uint8Array) {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo(current: Uint8Array): Uint8Array | null {
    const back = this.past.pop();
    if (!back) return null;
    this.future.push(current);
    return back;
  }
  redo(current: Uint8Array): Uint8Array | null {
    const ahead = this.future.pop();
    if (!ahead) return null;
    this.past.push(current);
    return ahead;
  }
  /** Drops the last snapshot without redo (a stroke that was cancelled). */
  discard() {
    return this.past.pop() ?? null;
  }
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
}
