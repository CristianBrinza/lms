/**
 * Cleans a cut-out before it is stored ("Background only"): a crisp alpha
 * mask without stray islands or pinholes, the garment's colour corrected from the white towel it
 * lay on, and a tight crop. Pure pixel maths on RGBA arrays, so it is tested without a browser.
 */

export interface Raster {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

const LUMA = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Hard threshold with a short ramp: alpha < 0.3 → 0, > 0.7 → 1, linear between. */
export function sharpenAlpha(data: Uint8ClampedArray) {
  for (let i = 3; i < data.length; i += 4) {
    const a = data[i]! / 255;
    data[i] = a <= 0.3 ? 0 : a >= 0.7 ? 255 : Math.round(((a - 0.3) / 0.4) * 255);
  }
}

/** Keeps the largest 4-connected blob of opaque pixels; the other islands go. */
export function keepLargestBlob(data: Uint8ClampedArray, width: number, height: number) {
  const n = width * height;
  const label = new Int32Array(n); // 0 = none, >0 = blob id
  const stack = new Int32Array(n);
  let best = 0;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (label[start] || data[start * 4 + 3]! < 128) continue;
    next++;
    let size = 0;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    while (top) {
      const p = stack[--top]!;
      size++;
      const x = p % width;
      const y = (p - x) / width;
      const visit = (q: number) => {
        if (!label[q] && data[q * 4 + 3]! >= 128) {
          label[q] = next;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
  }
  if (!best) return 0;
  // The blob plus a 2 px rim keeps its soft edge; soft pixels further out belong to islands.
  let keep = new Uint8Array(n);
  for (let p = 0; p < n; p++) keep[p] = label[p] === best ? 1 : 0;
  for (let round = 0; round < 2; round++) {
    const grown = keep.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (keep[p]) continue;
        if ((x > 0 && keep[p - 1]) || (x < width - 1 && keep[p + 1]) || (y > 0 && keep[p - width]) || (y < height - 1 && keep[p + width]))
          grown[p] = 1;
      }
    keep = grown;
  }
  for (let p = 0; p < n; p++) if (!keep[p]) data[p * 4 + 3] = 0;
  return bestSize;
}

/** A square box test over a binary mask: true where the whole (all=true) or any (all=false) (2r+1) window is set; outside the picture counts as `outside`. */
function boxWindow(mask: Uint8Array, width: number, height: number, r: number, all: boolean, outside: number): Uint8Array {
  const pass = (src: Uint8Array, w: number, h: number, horizontal: boolean): Uint8Array => {
    const out = new Uint8Array(w * h);
    const lines = horizontal ? h : w;
    const length = horizontal ? w : h;
    const at = (line: number, i: number) => (horizontal ? line * w + i : i * w + line);
    for (let line = 0; line < lines; line++) {
      // Running count of set cells in [i - r, i + r], cells outside the picture counting as `outside`.
      let count = 0;
      for (let i = -r; i <= r; i++) count += i < 0 || i >= length ? outside : src[at(line, i)]!;
      for (let i = 0; i < length; i++) {
        out[at(line, i)] = all ? (count === 2 * r + 1 ? 1 : 0) : count > 0 ? 1 : 0;
        const leave = i - r;
        const enter = i + r + 1;
        count -= leave < 0 || leave >= length ? outside : src[at(line, leave)]!;
        count += enter < 0 || enter >= length ? outside : src[at(line, enter)]!;
      }
    }
    return out;
  };
  return pass(pass(mask, width, height, true), width, height, false);
}

/** Labels the 4-connected blobs of a binary mask (ids from 1); returns the ids, sizes and which touch the picture's edge. */
function blobs(mask: Uint8Array, width: number, height: number) {
  const n = width * height;
  const label = new Int32Array(n);
  const stack = new Int32Array(n);
  const sizes: number[] = [0];
  const edge: boolean[] = [false];
  let next = 0;
  for (let start = 0; start < n; start++) {
    if (!mask[start] || label[start]) continue;
    next++;
    let size = 0;
    let top = 0;
    let touches = false;
    stack[top++] = start;
    label[start] = next;
    while (top) {
      const p = stack[--top]!;
      size++;
      const x = p % width;
      const y = (p - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touches = true;
      const visit = (q: number) => {
        if (mask[q] && !label[q]) {
          label[q] = next;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    sizes.push(size);
    edge.push(touches);
  }
  return { label, sizes, edge, count: next };
}

/**
 * Removes what touches the picture's edge but hangs on the garment only by a thin neck (a towel
 * strip along the top, a bed corner): an opening of the mask by ~1.5% of the picture. Blobs that
 * survive the erosion and touch the edge without being the largest go, and so do thin slivers
 * touching the edge that the opening cut off; the garment is dilated back to its own outline. The
 * edge itself is not eroded, so a garment cropped by the frame keeps its cut side.
 */
export function dropEdgeStrips(data: Uint8ClampedArray, width: number, height: number, share = 0.015) {
  const n = width * height;
  const r = Math.max(2, Math.round(Math.min(width, height) * share));
  if (width <= 2 * r + 2 || height <= 2 * r + 2) return;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) mask[p] = data[p * 4 + 3]! >= 128 ? 1 : 0;
  const eroded = boxWindow(mask, width, height, r, true, 1);
  const first = blobs(eroded, width, height);
  if (!first.count) return;
  let main = 1;
  for (let id = 2; id <= first.count; id++) if (first.sizes[id]! > first.sizes[main]!) main = id;
  const core = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const id = first.label[p]!;
    if (id && (id === main || !first.edge[id])) core[p] = 1;
  }
  const grown = boxWindow(core, width, height, r, false, 0);
  const rest = new Uint8Array(n);
  for (let p = 0; p < n; p++) rest[p] = mask[p] && !grown[p] ? 1 : 0;
  const slivers = blobs(rest, width, height);
  const drop = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (rest[p] && slivers.edge[slivers.label[p]!]) drop[p] = 1;
  // Also the edge blobs that the erosion kept apart, with the rim the opening gave them.
  const apart = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const id = first.label[p]!;
    if (id && id !== main && first.edge[id]) apart[p] = 1;
  }
  const apartGrown = boxWindow(apart, width, height, r, false, 0);
  for (let p = 0; p < n; p++) if (apartGrown[p] && mask[p] && !grown[p]) drop[p] = 1;
  // Soft pixels next to a dropped region go too (a 2 px rim), so no halo of towel stays.
  let zone = drop;
  for (let round = 0; round < 2; round++) {
    const next = zone.slice();
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (zone[p]) continue;
        if ((x > 0 && zone[p - 1]) || (x < width - 1 && zone[p + 1]) || (y > 0 && zone[p - width]) || (y < height - 1 && zone[p + width]))
          next[p] = 1;
      }
    zone = next;
  }
  for (let p = 0; p < n; p++) if (zone[p] && !grown[p]) data[p * 4 + 3] = 0;
}

/**
 * Fills holes enclosed by the garment that are smaller than `maxShare` of its area (pinholes the
 * model left). Colours come from `fallback` (the original photo) when it has the same size.
 */
export function fillSmallHoles(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  fallback: Uint8ClampedArray | null,
  maxShare = 0.005,
) {
  const n = width * height;
  let area = 0;
  for (let p = 0; p < n; p++) if (data[p * 4 + 3]! >= 128) area++;
  if (!area) return;
  const limit = Math.max(1, Math.floor(area * maxShare));
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const members = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (seen[start] || data[start * 4 + 3]! >= 128) continue;
    let top = 0;
    let count = 0;
    let touchesEdge = false;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const p = stack[--top]!;
      members[count++] = p;
      const x = p % width;
      const y = (p - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      const visit = (q: number) => {
        if (!seen[q] && data[q * 4 + 3]! < 128) {
          seen[q] = 1;
          stack[top++] = q;
        }
      };
      if (x > 0) visit(p - 1);
      if (x < width - 1) visit(p + 1);
      if (y > 0) visit(p - width);
      if (y < height - 1) visit(p + width);
    }
    if (touchesEdge || count > limit) continue;
    for (let k = 0; k < count; k++) {
      const i = members[k]! * 4;
      if (fallback) {
        data[i] = fallback[i]!;
        data[i + 1] = fallback[i + 1]!;
        data[i + 2] = fallback[i + 2]!;
      }
      data[i + 3] = 255;
    }
  }
}

/**
 * White-balance gains from the pixels the cut-out removed (mostly a white towel): per-channel mean
 * without the brightest 2% and the darkest 10%, mapped to neutral, each gain within 0.8–1.25.
 * Null when there are too few background pixels.
 */
export function backgroundGains(
  original: Uint8ClampedArray,
  cutAlpha: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number] | null {
  const bins = Array.from({ length: 256 }, () => ({ n: 0, r: 0, g: 0, b: 0 }));
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 60_000)));
  let total = 0;
  for (let y = 0; y < height; y += step)
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      if (cutAlpha[i + 3]! > 8) continue;
      const bin = bins[Math.min(255, Math.round(LUMA(original[i]!, original[i + 1]!, original[i + 2]!)))]!;
      bin.n++;
      bin.r += original[i]!;
      bin.g += original[i + 1]!;
      bin.b += original[i + 2]!;
      total++;
    }
  const sampled = Math.ceil(width / step) * Math.ceil(height / step);
  if (total < 200 || total < sampled * 0.03) return null;
  const skipLow = total * 0.1;
  const skipHigh = total * 0.02;
  let seen = 0;
  let n = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const bin of bins) {
    // The share of this bin that lies between the 10% and the 98% marks.
    const from = Math.max(seen, skipLow);
    const to = Math.min(seen + bin.n, total - skipHigh);
    seen += bin.n;
    if (bin.n === 0 || to <= from) continue;
    const share = (to - from) / bin.n;
    n += bin.n * share;
    r += bin.r * share;
    g += bin.g * share;
    b += bin.b * share;
  }
  if (n <= 0) return null;
  const mean = [r / n, g / n, b / n];
  const grey = (mean[0]! + mean[1]! + mean[2]!) / 3;
  if (grey < 60) return null; // not a light backdrop: nothing to learn from it
  const gain = (m: number) => Math.min(1.25, Math.max(0.8, grey / Math.max(1, m)));
  return [gain(mean[0]!), gain(mean[1]!), gain(mean[2]!)];
}

