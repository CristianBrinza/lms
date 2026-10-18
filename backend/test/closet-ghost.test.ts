import { describe, expect, it } from 'vitest';
import { ghostRaster, partOf, partsFor } from '../src/modules/closet/ghost';
import { setupTestApp } from './helpers';

const t = setupTestApp();
const PHOTO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('closet 3D effect', () => {
  it('reads the parts from the parsing colours and the category', () => {
    expect(partOf(0, 0, 0)).toBeNull();
    expect(partOf(128, 0, 0)).toBe('upper');
    expect(partOf(0, 128, 0)).toBe('lower');
    expect(partOf(0, 0, 128)).toBe('full');
    expect(partsFor('tops')).toContain('upper');
    expect(partsFor('bottoms')).toContain('lower');
    expect(partsFor('shoes')).toBeNull();
  });

  it('keeps the wanted clothes only, with the person gone', () => {
    const w = 80;
    const h = 100;
    const rgb = new Uint8Array(w * h * 3).fill(200);
    const map = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 3;
        if (x >= 20 && x < 60 && y >= 10 && y < 50) map[p] = 128; // upper body
        if (x >= 25 && x < 55 && y >= 50 && y < 90) map[p + 1] = 128; // lower body
        if (x >= 2 && x < 4 && y >= 2 && y < 4) map[p] = 128; // a speck
      }
    const out = ghostRaster(rgb, map, w, h, ['upper'])!;
    expect(out).not.toBeNull();
    // 40 x 40 of top plus 4% air each side; no trousers, no speck.
    expect(out.width).toBe(40 + 2 * Math.round(40 * 0.04));
    expect(out.height).toBe(out.width);
    const alphaAt = (x: number, y: number) => out.data[(y * out.width + x) * 4 + 3]!;
    expect(alphaAt(out.width / 2, out.height / 2)).toBe(255);
    expect(alphaAt(0, 0)).toBe(0);
    expect(ghostRaster(rgb, new Uint8Array(w * h * 3), w, h, ['upper'])).toBeNull();
  });

  it('refuses the effect for things that are not worn on the body', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const b = t.browser();
    await b.login('ana@example.com');
    const { item } = (await b.post('/api/closet/items', { name: 'Boots', category: 'shoes' })).body;
    await b.post(`/api/closet/items/${item.id}/photos`, { image: PHOTO });
    const res = await b.post(`/api/closet/items/${item.id}/ghost`, {});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_WORN');
  });
});
