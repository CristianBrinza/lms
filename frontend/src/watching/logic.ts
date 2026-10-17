import { addDays, localDate } from '@/food/format';
import type { DayPart, EpisodeRef, Play, PlayInput, TitleSeason } from './types';

/** Watching's arithmetic, free of React and words: what's next, how far along, when. */

// ---------------------------------------------------------------- episodes

export const episodeKey = (season: number, episode: number) => `${season}:${episode}`;

/** The seasons that count for progress: specials (season 0) are extras, not the show. */
export const realSeasons = (seasons: readonly TitleSeason[]) =>
  seasons.filter((s) => s.n > 0 && s.episodeCount > 0).sort((a, b) => a.n - b.n);

/** Every episode watched at least once, as 'season:episode' keys. */
export function watchedSet(plays: readonly Play[]): Set<string> {
  const keys = new Set<string>();
  for (const play of plays)
    if (play.season !== null && play.episode !== null)
      keys.add(episodeKey(play.season, play.episode));
  return keys;
}

/** Plays, or a set of watched keys already worked out (watching together). */
export type Seen = readonly Play[] | ReadonlySet<string>;
const seenSet = (seen: Seen): ReadonlySet<string> =>
  seen instanceof Set ? seen : watchedSet(seen as readonly Play[]);

/** True when the episode is out: before the next one TMDB says is coming (or none is coming). */
export function hasAired(
  season: number,
  episode: number,
  upcoming: Pick<EpisodeRef, 'season' | 'episode'> | null | undefined,
): boolean {
  if (!upcoming) return true;
  if (season !== upcoming.season) return season < upcoming.season;
  return episode < upcoming.episode;
}

/** The aired episodes of the real seasons, in order. */
export function airedEpisodes(
  seasons: readonly TitleSeason[],
  upcoming?: Pick<EpisodeRef, 'season' | 'episode'> | null,
): Array<{ season: number; episode: number }> {
  const out: Array<{ season: number; episode: number }> = [];
  for (const s of realSeasons(seasons))
    for (let e = 1; e <= s.episodeCount; e++)
      if (hasAired(s.n, e, upcoming)) out.push({ season: s.n, episode: e });
  return out;
}

/**
 * What to watch next, the way people actually watch: the episode after the furthest one seen (a
 * skipped episode early on doesn't pull you back). Nothing seen: the first. All seen: null.
 */
export function nextEpisode(
  seasons: readonly TitleSeason[],
  plays: Seen,
  upcoming?: Pick<EpisodeRef, 'season' | 'episode'> | null,
): { season: number; episode: number } | null {
  const aired = airedEpisodes(seasons, upcoming);
  if (!aired.length) return null;
  const seen = seenSet(plays);
  let furthest = -1;
  aired.forEach((ep, index) => {
    if (seen.has(episodeKey(ep.season, ep.episode))) furthest = index;
  });
  return aired[furthest + 1] ?? null;
}

/** Aired episodes seen, of all aired: { watched, total, share 0–1 }. */
export function showProgress(
  seasons: readonly TitleSeason[],
  plays: Seen,
  upcoming?: Pick<EpisodeRef, 'season' | 'episode'> | null,
): { watched: number; total: number; share: number } {
  const aired = airedEpisodes(seasons, upcoming);
  const seen = seenSet(plays);
  const watched = aired.filter((ep) => seen.has(episodeKey(ep.season, ep.episode))).length;
  return { watched, total: aired.length, share: aired.length ? watched / aired.length : 0 };
}

/** A share as a whole percent for a bar's width, never outside 0–100. */
export const percent = (share: number) =>
  Math.round(Math.min(1, Math.max(0, Number.isFinite(share) ? share : 0)) * 100);

/** "S1 E3": short, the same in every language. */
export const episodeCode = (season: number, episode: number) => `S${season} E${episode}`;

/** The latest play of an episode (to undo a check), or of a film (season and episode null). */
export function latestPlay(
  plays: readonly Play[],
  season: number | null,
  episode: number | null,
): Play | null {
  let best: Play | null = null;
  for (const play of plays) {
    if (play.season !== season || play.episode !== episode) continue;
    if (!best || (play.watchedAt ?? '') > (best.watchedAt ?? '')) best = play;
  }
  return best;
}

