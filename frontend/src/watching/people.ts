import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useUser } from '@/app/auth';
import { storage } from '@/lib/storage';
import { trainingApi, trainingKeys } from '@/training/api';
import type { Person } from '@/training/types';
import { defaultWho, remembersWho, viewIds, viewKey, type WatchView } from './view';

/**
 * Who Watching is about. Two choices, both remembered on this device:
 *
 * - the view (Home, Library, Stats): me, another person, several people together, or the whole
 *   household; shared by those screens at once, like Training's person;
 * - who watched (marking something): me alone or several of us; the last choice is the default,
 *   and each title remembers its own (a show we watch together pre-selects both of us).
 *
 * The household is Training's people list (the same endpoint its PersonSwitcher reads).
 */

const VIEW_KEY = 'lms:watching-view';
const WHO_KEY = 'lms:watching-who';
const WHO_BY_TITLE_KEY = 'lms:watching-who-by-title';
/** Titles remembered at most; the oldest choice is forgotten first. */
const WHO_BY_TITLE_MAX = 200;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let view: WatchView | null = storage.getJson<WatchView>(VIEW_KEY);
let viewSnapshot = JSON.stringify(view);

export function chooseView(next: WatchView) {
  view = next;
  viewSnapshot = JSON.stringify(next);
  storage.setJson(VIEW_KEY, next);
  notify();
}

/** The household: everyone in it, me first. */
export function useHousehold(): { me: Person; people: Person[]; loaded: boolean } {
  const user = useUser();
  const query = useQuery({
    queryKey: trainingKeys.people,
    queryFn: trainingApi.people,
    staleTime: 5 * 60_000,
  });
  const me: Person = query.data?.find((p) => p.id === user.id) ?? {
    id: user.id,
    name: user.name,
    surname: user.surname,
  };
  const others = (query.data ?? []).filter((p) => p.id !== user.id);
  return { me, people: [me, ...others], loaded: query.isSuccess };
}

/**
 * The current view, checked against the household: someone who left falls back to me, and a
 * "together" of one becomes that person.
 */
export function useWatchView(): {
  view: WatchView;
  ids: string[];
  setView: (view: WatchView) => void;
  me: Person;
  people: Person[];
} {
  const { me, people, loaded } = useHousehold();
  useSyncExternalStore(subscribe, () => viewSnapshot);
  let current: WatchView = view ?? { kind: 'me' };
  if (loaded) {
    const known = new Set(people.map((p) => p.id));
    if (current.kind === 'person' && !known.has(current.id)) current = { kind: 'me' };
    if (current.kind === 'together') {
      const ids = current.ids.filter((id) => known.has(id));
      current =
        ids.length > 1
          ? { kind: 'together', ids }
          : ids[0] && ids[0] !== me.id
            ? { kind: 'person', id: ids[0] }
            : { kind: 'me' };
    }
  }
  return { view: current, ids: viewIds(current, me.id, people), setView: chooseView, me, people };
}

// ---------------------------------------------------------------- who watched

/** Bumped on every change, so each screen re-reads who (a title's own choice included). */
let whoSnapshot = 0;
/** Choices made while looking at someone else (or several of us): kept for this visit only. */
const sessionWho = new Map<string, string[]>();

/** Who watched this title last time (or, new to the title, my last choice); me by default. */
export function rememberedWho(titleId: string | null, meId: string, known: Set<string>): string[] {
  const byTitle = storage.getJson<Record<string, string[]>>(WHO_BY_TITLE_KEY) ?? {};
  const last = storage.getJson<string[]>(WHO_KEY);
  const pick = (titleId ? byTitle[titleId] : undefined) ?? last ?? [meId];
  const valid = pick.filter((id) => known.has(id));
  return valid.length ? valid : [meId];
}

/** Keeps who watched, for this title and as the next default. */
export function rememberWho(titleId: string | null, ids: string[]) {
  storage.setJson(WHO_KEY, ids);
  whoSnapshot++;
  if (titleId) {
    const byTitle = storage.getJson<Record<string, string[]>>(WHO_BY_TITLE_KEY) ?? {};
    delete byTitle[titleId];
    byTitle[titleId] = ids;
    const keys = Object.keys(byTitle);
    for (const key of keys.slice(0, Math.max(0, keys.length - WHO_BY_TITLE_MAX)))
      delete byTitle[key];
    storage.setJson(WHO_BY_TITLE_KEY, byTitle);
  }
  notify();
}

/** Who watches a title by default, re-read when a choice is remembered anywhere. */
export function useWho(titleId: string | null): {
  who: string[];
  setWho: (ids: string[]) => void;
  people: Person[];
  me: Person;
} {
  const { me, people } = useHousehold();
  useSyncExternalStore(subscribe, () => whoSnapshot);
  const known = new Set(people.map((p) => p.id));
  return {
    who: rememberedWho(titleId, me.id, known),
    setWho: (ids) => rememberWho(titleId, ids),
    people,
    me,
  };
}

/**
 * Who a new play of this title is for, on the screen being looked at:
 *
 * - looking at someone else: them (I'm marking what Patricia watched);
 * - several of us together: all of us;
 * - my own view or everyone's: who watched this title last time (or my last choice).
 *
 * Changing it in my own view is remembered; in someone else's view it holds for this visit
 * only, so it never leaks into my own defaults.
 */
export function useMarkWho(titleId: string | null): {
  who: string[];
  setWho: (ids: string[]) => void;
  view: WatchView;
  people: Person[];
  me: Person;
} {
  const { view, me, people } = useWatchView();
  useSyncExternalStore(subscribe, () => whoSnapshot);
  const known = new Set(people.map((p) => p.id));
  const key = `${titleId ?? ''}|${viewKey(view)}`;
  const base = defaultWho(view, rememberedWho(titleId, me.id, known));
  const own = remembersWho(view) ? undefined : sessionWho.get(key);
  return {
    who: own?.length ? own : base,
    setWho: (ids) => {
      if (!ids.length) return;
      if (remembersWho(view)) return rememberWho(titleId, ids);
      sessionWho.set(key, ids);
      whoSnapshot++;
      notify();
    },
    view,
    people,
    me,
  };
}
