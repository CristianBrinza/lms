import { describe, expect, it } from 'vitest';
import { dropEdgeStrips, refineCutout, sharpenAlpha, type Raster } from './refine';

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

describe('dropEdgeStrips', () => {
  // A 200 x 200 picture: a garment (60..140 square) with a towel strip along the top edge (rows 0..20,
  // all across), joined to the garment by a thin neck (6 px wide), and a bed corner at the bottom left.
  const scene = raster(200, 200, (x, y) => {
    if (x >= 60 && x < 140 && y >= 50 && y < 150) return [20, 20, 20, 255];
    if (y < 20) return [240, 240, 240, 255]; // the towel strip along the top
    if (x >= 97 && x < 103 && y >= 20 && y < 50) return [240, 240, 240, 255]; // the neck
    if (x < 30 && y >= 170) return [230, 230, 230, 255]; // a corner
    return [0, 0, 0, 0];
  });
  it('removes the strip and the corner but keeps the garment whole', () => {
    const data = new Uint8ClampedArray(scene.data);
    dropEdgeStrips(data, 200, 200);
    const alpha = (x: number, y: number) => data[(y * 200 + x) * 4 + 3]!;
    expect(alpha(100, 5)).toBe(0);
    expect(alpha(10, 190)).toBe(0);
    expect(alpha(61, 51)).toBe(255); // the garment's corner survives the opening
    expect(alpha(139, 149)).toBe(255);
    expect(alpha(100, 100)).toBe(255);
  });
  it('keeps a garment that the picture itself cuts off', () => {
    const cropped = raster(100, 100, (x) => (x >= 20 && x < 80 ? [10, 10, 10, 255] : [0, 0, 0, 0]));
    const data = new Uint8ClampedArray(cropped.data);
    dropEdgeStrips(data, 100, 100);
    expect(data[(0 * 100 + 50) * 4 + 3]).toBe(255);
    expect(data[(99 * 100 + 21) * 4 + 3]).toBe(255);
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
