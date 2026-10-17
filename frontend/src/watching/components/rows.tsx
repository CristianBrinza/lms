import { Link } from 'react-router';
import { watchedWhen } from '../format';
import { episodeCode } from '../logic';
import type { PlayLine } from '../types';
import { PeopleStack } from './parts';
import { Poster } from './Poster';

/** One play in a list: the poster, the title and episode, when, and who if not me alone. */
export function PlayRow({ play }: { play: PlayLine }) {
  const title = play.title;
  if (!title) return null;
  const people = play.userId ? [play.userId, ...(play.together ?? [])] : undefined;
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
        {play.season !== null && play.episode !== null ? (
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
