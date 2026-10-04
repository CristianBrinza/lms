import { describe, expect, it } from 'vitest';
import { addWeights, countLabel, parseWeights, removeWeight, weightsLabel } from './weights';

describe('parseWeights', () => {
  it('reads spaces, commas, slashes and a kg unit', () => {
    expect(parseWeights('2 4 8')).toEqual([2, 4, 8]);
    expect(parseWeights('2, 4, 8')).toEqual([2, 4, 8]);
    expect(parseWeights('6/8/10kg')).toEqual([6, 8, 10]);
    expect(parseWeights('2,4,8')).toEqual([2, 4, 8]);
  });

  it('takes a comma between digits as a decimal comma', () => {
    expect(parseWeights('12,5 kg')).toEqual([12.5]);
    expect(parseWeights('2.5 1,25')).toEqual([1.25, 2.5]);
  });

  it('sorts, drops repeats and nonsense', () => {
    expect(parseWeights('8 2 8 abc 0 -3 900')).toEqual([2, 8]);
    expect(parseWeights('')).toEqual([]);
  });
});

describe('weights lists', () => {
  it('adds and removes keeping the order', () => {
    expect(addWeights([2, 8], [4, 8])).toEqual([2, 4, 8]);
    expect(removeWeight([2, 4, 8], 4)).toEqual([2, 8]);
  });

  it('reads back as a line', () => {
    expect(weightsLabel([2, 4, 8], true)).toBe('2 · 4 · 8 kg, pairs');
    expect(weightsLabel([12], false)).toBe('12 kg');
    expect(weightsLabel([12], true)).toBe('12 kg, a pair');
    expect(weightsLabel([1.25, 2.5], false)).toBe('1.25 · 2.5 kg');
    expect(weightsLabel([], true)).toBe('');
  });

  it('says when something is away', () => {
    expect(countLabel(0)).toBe('Not at home right now');
    expect(countLabel(1)).toBe('One');
    expect(countLabel(3)).toBe('3 of them');
  });
});
