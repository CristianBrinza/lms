import { describe, expect, it } from 'vitest';
import { fitWithin, humanSize } from './media';

describe('assistant media', () => {
  it('shrinks to 2048 on the long side and never enlarges', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('writes sizes', () => {
    expect(humanSize(2048)).toBe('2 KB');
    expect(humanSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
