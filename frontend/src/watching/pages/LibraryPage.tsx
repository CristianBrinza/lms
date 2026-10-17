import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useDeferredValue, useEffect, useRef, useState, type ReactNode } from 'react';
import { Skeleton, TextField } from '@/components/ui';
import { FavoriteIcon, SearchIcon, SortIcon, StarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { storage } from '@/lib/storage';
import { watchingApi, watchingKeys, type LibraryParams } from '../api';
import { ErrorCard, ViewSwitcher, WatchingScreen } from '../components/parts';
import { PosterCard } from '../components/Poster';
import { formatMinutes } from '../format';
import { useWatchingT } from '../i18n';
import type { LibrarySort } from '../logic';
import { useWatchView } from '../people';
import type { LibraryItem, TitleKind, WatchStatus } from '../types';

const SORTS: LibrarySort[] = ['recent', 'added', 'title', 'rating', 'year', 'progress', 'minutes'];
const STATUSES: WatchStatus[] = [
  'watching',
  'watchlist',
  'completed',
  'rewatching',
  'paused',
  'dropped',
];
const SORT_KEY = 'lms:watching-library-sort';

interface Filter {
  q: string;
  kind: TitleKind | null;
  status: WatchStatus | null;
  genre: number | null;
  year: number | null;
  provider: string | null;
  rated: boolean;
  favorite: boolean;
}

const EMPTY: Filter = {
  q: '',
  kind: null,
  status: null,
  genre: null,
  year: null,
  provider: null,
  rated: false,
  favorite: false,
};

/**
 * Every title: search within, a sort, and chips for kind, status, favourites, rated, genre and
 * service, plus a year. The server filters and pages (60 at a time, more as you scroll); the
 * previous page stays on screen while a new filter loads, so it never flashes empty.
 */
export default function LibraryPage() {
  const t = useWatchingT();
  const { view } = useWatchView();
  const [filter, setFilter] = useState<Filter>(EMPTY);
  const [sort, setSortState] = useState<LibrarySort>(() => {
    const saved = storage.get(SORT_KEY) as LibrarySort | null;
    return saved && SORTS.includes(saved) ? saved : 'recent';
  });
  const setSort = (value: LibrarySort) => {
    setSortState(value);
    storage.set(SORT_KEY, value);
  };
  const deferred = useDeferredValue(filter);
  const params: LibraryParams = {
    q: deferred.q.trim() || undefined,
    kind: deferred.kind ?? undefined,
    status: deferred.status ? [deferred.status] : undefined,
    genre: deferred.genre ?? undefined,
    year: deferred.year ?? undefined,
    provider: deferred.provider ?? undefined,
    rated: deferred.rated || undefined,
    favorite: deferred.favorite || undefined,
    sort,
  };
  const library = useInfiniteQuery({
    queryKey: watchingKeys.library(view, params),
    queryFn: ({ pageParam }) => watchingApi.library(view, params, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    placeholderData: keepPreviousData,
  });
  const first = library.data?.pages[0];
  const items = library.data?.pages.flatMap((p) => p.items) ?? [];
  const facets = first?.facets;
  const set = (patch: Partial<Filter>) => setFilter((f) => ({ ...f, ...patch }));
  const active = Object.entries(filter).some(
    ([key, value]) => key !== 'q' && value !== EMPTY[key as keyof Filter],
  );

  // More as the end of the grid comes into view.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = library;
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <WatchingScreen
      stored
      title={t.library.title}
      subtitle={first ? t.common.titles(first.total) : ' '}
      nav
      error={library.error}
    >
      <ViewSwitcher className="mb-2" />
      <div className="flex gap-2">
        <TextField
          label={t.library.searchLabel}
          hideLabel
          dense
          surface="raised"
          icon={SearchIcon}
          type="search"
          placeholder={t.library.placeholder}
          value={filter.q}
          onChange={(e) => set({ q: e.target.value })}
          className="flex-1"
        />
        <label className="relative flex shrink-0 items-center">
          <span className="sr-only">{t.library.sort}</span>
          <SortIcon
            fontSize="inherit"
            className="pointer-events-none absolute left-3 text-[1.2rem] text-ink-500"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as LibrarySort)}
            className="h-11 max-w-[11rem] appearance-none truncate rounded-pill bg-white pl-9 pr-4 text-sm font-semibold text-ink-800 shadow-[var(--shadow-xs)] outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
          >
            {SORTS.map((value) => (
              <option key={value} value={value}>
                {t.library.sorts[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        role="group"
        aria-label={t.library.filters}
        className="-mx-1 mt-2 flex items-center gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
      >
        {active ? (
          <Chip on={false} tone="clear" onClick={() => setFilter({ ...EMPTY, q: filter.q })}>
            {t.library.clear}
          </Chip>
        ) : null}
        {(['tv', 'movie'] as const).map((kind) => (
          <Chip
            key={kind}
            on={filter.kind === kind}
            onClick={() => set({ kind: filter.kind === kind ? null : kind })}
          >
            {t.kind[kind]}
          </Chip>
        ))}
        <Divider />
        {STATUSES.filter((s) => !facets || facets.statuses[s] || filter.status === s).map(
          (status) => (
            <Chip
              key={status}
              on={filter.status === status}
              onClick={() => set({ status: filter.status === status ? null : status })}
            >
              {t.status[status]}
            </Chip>
          ),
        )}
        <Divider />
        <Chip on={filter.favorite} onClick={() => set({ favorite: !filter.favorite })}>
          {t.library.favorites}
        </Chip>
        <Chip on={filter.rated} onClick={() => set({ rated: !filter.rated })}>
          {t.library.rated}
        </Chip>
        {facets?.genres.length ? <Divider /> : null}
        {facets?.genres.slice(0, 14).map((genre) => (
          <Chip
            key={genre.id}
            on={filter.genre === genre.id}
            onClick={() => set({ genre: filter.genre === genre.id ? null : genre.id })}
          >
            {genre.name}
          </Chip>
        ))}
        {facets?.providers.length ? <Divider /> : null}
        {facets?.providers.map((provider) => (
          <Chip
            key={provider}
            on={filter.provider === provider}
            onClick={() => set({ provider: filter.provider === provider ? null : provider })}
          >
            {provider}
          </Chip>
        ))}
        {facets && facets.years.length > 1 ? (
          <>
            <Divider />
            <label className="relative shrink-0">
              <span className="sr-only">{t.library.year}</span>
              <select
                value={filter.year ?? ''}
                onChange={(e) => set({ year: e.target.value ? Number(e.target.value) : null })}
                className={cx(
                  'h-9 appearance-none rounded-pill px-3.5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ink-900',
                  filter.year
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-700 shadow-[var(--shadow-xs)]',
                )}
              >
                <option value="">{t.library.anyYear}</option>
                {facets.years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>

      <div className={cx('mt-3 transition-opacity', library.isPlaceholderData && 'opacity-60')}>
        {library.isPending ? (
          <GridSkeleton />
        ) : library.error && !first ? (
          <ErrorCard error={library.error} onRetry={() => void library.refetch()} />
        ) : !items.length ? (
          <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
            {active || filter.q ? t.library.empty : t.library.emptyLibrary}
          </p>
        ) : (
          <>
            <ul className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {items.map((item) => (
                <li
                  key={item.title.id}
                  className="[contain-intrinsic-size:auto_14rem] [content-visibility:auto]"
                >
                  <LibraryCard item={item} sort={sort} />
                </li>
              ))}
            </ul>
            <div ref={sentinel} aria-hidden="true" className="h-px" />
            {isFetchingNextPage ? <GridSkeleton className="mt-4" /> : null}
          </>
        )}
      </div>
    </WatchingScreen>
  );
}

function Chip({
  on,
  onClick,
  children,
  tone,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: 'clear';
}) {
  return (
    <button
      type="button"
      aria-pressed={tone === 'clear' ? undefined : on}
      onClick={onClick}
      className={cx(
        'press inline-flex h-9 shrink-0 items-center rounded-pill px-3.5 text-sm font-semibold transition-colors',
        tone === 'clear'
          ? 'bg-pink-200 text-ink-900'
          : on
            ? 'bg-ink-900 text-white'
            : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-pink-100',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-ink-200" />;

function LibraryCard({ item, sort }: { item: LibraryItem; sort: LibrarySort }) {
  const t = useWatchingT();
  const line =
    sort === 'minutes' && item.minutes
      ? t.library.spent(formatMinutes(item.minutes))
      : t.status[item.status];
  const share = item.progress ? item.progress.percent / 100 : 0;
  return (
    <PosterCard
      title={item.title}
      sizes="(min-width: 80rem) 9rem, (min-width: 44rem) 18vw, 30vw"
      line={line}
      badge={
        <>
          <span className="absolute left-1.5 top-1.5 flex gap-1">
            {item.favorite ? (
              <span className="grid size-6 place-items-center rounded-full bg-white/90 text-[0.875rem] text-pink-800">
                <FavoriteIcon fontSize="inherit" />
              </span>
            ) : null}
            {item.rewatches > 0 ? (
              <span className="tabular grid h-6 place-items-center rounded-pill bg-ink-900/85 px-1.5 text-[0.6875rem] font-bold text-white">
                {t.title.rewatch(item.rewatches + 1)}
              </span>
            ) : null}
          </span>
          {item.rating ? (
            <span className="tabular absolute right-1.5 top-1.5 inline-flex h-6 items-center gap-0.5 rounded-pill bg-white/90 px-1.5 text-[0.6875rem] font-bold text-ink-900">
              <StarIcon fontSize="inherit" className="text-butter-400" />
              {item.rating}
            </span>
          ) : null}
          {item.title.kind === 'tv' && share > 0 && share < 1 ? (
            <span className="absolute inset-x-1.5 bottom-1.5 h-1 overflow-hidden rounded-full bg-white/60">
              <span
                className="block h-full rounded-full bg-ink-900"
                style={{ width: `${Math.round(share * 100)}%` }}
              />
            </span>
          ) : null}
        </>
      }
    />
  );
}

function GridSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cx(
        'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8',
        className,
      )}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <Skeleton key={i} className="aspect-[2/3] w-full rounded-[0.875rem]" />
      ))}
    </div>
  );
}
