import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui';
import { CheckIcon } from '@/components/ui/icons';
import { addDays, dayLong, localDate, relativeDay } from '@/food/format';
import { cx } from '@/lib/cx';
import { watchingApi, watchingKeys } from '../api';
import { ErrorCard, ViewSwitcher, WatchingScreen } from '../components/parts';
import { Poster } from '../components/Poster';
import { useWatchingT } from '../i18n';
import { episodeCode } from '../logic';
import { useWatchView } from '../people';
import { useSpoilerGuard } from '../spoilers';

/**
 * New episodes of the shows you follow (and films coming out from your watchlist), day by day:
 * the last week, to catch up, and the next eight.
 */
export default function CalendarPage() {
  const t = useWatchingT();
  const [guard] = useSpoilerGuard();
  const { view } = useWatchView();
  const today = localDate();
  const from = addDays(today, -7);
  const to = addDays(today, 56);
  const calendar = useQuery({
    queryKey: watchingKeys.calendar(view, from, to),
    queryFn: () => watchingApi.calendar(view, from, to),
  });
  const days = calendar.data?.days ?? [];

  return (
    <WatchingScreen
      title={t.calendar.title}
      subtitle={t.calendar.subtitle}
      nav
      error={calendar.error}
    >
      <ViewSwitcher className="mb-3" />
      {calendar.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[1.5rem]" />
          ))}
        </div>
      ) : calendar.error ? (
        <ErrorCard error={calendar.error} onRetry={() => void calendar.refetch()} />
      ) : days.length ? (
        <ol className="flex flex-col gap-5">
          {days.map(({ date, items }) => (
            <li key={date} className={cx(date < today && 'opacity-75')}>
              <h2 className="mb-2 flex items-baseline gap-2 px-0.5">
                <span
                  className={cx('text-[0.9375rem] font-bold', date === today && 'text-pink-800')}
                >
                  {relativeDay(date, today)}
                </span>
                <span className="text-xs font-medium text-ink-500">{dayLong(date)}</span>
              </h2>
              <ul className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
                {items.map((item) => (
                  <li
                    key={`${item.title.id}-${item.season}-${item.episode}`}
                    className="border-b border-ink-100 last:border-0"
                  >
                    <Link
                      to={
                        item.season !== null
                          ? `/watching/${item.title.id}/season/${item.season}`
                          : `/watching/${item.title.id}`
                      }
                      viewTransition
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-pink-50"
                    >
                      <Poster
                        path={item.title.posterPath}
                        kind={item.title.kind}
                        sizes="2.5rem"
                        className="w-10 shrink-0 rounded-[0.5rem]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{item.title.title}</span>
                        <span className="block truncate text-sm text-ink-600">
                          {item.season !== null && item.episode !== null ? (
                            <>
                              <span className="tabular">
                                {episodeCode(item.season, item.episode)}
                              </span>
                              {item.name && (!guard || item.watched) ? ` · ${item.name}` : ''}
                            </>
                          ) : (
                            t.kindOne.movie
                          )}
                        </span>
                      </span>
                      {item.watched ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-ink-900 px-2.5 py-1 text-xs font-bold text-white">
                          <CheckIcon fontSize="inherit" />
                          {t.calendar.watched}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
          {t.calendar.nothing}
        </p>
      )}
    </WatchingScreen>
  );
}