// ---------------------------------------------------------------- marking the past

export type BackfillScope =
  | { kind: 'show' }
  | { kind: 'season'; season: number }
  | { kind: 'through'; season: number; episode: number };

/** A "watched in the past" choice as the server's bulk forms: all, a whole season, up to S/E. */
export function backfillInput(scope: BackfillScope): Pick<PlayInput, 'all' | 'season' | 'upTo'> {
  switch (scope.kind) {
    case 'show':
      return { all: true };
    case 'season':
      return { season: scope.season, all: true };
    default:
      return { upTo: { season: scope.season, episode: Math.max(1, scope.episode) } };
  }
}

/** How many aired episodes a choice covers (shown before saving). */
export function backfillCount(
  seasons: readonly TitleSeason[],
  scope: BackfillScope,
  upcoming?: Pick<EpisodeRef, 'season' | 'episode'> | null,
): number {
  return airedEpisodes(seasons, upcoming).filter(
    (ep) =>
      scope.kind === 'show' ||
      (scope.kind === 'season' && ep.season === scope.season) ||
      (scope.kind === 'through' &&
        (ep.season < scope.season || (ep.season === scope.season && ep.episode <= scope.episode))),
  ).length;
}

export type WhenChoice =
  | { kind: 'now' }
  | { kind: 'date'; date: string }
  | { kind: 'month'; month: string }
  | { kind: 'unknown' };

/**
 * "When?" as the server reads it: nothing for now, a day ('2025-03-14'), a month ('2025-03') or
 * 'unknown'. A day or month still ahead becomes now.
 */
export function whenValue(choice: WhenChoice, today: string = localDate()): string | undefined {
  switch (choice.kind) {
    case 'date':
      return choice.date < today ? choice.date : undefined;
    case 'month':
      return choice.month < today.slice(0, 7)
        ? choice.month
        : choice.month === today.slice(0, 7)
          ? today
          : undefined;
    case 'unknown':
      return 'unknown';
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------- time

/** 'YYYY-MM' of a day. */
export const monthOf = (day: string) => day.slice(0, 7);

/** The first and last day of a month ('2026-10' → 2026-10-01 … 2026-10-31). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y!, m!, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** A month moved by n months ('2026-01', -1 → '2025-12'). */
export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(y!, m! - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** Every day of a range with its minutes (missing days are zero), oldest first. */
export function fillDays(
  from: string,
  to: string,
  perDay: ReadonlyArray<{ date: string; minutes: number }>,
): Array<{ date: string; minutes: number }> {
  const byDay = new Map(perDay.map((d) => [d.date.slice(0, 10), d.minutes]));
  const out: Array<{ date: string; minutes: number }> = [];
  for (let day = from; day <= to; day = addDays(day, 1))
    out.push({ date: day, minutes: byDay.get(day) ?? 0 });
  return out;
}

export const DAY_PARTS: readonly DayPart[] = ['morning', 'afternoon', 'evening', 'night'];

/** The part of the day with the most watching, or null when there's none. */
export function peakPart(perHour: Partial<Record<DayPart, number>>): DayPart | null {
  let best: DayPart | null = null;
  for (const part of DAY_PARTS) {
    const value = perHour[part] ?? 0;
    if (value > 0 && (best === null || value > (perHour[best] ?? 0))) best = part;
  }
  return best;
}

/** Minutes as days, hours and minutes (for "all time"). */
export function splitMinutes(total: number): { days: number; hours: number; minutes: number } {
  const whole = Math.max(0, Math.round(total));
  return {
    days: Math.floor(whole / 1440),
    hours: Math.floor((whole % 1440) / 60),
    minutes: whole % 60,
  };
}

/** Today's 'YYYY-MM' on this device. */
export const thisMonth = () => monthOf(localDate());

export type LibrarySort = 'recent' | 'added' | 'title' | 'rating' | 'year' | 'progress' | 'minutes';
