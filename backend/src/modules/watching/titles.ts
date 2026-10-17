import type { AppDeps } from '../../context';
import type { Queryable } from '../../db';
import { AppError } from '../../lib/errors';
import { LOCALES, type Locale } from '../../lib/i18n';
import { localDate } from '../food/stock';
import { DAY, notConfigured, tmdb, TMDB_LANGUAGE } from './tmdb';

/**
 * Titles and seasons from TMDB, kept compact in PostgreSQL (watch_titles, watch_episodes_cache).
 * What doesn't depend on the language is stored once; titles, overviews, taglines, genre and
 * episode names are stored per language as people ask for them ({ i18n: { en, ro, ru } }).
 *
 * Fresh for 7 days (ended series, released films) or 1 day (series still airing, films not out
 * for long); `refresh` asks again now. When TMDB fails, the stored copy is served.
 */

export type Kind = 'movie' | 'tv';
export const KINDS: readonly Kind[] = ['movie', 'tv'];

/** `movie:603`, `tv:1399`. */
export const TITLE_ID = /^(movie|tv):([1-9][0-9]{0,9})$/;

export function parseTitleId(id: string): { kind: Kind; tmdbId: number } {
  const match = TITLE_ID.exec(id);
  if (!match) throw new AppError(404, 'NOT_FOUND', 'That isn’t on TMDB');
  return { kind: match[1] as Kind, tmdbId: Number(match[2]) };
}

export const titleId = (kind: Kind, tmdbId: number) => `${kind}:${tmdbId}`;

// ---------------------------------------------------------------- what is stored

export interface Provider {
  id: number;
  name: string;
  logoPath: string | null;
}

export interface RegionProviders {
  link: string | null;
  flatrate: Provider[];
  free: Provider[];
  ads: Provider[];
  rent: Provider[];
  buy: Provider[];
}

