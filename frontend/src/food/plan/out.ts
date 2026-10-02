import type { OutKind } from '../types';

/** Where a meal was eaten when it wasn't cooked at home. */
export const OUT_KINDS: OutKind[] = ['restaurant', 'delivery', 'party', 'work', 'other'];

export const OUT_LABEL: Record<OutKind, string> = {
  restaurant: 'Restaurant',
  delivery: 'Ordered in',
  party: 'A party',
  work: 'At work',
  other: 'Somewhere else',
};
