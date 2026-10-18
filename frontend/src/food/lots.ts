import type { Lot } from './types';

/**
 * An item's pieces by kind, for picking which one a meal uses (which tea: Lovaré Champagne
 * Splashes, Tess Pleasure…): each kind once, with how much there is, its pieces in the order
 * cooking takes them — the opened one first, then the one that expires first.
 */
export interface KindGroup {
  /** The kind as stored ('' for pieces without one). */
  variant: string;
  lots: Lot[];
  total: number;
}

/** Cooking's order: opened first, then soonest to expire (no date last), then oldest. */
export function takingOrder(a: Lot, b: Lot): number {
  return (
    Number(!a.openedAt) - Number(!b.openedAt) ||
    (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999') ||
    a.addedAt.localeCompare(b.addedAt)
  );
}

/** Whether picking by kind makes sense: some pieces name their kind. */
export const hasKinds = (lots: ReadonlyArray<Pick<Lot, 'variant'>>) =>
  lots.some((lot) => lot.variant.trim());

/** Pieces grouped by kind (case aside), by name; pieces of no kind last. */
export function kindGroups(lots: Lot[], compare = (a: string, b: string) => a.localeCompare(b)) {
  const groups = new Map<string, KindGroup>();
  for (const lot of [...lots].sort(takingOrder)) {
    const key = lot.variant.trim().toLowerCase();
    const group = groups.get(key) ?? { variant: lot.variant.trim(), lots: [], total: 0 };
    // Named as written with capitals, when one of its pieces was ("Lovaré", not "lovaré").
    if (group.variant === group.variant.toLowerCase() && lot.variant.trim() !== key)
      group.variant = lot.variant.trim();
    group.lots.push(lot);
    group.total += lot.quantity;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (a, b) => Number(!a.variant) - Number(!b.variant) || compare(a.variant, b.variant),
  );
}

/** Kinds matching a search, in any of their names ("lovare", "champagne"). */
export function findKinds(groups: KindGroup[], query: string, names: (g: KindGroup) => string[]) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return groups;
  return groups.filter((group) => {
    const text = names(group).join(' ').toLocaleLowerCase();
    return words.every((word) => text.includes(word));
  });
}
