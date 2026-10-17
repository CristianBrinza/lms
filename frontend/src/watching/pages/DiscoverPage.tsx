import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { Chips, IconLink } from '@/components/ui';
import { SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { watchingApi, watchingKeys } from '../api';
import { ErrorCard, Section, WatchingScreen } from '../components/parts';
import { PosterCard, PosterRow, PosterRowSkeleton } from '../components/Poster';
import { useWatchingT } from '../i18n';
import { tmdbImage } from '../images';
import type { TitleKind } from '../types';

const LONG = 60 * 60_000;

/**
 * Something new: trending this week and "because you watched …" from your own history; or, with a
 * genre or a service that streams in Moldova picked, TMDB's matching titles. The choices live in
 * the address.
 */
export default function DiscoverPage() {
  const t = useWatchingT();
  const [params, setParams] = useSearchParams();
  const kind: TitleKind = params.get('kind') === 'movie' ? 'movie' : 'tv';
  const genre = Number(params.get('genre')) || undefined;
  const provider = Number(params.get('provider')) || undefined;
  const filtered = Boolean(genre || provider);
  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch))
      if (value) next.set(key, value);
      else next.delete(key);
    setParams(next, { replace: true });
  };

  const genres = useQuery({
    queryKey: watchingKeys.genres(kind),
    queryFn: () => watchingApi.genres(kind),
    staleTime: LONG,
  });
  const providers = useQuery({
    queryKey: watchingKeys.providers(kind),
    queryFn: () => watchingApi.providers(kind),
    staleTime: LONG,
  });
  const trending = useQuery({
    queryKey: watchingKeys.trending(kind),
    queryFn: () => watchingApi.trending(kind),
    staleTime: LONG,
    enabled: !filtered,
  });
  const because = useQuery({
    queryKey: watchingKeys.because(kind),
    queryFn: () => watchingApi.because(kind),
    staleTime: 10 * 60_000,
    enabled: !filtered,
  });
  const results = useQuery({
    queryKey: watchingKeys.discover({ kind, genre, provider }),
    queryFn: () => watchingApi.discover({ kind, genre, provider }),
    enabled: filtered,
    placeholderData: keepPreviousData,
    staleTime: LONG,
  });
  const error = filtered ? results.error : (trending.error ?? because.error);

  return (
    <WatchingScreen
      title={t.discover.title}
      nav
      error={error}
      actions={
        <IconLink
          icon={SearchIcon}
          label={t.common.search}
          to="/watching/search"
          variant="ink"
          size="sm"
        />
      }
    >
      <Chips
        label={t.discover.title}
        dense
        value={kind}
        onChange={(value) =>
          update({ kind: value === 'tv' ? null : value, genre: null, provider: null })
        }
        options={(['tv', 'movie'] as const).map((value) => ({ value, label: t.kind[value] }))}
      />

      {providers.data?.providers.length ? (
        <div
          role="radiogroup"
          aria-label={t.discover.available}
          className="-mx-1 mt-1 flex items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
        >
          <span className="shrink-0 pl-0.5 pr-1 text-xs font-semibold text-pink-800">
            {t.discover.available}
          </span>
          {providers.data.providers.slice(0, 12).map((p) => (
            <Pill
              key={p.id}
              on={provider === p.id}
              onClick={() => update({ provider: provider === p.id ? null : String(p.id) })}
            >
              {p.logoPath ? (
                <img
                  src={tmdbImage(p.logoPath, 'w92')!}
                  alt=""
                  width={24}
                  height={24}
                  loading="lazy"
                  decoding="async"
                  crossOrigin="anonymous"
                  className="-ml-2 size-6 rounded-full bg-ink-100"
                />
              ) : null}
              {p.name}
            </Pill>
          ))}
        </div>
      ) : null}

      {genres.data?.genres.length ? (
        <div
          role="radiogroup"
          aria-label={t.discover.genres}
          className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
        >
          {genres.data.genres.map((g) => (
            <Pill
              key={g.id}
              on={genre === g.id}
              onClick={() => update({ genre: genre === g.id ? null : String(g.id) })}
            >
              {g.name}
            </Pill>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        {filtered ? (
          results.isPending ? (
            <PosterRowSkeleton />
          ) : results.error ? (
            <ErrorCard error={results.error} onRetry={() => void results.refetch()} />
          ) : results.data?.results.length ? (
            <ul
              className={cx(
                'grid grid-cols-3 gap-x-3 gap-y-4 transition-opacity sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
                results.isPlaceholderData && 'opacity-60',
              )}
            >
              {results.data.results.map((item) => (
                <li key={item.id}>
                  <PosterCard
                    title={item}
                    sizes="(min-width: 80rem) 9rem, (min-width: 44rem) 18vw, 30vw"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-1 py-6 text-center text-sm text-ink-500">{t.discover.none}</p>
          )
        ) : trending.isPending ? (
          <>
            <PosterRowSkeleton />
            <div className="mt-6">
              <PosterRowSkeleton />
            </div>
          </>
        ) : trending.error ? (
          <ErrorCard error={trending.error} onRetry={() => void trending.refetch()} />
        ) : (
          <>
            {trending.data?.results.length ? (
              <Section title={t.discover.trending}>
                <PosterRow items={trending.data.results} label={t.discover.trending} />
              </Section>
            ) : null}
            {because.data?.groups.map((group) => (
              <Section key={group.because.id} title={t.discover.because(group.because.title)}>
                <PosterRow items={group.results} label={t.discover.because(group.because.title)} />
              </Section>
            ))}
          </>
        )}
      </div>
    </WatchingScreen>
  );
}

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cx(
        'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-semibold transition-colors',
        on
          ? 'bg-ink-900 text-white'
          : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-pink-100',
      )}
    >
      {children}
    </button>
  );
}