/** A title in a list (search, trending, recommendations…), as the app shows it. */
export interface Card {
  id: string;
  kind: Kind;
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath: string | null;
  overview: string;
  rating: number | null;
  genreIds: number[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface EpisodeRef {
  season: number;
  episode: number;
  airDate: string | null;
  name: string | null;
  runtime: number | null;
}

interface TitleText {
  title: string;
  overview: string;
  tagline: string;
  genres: string[];
  /** Season names in this language, by number. */
  seasons: Record<string, string>;
  recommendations: Card[];
  similar: Card[];
}

export interface TitleData {
  v: 1;
  kind: Kind;
  tmdbId: number;
  originalTitle: string;
  originalLanguage: string | null;
  i18n: Partial<Record<Locale, TitleText>>;
  year: number | null;
  /** Release date (films) or first air date (series). */
  date: string | null;
  /** Minutes: a film's length, or a series' usual episode length. */
  runtime: number | null;
  genreIds: number[];
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  votes: number;
  imdbId: string | null;
  tvdbId: number | null;
  status: string | null;
  seasons: Array<{
    n: number;
    episodeCount: number;
    airDate: string | null;
    posterPath: string | null;
  }>;
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  lastEpisode: EpisodeRef | null;
  nextEpisode: EpisodeRef | null;
  cast: CastMember[];
  links: { homepage: string | null; imdb: string | null; wikidata: string | null };
  /** TMDB's where-to-watch (JustWatch data), Moldova and Romania only. */
  providers: { MD?: RegionProviders; RO?: RegionProviders };
}

export interface StoredTitle {
  id: string;
  kind: Kind;
  tmdbId: number;
  data: TitleData;
  fetchedAt: Date;
}

// ---------------------------------------------------------------- TMDB's shapes (what we read)

export interface RawList {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  overview?: string;
  vote_average?: number;
  genre_ids?: number[];
  popularity?: number;
}

interface RawProviders {
  link?: string;
  flatrate?: RawProvider[];
  free?: RawProvider[];
  ads?: RawProvider[];
  rent?: RawProvider[];
  buy?: RawProvider[];
}
interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
}
interface RawEpisode {
  season_number: number;
  episode_number: number;
  air_date: string | null;
  name?: string;
  runtime?: number | null;
}

interface RawDetails {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  original_language?: string;
  overview?: string;
  tagline?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number | null;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  imdb_id?: string | null;
  status?: string;
  homepage?: string | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Array<{
    season_number: number;
    name: string;
    episode_count: number;
    air_date: string | null;
    poster_path: string | null;
  }>;
  last_episode_to_air?: RawEpisode | null;
  next_episode_to_air?: RawEpisode | null;
  credits?: {
    cast?: Array<{ id: number; name: string; character?: string; profile_path: string | null }>;
  };
  external_ids?: { imdb_id?: string | null; tvdb_id?: number | null; wikidata_id?: string | null };
  'watch/providers'?: { results?: Record<string, RawProviders> };
  recommendations?: { results?: RawList[] };
  similar?: { results?: RawList[] };
}

const yearOf = (date: string | null | undefined) =>
  date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null;

/** A list result as a card; people and anything without a kind are dropped. */
export function toCard(raw: RawList, kind?: Kind): Card | null {
  const k = (raw.media_type ?? kind) as Kind | undefined;
  if (k !== 'movie' && k !== 'tv') return null;
  const date = raw.release_date ?? raw.first_air_date ?? null;
  return {
    id: titleId(k, raw.id),
    kind: k,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? '',
    year: yearOf(date),
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    overview: raw.overview ?? '',
    rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : null,
    genreIds: raw.genre_ids ?? [],
  };
}

export const toCards = (list: RawList[] | undefined, kind?: Kind, limit = 20): Card[] =>
  (list ?? [])
    .map((raw) => toCard(raw, kind))
    .filter((card): card is Card => card !== null)
    .slice(0, limit);

const providers = (raw: RawProviders | undefined): RegionProviders | undefined => {
  if (!raw) return undefined;
  const list = (items: RawProvider[] | undefined) =>
    (items ?? [])
      .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
  return {
    link: raw.link ?? null,
    flatrate: list(raw.flatrate),
    free: list(raw.free),
    ads: list(raw.ads),
    rent: list(raw.rent),
    buy: list(raw.buy),
  };
};

const episodeRef = (raw: RawEpisode | null | undefined): EpisodeRef | null =>
  raw
    ? {
        season: raw.season_number,
        episode: raw.episode_number,
        airDate: raw.air_date || null,
        name: raw.name ?? null,
        runtime: raw.runtime ?? null,
      }
    : null;

function compact(kind: Kind, raw: RawDetails, locale: Locale, previous?: TitleData): TitleData {
  const date = (kind === 'movie' ? raw.release_date : raw.first_air_date) || null;
  const regions = raw['watch/providers']?.results ?? {};
  const text: TitleText = {
    title: raw.title ?? raw.name ?? '',
    overview: raw.overview ?? '',
    tagline: raw.tagline ?? '',
    genres: (raw.genres ?? []).map((g) => g.name),
    seasons: Object.fromEntries((raw.seasons ?? []).map((s) => [String(s.season_number), s.name])),
    recommendations: toCards(raw.recommendations?.results, kind, 12),
    similar: toCards(raw.similar?.results, kind, 12),
  };
  const runtime =
    kind === 'movie'
      ? (raw.runtime ?? null)
      : (raw.episode_run_time?.[0] ??
        raw.last_episode_to_air?.runtime ??
        previous?.runtime ??
        null);
  return {
    v: 1,
    kind,
    tmdbId: raw.id,
    originalTitle: raw.original_title ?? raw.original_name ?? text.title,
    originalLanguage: raw.original_language ?? null,
    i18n: { ...(previous?.i18n ?? {}), [locale]: text },
    year: yearOf(date),
    date,
    runtime: runtime || null,
    genreIds: (raw.genres ?? []).map((g) => g.id),
    posterPath: raw.poster_path ?? null,
    backdropPath: raw.backdrop_path ?? null,
    rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : null,
    votes: raw.vote_count ?? 0,
    imdbId: raw.imdb_id ?? raw.external_ids?.imdb_id ?? null,
    tvdbId: raw.external_ids?.tvdb_id ?? null,
    status: raw.status ?? null,
    seasons: (raw.seasons ?? []).map((s) => ({
      n: s.season_number,
      episodeCount: s.episode_count,
      airDate: s.air_date || null,
      posterPath: s.poster_path,
    })),
    numberOfSeasons: raw.number_of_seasons ?? null,
    numberOfEpisodes: raw.number_of_episodes ?? null,
    lastEpisode: episodeRef(raw.last_episode_to_air),
    nextEpisode: episodeRef(raw.next_episode_to_air),
    cast: (raw.credits?.cast ?? []).slice(0, 12).map((c) => ({
      id: c.id,
      name: c.name,
      character: c.character ?? '',
      profilePath: c.profile_path,
    })),
    links: {
      homepage: raw.homepage || null,
      imdb: raw.imdb_id ?? raw.external_ids?.imdb_id ?? null,
      wikidata: raw.external_ids?.wikidata_id ?? null,
    },
    providers: {
      ...(regions.MD ? { MD: providers(regions.MD) } : {}),
      ...(regions.RO ? { RO: providers(regions.RO) } : {}),
    },
  };
}

// ---------------------------------------------------------------- freshness

const ENDED = new Set(['Ended', 'Canceled', 'Released']);

/** How long a title stays fresh: a week once it is done, a day while it is still changing. */
export function titleTtl(data: TitleData, now: Date): number {
  if (data.kind === 'tv') return ENDED.has(data.status ?? '') ? 7 * DAY : DAY;
  const released = data.date ? Date.parse(`${data.date}T00:00:00Z`) : NaN;
  if (data.status === 'Released' && now.getTime() - released > 90 * DAY) return 7 * DAY;
  return DAY;
}

// ---------------------------------------------------------------- reading titles

interface TitleRow {
  id: string;
  kind: Kind;
  tmdb_id: number;
  data: TitleData;
  fetched_at: Date;
}
const toStored = (row: TitleRow): StoredTitle => ({
  id: row.id,
  kind: row.kind,
  tmdbId: row.tmdb_id,
  data: row.data,
  fetchedAt: row.fetched_at,
});

export async function storedTitles(
  db: Queryable,
  ids: string[],
): Promise<Map<string, StoredTitle>> {
  if (!ids.length) return new Map();
  const { rows } = await db.query<TitleRow>(
    'SELECT id, kind, tmdb_id, data, fetched_at FROM watch_titles WHERE id = ANY($1)',
    [[...new Set(ids)]],
  );
  return new Map(rows.map((row) => [row.id, toStored(row)]));
}

const loadingTitles = new Map<string, Promise<StoredTitle>>();

async function fetchTitle(
  deps: AppDeps,
  id: string,
  locale: Locale,
  previous: StoredTitle | undefined,
): Promise<StoredTitle> {
  const { kind, tmdbId } = parseTitleId(id);
  const raw = await tmdb(deps).get<RawDetails>(`/${kind}/${tmdbId}`, {
    language: TMDB_LANGUAGE[locale],
    append_to_response: 'credits,external_ids,watch/providers,recommendations,similar',
  });
  const data = compact(kind, raw, locale, previous?.data);
  const now = deps.now();
  await deps.db.query(
    `INSERT INTO watch_titles (id, kind, tmdb_id, data, fetched_at) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at`,
    [id, kind, tmdbId, JSON.stringify(data), now],
  );
  return { id, kind, tmdbId, data, fetchedAt: now };
}

/**
 * A title in the given language: from the cache while fresh, else from TMDB. A language not
 * asked for before is fetched then (and English too when the language has no overview, so
 * there is something to read).
 */
export async function getTitle(
  deps: AppDeps,
  id: string,
  locale: Locale,
  options: { refresh?: boolean } = {},
): Promise<StoredTitle> {
  parseTitleId(id);
  const stored = (await storedTitles(deps.db, [id])).get(id);
  const now = deps.now();
  const fresh = stored && now.getTime() - stored.fetchedAt.getTime() < titleTtl(stored.data, now);
  if (stored && stored.data.i18n[locale] && fresh && !options.refresh) return stored;
  if (!tmdb(deps).configured) {
    if (stored) return stored;
    throw notConfigured();
  }
  const key = `${id}:${locale}`;
  let pending = loadingTitles.get(key);
  if (!pending) {
    pending = fetchTitle(deps, id, locale, stored).finally(() => loadingTitles.delete(key));
    loadingTitles.set(key, pending);
  }
  let title: StoredTitle;
  try {
    title = await pending;
  } catch (error) {
    if (stored && error instanceof AppError && error.status >= 500) return stored;
    throw error;
  }
  if (locale !== 'en' && !title.data.i18n[locale]?.overview && !title.data.i18n.en)
    return getTitle(deps, id, 'en').catch(() => title);
  return title;
}

/** Several titles; each one TMDB doesn't know (or can't be reached for) is left out. */
export async function getTitles(
  deps: AppDeps,
  ids: string[],
  locale: Locale,
): Promise<Map<string, StoredTitle>> {
  const out = new Map<string, StoredTitle>();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const title = await getTitle(deps, id, locale).catch(() => null);
      if (title) out.set(id, title);
    }),
  );
  return out;
}

