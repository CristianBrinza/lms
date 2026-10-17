import { randomUUID } from 'node:crypto';
import { AppError } from '../../lib/errors';
import { afterPlays, epKey } from './plays';
import { me, type Watch } from './people';
import type { Status } from './schemas';
import { cached, DAY, tmdb } from './tmdb';
import { getTitle, storedSeason, titleId, toCards, type Kind, type StoredTitle } from './titles';

/**
 * Bringing a history over from TV Time (its GDPR export: CSV files) or Trakt (its JSON export):
 * plays with their dates, watchlists and ratings. Titles are matched by TMDB id, else IMDb or
 * TVDB id (TMDB's /find), else by name and year. Importing the same file again adds nothing new
 * (every imported play has a key). Large histories are done in parts: what didn't fit in one
 * request is reported as pending, and importing again carries on.
 */

const TIME_BUDGET_MS = 60_000;
const MAX_ROWS = 100_000;

interface Ids {
  tmdb?: number;
  imdb?: string;
  tvdb?: number;
}

interface Row {
  kind?: Kind;
  ids: Ids;
  title?: string;
  year?: number;
  season?: number;
  episode?: number;
  /** undefined: not a play (a watchlist or rating row); null: watched, date unknown. */
  watchedAt?: Date | null;
  status?: Status;
  rating?: number;
  /** A rating for one episode, not the whole title. */
  episodeRating?: boolean;
}

// ---------------------------------------------------------------- reading files

/** RFC 4180 CSV: quoted fields, doubled quotes, line breaks inside quotes. */
export function parseCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);
  const [header, ...body] = rows;
  if (!header) return [];
  const names = header.map((name) => name.trim().toLowerCase());
  return body.map((cells) => Object.fromEntries(names.map((name, i) => [name, cells[i] ?? ''])));
}

const num = (value: unknown): number | undefined => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(n) && String(value ?? '').trim() !== '' ? n : undefined;
};
const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim()
    ? value.trim()
    : typeof value === 'number'
      ? String(value)
      : undefined;

function date(value: unknown): Date | null {
  const text = str(value);
  if (!text) return null;
  // TV Time writes "2019-03-02 20:15:07" in UTC.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(text)
    ? `${text.replace(' ', 'T')}Z`
    : text;
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? null : at;
}

const imdbOf = (value: unknown) => {
  const text = str(value);
  return text && /^tt\d+$/.test(text) ? text : undefined;
};

function pick(record: Record<string, unknown>, names: string[]): unknown {
  for (const name of names)
    if (record[name] !== undefined && record[name] !== '') return record[name];
  return undefined;
}

/** One TV Time row (a CSV line, or a JSON object with the same kind of fields). */
function tvTimeRow(record: Record<string, unknown>, file: string): Row | null {
  const r = Object.fromEntries(Object.entries(record).map(([k, v]) => [k.toLowerCase(), v]));
  const type = String(pick(r, ['type', 'entity_type', 'media_type']) ?? '').toLowerCase();
  const movieName = str(pick(r, ['movie_name', 'movie_title']));
  const isMovie = Boolean(movieName) || type.includes('movie') || /movie/.test(file);
  const season = num(pick(r, ['episode_season_number', 'season_number', 'season']));
  const episode = num(pick(r, ['episode_number', 'number', 'episode']));
  const title =
    movieName ?? str(pick(r, ['tv_show_name', 'show_name', 'series_name', 'title', 'name']));
  const ids: Ids = {
    tmdb: num(pick(r, ['tmdb_id', 'tmdb'])),
    imdb: imdbOf(pick(r, ['imdb_id', 'imdb'])),
    tvdb: isMovie
      ? undefined
      : num(pick(r, ['tv_show_id', 'show_id', 'series_id', 'tvdb_id', 's_id'])),
  };
  if (!title && !ids.tmdb && !ids.imdb && !ids.tvdb) return null;
  const when = date(pick(r, ['watched_at', 'seen_at', 'created_at', 'date', 'updated_at']));
  const rating = num(pick(r, ['rating', 'score']));
  const followOnly = /follow|watchlist|towatch/.test(file) && episode === undefined;
  if (isMovie)
    return {
      kind: 'movie',
      ids,
      title,
      year: num(pick(r, ['year', 'release_year'])),
      ...(followOnly ? { status: 'watchlist' as Status } : { watchedAt: when }),
      ...(rating ? { rating: Math.round(rating) } : {}),
    };
  if (season !== undefined && episode !== undefined)
    return { kind: 'tv', ids, title, season, episode, watchedAt: when };
  return { kind: 'tv', ids, title, status: 'watchlist' };
}

