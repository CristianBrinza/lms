import { AppError } from '../../lib/errors';
import { localDate } from '../food/stock';
import type { Watch } from './people';
import type { Precision } from './plays';
import { cardOf, storedTitles, textOf, type StoredTitle } from './titles';

/**
 * Screen time: one person's (or several people's together, added up), from their plays. Plays
 * known only by month count in totals and months, not in days, hours or streaks; plays with no
 * date only in the all-time totals.
 */

interface PlayRow {
  id: string;
  user_id: string;
  title_id: string;
  season: number | null;
  episode: number | null;
  watched_at: Date | null;
  date_precision: Precision;
  runtime_min: number;
}

const pad = (value: number) => String(value).padStart(2, '0');
const dayOf = (date: Date) => localDate(date);
const monthOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

/** Morning 05–12, afternoon 12–17, evening 17–22, night 22–05 (local time). */
function partOf(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDate(new Date(y!, m! - 1, d!), days);
}

async function loadPlays(w: Watch, people: string[]): Promise<PlayRow[]> {
  const { rows } = await w.ctx.db.query<PlayRow>(
    `SELECT id, user_id, title_id, season, episode, watched_at, date_precision, runtime_min
       FROM watch_plays WHERE user_id = ANY($1) ORDER BY watched_at DESC NULLS LAST, created_at DESC`,
    [people],
  );
  return rows;
}

const dated = (p: PlayRow) =>
  p.watched_at && (p.date_precision === 'exact' || p.date_precision === 'day');

function summary(plays: PlayRow[]) {
  const episodes = plays.filter((p) => p.season !== null);
  return {
    episodes: episodes.length,
    shows: new Set(episodes.map((p) => p.title_id)).size,
    movies: plays.filter((p) => p.season === null).length,
    plays: plays.length,
    minutes: plays.reduce((sum, p) => sum + p.runtime_min, 0),
  };
}

function streaks(days: Set<string>, today: string) {
  const sorted = [...days].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of sorted) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  let current = 0;
  let cursor = days.has(today) ? today : addDays(today, -1);
  while (days.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best };
}

function bingeOf(plays: PlayRow[]) {
  const byDay = new Map<string, { minutes: number; plays: number; episodes: number }>();
  for (const p of plays.filter(dated)) {
    const day = dayOf(p.watched_at!);
    const entry = byDay.get(day) ?? { minutes: 0, plays: 0, episodes: 0 };
    entry.minutes += p.runtime_min;
    entry.plays++;
    if (p.season !== null) entry.episodes++;
    byDay.set(day, entry);
  }
  let best: { date: string; minutes: number; plays: number; episodes: number } | null = null;
  for (const [date, entry] of byDay)
    if (!best || entry.minutes > best.minutes) best = { date, ...entry };
  return best;
}

function tops(w: Watch, plays: PlayRow[], titles: Map<string, StoredTitle>) {
  const genres = new Map<number, { id: number; name: string; minutes: number; plays: number }>();
  const actors = new Map<
    number,
    { id: number; name: string; profilePath: string | null; titles: Set<string>; minutes: number }
  >();
  const perTitle = new Map<string, { plays: number; minutes: number }>();
  for (const p of plays) {
    const title = titles.get(p.title_id);
    const own = perTitle.get(p.title_id) ?? { plays: 0, minutes: 0 };
    own.plays++;
    own.minutes += p.runtime_min;
    perTitle.set(p.title_id, own);
    if (!title) continue;
    const text = textOf(title.data, w.locale);
    title.data.genreIds.forEach((id, i) => {
      const entry = genres.get(id) ?? { id, name: text.genres[i] ?? '', minutes: 0, plays: 0 };
      entry.minutes += p.runtime_min;
      entry.plays++;
      genres.set(id, entry);
    });
    for (const member of title.data.cast.slice(0, 6)) {
      const entry = actors.get(member.id) ?? {
        id: member.id,
        name: member.name,
        profilePath: member.profilePath,
        titles: new Set<string>(),
        minutes: 0,
      };
      entry.titles.add(p.title_id);
      entry.minutes += p.runtime_min;
      actors.set(member.id, entry);
    }
  }
  const ranked = (kind: 'movie' | 'tv') =>
    [...perTitle]
      .filter(([id]) => id.startsWith(`${kind}:`) && titles.has(id))
      .sort((a, b) => b[1].minutes - a[1].minutes || b[1].plays - a[1].plays)
      .slice(0, 10)
      .map(([id, entry]) => ({ title: cardOf(titles.get(id)!, w.locale), ...entry }));
  return {
    topGenres: [...genres.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 8),
    topActors: [...actors.values()]
      .sort((a, b) => b.titles.size - a.titles.size || b.minutes - a.minutes)
      .slice(0, 10)
      .map((a) => ({
        id: a.id,
        name: a.name,
        profilePath: a.profilePath,
        titles: a.titles.size,
        minutes: a.minutes,
      })),
    topShows: ranked('tv'),
    topMovies: ranked('movie'),
  };
}

