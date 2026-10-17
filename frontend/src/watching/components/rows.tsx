import { Link } from 'react-router';
import { watchedWhen } from '../format';
import { useWatchingT } from '../i18n';
import { episodeCode } from '../logic';
import type { PlayLine } from '../types';
import { PeopleStack } from './parts';
import { Poster } from './Poster';

/**
 * Plays in a row of the same title, on the same day, by the same people, become one line
 * ("S1 E1–E7"): marking a season shouldn't fill a list with one show.
 */
export function groupPlays(plays: readonly PlayLine[]): PlayLine[][] {
  const groups: PlayLine[][] = [];
  const keyOf = (p: PlayLine) =>
    [p.title?.id, (p.watchedAt ?? 'unknown').slice(0, 10), p.precision, p.userId, ...(p.together ?? [])].join('|');
  for (const play of plays) {
    const last = groups.at(-1);
    if (last && play.season !== null && keyOf(last[0]!) === keyOf(play)) last.push(play);
    else groups.push([play]);
  }
  return groups;
}

/** Which episodes a group is: one code, a range in one season, or a count. */
function episodesLine(group: readonly PlayLine[], count: (n: number) => string): string | null {
  const eps = group
    .filter((p) => p.season !== null && p.episode !== null)
    .map((p) => ({ season: p.season!, episode: p.episode! }))
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
  if (!eps.length) return null;
  const first = eps[0]!;
  const last = eps.at(-1)!;
  if (eps.length === 1) return episodeCode(first.season, first.episode);
  if (first.season === last.season && last.episode - first.episode + 1 === eps.length)
    return `${episodeCode(first.season, first.episode)}–${last.episode}`;
  return count(eps.length);
}

/** One play in a list (or a run of them): the poster, the title and episodes, when, and who. */
export function PlayRow({ play, group }: { play: PlayLine; group?: readonly PlayLine[] }) {
  const t = useWatchingT();
  const title = play.title;
  if (!title) return null;
  const people = play.userId ? [play.userId, ...(play.together ?? [])] : undefined;
  const many = group && group.length > 1 ? episodesLine(group, t.common.episodes) : null;
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
      <PeopleStack ids={people} />
      <span className="max-w-[35%] shrink-0 truncate text-right text-xs font-medium text-ink-500">
        {watchedWhen(play.watchedAt, play.precision)}
      </span>
    </Link>
  );
}