type TraktIds = { trakt?: number; tmdb?: number; imdb?: string; tvdb?: number };
type TraktMedia = { title?: string; year?: number; ids?: TraktIds };
const traktIds = (ids: TraktIds | undefined): Ids => ({
  tmdb: num(ids?.tmdb),
  imdb: imdbOf(ids?.imdb),
  tvdb: num(ids?.tvdb),
});

/** One Trakt record: history, watched (movies, shows), watchlist or ratings. */
function traktRows(record: Record<string, unknown>, file: string): Row[] {
  const movie = record.movie as TraktMedia | undefined;
  const show = record.show as TraktMedia | undefined;
  const episode = record.episode as
    { season?: number; number?: number; ids?: TraktIds } | undefined;
  const media = movie ?? show;
  if (!media) return [];
  const base = {
    kind: (movie ? 'movie' : 'tv') as Kind,
    ids: traktIds(media.ids),
    title: media.title,
    year: media.year,
  };
  if (record.rating !== undefined) {
    const rating = num(record.rating);
    if (!rating) return [];
    if (episode && show)
      return [
        { ...base, season: episode.season, episode: episode.number, rating, episodeRating: true },
      ];
    if (record.type === 'season') return [];
    return [{ ...base, rating }];
  }
  if (record.listed_at !== undefined || /watchlist/.test(file))
    return [{ ...base, status: 'watchlist' }];
  if (record.watched_at !== undefined) {
    const at = date(record.watched_at);
    return [
      episode
        ? { ...base, season: episode.season, episode: episode.number, watchedAt: at }
        : { ...base, watchedAt: at },
    ];
  }
  // watched-movies.json / watched-shows.json: counts and the last time, per title or episode.
  if (movie) {
    const plays = Math.max(1, num(record.plays) ?? 1);
    return Array.from({ length: plays }, () => ({
      ...base,
      watchedAt: date(record.last_watched_at),
    }));
  }
  const seasons = (record.seasons ?? []) as Array<{
    number: number;
    episodes?: Array<{ number: number; plays?: number; last_watched_at?: string }>;
  }>;
  return seasons.flatMap((s) =>
    (s.episodes ?? []).flatMap((e) =>
      Array.from({ length: Math.max(1, e.plays ?? 1) }, () => ({
        ...base,
        season: s.number,
        episode: e.number,
        watchedAt: date(e.last_watched_at),
      })),
    ),
  );
}

/** Every file of the export, read into rows. */
export function readExport(source: 'tvtime' | 'trakt', data: unknown, filename = ''): Row[] {
  const files: Array<[string, unknown]> =
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    !('movie' in data) &&
    !('show' in data)
      ? Object.entries(data as Record<string, unknown>)
      : [[filename, data]];
  const rows: Row[] = [];
  for (const [name, content] of files) {
    const file = name.toLowerCase();
    let records: unknown = content;
    if (typeof content === 'string') {
      const text = content.trim();
      if (text.startsWith('[') || text.startsWith('{')) {
        try {
          records = JSON.parse(text);
        } catch {
          throw new AppError(400, 'IMPORT_UNREADABLE', 'That file can’t be read');
        }
      } else records = parseCsv(text);
    }
    const list = Array.isArray(records)
      ? records
      : records && typeof records === 'object'
        ? [records]
        : [];
    for (const record of list) {
      if (!record || typeof record !== 'object') continue;
      const r = record as Record<string, unknown>;
      if (source === 'trakt' || 'movie' in r || 'show' in r) rows.push(...traktRows(r, file));
      else {
        const row = tvTimeRow(r, file);
        if (row) rows.push(row);
      }
      if (rows.length > MAX_ROWS)
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large');
    }
  }
  return rows;
}

// ---------------------------------------------------------------- matching titles

type MatchedBy = 'tmdb' | 'imdb' | 'tvdb' | 'title';

