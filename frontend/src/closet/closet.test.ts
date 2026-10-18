import { describe, expect, it } from 'vitest';
import type { Place } from './api';
import { COLORS, hexToRgb, nearestColor } from './catalog';
import { alphaBox, dominantColors } from './images';
import { childrenOf, pathLabel, placePath, subtree } from './places';

/** A width × height RGBA picture, filled by a function of each pixel. */
function picture(width: number, height: number, fill: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set(fill(x, y), (y * width + x) * 4);
  return data;
}

describe('closet: photos in the browser', () => {
  it('names colours by what the eye sees', () => {
    expect(nearestColor(...hexToRgb(COLORS.navy))).toBe('navy');
    expect(nearestColor(20, 22, 26)).toBe('black');
    expect(nearestColor(250, 250, 248)).toBe('white');
    expect(nearestColor(200, 40, 45)).toBe('red');
    expect(nearestColor(190, 140, 90)).toBe('camel');
  });

  it('crops a cut-out to what is opaque', () => {
    const data = picture(10, 8, (x, y) => (x >= 2 && x <= 6 && y >= 3 && y <= 5 ? [0, 0, 0, 255] : [0, 0, 0, 0]));
    expect(alphaBox(data, 10, 8)).toEqual({ x: 2, y: 3, w: 5, h: 3 });
    expect(alphaBox(picture(4, 4, () => [0, 0, 0, 0]), 4, 4)).toBeNull();
  });

  it('finds the main colours of the piece, not of the background', () => {
    // A navy piece with a red stripe, on a transparent background.
    const cut = picture(40, 40, (x, y) =>
      x < 8 ? [255, 255, 255, 0] : y < 12 ? [195, 50, 47, 255] : [34, 48, 79, 255],
    );
    expect(dominantColors(cut, 40, 40, true)).toEqual(['navy', 'red']);
    // A photo with its background: only the middle counts.
    const photo = picture(40, 40, (x, y) =>
      x > 10 && x < 30 && y > 10 && y < 30 ? [63, 125, 74, 255] : [250, 250, 248, 255],
    );
    expect(dominantColors(photo, 40, 40, false)[0]).toBe('green');
  });
});

describe('closet: places', () => {
  const place = (id: string, parentId: string | null, kind: Place['kind'], extra: Partial<Place> = {}): Place => ({
    id,
    parentId,
    kind,
    name: '',
    number: null,
    side: '',
    position: 0,
    items: 0,
    ...extra,
  });
  const places = [
    place('room', null, 'room', { name: 'Bedroom' }),
    place('wardrobe', 'room', 'furniture', { name: 'Wardrobe' }),
    place('s1', 'wardrobe', 'shelf', { number: 1, position: 0 }),
    place('s2', 'wardrobe', 'shelf', { number: 2, side: 'left', position: 1 }),
    place('rail', 'wardrobe', 'rail', { position: 2 }),
  ];

  it('reads a path from the room, shelves numbered from the bottom drawn top-down', () => {
    const byId = new Map(places.map((p) => [p.id, p]));
    expect(placePath(byId, 's2').map((p) => p.id)).toEqual(['room', 'wardrobe', 's2']);
    expect(pathLabel(byId, 's2')).toBe('Bedroom › Wardrobe › Shelf 2 · left');
    expect(childrenOf(places, 'wardrobe').map((p) => p.id)).toEqual(['s2', 's1', 'rail']);
    expect([...subtree(places, 'wardrobe')].sort()).toEqual(['rail', 's1', 's2', 'wardrobe']);
  });
});