/** Multiplies the garment's colours by the gains. */
export function applyGains(data: Uint8ClampedArray, gains: [number, number, number]) {
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    data[i] = clamp255(data[i]! * gains[0]);
    data[i + 1] = clamp255(data[i + 1]! * gains[1]);
    data[i + 2] = clamp255(data[i + 2]! * gains[2]);
  }
}

/**
 * Mild auto-levels: the garment's 1st/99th luminance percentiles are stretched toward 2/253. The
 * black point moves at most to 30 and the white point never below 190, so a black jumper stays
 * black and a dark one is not turned grey.
 */
export function autoLevels(data: Uint8ClampedArray) {
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3]! < 128) continue;
    hist[Math.round(LUMA(data[i]!, data[i + 1]!, data[i + 2]!))]!++;
    count++;
  }
  if (count < 100) return;
  const percentile = (share: number) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v]!;
      if (acc >= count * share) return v;
    }
    return 255;
  };
  const lo = Math.min(percentile(0.01), 30);
  const hi = Math.max(percentile(0.99), 190);
  if (hi - lo < 60) return;
  const scale = (253 - 2) / (hi - lo);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = clamp255(Math.round((v - lo) * scale + 2));
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    data[i] = lut[data[i]!]!;
    data[i + 1] = lut[data[i + 1]!]!;
    data[i + 2] = lut[data[i + 2]!]!;
  }
}

