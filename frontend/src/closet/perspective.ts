import type { Raster } from './refine';

/**
 * Perspective correction for a garment laid on a white towel and photographed from the foot of
 * the bed, at an angle: the towel is a rectangle, so where its two long edges converge the photo
 * is foreshortened. Everything here is pure pixel maths: find the towel, fit its two edges, build
 * the homography that makes them parallel, and warp. No towel (another background) means no plan,
 * and the photo is left alone.
 */

/** A point as [x, y]. */
export type Point = [number, number];

/** A line x = a * y + b. */
export interface Line {
  a: number;
  b: number;
}

/**
 * The correction, in fractions of the source's width and height so it applies to any copy of the
 * photo (the cut-out is the same picture at the same size). `inverse` takes a point of the output
 * (as a fraction of its width and height) back to a point of the source (as a fraction of its
 * width and height), a 3x3 homography, row-major.
 */
export interface Plan {
  inverse: number[];
  /** Output width as a share of the source width (before the 2048 cap), and output height / width. */
  width: number;
  aspect: number;
  /** How far the camera was tilted from looking straight down at the towel, and the roll taken out, in degrees. */
  tilt: number;
  roll: number;
}

/** Longest side of the towel search (a downscaled copy), and of the warped result. */
const SEARCH = 512;
const MAX_SIDE = 2048;
/** The camera tilts worth correcting (degrees from straight above); outside them the fit is not to be trusted. */
const MIN_TILT = 4;
const MAX_TILT = 50;
/** The iPhone main camera, as a 35 mm equivalent focal length; the full frame's diagonal is 43.27 mm. */
export const DEFAULT_F35 = 26;
export const focalPixels = (width: number, height: number, f35 = DEFAULT_F35) =>
  (f35 / 43.27) * Math.hypot(width, height);


/** A fixed pseudo-random generator, so a fit gives the same lines every time. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** The raster as a luminance + chroma pair of arrays, shrunk so its long side is about `size`. */
function shrink(raster: Raster, size: number) {
  const scale = Math.min(1, size / Math.max(raster.width, raster.height));
  const w = Math.max(1, Math.round(raster.width * scale));
  const h = Math.max(1, Math.round(raster.height * scale));
  const lum = new Float32Array(w * h);
  const chroma = new Float32Array(w * h);
  const stepX = raster.width / w;
  const stepY = raster.height / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * stepY);
    const y1 = Math.max(y0 + 1, Math.floor((y + 1) * stepY));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * stepX);
      const x1 = Math.max(x0 + 1, Math.floor((x + 1) * stepX));
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let yy = y0; yy < y1 && yy < raster.height; yy++)
        for (let xx = x0; xx < x1 && xx < raster.width; xx++) {
          const k = (yy * raster.width + xx) * 4;
          r += raster.data[k]!;
          g += raster.data[k + 1]!;
          b += raster.data[k + 2]!;
          n++;
        }
      r /= n * 255;
      g /= n * 255;
      b /= n * 255;
      lum[y * w + x] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      chroma[y * w + x] = Math.max(r, g, b) - Math.min(r, g, b);
    }
  }
  return { lum, chroma, w, h, scale };
}

/** The largest 4-connected blob of a mask (the rest cleared). Returns its pixel count. */
function largestBlob(mask: Uint8Array, w: number, h: number): number {
  const label = new Int32Array(w * h);
  const stack = new Int32Array(w * h);
  let best = 0;
  let bestLabel = 0;
  let next = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || label[i]) continue;
    next++;
    let sp = 0;
    let count = 0;
    stack[sp++] = i;
    label[i] = next;
    while (sp) {
      const p = stack[--sp]!;
      count++;
      const x = p % w;
      const y = (p - x) / w;
      if (x > 0 && mask[p - 1] && !label[p - 1]) {
        label[p - 1] = next;
        stack[sp++] = p - 1;
      }
      if (x < w - 1 && mask[p + 1] && !label[p + 1]) {
        label[p + 1] = next;
        stack[sp++] = p + 1;
      }
      if (y > 0 && mask[p - w] && !label[p - w]) {
        label[p - w] = next;
        stack[sp++] = p - w;
      }
      if (y < h - 1 && mask[p + w] && !label[p + w]) {
        label[p + w] = next;
        stack[sp++] = p + w;
      }
    }
    if (count > best) {
      best = count;
      bestLabel = next;
    }
  }
  for (let i = 0; i < w * h; i++) mask[i] = label[i] === bestLabel ? 1 : 0;
  return best;
}

