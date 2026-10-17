import { AppError } from '../../lib/errors';
import { localDate } from '../food/stock';
import type { Watch } from './people';
import { listRows, PLAY_COLUMNS, playCounts, progressOf, toPlay } from './plays';
import { type LIBRARY_SORTS, type LibraryQuery, type Status } from './schemas';
import {
  cardOf,
  episodeText,
  getSeason,
  getTitles,
  storedSeason,
  storedTitles,
  textOf,
  type Kind,
  type StoredTitle,
} from './titles';

/**
 * The Watching home (continue, start, upcoming, recent), the library with its filters, and the
 * calendar. One person's, or several people's together ("ours": an episode counts as watched
 * when all of them watched it).
 */

const ACTIVE: Status[] = ['watching', 'rewatching'];

async function episodeDetails(w: Watch, title: StoredTitle, season: number, episode: number) {
  const data = await getSeason(w.deps, title.tmdbId, season, w.locale).catch(() =>
    storedSeason(w.ctx.db, title.tmdbId, season),
  );
  const found = data?.episodes.find((e) => e.n === episode);
  return {
    season,
    episode,
    name: found ? episodeText(found, w.locale).name : null,
    airDate: found?.airDate ?? null,
    stillPath: found?.stillPath ?? null,
    runtime: found?.runtime ?? title.data.runtime,
  };
}

export async function home(w: Watch, people: string[], kind?: Kind) {
  const rows = await listRows(w.ctx.db, people);
  const titleIds = [...new Set(rows.map((r) => r.title_id))];
  const activeIds = [
    ...new Set(rows.filter((r) => ACTIVE.includes(r.status)).map((r) => r.title_id)),
  ].filter((id) => !kind || id.startsWith(`${kind}:`));
  // Shows being watched are refreshed when stale (a new episode may be out); the rest is read
  // as stored.
  const [fresh, stored, counts, recentRows] = await Promise.all([
    getTitles(
      w.deps,
      activeIds.filter((id) => id.startsWith('tv:')),
      w.locale,
    ),
    storedTitles(w.ctx.db, titleIds),
    playCounts(w.ctx.db, people),
    w.ctx.db.query<Parameters<typeof toPlay>[0]>(
      `SELECT ${PLAY_COLUMNS} FROM watch_plays p WHERE p.user_id = ANY($1) ${kind ? 'AND p.title_id LIKE $2' : ''}
        ORDER BY p.watched_at DESC NULLS LAST, p.created_at DESC LIMIT 40`,
      kind ? [people, `${kind}:%`] : [people],
    ),
  ]);
  const titles = new Map([...stored, ...fresh]);
  const lastPlayed = new Map<string, string>();
  const { rows: lastRows } = await w.ctx.db.query<{ title_id: string; last: Date }>(
    'SELECT title_id, max(coalesce(watched_at, created_at)) AS last FROM watch_plays WHERE user_id = ANY($1) GROUP BY title_id',
    [people],
  );
  for (const row of lastRows) lastPlayed.set(row.title_id, row.last.toISOString());
  const today = localDate(w.ctx.now);
  const single = people.length === 1;

  const continueWatching = [];
  for (const id of activeIds) {
    const title = titles.get(id);
    if (!title || title.kind !== 'tv') continue;
    const rewatching = single && rows.some((r) => r.title_id === id && r.status === 'rewatching');
    const progress = progressOf(title.data, counts, people, id, rewatching);
    if (!progress.next) continue;
    continueWatching.push({
      title: cardOf(title, w.locale),
      status: rewatching ? 'rewatching' : 'watching',
      next: await episodeDetails(w, title, progress.next.season, progress.next.episode),
      left: progress.left,
      watched: progress.watched,
      aired: progress.aired,
      progress: progress.aired ? progress.watched / progress.aired : 0,
      lastWatchedAt: lastPlayed.get(id) ?? null,
    });
  }
  continueWatching.sort((a, b) => (b.lastWatchedAt ?? '').localeCompare(a.lastWatchedAt ?? ''));

  const watchlist = new Map<string, Date>();
  for (const row of rows)
    if (row.status === 'watchlist' && (!kind || row.title_id.startsWith(`${kind}:`)))
      watchlist.set(row.title_id, row.added_at);
  const startWatching = [...watchlist]
    .sort((a, b) => b[1].getTime() - a[1].getTime())
    .map(([id, addedAt]) => {
      const title = titles.get(id);
      return title ? { ...cardOf(title, w.locale), addedAt: addedAt.toISOString() } : null;
    })
    .filter(Boolean)
    .slice(0, 30);

  const upcoming = [];
  const following = new Set(rows.filter((r) => r.status !== 'dropped').map((r) => r.title_id));
  for (const id of following) {
    const title = titles.get(id);
    if (!title || (kind && title.kind !== kind)) continue;
    if (title.kind === 'tv') {
      const next = title.data.nextEpisode;
      if (next?.airDate && next.airDate >= today)
        upcoming.push({
          title: cardOf(title, w.locale),
          airDate: next.airDate,
          episode: { season: next.season, episode: next.episode, name: next.name },
        });
    } else if (title.data.date && title.data.date >= today && watchlist.has(id)) {
      upcoming.push({ title: cardOf(title, w.locale), airDate: title.data.date, episode: null });
    }
  }
  upcoming.sort((a, b) => a.airDate.localeCompare(b.airDate));

  const recent = [];
  const seen = new Set<string>();
  for (const row of recentRows.rows) {
    const play = toPlay(row);
    // Watched together: shown once.
    const key = play.groupId ? `${play.groupId}:${play.season}:${play.episode}` : play.id;
    if (seen.has(key)) continue;
    seen.add(key);
    const title = titles.get(play.titleId);
    if (!title) continue;
    let name: string | null = null;
    if (play.season !== null) {
      const season = await storedSeason(w.ctx.db, title.tmdbId, play.season);
      const ep = season?.episodes.find((e) => e.n === play.episode);
      name = ep ? episodeText(ep, w.locale).name : null;
    }
    recent.push({ ...play, title: cardOf(title, w.locale), name });
    if (recent.length >= 20) break;
  }

  return { continueWatching, startWatching, upcoming: upcoming.slice(0, 20), recent };
}

