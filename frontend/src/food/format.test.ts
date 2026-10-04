import { describe, expect, it } from 'vitest';
import {
  addDays,
  expiry,
  formatAmount,
  formatQty,
  localDate,
  money,
  toBase,
  unitsFor,
  weekStart,
  kindName,
  stockKind,
} from './format';

const steak = { unit: 'g' as const, pieceSize: null, pieceUnit: null };
const tomato = { unit: 'pcs' as const, pieceSize: 120, pieceUnit: 'g' as const };
const water = { unit: 'ml' as const, pieceSize: 1500, pieceUnit: 'ml' as const };

describe('food format', () => {
  it('reads quantities the way people say them', () => {
    expect(formatQty(1300, steak)).toBe('1.3 kg');
    expect(formatQty(300, steak)).toBe('300 g');
    expect(formatQty(3, tomato)).toBe('3 pcs');
    expect(formatQty(0.5, tomato)).toBe('½ pc');
    expect(formatQty(1500, water)).toBe('1.5 l');
    expect(formatQty(1250, steak)).toBe('1.25 kg');
    expect(formatAmount(2, 'tbsp')).toBe('2 tbsp');
    expect(formatAmount(1, 'pcs')).toBe('1 pc');
  });

  it('offers the units an item can be counted in', () => {
    expect(unitsFor(steak)).toEqual(['g', 'kg']);
    expect(unitsFor(tomato)).toEqual(['pcs', 'g', 'kg']);
    expect(unitsFor(water)).toEqual(['ml', 'l', 'pcs']);
    expect(unitsFor(water, { cooking: true })).toEqual(['ml', 'l', 'tsp', 'tbsp', 'cup', 'pcs']);
    expect(toBase(1.3, 'kg', steak)).toBe(1300);
    expect(toBase(240, 'g', tomato)).toBe(2);
    expect(toBase(2, 'pcs', water)).toBe(3000);
  });

  it('says when food expires', () => {
    const today = '2026-10-02';
    expect(expiry('2026-09-30', today)).toMatchObject({
      tone: 'expired',
      label: 'Expired 2 days ago',
    });
    expect(expiry('2026-10-01', today)).toMatchObject({
      tone: 'expired',
      label: 'Expired yesterday',
    });
    expect(expiry('2026-10-02', today)).toMatchObject({ tone: 'today', label: 'Today' });
    expect(expiry('2026-10-03', today)).toMatchObject({ tone: 'soon', label: 'Tomorrow', days: 1 });
    expect(expiry('2026-10-05', today)).toMatchObject({ tone: 'soon', label: '3 days' });
    expect(expiry('2026-10-20', today)).toMatchObject({ tone: 'later', days: 18 });
    expect(expiry(null, today)).toMatchObject({ tone: 'none', label: 'No date' });
  });

  it('handles calendar days and money', () => {
    expect(localDate(new Date(2026, 9, 2, 23, 30))).toBe('2026-10-02');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(weekStart('2026-10-02')).toBe('2026-09-28');
    expect(weekStart('2026-10-05')).toBe('2026-10-05');
    expect(money(45.5)).toBe('45.50 lei');
    expect(money(340)).toBe('340 lei');
    expect(money(12.3, 'EUR')).toMatch(/12\.30/);
  });
});

describe('kind names', () => {
  it('puts a brand’s kind in its name, not a plain item’s', () => {
    expect(kindName('Coca-Cola', 'Zero', true)).toBe('Coca-Cola Zero');
    expect(kindName('Coca-Cola', 'Classic', true)).toBe('Coca-Cola');
    expect(kindName('Fanta', '', true)).toBe('Fanta');
    expect(kindName('Pasta', 'Penne', false)).toBe('Pasta');
  });
  it('knows the one kind in stock', () => {
    expect(stockKind([{ variant: 'Zero' }, { variant: 'zero' }])).toBe('Zero');
    expect(stockKind([{ variant: 'Zero' }, { variant: 'Lime' }])).toBeNull();
    expect(stockKind([{ variant: '' }])).toBeNull();
    expect(stockKind([])).toBeNull();
  });
});