export interface Towel {
  mask: Uint8Array;
  width: number;
  height: number;
  /** Downscaled size / original size. */
  scale: number;
  count: number;
}

/** The towel: the largest bright, barely coloured area of the photo, on a downscaled copy. */
export function findTowel(raster: Raster, lumMin = 0.62, chromaMax = 0.14): Towel | null {
  if (raster.width < 32 || raster.height < 32) return null;
  const { lum, chroma, w, h, scale } = shrink(raster, SEARCH);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = lum[i]! > lumMin && chroma[i]! < chromaMax ? 1 : 0;
  // A 3x3 opening drops the thin bright bridges that tie the towel to bright things around it.
  const opened = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let all = 1;
      for (let j = -1; j <= 1 && all; j++) for (let i = -1; i <= 1; i++) if (!mask[(y + j) * w + x + i]) all = 0;
      opened[y * w + x] = all;
    }
  const count = largestBlob(opened, w, h);
  if (count < w * h * 0.12) return null;
  return { mask: opened, width: w, height: h, scale, count };
}

/** Least-squares x = a*y + b through points [y, x]. */
function leastSquares(points: Point[]): Line | null {
  const n = points.length;
  if (n < 2) return null;
  let sy = 0;
  let sx = 0;
  let syy = 0;
  let syx = 0;
  for (const [y, x] of points) {
    sy += y;
    sx += x;
    syy += y * y;
    syx += y * x;
  }
  const d = n * syy - sy * sy;
  if (Math.abs(d) < 1e-9) return null;
  const a = (n * syx - sy * sx) / d;
  return { a, b: (sx - a * sy) / n };
}

export interface Fit {
  line: Line;
  inliers: number;
  total: number;
}

/** Robust line through points [y, x]: RANSAC, then a least-squares refit on the inliers. */
export function fitLine(points: Point[], tolerance = 3, rounds = 240): Fit | null {
  if (points.length < 8) return null;
  const rand = seeded(7);
  const ys = points.map((p) => p[0]);
  const spread = Math.max(...ys) - Math.min(...ys);
  if (spread < 8) return null;
  let best: Point[] = [];
  for (let round = 0; round < rounds; round++) {
    const p = points[Math.floor(rand() * points.length)]!;
    const q = points[Math.floor(rand() * points.length)]!;
    if (Math.abs(p[0] - q[0]) < spread * 0.25) continue;
    const a = (q[1] - p[1]) / (q[0] - p[0]);
    const b = p[1] - a * p[0];
    const inside = points.filter(([y, x]) => Math.abs(x - (a * y + b)) <= tolerance);
    if (inside.length > best.length) best = inside;
  }
  if (best.length < 8) return null;
  const first = leastSquares(best);
  if (!first) return null;
  let line: Line = first;
  for (let pass = 0; pass < 2; pass++) {
    const l: Line = line;
    const again: Point[] = points.filter(([y, x]) => Math.abs(x - (l.a * y + l.b)) <= tolerance);
    const refit: Line | null = again.length >= 8 ? leastSquares(again) : null;
    if (!refit) break;
    line = refit;
    best = again;
  }
  return { line, inliers: best.length, total: points.length };
}

