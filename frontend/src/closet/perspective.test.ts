import { describe, expect, it } from 'vitest';
import { fitLine, focalPixels, planPerspective, silhouetteKeystone, solveHomography, warpPerspective } from './perspective';
import type { Raster } from './refine';

const make = (w: number, h: number, at: (x: number, y: number) => number): Raster => {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = at(x, y);
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  return { data, width: w, height: h };
};

/** A white towel between two edges (x at the top row and at the bottom row), a dark garment on it, a dark bed around. */
const towel = (topLeft: number, topRight: number, bottomLeft: number, bottomRight: number) =>
  make(300, 400, (x, y) => {
    if (y < 30 || y > 370) return 40;
    const t = (y - 30) / 340;
    const l = topLeft + (bottomLeft - topLeft) * t;
    const r = topRight + (bottomRight - topRight) * t;
    if (x < l || x > r) return 40;
    return x > 120 && x < 180 && y > 150 && y < 300 ? 30 : 235;
  });

/**
 * A 600 x 800 photo of a plane (a white towel, 1.8 wide and 2.4 long, on a dark bed) from a pinhole
 * camera looking down at it, `tilt` degrees from straight above, with the iPhone's 26 mm lens.
 */
function render(tilt: number, f35 = 26): Raster {
  const w = 600;
  const h = 800;
  const f = focalPixels(w, h, f35);
  const t = (tilt * Math.PI) / 180;
  const n = [0, -Math.sin(t), -Math.cos(t)];
  const far = [0, -Math.cos(t), Math.sin(t)];
  const D = 3;
  return make(w, h, (x, y) => {
    const r = [(x + 0.5 - w / 2) / f, (y + 0.5 - h / 2) / f, 1];
    const k = (n[2]! * D) / (n[0]! * r[0]! + n[1]! * r[1]! + n[2]! * r[2]!);
    const P = [k * r[0]!, k * r[1]!, k * r[2]! - D];
    const X = P[0]!;
    const Y = P[1]! * far[1]! + P[2]! * far[2]!;
    return Math.abs(X) < 0.9 && Y > -1 && Y < 1.4 ? 235 : 40;
  });
}

/** Width / height of the bright area. */
const towelAspect = (r: Raster) => {
  let x0 = r.width;
  let x1 = -1;
  let y0 = r.height;
  let y1 = -1;
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++)
      if (r.data[(y * r.width + x) * 4]! > 150) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { width: x1 - x0 + 1, height: y1 - y0 + 1 };
};

describe('perspective', () => {
  it.each([25, 35, 45])('gives a towel seen at %i degrees its true proportions (2.4 / 1.8) back', (tilt) => {
    const photo = render(tilt);
    const before = towelAspect(photo);
    const plan = planPerspective(photo);
    expect(plan).not.toBeNull();
    expect(plan!.tilt).toBeGreaterThan(tilt - 3);
    expect(plan!.tilt).toBeLessThan(tilt + 3);
    const fixed = warpPerspective(photo, plan!, 'clamp');
    const after = towelAspect(fixed);
    expect(before.height / before.width).toBeLessThan(1.2); // it really was foreshortened
    expect(after.height / after.width / (2.4 / 1.8)).toBeGreaterThan(0.97);
    expect(after.height / after.width / (2.4 / 1.8)).toBeLessThan(1.03);
    // edges now vertical: the towel is as wide near the top as near the bottom
    const rowWidth = (y: number) => {
      let a = -1;
      let b = -1;
      for (let x = 0; x < fixed.width; x++)
        if (fixed.data[(y * fixed.width + x) * 4]! > 150) {
          if (a < 0) a = x;
          b = x;
        }
      return b - a;
    };
    expect(Math.abs(rowWidth(Math.round(fixed.height * 0.2)) - rowWidth(Math.round(fixed.height * 0.8)))).toBeLessThanOrEqual(4);
  });

  it('depends on the focal length it is told', () => {
    const photo = render(35, 35);
    const plan = planPerspective(photo, 35)!;
    const after = towelAspect(warpPerspective(photo, plan, 'clamp'));
    expect(after.height / after.width / (2.4 / 1.8)).toBeGreaterThan(0.97);
    expect(after.height / after.width / (2.4 / 1.8)).toBeLessThan(1.03);
  });

  it('leaves a straight towel, or a photo without one, alone', () => {
    expect(planPerspective(towel(60, 240, 60, 240))).toBeNull();
    expect(planPerspective(towel(60, 240, 59, 241))).toBeNull(); // under 2%
    expect(planPerspective(make(300, 400, () => 40))).toBeNull();
    // a towel that fills the frame has no edges to go by
    expect(planPerspective(make(300, 400, () => 230))).toBeNull();
  });

  it('solves the homography of four points', () => {
    const from: [number, number][] = [[0, 0], [10, 0], [10, 20], [0, 20]];
    const to: [number, number][] = [[2, 1], [9, 2], [12, 18], [-1, 22]];
    const h = solveHomography(from, to);
    from.forEach(([x, y], i) => {
      const d = h[6]! * x + h[7]! * y + h[8]!;
      expect((h[0]! * x + h[1]! * y + h[2]!) / d).toBeCloseTo(to[i]![0], 6);
      expect((h[3]! * x + h[4]! * y + h[5]!) / d).toBeCloseTo(to[i]![1], 6);
    });
  });

  it('fits a line through points with outliers', () => {
    const points: [number, number][] = Array.from({ length: 60 }, (_, y) => [y, 10 + 0.5 * y] as [number, number]);
    points[5] = [5, 90];
    points[20] = [20, -30];
    const fit = fitLine(points)!;
    expect(fit.line.a).toBeCloseTo(0.5, 2);
    expect(fit.line.b).toBeCloseTo(10, 1);
  });

  it('reads a keystone off a piece whose sides lean in at the top', () => {
    const piece = (topHalf: number, bottomHalf: number) =>
      make(300, 400, (x, y) => {
        const half = topHalf + ((bottomHalf - topHalf) * y) / 399;
        return Math.abs(x - 150) < half ? 90 : 0;
      });
    const alpha = (r: Raster) => ({ ...r, data: r.data.map((v, i) => (i % 4 === 3 ? (r.data[i - 3]! > 0 ? 255 : 0) : v)) });
    expect(silhouetteKeystone(alpha(piece(80, 120)))).toBeLessThan(-0.1); // narrow top: widen it
    expect(silhouetteKeystone(alpha(piece(100, 100)))).toBe(0);
  });
});