/** One field in a language, else English, else any language there is. */
export function textOf(data: TitleData, locale: Locale): TitleText {
  const pick = (field: 'title' | 'overview' | 'tagline') => {
    for (const lang of [locale, 'en', ...LOCALES] as Locale[]) {
      const value = data.i18n[lang]?.[field];
      if (value) return value;
    }
    return field === 'title' ? data.originalTitle : '';
  };
  const own = data.i18n[locale] ?? data.i18n.en ?? Object.values(data.i18n)[0];
  return {
    title: pick('title'),
    overview: pick('overview'),
    tagline: pick('tagline'),
    genres: own?.genres ?? [],
    seasons: own?.seasons ?? {},
    recommendations: own?.recommendations ?? [],
    similar: own?.similar ?? [],
  };
}

/** A stored title as a card. */
export function cardOf(title: StoredTitle, locale: Locale): Card {
  const text = textOf(title.data, locale);
  return {
    id: title.id,
    kind: title.kind,
    tmdbId: title.tmdbId,
    title: text.title,
    year: title.data.year,
    posterPath: title.data.posterPath,
    backdropPath: title.data.backdropPath,
    overview: text.overview,
    rating: title.data.rating,
    genreIds: title.data.genreIds,
  };
}

/** Each language's title, overview and tagline that is stored. */
export function translationsOf(data: TitleData) {
  const out: Partial<Record<Locale, { title: string; overview: string; tagline: string }>> = {};
  for (const lang of LOCALES) {
    const text = data.i18n[lang];
    if (text) out[lang] = { title: text.title, overview: text.overview, tagline: text.tagline };
  }
  return out;
}