/** The leftmost and rightmost mask pixel of each row, as [y, x] lists; rows touching a side border are skipped on that side. */
export function rowEdges(mask: Uint8Array, w: number, h: number, from = 0.15, to = 0.85) {
  let top = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    let any = false;
    for (let x = 0; x < w && !any; x++) any = mask[y * w + x] === 1;
    if (any) {
      if (top < 0) top = y;
      bottom = y;
    }
  }
  const left: Point[] = [];
  const right: Point[] = [];
  if (top < 0) return { left, right, top, bottom };
  const span = bottom - top;
  for (let y = Math.ceil(top + span * from); y <= Math.floor(top + span * to); y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (l < 0) l = x;
        r = x;
      }
    if (l < 0) continue;
    if (l > 1) left.push([y, l]);
    if (r < w - 2) right.push([y, r]);
  }
  return { left, right, top, bottom };
}

/**
 * The correction for this photo, or null when there is no towel to go by or nothing worth fixing.
 * `f35` is the 35 mm equivalent focal length (the photo's EXIF FocalLengthIn35mmFilm when known;
 * our uploads are re-encoded without EXIF, so normally the iPhone main camera's 26 mm).
 */
export function planPerspective(raster: Raster, f35 = DEFAULT_F35): Plan | null {
  // Towel in shade is darker than towel in light: try the strict brightness first, then a looser one.
  for (const lumMin of [0.62, 0.5]) {
    const towel = findTowel(raster, lumMin);
    if (!towel) continue;
    const { mask, width: w, height: h } = towel;
    const { left, right, top, bottom } = rowEdges(mask, w, h);
    const minRows = Math.max(12, Math.round((bottom - top) * 0.2));
    if (left.length < minRows || right.length < minRows) continue;
    const l = fitLine(left);
    const r = fitLine(right);
    // A good fit: most of the rows agree with one straight edge.
    if (!l || !r || l.inliers < l.total * 0.55 || r.inliers < r.total * 0.55) continue;
    // Back to the photo's own pixels.
    const sx = w / raster.width;
    const sy = h / raster.height;
    const full = (line: Line): Line => ({ a: (line.a * sy) / sx, b: line.b / sx });
    const plan = planFromLines(
      full(l.line),
      full(r.line),
      top / sy,
      (bottom + 1) / sy,
      raster.width,
      raster.height,
      focalPixels(raster.width, raster.height, f35),
    );
    if (plan) return plan;
  }
  return null;
}

type Vec = [number, number, number];
const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec): Vec => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Product of two 3x3 matrices (row-major). */
function mul(a: number[], b: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) out.push(a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!);
  return out;
}

function invert(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const k = 1 / det;
  return [
    (e * i - f * h) * k,
    (c * h - b * i) * k,
    (b * f - c * e) * k,
    (f * g - d * i) * k,
    (a * i - c * g) * k,
    (c * d - a * f) * k,
    (d * h - e * g) * k,
    (b * g - a * h) * k,
    (a * e - b * d) * k,
  ];
}

const apply = (m: number[], x: number, y: number): [number, number, number] => [
  m[0]! * x + m[1]! * y + m[2]!,
  m[3]! * x + m[4]! * y + m[5]!,
  m[6]! * x + m[7]! * y + m[8]!,
];

/**
 * Metric rectification from the towel's two long edges (lines x = a*y + b in the photo's pixels, from
 * row `top` to row `bottom`) and the focal length in pixels. The edges meet at a vanishing point,
 * which with the focal length fixes the direction of the towel in the camera; the camera is then
 * turned (a pure rotation, H = K R K^-1) to look straight down its normal, which undoes the roll and
 * the tilt and gives every length its true proportion. Null when the edges are parallel, the tilt is
 * under 4 or over 50 degrees, or the towel would land behind the camera.
 */
