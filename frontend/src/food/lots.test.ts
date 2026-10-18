import { describe, expect, it } from 'vitest';
import { findKinds, hasKinds, kindGroups } from './lots';
import type { Lot } from './types';

const lot = (id: string, extra: Partial<Lot>): Lot => ({
  id,
  productId: 'tea',
  quantity: 1,
  initialQuantity: 1,
  location: 'pantry',
  addedAt: '2026-10-01T10:00:00Z',
  expiresOn: null,
  openedAt: null,
  price: null,
  storeId: null,
  storeName: null,
  tripId: null,
  note: '',
  variant: '',
  package: '',
  packageSize: null,
  ...extra,
});

describe('picking a piece by kind', () => {
  const lots = [
    lot('a', { variant: 'Tess Pleasure', quantity: 5, expiresOn: '2027-01-01' }),
    lot('b', { variant: 'Lovaré Champagne Splashes', quantity: 3, expiresOn: '2027-03-01' }),
    lot('c', { variant: 'lovaré champagne splashes', quantity: 1, openedAt: '2026-10-10T08:00:00Z' }),
    lot('d', { quantity: 2 }),
  ];

  it('merges a kind’s pieces, the opened one first, kinds by name, no kind last', () => {
    const groups = kindGroups(lots);
    expect(groups.map((g) => [g.variant, g.total, g.lots.map((l) => l.id)])).toEqual([
      ['Lovaré Champagne Splashes', 4, ['c', 'b']],
      ['Tess Pleasure', 5, ['a']],
      ['', 2, ['d']],
    ]);
    expect(hasKinds(lots)).toBe(true);
    expect(hasKinds([lot('x', {})])).toBe(false);
  });

  it('finds kinds by any of their words', () => {
    const groups = kindGroups(lots);
    expect(findKinds(groups, 'champ lov', (g) => [g.variant]).map((g) => g.variant)).toEqual([
      'Lovaré Champagne Splashes',
    ]);
    expect(findKinds(groups, ' ', (g) => [g.variant])).toHaveLength(3);
  });
});