// ---------------------------------------------------------------- episodes and progress

/** Every regular episode (no specials) that has aired, in order, from the title alone. */
export function airedEpisodes(data: TitleData): Array<{ season: number; episode: number }> {
  if (data.kind !== 'tv') return [];
  const last = data.lastEpisode;
  if (!last) return [];
  const out: Array<{ season: number; episode: number }> = [];
  for (const season of [...data.seasons].sort((a, b) => a.n - b.n)) {
    if (season.n < 1 || season.n > last.season) continue;
    const count = season.n === last.season ? last.episode : season.episodeCount;
    for (let e = 1; e <= count; e++) out.push({ season: season.n, episode: e });
  }
  return out;
}

/** Every regular episode TMDB lists, aired or not. */
export function totalEpisodes(data: TitleData): number {
  return data.seasons.filter((s) => s.n >= 1).reduce((sum, s) => sum + s.episodeCount, 0);
}

export const isEnded = (data: TitleData) =>
  data.kind === 'movie' ? data.status === 'Released' : ENDED.has(data.status ?? '');

// ---------------------------------------------------------------- seasons

interface EpisodeText {
  name: string;
  overview: string;
}
export interface SeasonData {
  v: 1;
  n: number;
  airDate: string | null;
  posterPath: string | null;
  i18n: Partial<Record<Locale, { name: string; overview: string }>>;
  episodes: Array<{
    n: number;
    airDate: string | null;
    runtime: number | null;
    stillPath: string | null;
    rating: number | null;
    i18n: Partial<Record<Locale, EpisodeText>>;
  }>;
}

