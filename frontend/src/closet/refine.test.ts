import { describe, expect, it } from 'vitest';
import { refineCutout, sharpenAlpha, type Raster } from './refine';
import { volumePadding, volumeRaster } from './volume';

function raster(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return { data, width, height };
}
const px = (r: Raster, x: number, y: number) => [...r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)];

// A 100 x 100 photo: a slightly warm white towel with a blue garment (30..70) and a stray speck.
const original = raster(100, 100, (x, y) => (x >= 30 && x < 70 && y >= 30 && y < 70 ? [40, 70, 200, 255] : [250, 240, 225, 255]));
const cut = raster(100, 100, (x, y) => {
  if (x >= 30 && x < 70 && y >= 30 && y < 70) return [40, 70, 200, x === 50 && y === 50 ? 0 : 255]; // a pinhole
  if (x >= 5 && x < 9 && y >= 5 && y < 9) return [200, 200, 200, 255]; // an island of towel
  return [250, 240, 225, 0];
});

describe('refineCutout', () => {
  const out = refineCutout(cut, original);
  it('ramps alpha', () => {
    const d = new Uint8ClampedArray([0, 0, 0, 60, 0, 0, 0, 128, 0, 0, 0, 220]);
    sharpenAlpha(d);
    expect([d[3], d[7], d[11]]).toEqual([0, 129, 255]);
  });
  it('drops islands, fills the pinhole and crops with 4% air', () => {
    expect(out.width).toBe(44); // 40 + 2 * round(40 * 0.04)
    expect(out.height).toBe(44);
    expect(px(out, 22, 22)[3]).toBe(255); // the filled pinhole, near the centre
    expect(px(out, 0, 0)[3]).toBe(0);
  });
  it('removes the towel colour cast from the garment', () => {
    const [r, , b] = px(out, 12, 12);
    // The warm towel (R high, B low) is corrected, so the garment loses red and gains blue.
    expect(b! / r!).toBeGreaterThan(200 / 40);
  });
});

describe('volumeRaster', () => {
  const garment = refineCutout(cut, original);
  const result = volumeRaster(garment);
  const { left, top } = volumePadding(garment.width, garment.height);
  it('adds no white and keeps inside shading gentle', () => {
    for (let y = 0; y < garment.height; y++)
      for (let x = 0; x < garment.width; x++) {
        const src = px(garment, x, y);
        if (src[3] !== 255) continue;
        const dst = px(result, x + left, y + top);
        for (let c = 0; c < 3; c++) {
          expect(dst[c]!).toBeLessThanOrEqual(Math.min(255, src[c]! * 1.03 + 2));
          expect(dst[c]!).toBeGreaterThanOrEqual(src[c]! * 0.7 - 2);
        }
      }
  });
  it('leaves the outside transparent except in the shadow', () => {
    expect(result.height).toBeGreaterThan(garment.height);
    expect(px(result, 0, 0)[3]).toBe(0);
    expect(px(result, result.width - 1, 0)[3]).toBe(0);
    // shadow strictly below the hem, never above the garment's top
    const aboveTop = Array.from({ length: result.width }, (_, x) => px(result, x, top - 1)[3]!);
    expect(Math.max(...aboveTop)).toBe(0);
    const hem = top + garment.height - 6;
    const below = Array.from({ length: result.width }, (_, x) => px(result, x, hem + 6)[3]!);
    expect(Math.max(...below)).toBeGreaterThan(0);
    expect(Math.max(...below)).toBeLessThanOrEqual(Math.round(0.18 * 255) + 1);
  });
});

describe('straighten', () => {
  const bar = raster(60, 160, (x, y) => (x >= 20 && x < 40 && y >= 20 && y < 140 ? [90, 90, 90, 255] : [0, 0, 0, 0]));
  it('finds the tilt of a turned piece and stands it upright', async () => {
    const { principalTilt, rotateRaster, autoDeskew, keystone } = await import('./straighten');
    const tilted = rotateRaster(bar, 8);
    expect(principalTilt(tilted)).toBeGreaterThan(7);
    expect(principalTilt(tilted)).toBeLessThan(9);
    const fixed = autoDeskew(tilted);
    expect(fixed.width).toBeLessThan(tilted.width);
    expect(Math.abs(principalTilt(fixed) ?? 0)).toBeLessThan(1);
    expect(autoDeskew(bar)).toBe(bar); // already straight: untouched
    const narrow = keystone(bar, 0.2);
    const row = (r: Raster, y: number) => Array.from({ length: r.width }, (_, x) => px(r, x, y)[3]!).filter((a) => a > 128).length;
    expect(row(narrow, 30)).toBeLessThan(row(narrow, 130));
  });
});

describe('touch-up tools', () => {
  it('wand removes the connected near-white area only, undo restores it', async () => {
    const { wandErase, erase, restore, History, alphaOf, setAlpha } = await import('./touchup');
    // left half white towel, right half dark garment, both opaque
    const pic = raster(40, 20, (x) => (x < 20 ? [250, 250, 250, 255] : [30, 40, 90, 255]));
    const base = { ...pic, data: new Uint8ClampedArray(pic.data) };
    const history = new History(20);
    history.push(alphaOf(pic));
    expect(wandErase(pic, 5, 5, 20)).toBe(20 * 20);
    expect(px(pic, 5, 5)[3]).toBe(0);
    expect(px(pic, 30, 5)[3]).toBe(255);
    setAlpha(pic, history.undo(alphaOf(pic))!, base);
    expect(px(pic, 5, 5)).toEqual([250, 250, 250, 255]);
    erase(pic, 30, 10, 4);
    expect(px(pic, 30, 10)[3]).toBe(0);
    restore(pic, base, 30, 10, 4);
    expect(px(pic, 30, 10)[3]).toBe(255);
    for (let i = 0; i < 25; i++) history.push(alphaOf(pic));
    let steps = 0;
    while (history.undo(alphaOf(pic))) steps++;
    expect(steps).toBe(20);
  });
});
