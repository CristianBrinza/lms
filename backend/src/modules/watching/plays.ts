import { randomUUID } from 'node:crypto';
import type { Queryable } from '../../db';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';
import { localDate } from '../food/stock';
import { checked, me, sourceOf, type Watch } from './people';
import type { PlayInput, Status } from './schemas';
import {
  airedEpisodes,
  episodeText,
  getSeason,
  getTitle,
  isEnded,
  parseTitleId,
  storedSeason,
  textOf,
  totalEpisodes,
  translationsOf,
  type RegionProviders,
  type StoredTitle,
  type TitleData,
} from './titles';

/**
 * What each person watched (plays) and where they are with each title (their library row).
 * A play is one viewing: rewatching adds another. Watching together makes one play per person,
 * all with the same group id.
 */

export type Precision = 'exact' | 'day' | 'month' | 'unknown';

export interface Play {
  id: string;
  userId: string;
  titleId: string;
  season: number | null;
  episode: number | null;
  watchedAt: string | null;
  precision: Precision;
  runtime: number;
  source: 'app' | 'ai' | 'import';
  groupId: string | null;
  /** The others who watched this together (same group, same episode). */
  together: string[];
}

interface PlayRow {
  id: string;
  user_id: string;
  title_id: string;
  season: number | null;
  episode: number | null;
  watched_at: Date | null;
  date_precision: Precision;
  runtime_min: number;
  source: Play['source'];
  group_id: string | null;
  together?: string[] | null;
}

export const PLAY_COLUMNS = `p.id, p.user_id, p.title_id, p.season, p.episode, p.watched_at, p.date_precision, p.runtime_min, p.source, p.group_id,
  (SELECT array_agg(o.user_id) FROM watch_plays o WHERE p.group_id IS NOT NULL AND o.group_id = p.group_id AND o.id <> p.id
     AND o.season IS NOT DISTINCT FROM p.season AND o.episode IS NOT DISTINCT FROM p.episode) AS together`;

export const toPlay = (row: PlayRow): Play => ({
  id: row.id,
  userId: row.user_id,
  titleId: row.title_id,
  season: row.season,
  episode: row.episode,
  watchedAt: row.watched_at?.toISOString() ?? null,
  precision: row.date_precision,
  runtime: row.runtime_min,
  source: row.source,
  groupId: row.group_id,
  together: row.together ?? [],
});

// ---------------------------------------------------------------- when

/** "2026-10-17T21:30" (local), "2025-03-14", "2025-03" or "unknown" → a time and how exact it is. */
export function whenOf(
  input: string | undefined,
  now: Date,
): { at: Date | null; precision: Precision } {
  if (!input) return { at: now, precision: 'exact' };
  if (input === 'unknown') return { at: null, precision: 'unknown' };
  let at: Date;
  let precision: Precision;
  if (/^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split('-').map(Number);
    at = new Date(y!, m! - 1, 1, 12);
    precision = 'month';
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    const [y, m, d] = input.split('-').map(Number);
    at = new Date(y!, m! - 1, d!, 12);
    precision = 'day';
  } else {
    at = new Date(input);
    precision = 'exact';
  }
  if (Number.isNaN(at.getTime()))
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { watchedAt: 'Not a real date' },
    });
  if (at.getTime() > now.getTime() + 24 * 60 * 60 * 1000)
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { watchedAt: 'That date is in the future' },
    });
  return { at, precision };
}

// ---------------------------------------------------------------- progress

export const epKey = (season: number, episode: number) => `${season}:${episode}`;

/** Per person, per title, per episode: how many times, and the last time. */
export type Counts = Map<string, Map<string, Map<string, number>>>;

export async function playCounts(
  db: Queryable,
  userIds: string[],
  titleIds?: string[],
): Promise<Counts> {
  const { rows } = await db.query<{
    user_id: string;
    title_id: string;
    season: number | null;
    episode: number | null;
    plays: number;
  }>(
    `SELECT user_id, title_id, season, episode, count(*)::int AS plays FROM watch_plays
      WHERE user_id = ANY($1) ${titleIds ? 'AND title_id = ANY($2)' : ''}
      GROUP BY user_id, title_id, season, episode`,
    titleIds ? [userIds, titleIds] : [userIds],
  );
  const out: Counts = new Map();
  for (const row of rows) {
    const byTitle = out.get(row.user_id) ?? new Map<string, Map<string, number>>();
    const byEp = byTitle.get(row.title_id) ?? new Map<string, number>();
    byEp.set(row.season === null ? 'movie' : epKey(row.season, row.episode!), row.plays);
    byTitle.set(row.title_id, byEp);
    out.set(row.user_id, byTitle);
  }
  return out;
}