async function find(
  w: Watch,
  externalId: string,
  source: 'imdb_id' | 'tvdb_id',
): Promise<string | null> {
  const found = await cached(w.deps, `find:${source}:${externalId}`, 30 * DAY, async () => {
    const raw = await tmdb(w.deps).get<{
      movie_results?: Array<{ id: number }>;
      tv_results?: Array<{ id: number }>;
    }>(`/find/${encodeURIComponent(externalId)}`, { external_source: source });
    const tv = raw.tv_results?.[0];
    const movie = raw.movie_results?.[0];
    return { id: tv ? titleId('tv', tv.id) : movie ? titleId('movie', movie.id) : null };
  });
  return found.id;
}

async function searchTitle(w: Watch, kind: Kind | undefined, title: string, year?: number) {
  const key = `import-search:${kind ?? 'all'}:${year ?? ''}:${title.toLowerCase()}`;
  const found = await cached(w.deps, key, 30 * DAY, async () => {
    const path = kind ? `/search/${kind}` : '/search/multi';
    const yearParam = kind === 'movie' ? 'year' : kind === 'tv' ? 'first_air_date_year' : undefined;
    const raw = await tmdb(w.deps).get<{ results?: Parameters<typeof toCards>[0] }>(path, {
      query: title,
      ...(yearParam && year ? { [yearParam]: year } : {}),
    });
    return { id: toCards(raw.results, kind, 1)[0]?.id ?? null };
  });
  return found.id;
}

async function match(w: Watch, row: Row): Promise<{ id: string; by: MatchedBy } | null> {
  if (row.ids.tmdb && row.kind) return { id: titleId(row.kind, row.ids.tmdb), by: 'tmdb' };
  if (row.ids.imdb) {
    const id = await find(w, row.ids.imdb, 'imdb_id');
    if (id) return { id, by: 'imdb' };
  }
  if (row.ids.tvdb) {
    const id = await find(w, String(row.ids.tvdb), 'tvdb_id');
    if (id) return { id, by: 'tvdb' };
  }
  if (row.title) {
    const id = await searchTitle(w, row.kind, row.title, row.year);
    if (id) return { id, by: 'title' };
  }
  return null;
}

const identity = (row: Row) =>
  row.ids.tmdb
    ? `tmdb:${row.kind}:${row.ids.tmdb}`
    : row.ids.imdb
      ? `imdb:${row.ids.imdb}`
      : row.ids.tvdb
        ? `tvdb:${row.ids.tvdb}`
        : `title:${row.kind ?? ''}:${(row.title ?? '').toLowerCase()}:${row.year ?? ''}`;

// ---------------------------------------------------------------- importing

