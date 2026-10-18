import { cropToGarment, type Raster } from './refine';

/**
 * Straightening a photo taken at an angle, in pure pixel maths (no AI): the tilt of the piece
 * from its main axis, a rotation, and a keystone (a per-row horizontal scale, the simple version
 * of a perspective fix for a photo taken from the foot of the bed).
 */

/** Tilt (degrees, clockwise positive) of the piece's main axis from the nearest vertical/horizontal; null when it has no clear axis. */
export function principalTilt(raster: Raster): number | null {
  const { data, width, height } = raster;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]! >= 128) {
        n++;
        sx += x;
        sy += y;
      }
  if (n < 50) return null;
  const mx = sx / n;
  const my = sy / n;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (data[(y * width + x) * 4 + 3]! >= 128) {
        xx += (x - mx) ** 2;
        yy += (y - my) ** 2;
        xy += (x - mx) * (y - my);
      }
  const spread = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy);
  const major = (xx + yy) / 2 + spread;
  const minor = (xx + yy) / 2 - spread;
  if (minor <= 0 || major / minor < 1.15) return null; // round-ish: no reliable axis
  const phi = (0.5 * Math.atan2(2 * xy, xx - yy) * 180) / Math.PI; // major axis, from the x axis
  let d = phi - 90;
  while (d > 45) d -= 90;
  while (d <= -45) d += 90;
  return d;
}

/** Rotates by `degrees` (clockwise positive) on a canvas grown to hold the whole piece. */
export function rotateRaster(raster: Raster, degrees: number): Raster {
  if (!degrees) return raster;
  const { data, width, height } = raster;
  const a = (degrees * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const W = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
  const H = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - W / 2;
      const dy = y + 0.5 - H / 2;
      // back to the source: the inverse rotation
      const sx = dx * cos + dy * sin + width / 2 - 0.5;
      const sy = -dx * sin + dy * cos + height / 2 - 0.5;
      sample(data, width, height, sx, sy, out, (y * W + x) * 4);
    }
  return { data: out, width: W, height: H };
}

/** Bilinear sample with premultiplied alpha, written straight. */
function sample(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Uint8ClampedArray, at: number) {
  if (x < -0.5 || y < -0.5 || x > w - 0.5 || y > h - 0.5) return;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  let r = 0;
  let g = 0;
  let b = 0;
  let alpha = 0;
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
      alpha += wa;
    }
  if (alpha <= 0.001) return;
  out[at] = r / alpha;
  out[at + 1] = g / alpha;
  out[at + 2] = b / alpha;
  out[at + 3] = Math.round(alpha * 255);
}

/**
 * Keystone: each row is scaled horizontally about the centre, from (1 - amount) at the top to 1
 * at the bottom. Positive makes the top narrower, negative wider (amount within ±0.25).
 */
export function keystone(raster: Raster, amount: number): Raster {
  if (!amount) return raster;
  const { data, width, height } = raster;
  const wide = Math.ceil(width * (amount < 0 ? 1 - amount : 1));
  const out = new Uint8ClampedArray(wide * height * 4);
  for (let y = 0; y < height; y++) {
    const scale = 1 - amount * (1 - y / Math.max(1, height - 1));
    for (let x = 0; x < wide; x++) {
      const sx = (x + 0.5 - wide / 2) / scale + width / 2 - 0.5;
      sample(data, width, height, sx, y, out, (y * wide + x) * 4);
    }
  }
  return { data: out, width: wide, height };
}

/** Tilt and keystone, then a tight crop. */
export function straighten(raster: Raster, tilt: number, keystoneAmount: number): Raster {
  return cropToGarment(keystone(rotateRaster(raster, tilt), keystoneAmount), 0.04);
}

/** The rotation that stands the piece upright, when it is between 1° and 15° off; else 0. */
export function autoTilt(raster: Raster): number {
  const tilt = principalTilt(raster);
  return tilt !== null && Math.abs(tilt) >= 1 && Math.abs(tilt) <= 15 ? -tilt : 0;
}

/** The automatic deskew used by both cut-out options. */
export function autoDeskew(raster: Raster): Raster {
  const turn = autoTilt(raster);
  return turn ? straighten(raster, turn, 0) : raster;
}
