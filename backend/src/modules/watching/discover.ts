import { AppError } from '../../lib/errors';
import { me, type Watch } from './people';
import { cached, DAY, HOUR, tmdb, TMDB_LANGUAGE } from './tmdb';
import {
  cardOf,
  getTitle,
  getTitles,
  textOf,
  toCards,
  type Card,
  type Kind,
  type RawList,
} from './titles';

/**
 * Finding something to watch: search, trending, discover (by genre, year, service in Moldova),
 * TMDB's similar titles and recommendations, "because you watched", and people. Every answer
 * is cached (search a day, trending six hours, people a week) and tagged with the caller's
 * status for each title, so the app can show what is already in the library.
 */

type Raw = RawList[];

/** Each card with the caller's status for it (null when it isn't in their library). */
async function withStatus(w: Watch, cards: Card[]) {
  if (!cards.length) return [];
  const { rows } = await w.ctx.db.query<{ title_id: string; status: string }>(
    'SELECT title_id, status FROM watch_list WHERE user_id = $1 AND title_id = ANY($2)',
    [me(w), cards.map((c) => c.id)],
  );
  const status = new Map(rows.map((r) => [r.title_id, r.status]));
  return cards.map((card) => ({ ...card, status: status.get(card.id) ?? null }));
}

export async function search(w: Watch, q: string, kind: Kind | 'all' = 'all', page = 1) {
  const language = TMDB_LANGUAGE[w.locale];
  const path = kind === 'all' ? '/search/multi' : `/search/${kind}`;
  const key = `search:${kind}:${language}:${page}:${q.toLowerCase()}`;
  const data = await cached(w.deps, key, DAY, async () => {
    const raw = await tmdb(w.deps).get<{ results?: Raw; total_pages?: number }>(path, {
      query: q,
      language,
      page,
      include_adult: false,
    });
    return {
      results: toCards(raw.results, kind === 'all' ? undefined : kind, 20),
      totalPages: raw.total_pages ?? 1,
    };
  });
  return { results: await withStatus(w, data.results), page, totalPages: data.totalPages };
}

export async function trending(
  w: Watch,
  kind: Kind | 'all' = 'all',
  window: 'day' | 'week' = 'week',
) {
  const language = TMDB_LANGUAGE[w.locale];
  const data = await cached(
    w.deps,
    `trending:${kind}:${window}:${language}`,
    6 * HOUR,
    async () => {
      const raw = await tmdb(w.deps).get<{ results?: Raw }>(`/trending/${kind}/${window}`, {
        language,
      });
      return toCards(raw.results, kind === 'all' ? undefined : kind, 20);
    },
  );
  return { results: await withStatus(w, data) };
}

const SORTS = {
  popular: 'popularity.desc',
  rating: 'vote_average.desc',
  newest: { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' },
} as const;

export async function discover(
  w: Watch,
  query: {
    kind?: Kind;
    genre?: number;
    year?: number;
    provider?: number;
    region?: 'MD' | 'RO';
    sort?: 'popular' | 'rating' | 'newest';
    page?: number;
  },
) {
  const kind = query.kind ?? 'movie';
  const region = query.region ?? 'MD';
  const language = TMDB_LANGUAGE[w.locale];
  const sort = query.sort ?? 'popular';
  const params = {
    language,
    page: query.page ?? 1,
    sort_by: sort === 'newest' ? SORTS.newest[kind] : SORTS[sort],
    with_genres: query.genre,
    [kind === 'movie' ? 'primary_release_year' : 'first_air_date_year']: query.year,
    with_watch_providers: query.provider,
    watch_region: query.provider ? region : undefined,
    'vote_count.gte': sort === 'rating' ? 200 : undefined,
    // "Newest" means out already, not announced.
    [kind === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte']:
      sort === 'newest' ? new Date(w.ctx.now).toISOString().slice(0, 10) : undefined,
    include_adult: false,
  };
  const key = `discover:${kind}:${JSON.stringify(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .sort(),
  )}`;
  const data = await cached(w.deps, key, DAY, async () => {
    const raw = await tmdb(w.deps).get<{ results?: Raw; total_pages?: number }>(
      `/discover/${kind}`,
      params,
    );
    return {
      results: toCards(raw.results, kind, 20),
      totalPages: Math.min(raw.total_pages ?? 1, 50),
    };
  });
  return {
    results: await withStatus(w, data.results),
    page: query.page ?? 1,
    totalPages: data.totalPages,
    region,
  };
}

export async function genres(w: Watch, kind: Kind = 'movie') {
  const language = TMDB_LANGUAGE[w.locale];
  const list = await cached(w.deps, `genres:${kind}:${language}`, 30 * DAY, async () => {
    const raw = await tmdb(w.deps).get<{ genres?: Array<{ id: number; name: string }> }>(
      `/genre/${kind}/list`,
      { language },
    );
    return raw.genres ?? [];
  });
  return { genres: list };
}

/** The services TMDB knows in Moldova; Romania's when Moldova has none listed. */
export async function providers(w: Watch, kind: Kind = 'movie', region: 'MD' | 'RO' = 'MD') {
  const load = (r: 'MD' | 'RO') =>
    cached(w.deps, `providers:${kind}:${r}`, 7 * DAY, async () => {
      const raw = await tmdb(w.deps).get<{
        results?: Array<{
          provider_id: number;
          provider_name: string;
          logo_path: string | null;
          display_priorities?: Record<string, number>;
        }>;
      }>(`/watch/providers/${kind}`, { watch_region: r });
      return (raw.results ?? [])
        .sort((a, b) => (a.display_priorities?.[r] ?? 99) - (b.display_priorities?.[r] ?? 99))
        .map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }));
    });
  let list = await load(region);
  let used = region;
  if (!list.length && region === 'MD') {
    list = await load('RO');
    used = 'RO';
  }
  return { region: used, check: used !== 'MD', providers: list };
}