// ---------------------------------------------------------------- the library

export async function library(w: Watch, people: string[], query: LibraryQuery) {
  const rows = await listRows(w.ctx.db, people);
  const byTitle = new Map<string, typeof rows>();
  for (const row of rows) byTitle.set(row.title_id, [...(byTitle.get(row.title_id) ?? []), row]);
  const ids = [...byTitle.keys()];
  const [titles, counts, { rows: playRows }, { rows: checks }] = await Promise.all([
    storedTitles(w.ctx.db, ids),
    playCounts(w.ctx.db, people, ids),
    w.ctx.db.query<{ title_id: string; plays: number; minutes: number; last: Date | null }>(
      `SELECT title_id, count(*)::int AS plays, coalesce(sum(runtime_min), 0)::int AS minutes, max(watched_at) AS last
         FROM watch_plays WHERE user_id = ANY($1) AND title_id = ANY($2) GROUP BY title_id`,
      [people, ids],
    ),
    w.ctx.db.query<{ title_id: string; provider: string }>(
      'SELECT title_id, provider FROM watch_availability WHERE available AND title_id = ANY($1)',
      [ids],
    ),
  ]);
  const plays = new Map(playRows.map((r) => [r.title_id, r]));
  const q = query.q?.toLowerCase();
  const provider = query.provider?.toLowerCase();

  const genreNames = new Map<number, string>();
  let items = ids.flatMap((id) => {
    const title = titles.get(id);
    if (!title) return [];
    const own = byTitle.get(id)!;
    const first = own.find((r) => r.user_id === people[0]) ?? own[0]!;
    const text = textOf(title.data, w.locale);
    title.data.genreIds.forEach((g, i) => text.genres[i] && genreNames.set(g, text.genres[i]!));
    const progress =
      title.kind === 'tv'
        ? progressOf(
            title.data,
            counts,
            people,
            id,
            people.length === 1 && first.status === 'rewatching',
          )
        : null;
    const stats = plays.get(id);
    const providers = [
      ...['MD', 'RO'].flatMap((region) =>
        (title.data.providers[region as 'MD' | 'RO']?.flatrate ?? []).map((p) => p.name),
      ),
      ...checks.filter((c) => c.title_id === id).map((c) => c.provider),
    ];
    return [
      {
        title: { ...cardOf(title, w.locale), genres: text.genres },
        status: first.status,
        favorite: first.favorite,
        rating: first.rating,
        notes: first.notes,
        addedAt: first.added_at.toISOString(),
        updatedAt: first.updated_at.toISOString(),
        people: own.map((r) => ({ userId: r.user_id, status: r.status })),
        plays: stats?.plays ?? 0,
        minutes: stats?.minutes ?? 0,
        lastWatchedAt: stats?.last?.toISOString() ?? null,
        rewatches:
          title.kind === 'movie'
            ? Math.max(0, (counts.get(people[0]!)?.get(id)?.get('movie') ?? 0) - 1)
            : (progress?.rewatches ?? 0),
        progress: progress
          ? {
              watched: progress.watched,
              aired: progress.aired,
              total: progress.total,
              percent: progress.percent,
              left: progress.left,
            }
          : null,
        _search: [
          ...Object.values(title.data.i18n).map((t) => t?.title ?? ''),
          title.data.originalTitle,
        ]
          .join(' ')
          .toLowerCase(),
        _providers: providers.map((p) => p.toLowerCase()),
        _statuses: own.map((r) => r.status),
      },
    ];
  });

  // What there is to filter by, before filtering.
  const facets = {
    genres: [...genreNames]
      .map(([id, name]) => ({
        id,
        name,
        count: items.filter((i) => i.title.genreIds.includes(id)).length,
      }))
      .sort((a, b) => b.count - a.count),
    years: [...new Set(items.map((i) => i.title.year).filter((y): y is number => y !== null))].sort(
      (a, b) => b - a,
    ),
    providers: [...new Set(items.flatMap((i) => i._providers))].sort(),
    statuses: Object.fromEntries(
      [...new Set(items.map((i) => i.status))].map((s) => [
        s,
        items.filter((i) => i.status === s).length,
      ]),
    ),
  };

  items = items.filter(
    (i) =>
      (!query.status.length || i._statuses.some((s) => query.status.includes(s))) &&
      (!query.kind || i.title.kind === query.kind) &&
      (!query.genre || i.title.genreIds.includes(query.genre)) &&
      (!query.year || i.title.year === query.year) &&
      (!provider ||
        i._providers.some((p) => p === provider) ||
        i._providers.some((p) => p.includes(provider))) &&
      (query.rated === undefined || (query.rated === 'true') === (i.rating !== null)) &&
      (query.favorite === undefined || (query.favorite === 'true') === i.favorite) &&
      (!q || i._search.includes(q)),
  );

  const sort = query.sort ?? 'recent';
  const collator = new Intl.Collator(w.locale);
  type Item = (typeof items)[number];
  const n = (value: number | null) => value ?? -1e15;
  const ascendingOrder: Record<(typeof LIBRARY_SORTS)[number], (a: Item, b: Item) => number> = {
    recent: (a, b) =>
      (a.lastWatchedAt ?? a.updatedAt).localeCompare(b.lastWatchedAt ?? b.updatedAt),
    added: (a, b) => a.addedAt.localeCompare(b.addedAt),
    title: (a, b) => collator.compare(a.title.title, b.title.title),
    rating: (a, b) => n(a.rating) - n(b.rating) || n(a.title.rating) - n(b.title.rating),
    year: (a, b) => n(a.title.year) - n(b.title.year),
    progress: (a, b) => percentOf(a) - percentOf(b),
    minutes: (a, b) => a.minutes - b.minutes,
  };
  // Titles read A→Z by default; everything else biggest or newest first.
  const ascending = query.order ? query.order === 'asc' : sort === 'title';
  items.sort((a, b) => (ascending ? 1 : -1) * ascendingOrder[sort](a, b));

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 30;
  return {
    items: items
      .slice((page - 1) * pageSize, page * pageSize)
      .map(({ _search: _s, _providers: _p, _statuses: _st, ...item }) => item),
    total: items.length,
    page,
    pageSize,
    facets,
  };
}

