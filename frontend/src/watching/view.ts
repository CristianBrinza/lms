import { episodeKey } from './logic';
import type { Play } from './types';

/**
 * Whose watching a screen shows: mine, another person's, several people's together (what they
 * watched with each other) or the whole household's (everyone's plays added up).
 */
export type WatchView =
  | { kind: 'me' }
  | { kind: 'person'; id: string }
  | { kind: 'together'; ids: string[] }
  | { kind: 'household' };

/** The view as the API's query: nothing for me, `userId`, `people=a,b` or `scope=household`. */
export function viewQuery(view: WatchView): {
  userId?: string;
  people?: string;
  scope?: 'household';
} {
  switch (view.kind) {
    case 'person':
      return { userId: view.id };
    case 'together':
      return { people: [...view.ids].sort().join(',') };
    case 'household':
      return { scope: 'household' };
    default:
      return {};
  }
}

/**
 * A title or season answers for one person: someone else's (`userId`), else mine. Together views
 * read my plays and who watched each with me.
 */
export const titleQuery = (view: WatchView): { userId?: string } =>
  view.kind === 'person' ? { userId: view.id } : {};

/** A stable cache key part for the view. */
export const viewKey = (view: WatchView) => JSON.stringify(viewQuery(view));

/** The people a view is about. */
export function viewIds(
  view: WatchView,
  meId: string,
  people: ReadonlyArray<{ id: string }>,
): string[] {
  switch (view.kind) {
    case 'person':
      return [view.id];
    case 'together':
      return view.ids;
    case 'household':
      return people.map((p) => p.id);
    default:
      return [meId];
  }
}

/**
 * Tapping a face in the view switcher. A tap on someone else alone shows them; adding a second
 * person (the together toggle on) makes a together view; removing down to one goes back to that
 * person.
 */
export function toggleInView(
  view: WatchView,
  id: string,
  meId: string,
  together: boolean,
): WatchView {
  if (!together) return id === meId ? { kind: 'me' } : { kind: 'person', id };
  const current = view.kind === 'together' ? view.ids : view.kind === 'person' ? [view.id] : [meId];
  const ids = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
  if (ids.length > 1) return { kind: 'together', ids };
  const only = ids[0] ?? meId;
  return only === meId ? { kind: 'me' } : { kind: 'person', id: only };
}

/**
 * Who a new play is for, before anyone changes it: the person being viewed, the people viewed
 * together, else (my own view, everyone's) who watched this title last time.
 */
export function defaultWho(view: WatchView, remembered: readonly string[]): string[] {
  if (view.kind === 'person') return [view.id];
  if (view.kind === 'together') return [...view.ids];
  return [...remembered];
}

/** Whether a who-choice made in this view becomes the remembered default (only my own views). */
export const remembersWho = (view: WatchView) => view.kind === 'me' || view.kind === 'household';

/** Who watched a play: its owner and whoever watched it with them in the same sitting. */
export const playPeople = (play: Pick<Play, 'userId' | 'together'>) => [
  play.userId,
  ...(play.together ?? []),
];

/**
 * Episodes every one of `ids` has watched, as 'season:episode' keys. Together, an episode counts
 * only when each person has a play of it (on their own or with the others).
 */
export function watchedByAll(plays: readonly Play[], ids: readonly string[]) {
  const seenBy = new Map<string, Set<string>>();
  for (const play of plays) {
    if (play.season === null || play.episode === null) continue;
    const key = episodeKey(play.season, play.episode);
    const set = seenBy.get(key) ?? new Set<string>();
    for (const person of playPeople(play)) set.add(person);
    seenBy.set(key, set);
  }
  const all = new Set<string>();
  for (const [key, set] of seenBy) if (ids.every((id) => set.has(id))) all.add(key);
  return all;
}