export async function related(w: Watch, id: string, which: 'similar' | 'recommendations') {
  const title = await getTitle(w.deps, id, w.locale);
  const text = textOf(title.data, w.locale);
  return { results: await withStatus(w, text[which]) };
}

/**
 * "Because you watched X": the titles a person rated highly, marked favourite or finished
 * lately, each with TMDB's recommendations they haven't got yet.
 */
export async function because(w: Watch, kind?: Kind, limit = 3) {
  const { rows } = await w.ctx.db.query<{ title_id: string }>(
    `SELECT title_id FROM watch_list WHERE user_id = $1 AND status IN ('completed', 'watching', 'rewatching')
       ${kind ? 'AND title_id LIKE $2' : ''}
     ORDER BY favorite DESC, coalesce(rating, 0) >= 8 DESC, updated_at DESC LIMIT ${limit * 2}`,
    kind ? [me(w), `${kind}:%`] : [me(w)],
  );
  const titles = await getTitles(
    w.deps,
    rows.map((r) => r.title_id),
    w.locale,
  );
  const { rows: library } = await w.ctx.db.query<{ title_id: string }>(
    'SELECT title_id FROM watch_list WHERE user_id = $1',
    [me(w)],
  );
  const owned = new Set(library.map((r) => r.title_id));
  const groups = [];
  for (const row of rows) {
    const title = titles.get(row.title_id);
    if (!title) continue;
    const results = textOf(title.data, w.locale).recommendations.filter((c) => !owned.has(c.id));
    if (!results.length) continue;
    groups.push({ because: cardOf(title, w.locale), results: results.slice(0, 10) });
    if (groups.length >= limit) break;
  }
  return { groups };
}

interface RawPerson {
  id: number;
  name: string;
  biography?: string;
  birthday?: string | null;
  deathday?: string | null;
  place_of_birth?: string | null;
  profile_path?: string | null;
  known_for_department?: string;
  imdb_id?: string | null;
  combined_credits?: {
    cast?: Array<RawList & { character?: string }>;
    crew?: Array<RawList & { job?: string }>;
  };
}

export async function person(w: Watch, id: number) {
  if (!Number.isInteger(id) || id < 1) throw new AppError(404, 'NOT_FOUND', 'That isn’t on TMDB');
  const language = TMDB_LANGUAGE[w.locale];
  const data = await cached(w.deps, `person:${id}:${language}`, 7 * DAY, async () => {
    const raw = await tmdb(w.deps).get<RawPerson>(`/person/${id}`, {
      language,
      append_to_response: 'combined_credits',
    });
    let biography = raw.biography ?? '';
    if (!biography && w.locale !== 'en') {
      const en = await tmdb(w.deps)
        .get<RawPerson>(`/person/${id}`, { language: 'en-US' })
        .catch(() => null);
      biography = en?.biography ?? '';
    }
    const seen = new Set<string>();
    const credits = [
      ...(raw.combined_credits?.cast ?? []).map((c) => ({ raw: c, role: c.character ?? '' })),
      ...(raw.combined_credits?.crew ?? []).map((c) => ({ raw: c, role: c.job ?? '' })),
    ]
      .sort((a, b) => (b.raw.popularity ?? 0) - (a.raw.popularity ?? 0))
      .flatMap(({ raw: credit, role }) => {
        const card = toCards([credit])[0];
        if (!card || seen.has(card.id)) return [];
        seen.add(card.id);
        return [{ ...card, role }];
      })
      .slice(0, 40);
    return {
      id: raw.id,
      name: raw.name,
      biography,
      birthday: raw.birthday ?? null,
      deathday: raw.deathday ?? null,
      placeOfBirth: raw.place_of_birth ?? null,
      profilePath: raw.profile_path ?? null,
      knownFor: raw.known_for_department ?? null,
      imdbId: raw.imdb_id ?? null,
      credits,
    };
  });
  const credits = await withStatus(w, data.credits);
  return { person: { ...data, credits } };
}

/** What the app needs to build image addresses, and whether TMDB is set up. */
export function config(w: Watch) {
  return {
    configured: tmdb(w.deps).configured,
    images: {
      base: 'https://image.tmdb.org/t/p/',
      poster: ['w92', 'w185', 'w342'],
      profile: ['w185'],
      backdrop: ['w300', 'w780'],
      still: ['w300'],
      logo: ['w92'],
    },
    attribution: {
      tmdb: 'This product uses the TMDB API but is not endorsed or certified by TMDB.',
      justwatch: 'Where to watch: JustWatch',
    },
  };
}
