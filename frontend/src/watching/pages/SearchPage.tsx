import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, Chips, Skeleton, TextField } from '@/components/ui';
import { BookmarkBorderIcon, CheckIcon, SearchIcon } from '@/components/ui/icons';
import { watchingApi, watchingKeys } from '../api';
import { MarkWatchedSheet } from '../components/MarkWatchedSheet';
import { ErrorCard, WatchingScreen } from '../components/parts';
import { Poster } from '../components/Poster';
import { useSetStatus } from '../hooks';
import { useWatchingT } from '../i18n';
import { useMarkWho } from '../people';
import type { TitleCard, TitleKind } from '../types';

type Kind = TitleKind | 'all';

/**
 * Find a show or film on TMDB, and act on it straight from the result: "Watched" (then how much
 * and when, for the past too) or "Watchlist". The query lives in the address, so back returns to it.
 */
export default function SearchPage() {
  const t = useWatchingT();
  const [params, setParams] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const kind = (params.get('kind') as Kind | null) ?? 'all';
  const q = (params.get('q') ?? '').trim();
  const [marking, setMarking] = useState<TitleCard | null>(null);

  // Typing settles for a moment before it searches (and becomes the address).
  useEffect(() => {
    const timer = setTimeout(() => {
      if (text.trim() === q) return;
      const next = new URLSearchParams(params);
      if (text.trim()) next.set('q', text.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, q, params, setParams]);

  const results = useQuery({
    queryKey: watchingKeys.search(q, kind),
    queryFn: () => watchingApi.search(q, kind === 'all' ? undefined : kind),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  return (
    <WatchingScreen title={t.search.title} error={results.error}>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="flex flex-col gap-2">
        <TextField
          label={t.search.label}
          hideLabel
          icon={SearchIcon}
          surface="raised"
          type="search"
          enterKeyHint="search"
          autoFocus={!q}
          placeholder={t.search.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Chips
          label={t.search.label}
          dense
          value={kind}
          onChange={(value) => {
            const next = new URLSearchParams(params);
            if (value === 'all') next.delete('kind');
            else next.set('kind', value);
            setParams(next, { replace: true });
          }}
          options={(['all', 'tv', 'movie'] as const).map((value) => ({
            value,
            label: t.kind[value],
          }))}
        />
      </form>

      <div className="mt-3" aria-live="polite">
        {q.length < 2 ? (
          <p className="px-1 py-6 text-center text-sm text-ink-500">{t.search.hint}</p>
        ) : results.isPending ? (
          <ResultsSkeleton />
        ) : results.error ? (
          <ErrorCard error={results.error} onRetry={() => void results.refetch()} />
        ) : results.data?.results.length ? (
          <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {results.data.results.map((result) => (
              <li key={result.id}>
                <ResultRow result={result} onWatched={() => setMarking(result)} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-ink-500">{t.search.none(q)}</p>
        )}
      </div>

      {marking ? <MarkWatchedSheet open onClose={() => setMarking(null)} title={marking} /> : null}
    </WatchingScreen>
  );
}

function ResultRow({ result, onWatched }: { result: TitleCard; onWatched: () => void }) {
  const t = useWatchingT();
  const status = useSetStatus();
  const { who } = useMarkWho(result.id);
  const [added, setAdded] = useState(result.status === 'watchlist');
  const seen = result.status === 'completed';
  return (
    <article className="flex h-full gap-3 rounded-[1.25rem] bg-white p-2.5 shadow-[var(--shadow-xs)]">
      <Link to={`/watching/${result.id}`} viewTransition className="w-[4.5rem] shrink-0">
        <Poster
          path={result.posterPath}
          kind={result.kind}
          sizes="4.5rem"
          className="rounded-[0.625rem]"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link to={`/watching/${result.id}`} viewTransition className="min-w-0">
          <span className="line-clamp-2 font-semibold leading-snug">{result.title}</span>
          <span className="tabular block text-sm text-ink-500">
            {[t.kindOne[result.kind], result.year, result.status ? t.status[result.status] : null]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </Link>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
          {/* Seen: ink with a tick. Not yet: an outline that says what a tap does. */}
          <Button
            size="sm"
            variant={seen ? 'primary' : 'outline'}
            icon={seen ? CheckIcon : undefined}
            aria-pressed={seen}
            onClick={onWatched}
          >
            {seen ? t.search.watched : t.search.markWatched}
          </Button>
          <Button
            size="sm"
            variant="tint"
            icon={added ? CheckIcon : BookmarkBorderIcon}
            disabled={added}
            onClick={() => {
              setAdded(true);
              status.mutate(
                {
                  id: result.id,
                  body: { status: 'watchlist', userIds: who },
                  message: t.search.added(result.title),
                },
                { onError: () => setAdded(false) },
              );
            }}
          >
            {t.search.watchlist}
          </Button>
        </div>
      </div>
    </article>
  );
}

function ResultsSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 rounded-[1.25rem] bg-white p-2.5">
          <Skeleton className="aspect-[2/3] w-[4.5rem] shrink-0 rounded-[0.625rem]" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 rounded-md" />
            <Skeleton className="mt-2 h-3 w-1/3 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