export function planFromLines(
  l: Line,
  r: Line,
  top: number,
  bottom: number,
  width: number,
  height: number,
  focal: number,
): Plan | null {
  const da = l.a - r.a;
  if (Math.abs(da) < 1e-6) return null;
  const vy = (r.b - l.b) / da;
  const vx = l.a * vy + l.b;
  const cx = width / 2;
  const cy = height / 2;
  const dx = vx - cx;
  const dy = vy - cy;
  const reach = Math.hypot(dx, dy);
  if (!Number.isFinite(reach) || reach < 1e-6) return null;
  const tilt = (Math.atan(focal / reach) * 180) / Math.PI;
  if (tilt < MIN_TILT || tilt > MAX_TILT) return null;
  // The towel's far direction in the camera (x right, y down, z forward), and its sideways direction
  // (perpendicular to it with no twist: the horizon is perpendicular to principal point -> V).
  const far = unit([dx / focal, dy / focal, 1]);
  const down: Vec = [-far[0], -far[1], -far[2]];
  let side = unit([-dy, dx, 0]);
  let normal = cross(side, down);
  if (normal[2] < 0) {
    side = [-side[0], -side[1], 0];
    normal = cross(side, down);
  }
  const K = [focal, 0, cx, 0, focal, cy, 0, 0, 1];
  const Kinv = [1 / focal, 0, -cx / focal, 0, 1 / focal, -cy / focal, 0, 0, 1];
  const R = [...side, ...down, ...normal];
  const H = mul(K, mul(R, Kinv));
  const corners: Point[] = [
    [l.a * top + l.b, top],
    [r.a * top + r.b, top],
    [r.a * bottom + r.b, bottom],
    [l.a * bottom + l.b, bottom],
  ];
  const mapped: Point[] = [];
  for (const [x, y] of corners) {
    const [u, v, w] = apply(H, x, y);
    if (w < 1e-6) return null;
    mapped.push([u / w, v / w]);
  }
  const minX = Math.min(...mapped.map((p) => p[0]));
  const maxX = Math.max(...mapped.map((p) => p[0]));
  const minY = Math.min(...mapped.map((p) => p[1]));
  const maxY = Math.max(...mapped.map((p) => p[1]));
  if (!(maxX - minX > 8) || !(maxY - minY > 8)) return null;
  // Scale so the towel's bottom edge keeps one output pixel per photo pixel.
  const nearMapped = Math.abs(mapped[2]![0] - mapped[3]![0]);
  const nearSource = Math.abs(corners[2]![0] - corners[3]![0]);
  const s = nearMapped > 8 && nearSource > 8 ? nearSource / nearMapped : 1;
  const Dw = (maxX - minX) * s;
  const Dh = (maxY - minY) * s;
  // forward M = S * T * H ; the output pixel -> source pixel is its inverse
  const M = mul([s, 0, -minX * s, 0, s, -minY * s, 0, 0, 1], H);
  const inverse = mul([1 / width, 0, 0, 0, 1 / height, 0, 0, 0, 1], mul(invert(M), [Dw, 0, 0, 0, Dh, 0, 0, 0, 1]));
  return { inverse, width: Dw / width, aspect: Dh / Dw, tilt, roll: (Math.atan2(dx, -dy) * 180) / Math.PI };
}

