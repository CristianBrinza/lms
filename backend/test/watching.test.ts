import { beforeEach, describe, expect, it } from 'vitest';
import { areaOf, toolArea } from '../src/modules/live/publish';
import { tokenMayAccess } from '../src/modules/tokens';
import { parseCsv, readExport } from '../src/modules/watching/import';
import { isV4Token, setTmdbFetch } from '../src/modules/watching/tmdb';
import { setupTestApp } from './helpers';

/**
 * Watching, with TMDB answered by a fake: no key or network in tests. The fake counts what was
 * asked, so caching and de-duplication can be checked.
 */

const t = setupTestApp({ TMDB_API_KEY: 'eyJ-test-read-access-token-for-the-fake-tmdb-0000' });
const bare = setupTestApp();

const FUTURE = '2099-01-01';
const lang = (url: URL) => url.searchParams.get('language') ?? 'en-US';

const movie = (url: URL) => ({
  id: 603,
  title: lang(url) === 'ro-RO' ? 'Matrix (ro)' : 'The Matrix',
  original_title: 'The Matrix',
  overview: lang(url) === 'ro-RO' ? '' : 'A hacker learns the truth.',
  tagline: '',
  release_date: '1999-03-30',
  runtime: 136,
  status: 'Released',
  genres: [{ id: 28, name: lang(url) === 'ro-RO' ? 'Acțiune' : 'Action' }],
  poster_path: '/matrix.jpg',
  backdrop_path: '/matrix-wide.jpg',
  vote_average: 8.2,
  vote_count: 25000,
  imdb_id: 'tt0133093',
  credits: { cast: [{ id: 6384, name: 'Keanu Reeves', character: 'Neo', profile_path: '/k.jpg' }] },
  external_ids: { imdb_id: 'tt0133093' },
  'watch/providers': {
    results: {
      RO: {
        link: 'https://tmdb/ro',
        flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }],
      },
      US: { flatrate: [{ provider_id: 9, provider_name: 'Elsewhere', logo_path: null }] },
    },
  },
  recommendations: {
    results: [
      { id: 604, title: 'The Matrix Reloaded', release_date: '2003-05-15', poster_path: '/r.jpg' },
    ],
  },
  similar: { results: [{ id: 605, title: 'Similar film', release_date: '2001-01-01' }] },
});

/** A finished show: two seasons of three. */
const ended = () => ({
  id: 1399,
  name: 'Thrones',
  original_name: 'Thrones',
  overview: 'Families fight.',
  first_air_date: '2011-04-17',
  episode_run_time: [60],
  status: 'Ended',
  genres: [{ id: 18, name: 'Drama' }],
  poster_path: '/got.jpg',
  number_of_seasons: 2,
  number_of_episodes: 6,
  seasons: [
    {
      season_number: 0,
      name: 'Specials',
      episode_count: 1,
      air_date: '2011-01-01',
      poster_path: null,
    },
    {
      season_number: 1,
      name: 'Season 1',
      episode_count: 3,
      air_date: '2011-04-17',
      poster_path: null,
    },
    {
      season_number: 2,
      name: 'Season 2',
      episode_count: 3,
      air_date: '2012-04-01',
      poster_path: null,
    },
  ],
  last_episode_to_air: {
    season_number: 2,
    episode_number: 3,
    air_date: '2012-04-15',
    name: 'End',
    runtime: 55,
  },
  next_episode_to_air: null,
  credits: { cast: [{ id: 22970, name: 'Peter D', character: 'Tyrion', profile_path: null }] },
  external_ids: { imdb_id: 'tt0944947', tvdb_id: 121361 },
  'watch/providers': { results: {} },
});

/** A show still airing: season 2 has one episode out and two to come. */
const returning = () => ({
  ...ended(),
  id: 100,
  name: 'Ongoing',
  status: 'Returning Series',
  seasons: [
    {
      season_number: 1,
      name: 'Season 1',
      episode_count: 2,
      air_date: '2024-01-01',
      poster_path: null,
    },
    {
      season_number: 2,
      name: 'Season 2',
      episode_count: 3,
      air_date: '2025-01-01',
      poster_path: null,
    },
  ],
  last_episode_to_air: {
    season_number: 2,
    episode_number: 1,
    air_date: '2025-01-01',
    name: 'Back',
    runtime: 40,
  },
  next_episode_to_air: {
    season_number: 2,
    episode_number: 2,
    air_date: FUTURE,
    name: 'Soon',
    runtime: 40,
  },
  external_ids: {},
});