/**
 * How far one person (or several together) is in a series: aired episodes watched by all of
 * them, and the next one none-of-them-missing. Rewatching (one person) looks for the first
 * episode not yet seen in this round.
 */
export function progressOf(
  data: TitleData,
  counts: Counts,
  people: string[],
  titleId: string,
  rewatching = false,
) {
  const aired = airedEpisodes(data);
  const count = (key: string) =>
    Math.min(...people.map((p) => counts.get(p)?.get(titleId)?.get(key) ?? 0));
  const watched = aired.filter((e) => count(epKey(e.season, e.episode)) > 0).length;
  const least = aired.length ? Math.min(...aired.map((e) => count(epKey(e.season, e.episode)))) : 0;
  const round = rewatching && people.length === 1 ? least + 1 : 1;
  const next = aired.find((e) => count(epKey(e.season, e.episode)) < round) ?? null;
  return {
    watched,
    aired: aired.length,
    total: totalEpisodes(data),
    percent: aired.length ? Math.round((watched / aired.length) * 100) : 0,
    left: next ? aired.length - aired.indexOf(next) : 0,
    rewatches: Math.max(0, least - 1),
    next,
  };
}

// ---------------------------------------------------------------- library rows

interface ListRow {
  user_id: string;
  title_id: string;
  status: Status;
  favorite: boolean;
  rating: number | null;
  notes: string;
  reactions: string[];
  added_at: Date;
  updated_at: Date;
}

export async function listRows(
  db: Queryable,
  userIds: string[],
  titleIds?: string[],
): Promise<ListRow[]> {
  const { rows } = await db.query<ListRow>(
    `SELECT user_id, title_id, status, favorite, rating, notes, reactions, added_at, updated_at FROM watch_list
      WHERE user_id = ANY($1) ${titleIds ? 'AND title_id = ANY($2)' : ''}`,
    titleIds ? [userIds, titleIds] : [userIds],
  );
  return rows;
}

