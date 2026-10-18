import type { Raster } from './refine';

/**
 * The "3D" look for a cut-out garment, kept honest: nothing is ever painted outside the piece, and
 * nothing white is added. Inside the silhouette there is only a very faint darkening toward the
 * edge (2.5% of the size, at most 18%) and a gentle top-to-bottom tone (+3% to -4%). Under it, a
 * soft contact shadow touching the hem (offset 1.2% of the height, blur 3%, at most 18% opaque);
 * the picture grows just enough to hold it. Pure pixel maths; transparent in, transparent out.
 */

const EDGE_SHARE = 0.025;
const EDGE_MAX = 0.18;
const TONE_TOP = 1.03;
const TONE_BOTTOM = 0.96;
const SHADOW_OFFSET = 0.012;
const SHADOW_BLUR = 0.03;
const SHADOW_OPACITY = 0.18;
const SHADOW = [20, 16, 40] as const;

/** Distance (px, capped) from each pixel to the nearest transparent one; 0 outside the piece. */
function edgeDistance(alpha: Float32Array, width: number, height: number, cap: number) {
  const dist = new Float32Array(width * height);
  const big = cap + 1;
  for (let i = 0; i < dist.length; i++) dist[i] = alpha[i]! >= 0.5 ? big : 0;
  const a = 1;
  const b = 1.4142;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!dist[p]) continue;
      let d = dist[p]!;
      if (x > 0) d = Math.min(d, dist[p - 1]! + a);
      if (y > 0) {
        d = Math.min(d, dist[p - width]! + a);
        if (x > 0) d = Math.min(d, dist[p - width - 1]! + b);
        if (x < width - 1) d = Math.min(d, dist[p - width + 1]! + b);
      }
      dist[p] = d;
    }
  for (let y = height - 1; y >= 0; y--)
    for (let x = width - 1; x >= 0; x--) {
      const p = y * width + x;
      if (!dist[p]) continue;
      let d = dist[p]!;
      if (x < width - 1) d = Math.min(d, dist[p + 1]! + a);
      if (y < height - 1) {
        d = Math.min(d, dist[p + width]! + a);
        if (x < width - 1) d = Math.min(d, dist[p + width + 1]! + b);
        if (x > 0) d = Math.min(d, dist[p + width - 1]! + b);
      }
      dist[p] = d;
    }
  return dist;
}

/** Three passes of a box blur ≈ a Gaussian; separable, in place on a copy. */
function blur(src: Float32Array, width: number, height: number, radius: number) {
  const r = Math.max(1, Math.round(radius));
  let a: Float32Array = src;
  let b: Float32Array = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    // horizontal
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[row + Math.min(width - 1, Math.max(0, x))]!;
      for (let x = 0; x < width; x++) {
        b[row + x] = sum / (2 * r + 1);
        sum += a[row + Math.min(width - 1, x + r + 1)]! - a[row + Math.max(0, x - r)]!;
      }
    }
    [a, b] = [b, a];
    // vertical
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += a[Math.min(height - 1, Math.max(0, y)) * width + x]!;
      for (let y = 0; y < height; y++) {
        b[y * width + x] = sum / (2 * r + 1);
        sum += a[Math.min(height - 1, y + r + 1) * width + x]! - a[Math.max(0, y - r) * width + x]!;
      }
    }
    [a, b] = [b, a];
  }
  return a;
}

/** Room added around the piece for its contact shadow (the blur reaches twice its radius). */
export function volumePadding(w: number, h: number) {
  const reach = Math.max(1, Math.round(Math.max(w, h) * SHADOW_BLUR)) * 2;
  const offset = Math.round(h * SHADOW_OFFSET);
  return { left: reach, right: reach, top: Math.max(0, reach - offset), bottom: reach + offset };
}

/** The garment with its soft shading, and the canvas grown to hold the contact shadow. */
export function volumeRaster(source: Raster): Raster {
  const { width: w, height: h } = source;
  const size = Math.max(w, h);
  const blurPx = Math.max(1, Math.round(size * SHADOW_BLUR));
  const offset = Math.round(h * SHADOW_OFFSET);
  const { left, right, top, bottom } = volumePadding(w, h);
  const W = w + left + right;
  const H = h + top + bottom;

  const alpha = new Float32Array(W * H);
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const a = source.data[(y * w + x) * 4 + 3]! / 255;
      alpha[(y + top) * W + x + left] = a;
      if (a >= 0.5) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  if (maxY < 0) return source;

  // The shadow: the silhouette dropped by `offset`, blurred.
  const dropped = new Float32Array(W * H);
  for (let y = 0; y < H - offset; y++) dropped.set(alpha.subarray(y * W, (y + 1) * W), (y + offset) * W);
  const shade = blur(dropped, W, H, blurPx);

  const edgeCap = Math.max(1, size * EDGE_SHARE);
  const edge = edgeDistance(alpha, W, H, edgeCap);
  const span = Math.max(1, maxY - minY);

  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x;
      const a = alpha[p]!;
      const outA = a + shade[p]! * SHADOW_OPACITY * (1 - a); // the garment over its shadow
      if (outA <= 0.002) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      if (a > 0) {
        const sx = x - left;
        const sy = y - top;
        const i = (sy * w + sx) * 4;
        // Tone: from lighter at the top to a little darker at the hem, as a gain (never a white wash).
        const t = Math.min(1, Math.max(0, (sy - minY) / span));
        const tone = TONE_TOP + (TONE_BOTTOM - TONE_TOP) * t;
        // Edge: up to 18% darker right at the silhouette, none past 2.5% of the size.
        const e = edge[p]! < edgeCap ? 1 - edge[p]! / edgeCap : 0;
        const dark = 1 - EDGE_MAX * e * e;
        const gain = tone * dark;
        r = Math.min(source.data[i]! * gain, 255);
        g = Math.min(source.data[i + 1]! * gain, 255);
        b = Math.min(source.data[i + 2]! * gain, 255);
      }
      // Straight-alpha "over": the garment above, the shadow colour beneath where it is thin.
      const k = a / outA;
      out[p * 4] = r * k + SHADOW[0] * (1 - k);
      out[p * 4 + 1] = g * k + SHADOW[1] * (1 - k);
      out[p * 4 + 2] = b * k + SHADOW[2] * (1 - k);
      out[p * 4 + 3] = Math.round(outA * 255);
    }
  return { data: out, width: W, height: H };
}