const season = (show: number, n: number, url: URL) => {
  const count = show === 1399 ? 3 : n === 1 ? 2 : 3;
  return {
    season_number: n,
    name: `Season ${n}`,
    episodes: Array.from({ length: count }, (_, i) => ({
      episode_number: i + 1,
      name: lang(url) === 'ro-RO' ? `Episodul ${i + 1}` : `Episode ${i + 1}`,
      overview: 'Things happen.',
      air_date: show === 100 && n === 2 && i > 0 ? FUTURE : `2012-0${n}-0${i + 1}`,
      runtime: 50 + i,
      still_path: `/s${n}e${i + 1}.jpg`,
    })),
  };
};

let calls: string[] = [];
let auth: string[] = [];

function fakeTmdb(): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}?language=${lang(url)}`);
    auth.push(String((init?.headers as Record<string, string>)?.authorization ?? ''));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const path = url.pathname.replace('/3', '');
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    let m: RegExpExecArray | null;
    if (path === '/movie/603') return json(movie(url));
    if (path === '/tv/1399') return json(ended());
    if (path === '/tv/100') return json(returning());
    if ((m = /^\/tv\/(\d+)\/season\/(\d+)$/.exec(path)))
      return json(season(Number(m[1]), Number(m[2]), url));
    if (path === '/search/multi' || path === '/search/movie' || path === '/search/tv') {
      const q = url.searchParams.get('query') ?? '';
      if (/matrix/i.test(q))
        return json({
          results: [
            { id: 603, media_type: 'movie', title: 'The Matrix', release_date: '1999-03-30' },
            { id: 1, media_type: 'person', name: 'Someone' },
          ],
          total_pages: 1,
        });
      if (/thrones/i.test(q))
        return json({ results: [{ id: 1399, name: 'Thrones', first_air_date: '2011-04-17' }] });
      return json({ results: [], total_pages: 1 });
    }
    if (path === '/find/tt0133093') return json({ movie_results: [{ id: 603 }], tv_results: [] });
    if (path === '/find/121361') return json({ movie_results: [], tv_results: [{ id: 1399 }] });
    if (path.startsWith('/find/')) return json({ movie_results: [], tv_results: [] });
    if (path === '/trending/all/week')
      return json({
        results: [
          { id: 603, media_type: 'movie', title: 'The Matrix' },
          { id: 100, media_type: 'tv', name: 'Ongoing' },
        ],
      });
    if (path === '/person/6384')
      return json({
        id: 6384,
        name: 'Keanu Reeves',
        biography: 'Actor.',
        combined_credits: {
          cast: [
            { id: 603, media_type: 'movie', title: 'The Matrix', character: 'Neo', popularity: 9 },
          ],
        },
      });
    return json({ status_message: 'not found' }, 404);
  }) as typeof fetch;
}

beforeEach(async () => {
  calls = [];
  auth = [];
  setTmdbFetch(t.deps, fakeTmdb());
  await t.db.query(
    'TRUNCATE watch_titles, watch_episodes_cache, watch_tmdb_cache, watch_availability RESTART IDENTITY CASCADE',
  );
});

async function viewer(email = 'ana@example.com', name = 'Ana') {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}

/** Two people at home: the second one is seated in the first one's household. */
async function family() {
  const ana = await viewer('ana@example.com', 'Ana');
  const ion = await viewer('ion@example.com', 'Ion');
  await ana.b.get('/api/watching/config');
  const { rows } = await t.db.query<{ household_id: string }>(
    'SELECT household_id FROM users WHERE id = $1',
    [ana.user.id],
  );
  await t.db.query('UPDATE users SET household_id = $2 WHERE id = $1', [
    ion.user.id,
    rows[0]!.household_id,
  ]);
  return { ana, ion };
}

describe('watching: TMDB, asked politely', () => {
  it('without a key: says so, calmly', async () => {
    await bare.createUser({ email: 'ana@example.com' });
    const b = bare.browser();
    await b.login('ana@example.com');
    const config = await b.get('/api/watching/config');
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({
      configured: false,
      images: { base: 'https://image.tmdb.org/t/p/' },
    });
    const search = await b.get('/api/watching/search?q=matrix');
    expect(search.status).toBe(503);
    expect(search.body.error.code).toBe('TMDB_NOT_CONFIGURED');
    // The library still opens: it is read from the database.
    expect((await b.get('/api/watching/library')).status).toBe(200);
  });

  it('caches titles, asks once for the same thing at once, and keeps each language', async () => {
    const { b } = await viewer();
    expect(isV4Token('eyJhbGciOi')).toBe(true);
    expect(isV4Token('0123456789abcdef0123456789abcdef')).toBe(false);

    const three = await Promise.all([1, 2, 3].map(() => b.get('/api/watching/titles/movie:603')));
    expect(three.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(calls.filter((c) => c.startsWith('/3/movie/603'))).toEqual([
      '/3/movie/603?language=en-US',
    ]);
    expect(auth[0]).toMatch(/^Bearer eyJ/);

    const title = three[0]!.body.title;
    expect(title).toMatchObject({
      id: 'movie:603',
      kind: 'movie',
      title: 'The Matrix',
      year: 1999,
      runtime: 136,
      genres: ['Action'],
      posterPath: '/matrix.jpg',
      imdbId: 'tt0133093',
      cast: [{ id: 6384, name: 'Keanu Reeves', character: 'Neo', profilePath: '/k.jpg' }],
    });
    // Moldova has nothing on TMDB: Romania's list, flagged to be checked.
    expect(title.providers).toMatchObject({
      region: 'RO',
      check: true,
      flatrate: [{ name: 'Netflix', logoPath: '/n.png' }],
      checked: [],
    });
    expect(three[0]!.body.mine).toMatchObject({ status: null, plays: [], playCount: 0 });

    await b.get('/api/watching/titles/movie:603');
    expect(calls.filter((c) => c.startsWith('/3/movie/603'))).toHaveLength(1);

    // Romanian: asked once, with English's overview standing in for the missing one.
    const ro = await b.get('/api/watching/titles/movie:603', { 'accept-language': 'ro' });
    expect(ro.body.title).toMatchObject({
      title: 'Matrix (ro)',
      overview: 'A hacker learns the truth.',
      genres: ['Acțiune'],
    });
    expect(Object.keys(ro.body.title.translations).sort()).toEqual(['en', 'ro']);
    expect(calls.filter((c) => c.startsWith('/3/movie/603'))).toHaveLength(2);

    expect((await b.get('/api/watching/titles/movie:999')).status).toBe(404);
    expect((await b.get('/api/watching/titles/nonsense')).status).toBe(404);
  });

  it('search, trending, similar, recommendations and people, each cached', async () => {
    const { b } = await viewer();
    const found = await b.get('/api/watching/search?q=Matrix');
    expect(found.body.results).toEqual([
      expect.objectContaining({
        id: 'movie:603',
        kind: 'movie',
        tmdbId: 603,
        title: 'The Matrix',
        year: 1999,
        status: null,
      }),
    ]);
    await b.get('/api/watching/search?q=matrix');
    expect(calls.filter((c) => c.startsWith('/3/search'))).toHaveLength(1);

    expect((await b.get('/api/watching/trending')).body.results.map((r: any) => r.id)).toEqual([
      'movie:603',
      'tv:100',
    ]);
    expect(
      (await b.get('/api/watching/titles/movie:603/recommendations')).body.results[0],
    ).toMatchObject({ id: 'movie:604' });
    expect((await b.get('/api/watching/titles/movie:603/similar')).body.results[0]).toMatchObject({
      id: 'movie:605',
    });
    const keanu = await b.get('/api/watching/people/6384');
    expect(keanu.body.person).toMatchObject({
      name: 'Keanu Reeves',
      credits: [expect.objectContaining({ id: 'movie:603', role: 'Neo' })],
    });
  });
});

describe('watching: plays, progress and the library', () => {
  it('a film watched is completed; rewatching adds plays and minutes', async () => {
    const { b } = await viewer();
    const first = await b.post('/api/watching/plays', { titleId: 'movie:603' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ added: 1, skipped: 0, status: 'completed' });
    expect(first.body.plays[0]).toMatchObject({
      season: null,
      episode: null,
      precision: 'exact',
      runtime: 136,
      source: 'app',
    });
    await b.post('/api/watching/plays', { titleId: 'movie:603', watchedAt: '2024-05' });
    const mine = (await b.get('/api/watching/titles/movie:603')).body.mine;
    expect(mine).toMatchObject({ status: 'completed', playCount: 2, rewatches: 1, minutes: 272 });
    expect(
      (await b.post('/api/watching/plays', { titleId: 'movie:603', season: 1, episode: 1 })).status,
    ).toBe(400);
    expect(
      (await b.post('/api/watching/plays', { titleId: 'movie:603', watchedAt: '2999-01-01' }))
        .status,
    ).toBe(400);
  });

  it('episodes one by one, up to S2E1, a whole season, and the show done', async () => {
    const { b } = await viewer();
    const one = await b.post('/api/watching/plays', { titleId: 'tv:1399', season: 1, episode: 1 });
    expect(one.body).toMatchObject({ added: 1, status: 'watching' });
    expect(one.body.plays[0].runtime).toBe(60); // the season isn't fetched yet: the usual length

    const upTo = await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      upTo: { season: 2, episode: 1 },
    });
    expect(upTo.body).toMatchObject({ added: 3, skipped: 1 });

    let view = (await b.get('/api/watching/titles/tv:1399')).body;
    expect(view.mine.progress).toMatchObject({
      watched: 4,
      aired: 6,
      total: 6,
      percent: 67,
      left: 2,
    });
    expect(view.mine.next).toMatchObject({ season: 2, episode: 2 });

    const s2 = await b.get('/api/watching/titles/tv:1399/seasons/2');
    expect(s2.body.season).toMatchObject({ n: 2, episodeCount: 3 });
    expect(s2.body.episodes[0]).toMatchObject({
      n: 1,
      name: 'Episode 1',
      aired: true,
      runtime: 50,
      stillPath: '/s2e1.jpg',
    });
    expect(s2.body.episodes[0].watched).toHaveLength(1);
    expect(s2.body.episodes[1].watched).toHaveLength(0);

    const season = await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 2,
      all: true,
    });
    expect(season.body).toMatchObject({ added: 2, skipped: 1, status: 'completed' });
    expect(season.body.plays.map((p: any) => p.runtime)).toEqual([51, 52]);

    // Undo the season mark in one go.
    await b.delete(`/api/watching/plays/groups/${season.body.groupId}`);
    view = (await b.get('/api/watching/titles/tv:1399')).body;
    expect(view.mine.progress.watched).toBe(4);

    // Rewatching starts a new round.
    await b.post('/api/watching/plays', { titleId: 'tv:1399', all: true });
    await b.put('/api/watching/titles/tv:1399/status', { status: 'rewatching' });
    await b.post('/api/watching/plays', { titleId: 'tv:1399', season: 1, episode: 1 });
    view = (await b.get('/api/watching/titles/tv:1399')).body;
    expect(view.mine).toMatchObject({ status: 'rewatching', next: { season: 1, episode: 2 } });
  });

  it('backfills by day, by month, or not knowing; statistics keep them apart', async () => {
    t.setNow(new Date(2026, 9, 17, 21, 0));
    const { b } = await viewer();
    await b.post('/api/watching/plays', { titleId: 'movie:603' });
    await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 1,
      episode: 1,
      watchedAt: '2026-10-03',
    });
    await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 1,
      episode: 2,
      watchedAt: '2026-10',
    });
    await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 1,
      episode: 3,
      watchedAt: 'unknown',
    });
    await b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 2,
      episode: 1,
      watchedAt: '2026-10-16T08:30',
    });
    await b.put('/api/watching/titles/movie:603/status', { favorite: true, rating: 9 });

    const stats = (await b.get('/api/watching/stats?from=2026-10-01&to=2026-10-17')).body;
    expect(stats.month).toEqual({ episodes: 3, shows: 1, movies: 1, plays: 4, minutes: 136 + 180 });
    expect(stats.perDay).toHaveLength(17);
    expect(stats.perDay.find((d: any) => d.date === '2026-10-03')).toMatchObject({
      plays: 1,
      minutes: 60,
    });
    expect(stats.perDay.reduce((sum: number, d: any) => sum + d.plays, 0)).toBe(3);
    expect(stats.perHour).toEqual({ morning: 60, afternoon: 0, evening: 136, night: 0 });
    expect(stats.total).toMatchObject({
      plays: 5,
      episodes: 4,
      movies: 1,
      unknownDates: 1,
      monthOnlyDates: 1,
    });
    expect(stats.topGenres.map((g: any) => g.name)).toEqual(['Drama', 'Action']);
    expect(stats.topActors.map((a: any) => a.name)).toEqual(['Peter D', 'Keanu Reeves']);
    expect(stats.streak).toEqual({ current: 2, best: 2 });
    expect(stats.bingeDay).toMatchObject({ date: '2026-10-17', minutes: 136 });
    expect(stats.favorites.map((f: any) => f.id)).toEqual(['movie:603']);
    expect(stats.perMonth).toEqual([{ month: '2026-10', minutes: 316, plays: 4 }]);

    const review = (await b.get('/api/watching/stats/year?year=2026')).body;
    expect(review).toMatchObject({ year: 2026, plays: 4, startedShows: 1, longestStreak: 2 });
    expect(review.months).toHaveLength(12);
  });

  it('the library: filters, sorting, pages; ratings, notes and favourites per episode', async () => {
    const { b } = await viewer();
    await b.post('/api/watching/plays', { titleId: 'movie:603' });
    await b.put('/api/watching/titles/tv:100/status', { status: 'watchlist' });
    await b.post('/api/watching/plays', { titleId: 'tv:1399', season: 1, episode: 1 });
    await b.put('/api/watching/titles/tv:1399/status', { rating: 8 });

    const all = (await b.get('/api/watching/library')).body;
    expect(all.total).toBe(3);
    expect(all.facets.genres.map((g: any) => g.name).sort()).toEqual(['Action', 'Drama']);
    expect(all.items[0]).toEqual(
      expect.objectContaining({
        title: expect.objectContaining({ id: 'tv:1399', genres: ['Drama'] }),
        status: 'watching',
        rating: 8,
        progress: expect.objectContaining({ watched: 1, aired: 6 }),
      }),
    );
    const ids = async (query: string) =>
      (await b.get(`/api/watching/library?${query}`)).body.items.map((i: any) => i.title.id);
    expect(await ids('kind=movie')).toEqual(['movie:603']);
    expect(await ids('status=watchlist,completed&sort=title')).toEqual(['tv:100', 'movie:603']);
    expect(await ids('genre=18&sort=added&order=asc')).toEqual(['tv:100', 'tv:1399']);
    expect(await ids('rated=true')).toEqual(['tv:1399']);
    expect(await ids('provider=netflix')).toEqual(['movie:603']);
    expect(await ids('q=matr')).toEqual(['movie:603']);
    expect(await ids('sort=minutes')).toEqual(['movie:603', 'tv:1399', 'tv:100']);
    expect((await b.get('/api/watching/library?pageSize=2&page=2')).body.items).toHaveLength(1);

    const mark = await b.put('/api/watching/titles/tv:1399/episodes/1/1', {
      rating: 10,
      note: 'Wow',
      favorite: true,
    });
    expect(mark.body.episode).toMatchObject({
      season: 1,
      episode: 1,
      rating: 10,
      note: 'Wow',
      favorite: true,
    });
    const s1 = (await b.get('/api/watching/titles/tv:1399/seasons/1')).body;
    expect(s1.episodes[0].mine).toEqual({ rating: 10, note: 'Wow', favorite: true });
    expect(s1.hideSpoilers).toBe(false);

    expect((await b.put('/api/watching/settings', { hideSpoilers: true })).body).toEqual({
      hideSpoilers: true,
    });
    expect((await b.get('/api/watching/settings')).body).toEqual({ hideSpoilers: true });

    expect((await b.delete('/api/watching/titles/tv:100/status')).status).toBe(204);
    expect((await b.get('/api/watching/library')).body.total).toBe(2);
  });

  it('home: continue, start, upcoming, recent; and the calendar', async () => {
    const { b } = await viewer();
    await b.post('/api/watching/plays', { titleId: 'tv:100', season: 1, episode: 1 });
    await b.put('/api/watching/titles/movie:603/status', { status: 'watchlist' });
    const home = (await b.get('/api/watching/home')).body;
    expect(home.continueWatching).toEqual([
      expect.objectContaining({
        title: expect.objectContaining({ id: 'tv:100' }),
        next: {
          season: 1,
          episode: 2,
          name: 'Episode 2',
          airDate: '2012-01-02',
          stillPath: '/s1e2.jpg',
          runtime: 51,
        },
        left: 2,
        watched: 1,
        aired: 3,
      }),
    ]);
    expect(home.startWatching.map((c: any) => c.id)).toEqual(['movie:603']);
    expect(home.upcoming).toEqual([
      expect.objectContaining({
        airDate: FUTURE,
        episode: { season: 2, episode: 2, name: 'Soon' },
      }),
    ]);
    expect(home.recent[0]).toMatchObject({ titleId: 'tv:100', season: 1, episode: 1 });
    expect((await b.get('/api/watching/home?kind=movie')).body.continueWatching).toEqual([]);

    const cal = (await b.get(`/api/watching/calendar?from=2098-12-01&to=2099-01-30`)).body;
    expect(cal.days).toEqual([
      {
        date: FUTURE,
        items: [
          expect.objectContaining({ kind: 'episode', season: 2, episode: 2 }),
          expect.objectContaining({ episode: 3 }),
        ],
      },
    ]);
    expect((await b.get('/api/watching/calendar?from=2026-01-01&to=2026-12-31')).status).toBe(400);
  });

  it('where to watch in Moldova, as checked', async () => {
    const { b } = await viewer();
    const res = await b.post('/api/watching/availability', {
      titleId: 'movie:603',
      provider: 'Netflix',
      available: false,
      note: 'Not in the MD catalogue',
    });
    expect(res.status).toBe(200);
    await b.post('/api/watching/availability', {
      titleId: 'movie:603',
      provider: 'netflix',
      available: true,
    });
    const checked = (await b.get('/api/watching/titles/movie:603')).body.title.providers.checked;
    expect(checked).toEqual([
      expect.objectContaining({
        provider: 'netflix',
        available: true,
        checkedBy: expect.objectContaining({ name: 'Ana' }),
      }),
    ]);
  });
});

describe('watching together', () => {
  it('one play each, one group; "ours" waits for everyone', async () => {
    const { ana, ion } = await family();
    const both = await ana.b.post('/api/watching/plays', {
      titleId: 'tv:1399',
      season: 1,
      upTo: 2,
      userIds: [ana.user.id, ion.user.id],
    });
    expect(both.body.added).toBe(4);
    expect(new Set(both.body.plays.map((p: any) => p.groupId)).size).toBe(1);
    expect(both.body.plays[0].together).toEqual([ion.user.id]);
    await ana.b.post('/api/watching/plays', { titleId: 'tv:1399', season: 1, episode: 3 });

    const mine = (await ana.b.get('/api/watching/home')).body.continueWatching[0];
    expect(mine.next).toMatchObject({ season: 2, episode: 1 });
    const ours = (await ana.b.get(`/api/watching/home?people=${ana.user.id},${ion.user.id}`)).body
      .continueWatching[0];
    expect(ours.next).toMatchObject({ season: 1, episode: 3 });
    expect(
      (await ana.b.get('/api/watching/home?scope=household')).body.continueWatching[0].next,
    ).toMatchObject({ season: 1, episode: 3 });

    // Ion's stats are visible to Ana (the family switcher); a stranger's are not.
    const ions = (await ana.b.get(`/api/watching/stats?userId=${ion.user.id}&from=2000-01-01`))
      .body;
    expect(ions.total.plays).toBe(2);
    const stranger = await t.createUser({ email: 'x@example.com' });
    expect((await ana.b.get(`/api/watching/stats?userId=${stranger.id}`)).status).toBe(400);
    expect(
      (await ana.b.post('/api/watching/plays', { titleId: 'movie:603', userIds: [stranger.id] }))
        .status,
    ).toBe(400);

    const s1 = (await ion.b.get('/api/watching/titles/tv:1399/seasons/1')).body;
    expect(s1.episodes[0].watchedBy.sort()).toEqual([ana.user.id, ion.user.id].sort());
    expect(s1.episodes[2].watchedBy).toEqual([ana.user.id]);

    // Undo one episode for both.
    const play = both.body.plays.find((p: any) => p.userId === ana.user.id && p.episode === 1);
    const undone = await ana.b.delete(`/api/watching/plays/${play.id}?together=true`);
    expect(undone.body.removed).toHaveLength(2);

    // A shared status.
    const status = await ana.b.put('/api/watching/titles/movie:603/status', {
      status: 'watchlist',
      userIds: [ana.user.id, ion.user.id],
    });
    expect(status.body.mine.status).toBe('watchlist');
    expect((await ion.b.get('/api/watching/titles/movie:603')).body.mine.status).toBe('watchlist');
    expect((await ana.b.get('/api/watching/titles/movie:603')).body.household).toEqual([
      expect.objectContaining({ name: 'Ion', status: 'watchlist' }),
    ]);
  });

  it('lists: own and shared, in order', async () => {
    const { ana, ion } = await family();
    const night = (await ana.b.post('/api/watching/lists', { name: 'Movie night', shared: true }))
      .body.list;
    const secret = (await ana.b.post('/api/watching/lists', { name: 'Mine' })).body.list;
    await ana.b.post(`/api/watching/lists/${night.id}/items`, { titleId: 'movie:603' });
    await ion.b.post(`/api/watching/lists/${night.id}/items`, {
      titleId: 'tv:1399',
      note: 'For Patricia',
    });
    expect((await ion.b.get('/api/watching/lists')).body.lists.map((l: any) => l.name)).toEqual([
      'Movie night',
    ]);
    expect((await ion.b.get(`/api/watching/lists/${secret.id}`)).status).toBe(404);
    expect((await ion.b.delete(`/api/watching/lists/${night.id}`)).status).toBe(403);

    const reordered = await ana.b.put(`/api/watching/lists/${night.id}/order`, {
      titleIds: ['tv:1399', 'movie:603'],
    });
    expect(reordered.body.items.map((i: any) => i.title.id)).toEqual(['tv:1399', 'movie:603']);
    expect(reordered.body.list).toMatchObject({
      count: 2,
      posters: ['/got.jpg', '/matrix.jpg'],
      mine: true,
    });
    await ana.b.delete(`/api/watching/lists/${night.id}/items/movie:603`);
    expect((await ana.b.get(`/api/watching/lists/${night.id}`)).body.items).toHaveLength(1);
  });
});

describe('watching: bringing TV Time and Trakt over', () => {
  it('reads CSV with quotes and line breaks', () => {
    expect(parseCsv('\uFEFFa,b\r\n"x, y","he said ""hi""\nthen"\n')).toEqual([
      { a: 'x, y', b: 'he said "hi"\nthen' },
    ]);
    const rows = readExport('tvtime', {
      'seen_episode.csv':
        'tv_show_name,episode_season_number,episode_number,created_at\nThrones,1,1,2019-03-02 20:15:07\n',
      'followed_tv_show.csv': 'tv_show_id,tv_show_name\n100,Ongoing\n',
    });
    expect(rows).toEqual([
      expect.objectContaining({
        kind: 'tv',
        title: 'Thrones',
        season: 1,
        episode: 1,
        watchedAt: new Date('2019-03-02T20:15:07Z'),
      }),
      expect.objectContaining({
        kind: 'tv',
        ids: expect.objectContaining({ tvdb: 100 }),
        status: 'watchlist',
      }),
    ]);
  });

  it('matches by ids or name, reports the rest, and adds nothing twice', async () => {
    const { b } = await viewer();
    const history = [
      {
        watched_at: '2020-01-02T20:00:00.000Z',
        type: 'movie',
        movie: { title: 'The Matrix', year: 1999, ids: { imdb: 'tt0133093' } },
      },
      {
        watched_at: '2020-01-03T20:00:00.000Z',
        type: 'episode',
        episode: { season: 1, number: 1 },
        show: { title: 'Thrones', ids: { tvdb: 121361 } },
      },
      {
        watched_at: '2020-01-04T20:00:00.000Z',
        type: 'episode',
        episode: { season: 1, number: 2 },
        show: { title: 'Thrones', ids: { tvdb: 121361 } },
      },
      {
        watched_at: '2020-01-05T20:00:00.000Z',
        type: 'movie',
        movie: { title: 'Nowhere film', year: 1950, ids: { imdb: 'tt0000001' } },
      },
    ];
    const first = await b.post('/api/watching/import', {
      source: 'trakt',
      data: {
        'watched-history.json': JSON.stringify(history),
        'ratings-movies.json': [
          { rated_at: '2020-01-02', rating: 9, type: 'movie', movie: { ids: { tmdb: 603 } } },
        ],
      },
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      rows: 5,
      titles: { matched: 2, unmatched: 1, pending: 0 },
      matchedBy: { imdb: 1, tvdb: 1 },
      plays: { added: 3, duplicates: 0 },
      ratings: 1,
      unmatched: [expect.objectContaining({ title: 'Nowhere film', reason: 'not found on TMDB' })],
    });
    const again = await b.post('/api/watching/import', {
      source: 'trakt',
      data: JSON.stringify(history),
    });
    expect(again.body.plays).toEqual({ added: 0, duplicates: 3 });

    const tvtime = await b.post('/api/watching/import', {
      source: 'tvtime',
      filename: 'seen_episode.csv',
      data: 'tv_show_name,episode_season_number,episode_number,created_at\nThrones,1,3,2020-01-06 21:00:00\n',
    });
    expect(tvtime.body).toMatchObject({ matchedBy: { title: 1 }, plays: { added: 1 } });

    const mine = (await b.get('/api/watching/titles/movie:603')).body.mine;
    expect(mine).toMatchObject({ status: 'completed', rating: 9, playCount: 1 });
    expect(mine.plays[0]).toMatchObject({
      source: 'import',
      watchedAt: '2020-01-02T20:00:00.000Z',
    });
    expect((await b.get('/api/watching/titles/tv:1399')).body.mine.progress.watched).toBe(3);
  });
});

describe('watching: keys, live sync and MCP', () => {
  it('keys reach /api/watching like training; changes are announced as watching', () => {
    expect(tokenMayAccess('food:read', 'GET', '/api/watching/home')).toBe(true);
    expect(tokenMayAccess('food:read', 'POST', '/api/watching/plays')).toBe(false);
    expect(tokenMayAccess('food', 'POST', '/api/watching/plays')).toBe(true);
    expect(areaOf('/api/watching/plays')).toBe('watching');
    expect(toolArea('watching_mark_watched')).toBe('watching');
    expect(toolArea('watching_add_to_list')).toBe('watching');
  });

  it('Claude marks a film watched for two people by name', async () => {
    const { ana, ion } = await family();
    const key = (await ana.b.post('/api/me/tokens', { name: 'Claude', scope: 'food' })).body.token;
    const call = async (name: string, args: unknown) => {
      const res = await t.app.request('/api/mcp', {
        method: 'POST',
        headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args },
        }),
      });
      const body = (await res.json()) as any;
      expect(body.result.isError ?? false).toBe(false);
      return JSON.parse(body.result.content[0].text);
    };
    expect(await call('watching_search', { q: 'matrix' })).toEqual([
      expect.objectContaining({ id: 'movie:603', title: 'The Matrix' }),
    ]);
    expect(
      await call('watching_mark_watched', { titleId: 'movie:603', people: ['Ana', 'ion'] }),
    ).toMatchObject({ added: 2, status: 'completed' });
    expect((await ion.b.get('/api/watching/titles/movie:603')).body.mine.plays[0]).toMatchObject({
      source: 'ai',
    });
    expect(
      await call('watching_set_availability', {
        titleId: 'movie:603',
        provider: 'Netflix',
        available: true,
        note: 'Checked netflix.com/md',
      }),
    ).toEqual([expect.objectContaining({ provider: 'Netflix', available: true })]);
    expect(
      await call('watching_add_to_list', { list: 'Movie night', titleId: 'tv:1399' }),
    ).toMatchObject({ list: 'Movie night' });
    expect((await call('watching_library', {})).total).toBe(1);
    expect(
      await call('watching_mark_up_to', { titleId: 'tv:1399', season: 2, episode: 1 }),
    ).toMatchObject({ added: 4 });
    expect((await call('watching_stats', { from: '2000-01-01' })).total.plays).toBe(5);
  });
});
