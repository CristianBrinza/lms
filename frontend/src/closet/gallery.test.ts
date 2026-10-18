import { describe, expect, it } from 'vitest';
import { slideIndex } from './gallery';

describe('slideIndex', () => {
  it('rounds to the nearest slide and clamps', () => {
    expect(slideIndex(0, 300, 3)).toBe(0);
    expect(slideIndex(140, 300, 3)).toBe(0);
    expect(slideIndex(160, 300, 3)).toBe(1);
    expect(slideIndex(9999, 300, 3)).toBe(2);
    expect(slideIndex(-20, 300, 3)).toBe(0);
    expect(slideIndex(10, 0, 3)).toBe(3 - 1);
    expect(slideIndex(10, 300, 0)).toBe(0);
  });
});