/** The 3x3 homography (row-major, h22 = 1) taking each `from[i]` to `to[i]`. */
export function solveHomography(from: Point[], to: Point[]): number[] {
  const m: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!;
    const [u, v] = to[i]!;
    m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let pivot = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    [m[c], m[pivot]] = [m[pivot]!, m[c]!];
    const d = m[c]![c]!;
    if (Math.abs(d) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let k = c; k < 9; k++) m[c]![k]! /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = m[r]![c]!;
      if (f) for (let k = c; k < 9; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return [...m.map((row) => row[8]!), 1];
}

/** The output size of a plan applied to `raster`, capped at 2048 on the long side. */
export function outputSize(plan: Plan, raster: Raster): { width: number; height: number } {
  let width = plan.width * raster.width;
  let height = width * plan.aspect;
  const cap = Math.min(1, MAX_SIDE / Math.max(width, height));
  width *= cap;
  height *= cap;
  return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
}

/**
 * Warps `raster` through the plan (inverse mapping, bilinear, alpha premultiplied). `edge: 'clamp'`
 * repeats the border for opaque photos; 'clear' leaves what falls outside the picture transparent
 * (a cut-out).
 */
export function warpPerspective(raster: Raster, plan: Plan, edge: 'clamp' | 'clear' = 'clear'): Raster {
  const { width: W, height: H } = outputSize(plan, raster);
  const out = new Uint8ClampedArray(W * H * 4);
  const { data, width, height } = raster;
  const m = plan.inverse;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [u, v, den] = apply(m, (x + 0.5) / W, (y + 0.5) / H);
      let sx = (u / den) * width - 0.5;
      let sy = (v / den) * height - 0.5;
      const at = (y * W + x) * 4;
      if (edge === 'clamp') {
        sx = Math.min(width - 1, Math.max(0, sx));
        sy = Math.min(height - 1, Math.max(0, sy));
      } else if (!(sx >= -0.5 && sy >= -0.5 && sx <= width - 0.5 && sy <= height - 0.5)) continue;
      bilinear(data, width, height, sx, sy, out, at);
    }
  }
  return { data: out, width: W, height: H };
}

function bilinear(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Uint8ClampedArray, at: number) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (let j = 0; j < 2; j++)
    for (let i = 0; i < 2; i++) {
      const px = Math.min(w - 1, Math.max(0, x0 + i));
      const py = Math.min(h - 1, Math.max(0, y0 + j));
      const weight = (i ? fx : 1 - fx) * (j ? fy : 1 - fy);
      const k = (py * w + px) * 4;
      const wa = (weight * data[k + 3]!) / 255;
      r += data[k]! * wa;
      g += data[k + 1]! * wa;
      b += data[k + 2]! * wa;
      a += wa;
    }
  if (a <= 0.001) return;
  out[at] = r / a;
  out[at + 1] = g / a;
  out[at + 2] = b / a;
  out[at + 3] = Math.round(a * 255);
}

/**
 * The keystone amount (for `straighten`'s slider: top scaled by 1 - amount) that evens out a
 * cut-out's own sides, from the lower body only (below 55% of its height, above the hem), where a
 * garment's two sides run parallel. 0 when they already do, or there is no clear fit.
 */
export function silhouetteKeystone(cut: Raster): number {
  const { data, width: w, height: h } = cut;
  let top = h;
  let bottom = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! >= 128) {
        if (y < top) top = y;
        bottom = y;
        break;
      }
  if (bottom - top < 40) return 0;
  const span = bottom - top;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let y = Math.floor(top + span * 0.58); y <= Math.floor(top + span * 0.92); y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++)
      if (data[(y * w + x) * 4 + 3]! >= 128) {
        if (l < 0) l = x;
        r = x;
      }
    if (l >= 0) {
      left.push([y, l]);
      right.push([y, r]);
    }
  }
  const tolerance = Math.max(2, w * 0.006);
  const lf = fitLine(left, tolerance);
  const rf = fitLine(right, tolerance);
  if (!lf || !rf || lf.inliers < lf.total * 0.7 || rf.inliers < rf.total * 0.7) return 0;
  const wt = rf.line.a * top + rf.line.b - (lf.line.a * top + lf.line.b);
  const wb = rf.line.a * bottom + rf.line.b - (lf.line.a * bottom + lf.line.b);
  if (wt <= 0 || wb <= 0) return 0;
  const amount = 1 - wb / wt; // the top is scaled by 1 - amount: a narrow top (wt < wb) needs a negative amount
  if (Math.abs(amount) < 0.02) return 0;
  return Math.max(-0.25, Math.min(0.25, amount));
}