/** Plays in [from, to]: by day for exact and day plays, by month for month-only plays. */
const inRange = (p: PlayRow, from: string, to: string) => {
  if (!p.watched_at || p.date_precision === 'unknown') return false;
  if (p.date_precision === 'month') {
    const month = monthOf(p.watched_at);
    return month >= from.slice(0, 7) && month <= to.slice(0, 7);
  }
  const day = dayOf(p.watched_at);
  return day >= from && day <= to;
};

export async function watchStats(w: Watch, people: string[], from?: string, to?: string) {
  const today = localDate(w.ctx.now);
  const start = from ?? `${today.slice(0, 7)}-01`;
  const end = to ?? today;
  if (start > end)
    throw new AppError(400, 'VALIDATION', 'Some fields need attention', {
      fields: { from: 'The start is after the end' },
    });
  const all = await loadPlays(w, people);
  const range = all.filter((p) => inRange(p, start, end));
  const titles = await storedTitles(w.ctx.db, [...new Set(all.map((p) => p.title_id))]);

  const perDayMap = new Map<string, { minutes: number; plays: number }>();
  const hours = Array.from({ length: 24 }, () => 0);
  const perHour = { morning: 0, afternoon: 0, evening: 0, night: 0 };
  for (const p of range.filter(dated)) {
    const day = dayOf(p.watched_at!);
    const entry = perDayMap.get(day) ?? { minutes: 0, plays: 0 };
    entry.minutes += p.runtime_min;
    entry.plays++;
    perDayMap.set(day, entry);
    if (p.date_precision === 'exact') {
      const hour = p.watched_at!.getHours();
      hours[hour]! += p.runtime_min;
      perHour[partOf(hour)] += p.runtime_min;
    }
  }
  // Every day of a range up to a year and a bit (zeros included); longer ranges, active days.
  const spanDays = (Date.parse(end) - Date.parse(start)) / 86_400_000;
  const perDay: Array<{ date: string; minutes: number; plays: number }> = [];
  if (spanDays <= 400)
    for (let day = start; day <= end; day = addDays(day, 1))
      perDay.push({ date: day, ...(perDayMap.get(day) ?? { minutes: 0, plays: 0 }) });
  else for (const [date, entry] of [...perDayMap].sort()) perDay.push({ date, ...entry });

  const perYear = new Map<number, { year: number; minutes: number; plays: number }>();
  const perMonth = new Map<string, { month: string; minutes: number; plays: number }>();
  for (const p of all) {
    if (!p.watched_at) continue;
    const year = p.watched_at.getFullYear();
    const y = perYear.get(year) ?? { year, minutes: 0, plays: 0 };
    y.minutes += p.runtime_min;
    y.plays++;
    perYear.set(year, y);
    const month = monthOf(p.watched_at);
    const m = perMonth.get(month) ?? { month, minutes: 0, plays: 0 };
    m.minutes += p.runtime_min;
    m.plays++;
    perMonth.set(month, m);
  }

  const { rows: favoriteRows } = await w.ctx.db.query<{ title_id: string }>(
    'SELECT DISTINCT title_id FROM watch_list WHERE user_id = ANY($1) AND favorite',
    [people],
  );
  const favoriteTitles = await storedTitles(
    w.ctx.db,
    favoriteRows.map((r) => r.title_id),
  );

  const activeDays = new Set(all.filter(dated).map((p) => dayOf(p.watched_at!)));
  const top = tops(w, range, titles);
  return {
    from: start,
    to: end,
    people,
    month: summary(range),
    perDay,
    perHour,
    hours,
    favorites: [...favoriteTitles.values()].map((t) => cardOf(t, w.locale)),
    history: range.slice(0, 100).map((p) => ({
      id: p.id,
      userId: p.user_id,
      title: titles.has(p.title_id) ? cardOf(titles.get(p.title_id)!, w.locale) : null,
      titleId: p.title_id,
      season: p.season,
      episode: p.episode,
      watchedAt: p.watched_at?.toISOString() ?? null,
      precision: p.date_precision,
      minutes: p.runtime_min,
    })),
    total: {
      ...summary(all),
      titles: new Set(all.map((p) => p.title_id)).size,
      unknownDates: all.filter((p) => p.date_precision === 'unknown').length,
      monthOnlyDates: all.filter((p) => p.date_precision === 'month').length,
      days: activeDays.size,
    },
    perYear: [...perYear.values()].sort((a, b) => a.year - b.year),
    perMonth: [...perMonth.values()].sort((a, b) => a.month.localeCompare(b.month)),
    topGenres: top.topGenres,
    topActors: top.topActors,
    topShows: top.topShows,
    topMovies: top.topMovies,
    streak: streaks(activeDays, today),
    bingeDay: bingeOf(all),
  };
}