interface RawSeason {
  season_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  poster_path?: string | null;
  episodes?: Array<{
    episode_number: number;
    name?: string;
    overview?: string;
    air_date?: string | null;
    runtime?: number | null;
    still_path?: string | null;
    vote_average?: number;
  }>;
}

const loadingSeasons = new Map<string, Promise<SeasonData>>();

/** Fresh for a day while the season is airing (or just aired), for a month after. */
export function seasonTtl(data: SeasonData, now: Date): number {
  const recent = localDate(new Date(now.getTime() - 14 * DAY));
  const airing =
    !data.episodes.length || data.episodes.some((e) => !e.airDate || e.airDate >= recent);
  return airing ? DAY : 30 * DAY;
}

export async function getSeason(
  deps: AppDeps,
  tmdbId: number,
  season: number,
  locale: Locale,
  options: { refresh?: boolean } = {},
): Promise<SeasonData> {
  const { rows } = await deps.db.query<{ data: SeasonData; fetched_at: Date }>(
    'SELECT data, fetched_at FROM watch_episodes_cache WHERE tmdb_id = $1 AND season = $2',
    [tmdbId, season],
  );
  const stored = rows[0];
  const now = deps.now();
  const fresh = stored && now.getTime() - stored.fetched_at.getTime() < seasonTtl(stored.data, now);
  if (stored && stored.data.i18n[locale] && fresh && !options.refresh) return stored.data;
  if (!tmdb(deps).configured) {
    if (stored) return stored.data;
    throw notConfigured();
  }
  const key = `${tmdbId}:${season}:${locale}`;
  let pending = loadingSeasons.get(key);
  if (!pending) {
    pending = (async () => {
      const raw = await tmdb(deps).get<RawSeason>(`/tv/${tmdbId}/season/${season}`, {
        language: TMDB_LANGUAGE[locale],
      });
      const before = new Map((stored?.data.episodes ?? []).map((e) => [e.n, e]));
      const data: SeasonData = {
        v: 1,
        n: raw.season_number,
        airDate: raw.air_date || null,
        posterPath: raw.poster_path ?? null,
        i18n: {
          ...(stored?.data.i18n ?? {}),
          [locale]: { name: raw.name ?? '', overview: raw.overview ?? '' },
        },
        episodes: (raw.episodes ?? []).map((e) => ({
          n: e.episode_number,
          airDate: e.air_date || null,
          runtime: e.runtime ?? null,
          stillPath: e.still_path ?? null,
          rating: e.vote_average ? Math.round(e.vote_average * 10) / 10 : null,
          i18n: {
            ...(before.get(e.episode_number)?.i18n ?? {}),
            [locale]: { name: e.name ?? '', overview: e.overview ?? '' },
          },
        })),
      };
      await deps.db.query(
        `INSERT INTO watch_episodes_cache (tmdb_id, season, data, fetched_at) VALUES ($1, $2, $3, $4)
         ON CONFLICT (tmdb_id, season) DO UPDATE SET data = EXCLUDED.data, fetched_at = EXCLUDED.fetched_at`,
        [tmdbId, season, JSON.stringify(data), now],
      );
      return data;
    })().finally(() => loadingSeasons.delete(key));
    loadingSeasons.set(key, pending);
  }
  try {
    return await pending;
  } catch (error) {
    if (stored && error instanceof AppError && error.status >= 500) return stored.data;
    throw error;
  }
}

/** The stored season, without asking TMDB (null when it was never fetched). */
export async function storedSeason(
  db: Queryable,
  tmdbId: number,
  season: number,
): Promise<SeasonData | null> {
  const { rows } = await db.query<{ data: SeasonData }>(
    'SELECT data FROM watch_episodes_cache WHERE tmdb_id = $1 AND season = $2',
    [tmdbId, season],
  );
  return rows[0]?.data ?? null;
}

export function episodeText(episode: SeasonData['episodes'][number], locale: Locale): EpisodeText {
  const pick = (field: keyof EpisodeText) => {
    for (const lang of [locale, 'en', ...LOCALES] as Locale[]) {
      const value = episode.i18n[lang]?.[field];
      if (value) return value;
    }
    return '';
  };
  return { name: pick('name'), overview: pick('overview') };
}
