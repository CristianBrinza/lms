import { Link } from 'react-router';
import { watchedWhen } from '../format';
import { useWatchingT } from '../i18n';
import { episodeCode } from '../logic';
import type { PlayLine } from '../types';
import { PeopleStack } from './parts';
import { Poster } from './Poster';

/**
 * One line per title per day: every play of a show (or film) on the same day, by anyone at home,
 * becomes one line ("S1 E1–7 · again E1–3"), so marking a season, or watching some of it twice,
 * doesn't fill the list with one show. Lines keep the order of each title's latest play.
 */
export function groupPlays(plays: readonly PlayLine[]): PlayLine[][] {
  const groups = new Map<string, PlayLine[]>();
  for (const play of plays) {
    const key = [play.title?.id, (play.watchedAt ?? 'unknown').slice(0, 10), play.precision].join('|');
    const group = groups.get(key);
    if (group) group.push(play);
    else groups.set(key, [play]);
  }
  return [...groups.values()];
}

type Ep = { season: number; episode: number };

/** A set of episodes as short as it gets: "S1 E4", "S1 E1–7", "S1 E1–3, 5", else a count. */
function rangeOf(eps: Ep[], count: (n: number) => string): string {
  const sorted = [...eps].sort((a, b) => a.season - b.season || a.episode - b.episode);
  const first = sorted[0]!;
  if (sorted.some((e) => e.season !== first.season)) return count(sorted.length);
  const runs: string[] = [];
  let start = first.episode;
  let prev = first.episode;
  for (const { episode } of sorted.slice(1)) {
    if (episode === prev + 1) {
      prev = episode;
      continue;
    }
    runs.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = prev = episode;
  }
  runs.push(start === prev ? `${start}` : `${start}–${prev}`);
  return runs.length > 3 ? count(sorted.length) : `S${first.season} E${runs.join(', ')}`;
}

/**
 * Which episodes a day's group is: each episode once, then what was watched again
 * ("S1 E1–7 · again E1–3"). Several people's plays of the same episode count once.
 */
export function episodesLine(
  group: readonly PlayLine[],
  count: (n: number) => string,
  again: string,
): string | null {
  // One sitting (a group of people) is one watch: count each episode per sitting, not per person.
  const seen = new Map<string, number>();
  const passes: Ep[][] = [];
  const sittings = new Set<string>();
  for (const p of [...group].reverse()) {
    if (p.season === null || p.episode === null) continue;
    const people = [p.userId, ...(p.together ?? [])].sort().join(',');
    const sitting = `${p.season}:${p.episode}:${people}:${p.watchedAt ?? ''}`;
    if (sittings.has(sitting)) continue;
    sittings.add(sitting);
    const key = `${p.season}:${p.episode}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    (passes[n] ??= []).push({ season: p.season, episode: p.episode });
  }
  if (!passes.length) return null;
  const [firstPass, ...more] = passes;
  if (firstPass!.length === 1 && !more.length)
    return episodeCode(firstPass![0]!.season, firstPass![0]!.episode);
  return [rangeOf(firstPass!, count), ...more.map((pass) => `${again} ${rangeOf(pass, count).replace(/^S\d+ /, '')}`)].join(' · ');
}

/** One play in a list (or a day of them): the poster, the title and episodes, when, and who. */
export function PlayRow({ play, group }: { play: PlayLine; group?: readonly PlayLine[] }) {
  const t = useWatchingT();
  const title = play.title;
  if (!title) return null;
  const all = group ?? [play];
  const people = [
    ...new Set(all.flatMap((p) => (p.userId ? [p.userId, ...(p.together ?? [])] : []))),
  ];
  const many = all.length > 1 ? episodesLine(all, t.common.episodes, t.common.again) : null;
  // A film watched together is one sitting, not one per person.
  const filmTimes =
    play.season === null
      ? new Set(all.map((p) => `${[p.userId, ...(p.together ?? [])].sort().join(',')}`)).size
      : 0;
  return (
    <Link
      to={`/watching/${title.id}`}
      viewTransition
      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-pink-100"
    >
      <Poster
        path={title.posterPath}
        kind={title.kind}
        sizes="2.5rem"
        className="w-10 shrink-0 rounded-[0.5rem]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{title.title}</span>
        {many ? (
          <span className="tabular block truncate text-sm text-ink-600">{many}</span>
        ) : play.season !== null && play.episode !== null ? (
          <span className="block truncate text-sm text-ink-600">
            <span className="tabular">{episodeCode(play.season, play.episode)}</span>
            {play.name ? ` · ${play.name}` : ''}
          </span>
        ) : null}
      </span>
      <PeopleStack ids={people.length ? people : undefined} />
      <span className="max-w-[35%] shrink-0 truncate text-right text-xs font-medium text-ink-500">
        {watchedWhen(play.watchedAt, play.precision)}
        {filmTimes > 1 ? ` · ×${filmTimes}` : ''}
      </span>
    </Link>
  );
}
