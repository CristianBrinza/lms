import type { Place } from './api';
import { closetT } from './i18n';

/** Places on the screen: a place's own name, its path from the room, the tree's order. */

export function placeName(place: Pick<Place, 'kind' | 'name' | 'number' | 'side'>): string {
  const t = closetT();
  const base = place.name.trim() || `${t.placeKind[place.kind]}${place.number ? ` ${place.number}` : ''}`;
  return place.side ? `${base} · ${t.side[place.side]}` : base;
}

export function placePath(places: Map<string, Place>, id: string | null): Place[] {
  const path: Place[] = [];
  const seen = new Set<string>();
  let current = id ? places.get(id) : undefined;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? places.get(current.parentId) : undefined;
  }
  return path;
}

export const pathLabel = (places: Map<string, Place>, id: string | null) =>
  placePath(places, id).map(placeName).join(' › ');

/** A place's children, in order (shelves top-down on screen: the highest number first). */
export function childrenOf(places: Place[], parentId: string | null): Place[] {
  return places
    .filter((p) => p.parentId === parentId)
    .sort((a, b) => {
      if (a.kind === 'shelf' && b.kind === 'shelf') return (b.number ?? 0) - (a.number ?? 0) || a.position - b.position;
      return a.position - b.position;
    });
}

/** Everything under a place, itself included. */
export function subtree(places: Place[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const p of places)
      if (p.parentId && ids.has(p.parentId) && !ids.has(p.id)) {
        ids.add(p.id);
        grew = true;
      }
  }
  return ids;
}