/** After new plays: a film is seen; a series is being watched, and done once all of it is. */
export async function afterPlays(
  db: Queryable,
  userId: string,
  title: StoredTitle,
  now: Date,
  touchedLast: boolean,
): Promise<void> {
  const [row] = await listRows(db, [userId], [title.id]);
  let status: Status = row?.status ?? (title.kind === 'movie' ? 'completed' : 'watching');
  if (title.kind === 'movie') status = 'completed';
  else {
    if (!row || ['watchlist', 'paused', 'dropped'].includes(status)) status = 'watching';
    const counts = await playCounts(db, [userId], [title.id]);
    const progress = progressOf(title.data, counts, [userId], title.id);
    const done = progress.aired > 0 && progress.watched === progress.aired && isEnded(title.data);
    if (status === 'watching' && done) status = 'completed';
    if (status === 'rewatching' && done && touchedLast) status = 'completed';
  }
  if (row?.status === status) {
    await db.query('UPDATE watch_list SET updated_at = $3 WHERE user_id = $1 AND title_id = $2', [
      userId,
      title.id,
      now,
    ]);
    return;
  }
  await db.query(
    `INSERT INTO watch_list (user_id, title_id, status, added_at, updated_at) VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (user_id, title_id) DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    [userId, title.id, status, now],
  );
}

// ---------------------------------------------------------------- adding plays

type Target = { season: number; episode: number } | null;

async function targetsOf(
  w: Watch,
  title: StoredTitle,
  input: PlayInput,
): Promise<{ targets: Target[]; bulk: boolean }> {
  const bad = (field: string, message: string) =>
    new AppError(400, 'VALIDATION', 'Some fields need attention', { fields: { [field]: message } });
  if (title.kind === 'movie') {
    if (
      input.season !== undefined ||
      input.episode !== undefined ||
      input.upTo ||
      input.all ||
      input.episodes
    )
      throw bad('season', 'A film has no episodes');
    return { targets: [null], bulk: false };
  }
  const today = localDate(w.ctx.now);
  const seasonEpisodes = async (season: number) => {
    const data = await getSeason(w.deps, title.tmdbId, season, w.locale);
    return data.episodes.filter((e) => e.airDate && e.airDate <= today).map((e) => e.n);
  };
  if (input.season !== undefined && input.episodes?.length) {
    const season = input.season;
    return {
      targets: [...new Set(input.episodes)]
        .sort((a, b) => a - b)
        .map((n) => ({ season, episode: n })),
      bulk: true,
    };
  }
  if (input.season !== undefined && input.episode !== undefined && !input.upTo && !input.all)
    return { targets: [{ season: input.season, episode: input.episode }], bulk: false };
  if (input.season !== undefined && typeof input.upTo === 'number') {
    const season = input.season;
    const known = await seasonEpisodes(season).catch(() => null);
    const list = known
      ? known.filter((n) => n <= (input.upTo as number))
      : Array.from({ length: input.upTo }, (_, i) => i + 1);
    return { targets: list.map((n) => ({ season, episode: n })), bulk: true };
  }
  if (input.season !== undefined && input.all) {
    const season = input.season;
    return {
      targets: (await seasonEpisodes(season)).map((n) => ({ season, episode: n })),
      bulk: true,
    };
  }
  if (input.upTo && typeof input.upTo === 'object') {
    const limit = input.upTo;
    return {
      targets: airedEpisodes(title.data).filter(
        (e) => e.season < limit.season || (e.season === limit.season && e.episode <= limit.episode),
      ),
      bulk: true,
    };
  }
  if (input.all && input.season === undefined)
    return { targets: airedEpisodes(title.data), bulk: true };
  throw bad('episode', 'Say which episode');
}

export async function addPlays(w: Watch, input: PlayInput) {
  const title = await getTitle(w.deps, input.titleId, w.locale);
  const people = await checked(w, input.userIds);
  const { targets, bulk } = await targetsOf(w, title, input);
  const { at, precision } = whenOf(input.watchedAt, w.ctx.now);
  const groupId = randomUUID();

  // Episode lengths from the stored seasons, else the series' usual length.
  const runtimes = new Map<string, number>();
  for (const season of new Set(targets.filter(Boolean).map((t) => t!.season))) {
    const data = await storedSeason(w.ctx.db, title.tmdbId, season);
    for (const e of data?.episodes ?? [])
      if (e.runtime) runtimes.set(epKey(season, e.n), e.runtime);
  }
  const runtimeOf = (t: Target) =>
    (t ? runtimes.get(epKey(t.season, t.episode)) : null) ?? title.data.runtime ?? 0;

  const counts = bulk && !input.rewatch ? await playCounts(w.ctx.db, people, [title.id]) : null;
  const lastAired = airedEpisodes(title.data).at(-1);
  return w.ctx.tx(async (ctx) => {
    const added: Play[] = [];
    let skipped = 0;
    for (const userId of people) {
      let touchedLast = title.kind === 'movie';
      for (const target of targets) {
        if (
          target &&
          counts?.get(userId)?.get(title.id)?.get(epKey(target.season, target.episode))
        ) {
          skipped++;
          continue;
        }
        if (
          target &&
          lastAired &&
          target.season === lastAired.season &&
          target.episode === lastAired.episode
        )
          touchedLast = true;
        const { rows } = await ctx.db.query<PlayRow>(
          `INSERT INTO watch_plays (id, user_id, title_id, season, episode, watched_at, date_precision, runtime_min, source, group_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id, user_id, title_id, season, episode, watched_at, date_precision, runtime_min, source, group_id`,
          [
            randomUUID(),
            userId,
            title.id,
            target?.season ?? null,
            target?.episode ?? null,
            at,
            precision,
            runtimeOf(target),
            sourceOf(w),
            groupId,
            w.ctx.now,
          ],
        );
        added.push(toPlay(rows[0]!));
      }
      await afterPlays(ctx.db, userId, title, w.ctx.now, touchedLast);
    }
    for (const play of added)
      play.together = added
        .filter(
          (o) => o.userId !== play.userId && o.season === play.season && o.episode === play.episode,
        )
        .map((o) => o.userId);
    // The status of whoever the plays are for: the caller when included, else the first person.
    const [row] = await listRows(ctx.db, [people.includes(me(w)) ? me(w) : people[0]!], [title.id]);
    return {
      plays: added,
      added: added.length,
      skipped,
      groupId: added.length ? groupId : null,
      status: row?.status ?? null,
    };
  });
}

/** One play goes; `together` takes the others' plays of the same episode in its group too. */
export async function removePlay(w: Watch, id: string, together = false) {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  const { rows } = await w.ctx.db.query<PlayRow>(
    `SELECT p.* FROM watch_plays p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND (p.user_id = $2 OR u.household_id = $3)`,
    [id, me(w), w.ctx.actor.householdId],
  );
  const play = rows[0];
  if (!play) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  const { rows: removed } = await w.ctx.db.query<{ id: string }>(
    together && play.group_id
      ? `DELETE FROM watch_plays p USING users u WHERE u.id = p.user_id AND u.household_id = $3
           AND p.group_id = $1 AND p.season IS NOT DISTINCT FROM $2::int AND p.episode IS NOT DISTINCT FROM $4::int RETURNING p.id`
      : 'DELETE FROM watch_plays WHERE id = $1 RETURNING id',
    together && play.group_id
      ? [play.group_id, play.season, w.ctx.actor.householdId, play.episode]
      : [id],
  );
  return { removed: removed.map((r) => r.id) };
}

/**
 * When a play happened, changed afterwards: a day, a month, an exact moment or "unknown". together:
 * the same change for everyone who watched it in that sitting.
 */
export async function updatePlay(
  w: Watch,
  id: string,
  input: { watchedAt: string; together?: boolean },
) {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  const { rows } = await w.ctx.db.query<PlayRow>(
    `SELECT p.* FROM watch_plays p JOIN users u ON u.id = p.user_id
      WHERE p.id = $1 AND (p.user_id = $2 OR u.household_id = $3)`,
    [id, me(w), w.ctx.actor.householdId],
  );
  const play = rows[0];
  if (!play) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  const { at, precision } = whenOf(input.watchedAt, w.ctx.now);
  const { rows: changed } = await w.ctx.db.query<{ id: string }>(
    input.together && play.group_id
      ? `UPDATE watch_plays p SET watched_at = $1, precision = $2 FROM users u
          WHERE u.id = p.user_id AND u.household_id = $5 AND p.group_id = $3
            AND p.season IS NOT DISTINCT FROM $4::int AND p.episode IS NOT DISTINCT FROM $6::int
          RETURNING p.id`
      : 'UPDATE watch_plays SET watched_at = $1, precision = $2 WHERE id = $3 RETURNING id',
    input.together && play.group_id
      ? [at, precision, play.group_id, play.season, w.ctx.actor.householdId, play.episode]
      : [at, precision, id],
  );
  return { changed: changed.map((r) => r.id) };
}

/** Undo one "mark watched" (a bulk mark, or watching together): every play it added. */
export async function removeGroup(w: Watch, groupId: string) {
  if (!isUuid(groupId)) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  const { rows } = await w.ctx.db.query<{ id: string }>(
    `DELETE FROM watch_plays p USING users u WHERE u.id = p.user_id AND u.household_id = $2 AND p.group_id = $1 RETURNING p.id`,
    [groupId, w.ctx.actor.householdId],
  );
  if (!rows.length) throw new AppError(404, 'NOT_FOUND', 'That play isn’t there');
  return { removed: rows.map((r) => r.id) };
}

// ---------------------------------------------------------------- status

export async function setStatus(
  w: Watch,
  id: string,
  input: {
    status?: Status;
    favorite?: boolean;
    rating?: number | null;
    notes?: string;
    reactions?: string[];
    userIds?: string[];
  },
) {
  const title = await getTitle(w.deps, id, w.locale);
  const people = await checked(w, input.userIds);
  const now = w.ctx.now;
  for (const userId of people) {
    await w.ctx.db.query(
      `INSERT INTO watch_list (user_id, title_id, status, favorite, rating, notes, reactions, added_at, updated_at)
       VALUES ($1, $2, coalesce($3, 'watchlist'), coalesce($4, false), $5, coalesce($6, ''), coalesce($9::text[], '{}'), $7, $7)
       ON CONFLICT (user_id, title_id) DO UPDATE SET
         status = coalesce($3, watch_list.status),
         favorite = coalesce($4, watch_list.favorite),
         rating = CASE WHEN $8 THEN $5 ELSE watch_list.rating END,
         notes = coalesce($6, watch_list.notes),
         reactions = coalesce($9::text[], watch_list.reactions),
         updated_at = $7`,
      [
        userId,
        title.id,
        input.status ?? null,
        input.favorite ?? null,
        input.rating ?? null,
        input.notes ?? null,
        now,
        input.rating !== undefined,
        input.reactions ? [...new Set(input.reactions)].slice(0, 3) : null,
      ],
    );
  }
  return { mine: await mineOf(w, people.includes(me(w)) ? me(w) : people[0]!, title) };
}

/** Out of the library (plays stay, so statistics keep them). */
export async function clearStatus(w: Watch, id: string, userIds?: string[]) {
  parseTitleId(id);
  const people = await checked(w, userIds);
  await w.ctx.db.query('DELETE FROM watch_list WHERE user_id = ANY($1) AND title_id = $2', [
    people,
    id,
  ]);
}

// ---------------------------------------------------------------- a title, as the app shows it

export async function mineOf(w: Watch, userId: string, title: StoredTitle) {
  const [row] = await listRows(w.ctx.db, [userId], [title.id]);
  const { rows } = await w.ctx.db.query<PlayRow>(
    `SELECT ${PLAY_COLUMNS} FROM watch_plays p WHERE p.user_id = $1 AND p.title_id = $2
      ORDER BY p.watched_at DESC NULLS LAST, p.created_at DESC`,
    [userId, title.id],
  );
  const plays = rows.map(toPlay);
  const counts = await playCounts(w.ctx.db, [userId], [title.id]);
  const progress =
    title.kind === 'tv'
      ? progressOf(title.data, counts, [userId], title.id, row?.status === 'rewatching')
      : null;
  return {
    status: row?.status ?? null,
    favorite: row?.favorite ?? false,
    rating: row?.rating ?? null,
    notes: row?.notes ?? '',
    reactions: row?.reactions ?? [],
    addedAt: row?.added_at.toISOString() ?? null,
    updatedAt: row?.updated_at.toISOString() ?? null,
    plays,
    playCount: plays.length,
    rewatches: title.kind === 'movie' ? Math.max(0, plays.length - 1) : (progress?.rewatches ?? 0),
    minutes: plays.reduce((sum, p) => sum + p.runtime, 0),
    lastWatchedAt: plays.find((p) => p.watchedAt)?.watchedAt ?? null,
    progress: progress
      ? {
          watched: progress.watched,
          aired: progress.aired,
          total: progress.total,
          percent: progress.percent,
          left: progress.left,
        }
      : null,
    next: progress?.next ?? null,
  };
}

interface AvailabilityRow {
  id: string;
  provider: string;
  available: boolean;
  note: string;
  checked_at: Date;
  checked_by: string | null;
  checked_by_name: string | null;
}

export async function availabilityOf(db: Queryable, titleId: string) {
  const { rows } = await db.query<AvailabilityRow>(
    `SELECT a.id, a.provider, a.available, a.note, a.checked_at, a.checked_by, u.name AS checked_by_name
       FROM watch_availability a LEFT JOIN users u ON u.id = a.checked_by
      WHERE a.title_id = $1 ORDER BY a.checked_at DESC`,
    [titleId],
  );
  return rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    available: row.available,
    note: row.note,
    checkedAt: row.checked_at.toISOString(),
    checkedBy: row.checked_by ? { id: row.checked_by, name: row.checked_by_name ?? '' } : null,
  }));
}

/** Moldova first; when TMDB has nothing for MD, Romania's list, flagged to be checked. */
export function providersOf(data: TitleData) {
  const md = data.providers.MD;
  const has = (r: RegionProviders | undefined) =>
    Boolean(
      r && (r.flatrate.length || r.free.length || r.ads.length || r.rent.length || r.buy.length),
    );
  const region: 'MD' | 'RO' = has(md) || !data.providers.RO ? 'MD' : 'RO';
  const chosen = data.providers[region];
  const brief = (list: RegionProviders['flatrate'] | undefined) =>
    (list ?? []).map((p) => ({ id: p.id, name: p.name, logoPath: p.logoPath }));
  return {
    region,
    /** Romania's list stands in for Moldova's: worth checking before counting on it. */
    check: region === 'RO',
    link: chosen?.link ?? null,
    flatrate: brief(chosen?.flatrate),
    free: brief([...(chosen?.free ?? []), ...(chosen?.ads ?? [])]),
    rent: brief(chosen?.rent),
    buy: brief(chosen?.buy),
  };
}

export async function titleView(
  w: Watch,
  id: string,
  options: { userId?: string; refresh?: boolean } = {},
) {
  const title = await getTitle(w.deps, id, w.locale, { refresh: options.refresh });
  const data = title.data;
  const text = textOf(data, w.locale);
  const viewed = options.userId ?? me(w);
  const [mine, checkedList, members] = await Promise.all([
    mineOf(w, viewed, title),
    availabilityOf(w.ctx.db, id),
    membersOn(w, title, viewed),
  ]);
  return {
    title: {
      id: title.id,
      kind: title.kind,
      tmdbId: title.tmdbId,
      title: text.title,
      originalTitle: data.originalTitle,
      translations: translationsOf(data),
      year: data.year,
      date: data.date,
      runtime: data.runtime,
      genres: text.genres,
      genreIds: data.genreIds,
      overview: text.overview,
      tagline: text.tagline,
      posterPath: data.posterPath,
      backdropPath: data.backdropPath,
      rating: data.rating,
      votes: data.votes,
      imdbId: data.imdbId,
      status: data.status,
      seasons: data.seasons.map((s) => ({
        n: s.n,
        name: text.seasons[String(s.n)] ?? '',
        episodeCount: s.episodeCount,
        airDate: s.airDate,
        posterPath: s.posterPath,
      })),
      numberOfSeasons: data.numberOfSeasons,
      numberOfEpisodes: data.numberOfEpisodes,
      lastEpisode: data.lastEpisode,
      nextEpisode: data.nextEpisode,
      cast: data.cast,
      links: data.links,
      providers: { ...providersOf(data), checked: checkedList },
      fetchedAt: title.fetchedAt.toISOString(),
    },
    mine,
    /** Everyone else at home (not the person viewed), watched or not, and how far. */
    household: members.filter((m) => m.userId !== viewed),
    /** Everyone at home, the person viewed included: who has seen it, before marking it. */
    members,
  };
}

export interface MemberProgress {
  userId: string;
  name: string;
  status: Status | null;
  favorite: boolean;
  rating: number | null;
  /** Every play of the title (a film's viewings, a show's episodes). */
  plays: number;
  lastWatchedAt: string | null;
  /** Shows: aired episodes seen, the furthest one seen and the next one to watch. */
  progress: {
    watched: number;
    aired: number;
    furthest: { season: number; episode: number } | null;
    next: { season: number; episode: number } | null;
  } | null;
}

/** The furthest regular episode someone has a play of (S2 E4), from their counts. */
export function furthestOf(
  counts: Counts,
  userId: string,
  titleId: string,
): { season: number; episode: number } | null {
  let best: { season: number; episode: number } | null = null;
  for (const [key, plays] of counts.get(userId)?.get(titleId) ?? []) {
    if (key === 'movie' || !plays) continue;
    const [season, episode] = key.split(':').map(Number) as [number, number];
    if (season < 1) continue;
    if (!best || season > best.season || (season === best.season && episode > best.episode))
      best = { season, episode };
  }
  return best;
}

/** Every family member, with what they have of this title and how far they are. */
async function membersOn(w: Watch, title: StoredTitle, viewed: string) {
  const { rows } = await w.ctx.db.query<{
    user_id: string;
    name: string;
    status: Status | null;
    favorite: boolean | null;
    rating: number | null;
    plays: number;
    last: Date | null;
  }>(
    `SELECT u.id AS user_id, u.name, l.status, l.favorite, l.rating,
            (SELECT count(*)::int FROM watch_plays p WHERE p.user_id = u.id AND p.title_id = $2) AS plays,
            (SELECT max(p.watched_at) FROM watch_plays p WHERE p.user_id = u.id AND p.title_id = $2) AS last
       FROM users u LEFT JOIN watch_list l ON l.user_id = u.id AND l.title_id = $2
      WHERE (u.household_id = $1 AND u.is_active) OR u.id = $3
      ORDER BY u.id = $3 DESC, u.created_at`,
    [w.ctx.actor.householdId, title.id, viewed],
  );
  const counts =
    title.kind === 'tv'
      ? await playCounts(
          w.ctx.db,
          rows.map((r) => r.user_id),
          [title.id],
        )
      : null;
  return rows.map((row): MemberProgress => {
    let progress: MemberProgress['progress'] = null;
    if (counts) {
      const p = progressOf(title.data, counts, [row.user_id], title.id);
      progress = {
        watched: p.watched,
        aired: p.aired,
        furthest: furthestOf(counts, row.user_id, title.id),
        next: p.next,
      };
    }
    return {
      userId: row.user_id,
      name: row.name,
      status: row.status,
      favorite: row.favorite ?? false,
      rating: row.rating,
      plays: row.plays,
      lastWatchedAt: row.last?.toISOString() ?? null,
      progress,
    };
  });
}

export async function seasonView(w: Watch, id: string, n: number, userId?: string) {
  const { kind, tmdbId } = parseTitleId(id);
  if (kind !== 'tv') throw new AppError(404, 'NOT_FOUND', 'A film has no episodes');
  const person = userId ?? me(w);
  const [season, title] = await Promise.all([
    getSeason(w.deps, tmdbId, n, w.locale),
    getTitle(w.deps, id, w.locale),
  ]);
  const [{ rows: plays }, { rows: allMarks }, { rows: family }, settings] = await Promise.all([
    w.ctx.db.query<PlayRow>(
      `SELECT ${PLAY_COLUMNS} FROM watch_plays p WHERE p.user_id = $1 AND p.title_id = $2 AND p.season = $3
        ORDER BY p.watched_at NULLS FIRST, p.created_at`,
      [person, id, n],
    ),
    // Everyone's take on these episodes at home: the viewed person's own, and the others'.
    w.ctx.db.query<{
      user_id: string;
      episode: number;
      rating: number | null;
      note: string;
      favorite: boolean;
      reactions: string[];
    }>(
      `SELECT m.user_id, m.episode, m.rating, m.note, m.favorite, m.reactions FROM watch_episode_marks m
         JOIN users u ON u.id = m.user_id
        WHERE (m.user_id = $1 OR (u.household_id = $4 AND u.is_active)) AND m.title_id = $2 AND m.season = $3
        ORDER BY m.updated_at DESC`,
      [person, id, n, w.ctx.actor.householdId],
    ),
    w.ctx.db.query<{ episode: number; users: string[] }>(
      `SELECT p.episode, array_agg(DISTINCT p.user_id) AS users FROM watch_plays p JOIN users u ON u.id = p.user_id
        WHERE u.household_id = $1 AND p.title_id = $2 AND p.season = $3 GROUP BY p.episode`,
      [w.ctx.actor.householdId, id, n],
    ),
    getSettings(w, person),
  ]);
  const today = localDate(w.ctx.now);
  const marks = allMarks.filter((m) => m.user_id === person);
  const markOf = new Map(marks.map((m) => [m.episode, m]));
  const othersOf = new Map<number, typeof allMarks>();
  for (const m of allMarks) {
    if (m.user_id === person || (!m.rating && !m.note && !m.favorite && !m.reactions.length))
      continue;
    othersOf.set(m.episode, [...(othersOf.get(m.episode) ?? []), m]);
  }
  const byFamily = new Map(family.map((f) => [f.episode, f.users]));
  const text = textOf(title.data, w.locale);
  const ownText = season.i18n[w.locale] ?? season.i18n.en;
  return {
    season: {
      n,
      name: ownText?.name || text.seasons[String(n)] || '',
      overview: ownText?.overview ?? '',
      airDate: season.airDate,
      posterPath: season.posterPath,
      episodeCount: season.episodes.length,
    },
    hideSpoilers: settings.hideSpoilers,
    episodes: season.episodes.map((e) => {
      const own = plays.filter((p) => p.episode === e.n).map(toPlay);
      const mark = markOf.get(e.n);
      return {
        n: e.n,
        ...episodeText(e, w.locale),
        airDate: e.airDate,
        aired: Boolean(e.airDate && e.airDate <= today),
        runtime: e.runtime,
        stillPath: e.stillPath,
        rating: e.rating,
        watched: own.map((p) => p.watchedAt),
        plays: own,
        watchedBy: byFamily.get(e.n) ?? [],
        mine: mark
          ? {
              rating: mark.rating,
              note: mark.note,
              favorite: mark.favorite,
              reactions: mark.reactions,
            }
          : null,
        /** What the others at home thought of it: rating, reactions, a line. */
        others: (othersOf.get(e.n) ?? []).map((m) => ({
          userId: m.user_id,
          rating: m.rating,
          note: m.note,
          favorite: m.favorite,
          reactions: m.reactions,
        })),
      };
    }),
  };
}

// ---------------------------------------------------------------- episode ratings and notes

export async function setEpisodeMark(
  w: Watch,
  id: string,
  season: number,
  episode: number,
  input: { rating?: number | null; note?: string; favorite?: boolean; reactions?: string[] },
) {
  await getTitle(w.deps, id, w.locale);
  const { rows } = await w.ctx.db.query<{
    rating: number | null;
    note: string;
    favorite: boolean;
    reactions: string[];
  }>(
    `INSERT INTO watch_episode_marks (user_id, title_id, season, episode, rating, note, favorite, reactions, updated_at)
     VALUES ($1, $2, $3, $4, $5, coalesce($6, ''), coalesce($7, false), coalesce($10::text[], '{}'), $8)
     ON CONFLICT (user_id, title_id, season, episode) DO UPDATE SET
       rating = CASE WHEN $9 THEN $5 ELSE watch_episode_marks.rating END,
       note = coalesce($6, watch_episode_marks.note),
       favorite = coalesce($7, watch_episode_marks.favorite),
       reactions = coalesce($10::text[], watch_episode_marks.reactions),
       updated_at = $8
     RETURNING rating, note, favorite, reactions`,
    [
      me(w),
      id,
      season,
      episode,
      input.rating ?? null,
      input.note ?? null,
      input.favorite ?? null,
      w.ctx.now,
      input.rating !== undefined,
      input.reactions ? [...new Set(input.reactions)].slice(0, 3) : null,
    ],
  );
  return { episode: { titleId: id, season, episode, ...rows[0]! } };
}

// ---------------------------------------------------------------- settings

export async function getSettings(w: Watch, userId = me(w)) {
  const { rows } = await w.ctx.db.query<{ hide_spoilers: boolean }>(
    'SELECT hide_spoilers FROM watch_settings WHERE user_id = $1',
    [userId],
  );
  return { hideSpoilers: rows[0]?.hide_spoilers ?? false };
}

export async function saveSettings(w: Watch, input: { hideSpoilers: boolean }) {
  await w.ctx.db.query(
    `INSERT INTO watch_settings (user_id, hide_spoilers, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET hide_spoilers = EXCLUDED.hide_spoilers, updated_at = EXCLUDED.updated_at`,
    [me(w), input.hideSpoilers, w.ctx.now],
  );
  return getSettings(w);
}

// ---------------------------------------------------------------- availability in Moldova

export async function setAvailability(
  w: Watch,
  input: {
    titleId: string;
    provider: string;
    available: boolean;
    note?: string;
    checkedAt?: string;
  },
) {
  await getTitle(w.deps, input.titleId, w.locale);
  await w.ctx.db.query(
    `INSERT INTO watch_availability (id, title_id, provider, available, note, checked_at, checked_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (title_id, lower(provider)) DO UPDATE SET provider = EXCLUDED.provider, available = EXCLUDED.available,
       note = EXCLUDED.note, checked_at = EXCLUDED.checked_at, checked_by = EXCLUDED.checked_by`,
    [
      randomUUID(),
      input.titleId,
      input.provider,
      input.available,
      input.note ?? '',
      input.checkedAt ? new Date(input.checkedAt) : w.ctx.now,
      me(w),
    ],
  );
  return { checked: await availabilityOf(w.ctx.db, input.titleId) };
}

export async function removeAvailability(w: Watch, id: string) {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Not found');
  const { rowCount } = await w.ctx.db.query('DELETE FROM watch_availability WHERE id = $1', [id]);
  if (!rowCount) throw new AppError(404, 'NOT_FOUND', 'Not found');
}