export async function importHistory(
  w: Watch,
  input: { source: 'tvtime' | 'trakt'; data: unknown; filename?: string },
) {
  if (!tmdb(w.deps).configured)
    throw new AppError(503, 'TMDB_NOT_CONFIGURED', 'Watching needs its TMDB key');
  const rows = readExport(input.source, input.data, input.filename);
  const started = Date.now();
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(identity(row), [...(groups.get(identity(row)) ?? []), row]);

  const report = {
    source: input.source,
    rows: rows.length,
    titles: { matched: 0, unmatched: 0, pending: 0 },
    matchedBy: { tmdb: 0, imdb: 0, tvdb: 0, title: 0 } as Record<MatchedBy, number>,
    plays: { added: 0, duplicates: 0 },
    statuses: 0,
    ratings: 0,
    unmatched: [] as Array<{
      title: string | null;
      year: number | null;
      ids: Ids;
      rows: number;
      reason: string;
    }>,
  };
  const userId = me(w);
  const seenKeys = new Map<string, number>();

  // A few titles at a time (the TMDB client limits itself too).
  const entries = [...groups.values()];
  const resolved: Array<{ rows: Row[]; title: StoredTitle; by: MatchedBy } | null> = [];
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4);
    resolved.push(
      ...(await Promise.all(
        batch.map(async (group) => {
          const sample = group[0]!;
          const note = (reason: string) => {
            if (reason === 'later') report.titles.pending++;
            else report.titles.unmatched++;
            if (report.unmatched.length < 200)
              report.unmatched.push({
                title: sample.title ?? null,
                year: sample.year ?? null,
                ids: sample.ids,
                rows: group.length,
                reason,
              });
            return null;
          };
          if (Date.now() - started > TIME_BUDGET_MS) return note('later');
          const found = await match(w, sample).catch(() => null);
          if (!found) return note('not found on TMDB');
          const title = await getTitle(w.deps, found.id, w.locale).catch(() => null);
          if (!title) return note('not found on TMDB');
          return { rows: group, title, by: found.by };
        }),
      )),
    );
  }

  // The same title can come in under several ids (an IMDb id in the history, a TMDB id in the
  // ratings): one title, all its rows.
  const byTitle = new Map<string, { rows: Row[]; title: StoredTitle }>();
  for (const entry of resolved) {
    if (!entry) continue;
    report.matchedBy[entry.by]++;
    const known = byTitle.get(entry.title.id);
    if (known) known.rows.push(...entry.rows);
    else byTitle.set(entry.title.id, { rows: [...entry.rows], title: entry.title });
  }
  report.titles.matched = byTitle.size;

  for (const entry of byTitle.values()) {
    const { title } = entry;
    const runtimes = new Map<string, number>();
    if (title.kind === 'tv')
      for (const season of new Set(entry.rows.map((r) => r.season).filter((s) => s !== undefined)))
        for (const e of (await storedSeason(w.ctx.db, title.tmdbId, season!))?.episodes ?? [])
          if (e.runtime) runtimes.set(epKey(season!, e.n), e.runtime);

    await w.ctx.tx(async (ctx) => {
      let played = false;
      for (const row of entry.rows) {
        if (row.watchedAt === undefined) continue;
        if (title.kind === 'tv' && (row.season === undefined || row.episode === undefined))
          continue;
        const season = title.kind === 'tv' ? row.season! : null;
        const episode = title.kind === 'tv' ? row.episode! : null;
        const base = `${input.source}:${title.id}:${season ?? ''}:${episode ?? ''}:${row.watchedAt?.toISOString() ?? 'unknown'}`;
        const n = (seenKeys.get(base) ?? 0) + 1;
        seenKeys.set(base, n);
        const runtime =
          (season !== null ? runtimes.get(epKey(season, episode!)) : undefined) ??
          title.data.runtime ??
          0;
        const { rowCount } = await ctx.db.query(
          `INSERT INTO watch_plays (id, user_id, title_id, season, episode, watched_at, date_precision, runtime_min, source, import_key, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'import', $9, $10)
           ON CONFLICT (user_id, import_key) WHERE import_key IS NOT NULL DO NOTHING`,
          [
            randomUUID(),
            userId,
            title.id,
            season,
            episode,
            row.watchedAt,
            row.watchedAt ? 'exact' : 'unknown',
            runtime,
            `${base}:${n}`,
            w.ctx.now,
          ],
        );
        if (rowCount) {
          report.plays.added++;
          played = true;
        } else report.plays.duplicates++;
      }
      if (played) await afterPlays(ctx.db, userId, title, w.ctx.now, false);

      for (const row of entry.rows) {
        if (row.status) {
          const { rowCount } = await ctx.db.query(
            `INSERT INTO watch_list (user_id, title_id, status, added_at, updated_at) VALUES ($1, $2, $3, $4, $4)
             ON CONFLICT (user_id, title_id) DO NOTHING`,
            [userId, title.id, row.status, w.ctx.now],
          );
          report.statuses += rowCount ?? 0;
        }
        if (row.rating && row.rating >= 1 && row.rating <= 10) {
          const rating = Math.round(row.rating);
          if (row.episodeRating && row.season !== undefined && row.episode !== undefined)
            await ctx.db.query(
              `INSERT INTO watch_episode_marks (user_id, title_id, season, episode, rating, updated_at) VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (user_id, title_id, season, episode) DO UPDATE SET rating = EXCLUDED.rating`,
              [userId, title.id, row.season, row.episode, rating, w.ctx.now],
            );
          else
            await ctx.db.query(
              `INSERT INTO watch_list (user_id, title_id, status, rating, added_at, updated_at) VALUES ($1, $2, $3, $4, $5, $5)
               ON CONFLICT (user_id, title_id) DO UPDATE SET rating = EXCLUDED.rating`,
              [
                userId,
                title.id,
                title.kind === 'movie' ? 'completed' : 'watching',
                rating,
                w.ctx.now,
              ],
            );
          report.ratings++;
        }
      }
    });
  }
  return report;
}
