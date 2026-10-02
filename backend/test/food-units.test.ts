import { describe, expect, it } from 'vitest';
import { amountIn, displayUnit, toBase, UnitMismatchError } from '../src/modules/food/units';

const steak = { unit: 'g' as const, pieceSize: null, pieceUnit: null };
const tomato = { unit: 'pcs' as const, pieceSize: 120, pieceUnit: 'g' as const };
const milk = { unit: 'pcs' as const, pieceSize: 1000, pieceUnit: 'ml' as const };
const water = { unit: 'ml' as const, pieceSize: 1500, pieceUnit: 'ml' as const };
const egg = { unit: 'pcs' as const, pieceSize: null, pieceUnit: null };

describe('food units', () => {
  it('converts within a family to the base unit', () => {
    expect(toBase(1.3, 'kg', steak)).toBe(1300);
    expect(toBase(300, 'g', steak)).toBe(300);
    expect(toBase(2, 'tbsp', water)).toBe(30);
    expect(toBase(1.5, 'l', water)).toBe(1500);
    expect(toBase(2, 'pcs', tomato)).toBe(2);
  });

  it('converts pieces through the piece size', () => {
    expect(toBase(240, 'g', tomato)).toBe(2);
    expect(toBase(0.5, 'l', milk)).toBe(0.5);
    expect(toBase(2, 'pcs', water)).toBe(3000);
  });

  it('refuses units that cannot be converted', () => {
    expect(() => toBase(1, 'kg', egg)).toThrow(UnitMismatchError);
    expect(() => toBase(1, 'l', steak)).toThrow(UnitMismatchError);
    expect(() => toBase(1, 'pcs', steak)).toThrow(UnitMismatchError);
    expect(() => toBase(1, 'ml', tomato)).toThrow(UnitMismatchError);
  });

  it('shows an amount in a chosen unit and picks a readable one', () => {
    expect(amountIn(1300, 'kg', steak)).toBe(1.3);
    expect(amountIn(30, 'tbsp', water)).toBe(2);
    expect(displayUnit(1300, steak)).toBe('kg');
    expect(displayUnit(300, steak)).toBe('g');
    expect(displayUnit(1500, water)).toBe('l');
    expect(displayUnit(3, tomato)).toBe('pcs');
  });

  it('keeps sane precision', () => {
    expect(toBase(0.1, 'kg', steak) + toBase(0.2, 'kg', steak)).toBe(300);
    expect(toBase(100, 'g', tomato)).toBe(0.833);
  });
});