/** A year in review: the year's totals, months, favourites and records. */
export async function yearInReview(w: Watch, people: string[], year: number) {
  const all = await loadPlays(w, people);
  const plays = all.filter((p) => p.watched_at && p.watched_at.getFullYear() === year);
  const titles = await storedTitles(w.ctx.db, [...new Set(plays.map((p) => p.title_id))]);
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${pad(i + 1)}`,
    minutes: 0,
    plays: 0,
  }));
  for (const p of plays) {
    const m = months[p.watched_at!.getMonth()]!;
    m.minutes += p.runtime_min;
    m.plays++;
  }
  // Shows started this year: their first play ever is in it.
  const firstEver = new Map<string, Date>();
  for (const p of all)
    if (p.watched_at && (!firstEver.has(p.title_id) || p.watched_at < firstEver.get(p.title_id)!))
      firstEver.set(p.title_id, p.watched_at);
  const startedShows = [...firstEver]
    .filter(([id, at]) => id.startsWith('tv:') && at.getFullYear() === year)
    .map(([id]) => id);
  const days = new Set(plays.filter(dated).map((p) => dayOf(p.watched_at!)));
  const busiest = [...months].sort((a, b) => b.minutes - a.minutes)[0]!;
  const ordered = [...plays].sort((a, b) => a.watched_at!.getTime() - b.watched_at!.getTime());
  const describe = (p: PlayRow | undefined) =>
    p
      ? {
          title: titles.has(p.title_id) ? cardOf(titles.get(p.title_id)!, w.locale) : null,
          season: p.season,
          episode: p.episode,
          watchedAt: p.watched_at!.toISOString(),
        }
      : null;
  return {
    year,
    people,
    ...summary(plays),
    activeDays: days.size,
    months,
    busiestMonth: busiest.minutes ? busiest : null,
    startedShows: startedShows.length,
    ...tops(w, plays, titles),
    bingeDay: bingeOf(plays),
    longestStreak: streaks(days, `${year}-12-31`).best,
    first: describe(ordered[0]),
    last: describe(ordered.at(-1)),
  };
}
