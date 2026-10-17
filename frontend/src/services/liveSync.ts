import { useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from './api/client';

/**
 * Live sync: what someone else in the household changes (in the app, or Claude through MCP or an
 * access key) shows here within seconds, without pulling to refresh. The server's GET /api/events
 * says which area changed (backend/src/modules/live); this refetches that area's queries.
 */

export type LiveArea =
  | 'food'
  | 'house'
  | 'training'
  | 'travel'
  | 'watching'
  | 'wishlist'
  | 'reminders'
  | 'people'
  | 'paydays'
  | 'other';

export interface LiveEvent {
  area: LiveArea;
  path: string;
  by: string;
  at: string;
}

export interface LiveTarget {
  queryKey: QueryKey;
  /** Only this query, not the ones under it (['me'] without sessions, keys and reminders). */
  exact?: boolean;
}

// The prefixes of the query key factories (foodKeys, trainingKeys, travelKeys, watchingKeys,
// paydaysQueryKey, queryKeys), written out so the app shell does not pull every area into the first
// load.
// liveSync.test.ts keeps them in step with the factories.
const FOOD: LiveTarget[] = [
  { queryKey: ['food'] },
  // What was eaten counts in each person's energy.
  { queryKey: ['training', 'energy'] },
  { queryKey: ['training', 'overview'] },
];

const TARGETS: Record<Exclude<LiveArea, 'other'>, LiveTarget[]> = {
  // The House is the kitchen's engine with area=house: the same queries.
  food: FOOD,
  house: FOOD,
  training: [{ queryKey: ['training'] }],
  // A trip's “shop for it” puts lines on the shopping list.
  travel: [
    { queryKey: ['travel'] },
    { queryKey: ['food', 'shopping'] },
    { queryKey: ['food', 'overview'] },
  ],
  // What each person watched, their lists and the household's Moldova availability checks.
  watching: [{ queryKey: ['watching'] }],
  // The priority buy list (its count also shows on Home).
  wishlist: [{ queryKey: ['wishlist'] }],
  reminders: [{ queryKey: ['me', 'reminders'] }],
  people: [
    { queryKey: ['me'], exact: true },
    { queryKey: ['paydays'] },
    { queryKey: ['admin'] },
    { queryKey: ['food', 'people'] },
    { queryKey: ['training', 'people'] },
  ],
  paydays: [{ queryKey: ['paydays'] }],
};

/** The queries an area's change touches; null means all of them (an area this app doesn't know). */
export function liveTargets(area: string): LiveTarget[] | null {
  return Object.hasOwn(TARGETS, area) ? TARGETS[area as keyof typeof TARGETS] : null;
}

const startsWith = (key: QueryKey, prefix: QueryKey) =>
  prefix.length <= key.length && prefix.every((part, index) => key[index] === part);

/**
 * Refetches what the areas touch, each query once: a second invalidation of a query already
 * refetching would cancel and restart it, so a key under a broader one in the batch is dropped.
 */
export function invalidateAreas(queryClient: QueryClient, areas: Iterable<string>): void {
  const targets: LiveTarget[] = [];
  for (const area of areas) {
    const found = liveTargets(area);
    if (!found) {
      void queryClient.invalidateQueries();
      return;
    }
    targets.push(...found);
  }
  const chosen: LiveTarget[] = [];
  for (const target of targets) {
    const covered = chosen.some(
      (other) =>
        startsWith(target.queryKey, other.queryKey) &&
        (!other.exact || (target.exact && other.queryKey.length === target.queryKey.length)),
    );
    if (!covered) chosen.push(target);
  }
  for (const target of chosen)
    void queryClient.invalidateQueries({ queryKey: target.queryKey, exact: target.exact });
}

/** Several changes in a row (a checkout ticks many lines) become one refetch. */
const DEBOUNCE_MS = 300;
const RETRY_FIRST_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/**
 * Mounted once in the signed-in app shell. Listens while the tab is visible; hidden, it lets go
 * of the connection, and coming back it reconnects and refetches everything once (anything could
 * have changed meanwhile). No UI: the screens simply show the new data.
 */
export function useLiveSync(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof EventSource === 'undefined' || typeof document === 'undefined') return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let flushTimer: ReturnType<typeof setTimeout> | undefined;
    let retryDelay = RETRY_FIRST_MS;
    let stopped = false;
    const areas = new Set<string>();

    const flush = () => {
      flushTimer = undefined;
      const batch = [...areas];
      areas.clear();
      invalidateAreas(queryClient, batch);
    };

    const disconnect = () => {
      clearTimeout(retryTimer);
      retryTimer = undefined;
      source?.close();
      source = null;
    };

    const connect = () => {
      disconnect();
      if (stopped || document.visibilityState === 'hidden') return;
      let opened = false;
      const current = new EventSource('/api/events');
      source = current;
      current.onopen = () => {
        opened = true;
        retryDelay = RETRY_FIRST_MS;
      };
      current.addEventListener('change', (message) => {
        try {
          const event = JSON.parse((message as MessageEvent<string>).data) as LiveEvent;
          areas.add(event.area);
        } catch {
          areas.add('other');
        }
        flushTimer ??= setTimeout(flush, DEBOUNCE_MS);
      });
      current.onerror = () => {
        // The browser would retry by itself, but not after a 401 (the access cookie expired
        // while the stream was down): take over, with backoff and a fresh session.
        if (source !== current) return;
        disconnect();
        const delay = retryDelay + Math.random() * 500;
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
        retryTimer = setTimeout(() => {
          if (opened) {
            connect();
            return;
          }
          // Never opened: likely signed out of this access token. A plain API call refreshes
          // the session (or signs the app out if it's over); offline, it just fails and we wait.
          void api
            .get('/me')
            .catch(() => undefined)
            .finally(connect);
        }, delay);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        disconnect();
        return;
      }
      if (source) return;
      retryDelay = RETRY_FIRST_MS;
      connect();
      void queryClient.invalidateQueries();
    };
    const onOnline = () => {
      if (source?.readyState === EventSource.OPEN) return;
      retryDelay = RETRY_FIRST_MS;
      connect();
    };

    connect();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      stopped = true;
      disconnect();
      clearTimeout(flushTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [queryClient]);
}
