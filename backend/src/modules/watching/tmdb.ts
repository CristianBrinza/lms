import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import type { Locale } from '../../lib/i18n';

/**
 * TMDB (themoviedb.org), asked politely: one key for the household (a v4 read access token as a
 * Bearer header, or a v3 key as `api_key`), a 10-second timeout, at most four requests at once,
 * the same request never twice at the same time, and every answer cached in PostgreSQL (see
 * titles.ts for titles and seasons, `cached` below for the rest). Images are never fetched here:
 * the app loads them from TMDB's CDN in small sizes.
 */

const API = 'https://api.themoviedb.org/3';
const TIMEOUT_MS = 10_000;
const MAX_CONCURRENT = 4;

/** The language TMDB is asked in, per LMS language. */
export const TMDB_LANGUAGE: Record<Locale, string> = { en: 'en-US', ro: 'ro-RO', ru: 'ru-RU' };

export type Params = Record<string, string | number | boolean | undefined | null>;

export interface Tmdb {
  readonly configured: boolean;
  get<T>(path: string, params?: Params): Promise<T>;
}

type Fetch = typeof fetch;

const clients = new WeakMap<AppDeps, Tmdb>();
const fetches = new WeakMap<AppDeps, Fetch>();

/** Tests (and nothing else) answer for TMDB with their own fetch. */
export function setTmdbFetch(deps: AppDeps, fetcher: Fetch): void {
  fetches.set(deps, fetcher);
  clients.delete(deps);
}

export const notConfigured = () =>
  new AppError(503, 'TMDB_NOT_CONFIGURED', 'Watching needs its TMDB key');

const unavailable = () =>
  new AppError(502, 'TMDB_UNAVAILABLE', 'TMDB isn’t answering right now. Try again in a moment.');

/** A v4 read access token is a JWT (eyJ…); a v3 key is 32 hex characters. */
export const isV4Token = (key: string) => key.startsWith('eyJ') || key.length > 40;

export function tmdb(deps: AppDeps): Tmdb {
  const existing = clients.get(deps);
  if (existing) return existing;
  const client = createClient(deps.config.tmdb?.apiKey ?? null, fetches.get(deps) ?? fetch);
  clients.set(deps, client);
  return client;
}

function createClient(key: string | null, fetcher: Fetch): Tmdb {
  const inFlight = new Map<string, Promise<unknown>>();
  let active = 0;
  const waiting: Array<() => void> = [];

  const acquire = () =>
    active < MAX_CONCURRENT
      ? (active++, Promise.resolve())
      : new Promise<void>((resolve) => waiting.push(() => (active++, resolve())));
  const release = () => {
    active--;
    waiting.shift()?.();
  };

  async function request(url: URL, attempt = 0): Promise<unknown> {
    const headers: Record<string, string> = { accept: 'application/json' };
    if (key && isV4Token(key)) headers.authorization = `Bearer ${key}`;
    else if (key) url.searchParams.set('api_key', key);
    await acquire();
    let response: Response;
    try {
      response = await fetcher(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      throw unavailable();
    } finally {
      release();
    }
    if (response.ok) return response.json();
    if (response.status === 404) throw new AppError(404, 'NOT_FOUND', 'That isn’t on TMDB');
    if (response.status === 401) {
      console.error('[watching] TMDB refused the key (401)');
      throw notConfigured();
    }
    // Too many requests or a hiccup: once more, after a short pause.
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      const wait = Math.min(Number(response.headers.get('retry-after')) || 1, 3) * 1000;
      await new Promise((resolve) => setTimeout(resolve, wait));
      return request(url, 1);
    }
    throw unavailable();
  }

  return {
    configured: Boolean(key),
    get<T>(path: string, params: Params = {}): Promise<T> {
      if (!key) return Promise.reject(notConfigured());
      const url = new URL(API + path);
      for (const [name, value] of Object.entries(params).sort(([a], [b]) => a.localeCompare(b)))
        if (value !== undefined && value !== null && value !== '')
          url.searchParams.set(name, String(value));
      const id = url.toString();
      const pending = inFlight.get(id);
      if (pending) return pending as Promise<T>;
      const started = request(url).finally(() => inFlight.delete(id));
      inFlight.set(id, started);
      return started as Promise<T>;
    },
  };
}

// ---------------------------------------------------------------- the general cache

const loading = new Map<string, Promise<unknown>>();
let lastSweep = 0;

/**
 * An answer from the cache while it is fresh; else loaded, stored and returned. When TMDB fails
 * and an old answer is there, the old answer is better than none.
 */
export async function cached<T>(
  deps: AppDeps,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const now = deps.now();
  const { rows } = await deps.db.query<{ data: T; expires_at: Date }>(
    'SELECT data, expires_at FROM watch_tmdb_cache WHERE key = $1',
    [key],
  );
  const row = rows[0];
  if (row && row.expires_at > now) return row.data;
  if (!tmdb(deps).configured) {
    if (row) return row.data;
    throw notConfigured();
  }
  const pending = loading.get(key);
  if (pending) return pending as Promise<T>;
  const work = (async () => {
    try {
      const data = await load();
      await deps.db.query(
        `INSERT INTO watch_tmdb_cache (key, data, fetched_at, expires_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at, expires_at = EXCLUDED.expires_at`,
        [key, JSON.stringify(data), now, new Date(now.getTime() + ttlMs)],
      );
      await sweep(deps, now);
      return data;
    } catch (error) {
      if (row && error instanceof AppError && error.status >= 500) return row.data;
      throw error;
    }
  })().finally(() => loading.delete(key));
  loading.set(key, work);
  return work;
}

/** Expired answers go, at most once an hour (titles and seasons stay: libraries point at them). */
async function sweep(deps: AppDeps, now: Date): Promise<void> {
  if (now.getTime() - lastSweep < 60 * 60 * 1000) return;
  lastSweep = now.getTime();
  await deps.db.query(
    `DELETE FROM watch_tmdb_cache WHERE expires_at < $1::timestamptz - interval '1 day'`,
    [now],
  );
}

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