const percentOf = (item: { progress: { percent: number } | null; plays: number }) =>
  item.progress ? item.progress.percent : item.plays ? 100 : 0;

// ---------------------------------------------------------------- the calendar

export async function calendar(w: Watch, people: string[], from?: string, to?: string) {
  const start = from ?? localDate(w.ctx.now);
  const end = to ?? localDate(w.ctx.now, 30);
  const days = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  if (days < 0 || days > 120)
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { to: 'At most 120 days from the start' },
    });
  const rows = (await listRows(w.ctx.db, people)).filter((r) => r.status !== 'dropped');
  const ids = [...new Set(rows.map((r) => r.title_id))];
  const shows = ids.filter((id) => id.startsWith('tv:'));
  const [fresh, stored, counts] = await Promise.all([
    getTitles(
      w.deps,
      shows.filter((id) => rows.some((r) => r.title_id === id && r.status !== 'completed')),
      w.locale,
    ),
    storedTitles(w.ctx.db, ids),
    playCounts(w.ctx.db, people, ids),
  ]);
  const titles = new Map([...stored, ...fresh]);
  const watchedByAll = (id: string, key: string) =>
    people.every((p) => (counts.get(p)?.get(id)?.get(key) ?? 0) > 0);

  const items: Array<{
    date: string;
    kind: 'episode' | 'movie';
    title: ReturnType<typeof cardOf>;
    season: number | null;
    episode: number | null;
    name: string | null;
    stillPath: string | null;
    runtime: number | null;
    watched: boolean;
  }> = [];
  for (const title of titles.values()) {
    if (title.kind === 'movie') {
      const date = title.data.date;
      if (date && date >= start && date <= end)
        items.push({
          date,
          kind: 'movie',
          title: cardOf(title, w.locale),
          season: null,
          episode: null,
          name: null,
          stillPath: null,
          runtime: title.data.runtime,
          watched: watchedByAll(title.id, 'movie'),
        });
      continue;
    }
    const { lastEpisode: last, nextEpisode: next } = title.data;
    const seasons = new Set<number>();
    if (last && (last.airDate ?? '') >= start) seasons.add(last.season);
    if (next && next.airDate && next.airDate <= end) seasons.add(next.season);
    for (const n of seasons) {
      const season = await getSeason(w.deps, title.tmdbId, n, w.locale).catch(() =>
        storedSeason(w.ctx.db, title.tmdbId, n),
      );
      for (const e of season?.episodes ?? []) {
        if (!e.airDate || e.airDate < start || e.airDate > end) continue;
        items.push({
          date: e.airDate,
          kind: 'episode',
          title: cardOf(title, w.locale),
          season: n,
          episode: e.n,
          name: episodeText(e, w.locale).name || null,
          stillPath: e.stillPath,
          runtime: e.runtime,
          watched: watchedByAll(title.id, `${n}:${e.n}`),
        });
      }
    }
  }
  items.sort((a, b) => a.date.localeCompare(b.date) || a.title.title.localeCompare(b.title.title));
  const out: Array<{ date: string; items: Array<Omit<(typeof items)[number], 'date'>> }> = [];
  for (const { date, ...item } of items) {
    if (out.at(-1)?.date !== date) out.push({ date, items: [] });
    out.at(-1)!.items.push(item);
  }
  return { from: start, to: end, days: out };
}