/** Crops to the garment's box plus `pad` (a share of its long side) of transparent air. */
export function cropToGarment(raster: Raster, pad = 0.04): Raster {
  const { data, width, height } = raster;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! < 24) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  if (maxX < 0) return raster;
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const air = Math.round(Math.max(w, h) * pad);
  const out = new Uint8ClampedArray((w + air * 2) * (h + air * 2) * 4);
  const outWidth = w + air * 2;
  for (let y = 0; y < h; y++) {
    const from = ((minY + y) * width + minX) * 4;
    out.set(data.subarray(from, from + w * 4), ((y + air) * outWidth + air) * 4);
  }
  return { data: out, width: outWidth, height: h + air * 2 };
}

/**
 * The whole clean-up. `cut` is the model's cut-out; `original` the photo it came from (same size)
 * for the white balance and for filling pinholes; without it only the mask is cleaned.
 */
export function refineCutout(cut: Raster, original: Raster | null): Raster {
  const { width, height } = cut;
  const same = original && original.width === width && original.height === height ? original : null;
  const data = new Uint8ClampedArray(cut.data);
  const gains = same ? backgroundGains(same.data, cut.data, width, height) : null;
  sharpenAlpha(data);
  dropEdgeStrips(data, width, height);
  keepLargestBlob(data, width, height);
  fillSmallHoles(data, width, height, same ? same.data : null);
  if (gains) applyGains(data, gains);
  autoLevels(data);
  return cropToGarment({ data, width, height }, 0.04);
}
