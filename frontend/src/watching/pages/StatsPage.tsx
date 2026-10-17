import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { IconButton, Skeleton } from '@/components/ui';
import { ChevronLeftIcon, ChevronRightIcon, FireIcon } from '@/components/ui/icons';
import { localDate } from '@/food/format';
import { formatNumber } from '@/i18n';
import { cx } from '@/lib/cx';
import { BarChart } from '@/training/components/charts';
import { watchingApi, watchingKeys } from '../api';
import { ErrorCard, ViewSwitcher, WatchingScreen } from '../components/parts';
import { Face, PosterRow } from '../components/Poster';
import { PlayRow } from '../components/rows';
import {
  formatLongMinutes,
  formatMinutes,
  monthLine,
  monthName,
  monthShortName,
  watchedWhen,
} from '../format';
import { useWatchingT } from '../i18n';
import { DAY_PARTS, fillDays, monthRange, peakPart, shiftMonth, thisMonth } from '../logic';
import { useWatchView } from '../people';
import type { WatchingStats } from '../types';

/**
 * How the chosen person (or several together, or the household) watches: the month in numbers,
 * screen time per day, the hours they watch at, all-time totals, streak and longest binge, top
 * genres and faces, years, favourites and the history of plays.
 */
export default function StatsPage() {
  const t = useWatchingT();
  const { view, people } = useWatchView();
  const [month, setMonth] = useState(thisMonth);
  const { from, to } = monthRange(month);
  const today = localDate();
  const current = month === thisMonth();
  const stats = useQuery({
    queryKey: watchingKeys.stats(view, from, to),
    queryFn: () => watchingApi.stats(view, from, to),
    placeholderData: keepPreviousData,
  });
  const data = stats.data;
  const who = view.kind === 'person' ? (people.find((p) => p.id === view.id)?.name ?? null) : null;

  return (
    <WatchingScreen stored title={t.stats.title} back="/watching" nav error={stats.error}>
      <ViewSwitcher className="mb-2" />
      <div className="flex items-center justify-between gap-2">
        <IconButton
          icon={ChevronLeftIcon}
          label={t.stats.previous}
          variant="outline"
          size="sm"
          onClick={() => setMonth(shiftMonth(month, -1))}
        />
        <h2 className="text-[1.0625rem] font-bold">{monthName(month)}</h2>
        <IconButton
          icon={ChevronRightIcon}
          label={t.stats.next}
          variant="outline"
          size="sm"
          disabled={current}
          onClick={() => setMonth(shiftMonth(month, 1))}
        />
      </div>

      <div className="mt-3">
        {stats.isPending ? (
          <StatsSkeleton />
        ) : stats.error && !data ? (
          <ErrorCard error={stats.error} onRetry={() => void stats.refetch()} />
        ) : data ? (
          <div
            className={cx(
              'flex flex-col gap-3 transition-opacity md:grid md:grid-cols-2 md:items-start md:gap-4',
              stats.isPlaceholderData && 'opacity-60',
            )}
          >
            <div className="flex min-w-0 flex-col gap-3 md:gap-4">
              <MonthCard
                stats={data}
                nothing={who ? t.stats.nothingTheirs(who) : t.stats.nothing}
              />
              <Card title={t.stats.perDay}>
                <BarChart
                  label={t.stats.perDay}
                  format={formatMinutes}
                  bars={fillDays(from, to, data.perDay).map((d) => ({
                    key: d.date,
                    label: String(Number(d.date.slice(8))),
                    value: d.minutes,
                    current: d.date === today,
                    title: d.date,
                  }))}
                />
              </Card>
              <PeakCard perHour={data.perHour} />
              {data.history.length ? (
                <Card title={t.stats.history} flush>
                  <ul>
                    {data.history.slice(0, 30).map((play) => (
                      <li key={play.id} className="border-b border-ink-100 last:border-0">
                        <PlayRow play={play} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-3 md:gap-4">
              <YearCard />
              <Extras stats={data} />
              {data.favorites.length ? (
                <Card title={t.stats.favorites}>
                  <PosterRow items={data.favorites} label={t.stats.favorites} />
                </Card>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </WatchingScreen>
  );
}

function Card({ title, children, flush }: { title: string; children: ReactNode; flush?: boolean }) {
  return (
    <section
      className={cx(
        'overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]',
        !flush && 'p-4',
      )}
    >
      <h3 className={cx('text-[0.9375rem] font-bold', flush ? 'px-4 pb-1 pt-4' : 'mb-3')}>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** The reference's "This month: 7 episodes · 1 show · 2 movies · 9 plays", with screen time large. */
function MonthCard({ stats, nothing }: { stats: WatchingStats; nothing: string }) {
  const t = useWatchingT();
  const m = stats.month;
  const tiles = [
    [m.episodes, t.stats.word.episodes(m.episodes)],
    [m.shows, t.stats.word.shows(m.shows)],
    [m.movies, t.stats.word.movies(m.movies)],
    [m.plays, t.stats.word.plays(m.plays)],
  ] as const;
  return (
    <section className="rounded-[1.5rem] bg-ink-900 p-5 text-white shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-white/70">{t.stats.screenTime}</p>
      <p className="tabular mt-0.5 text-[2.25rem] font-bold leading-none tracking-[-0.03em]">
        {formatMinutes(m.minutes)}
      </p>
      {m.plays ? (
        <>
          <p className="mt-2 text-sm text-white/80">{monthLine(m)}</p>
          <dl className="mt-4 grid grid-cols-4 gap-2">
            {tiles.map(([value, word]) => (
              <div key={word} className="min-w-0 rounded-2xl bg-white/10 px-2 py-2.5 text-center">
                <dt className="sr-only">{word}</dt>
                <dd className="tabular text-xl font-bold leading-none">{formatNumber(value)}</dd>
                <dd
                  aria-hidden="true"
                  className="mt-1 truncate text-[0.6875rem] font-medium text-white/70"
                >
                  {word}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="mt-2 text-sm text-white/80">{nothing}</p>
      )}
    </section>
  );
}

function PeakCard({ perHour }: { perHour: WatchingStats['perHour'] }) {
  const t = useWatchingT();
  const peak = peakPart(perHour);
  const max = Math.max(1, ...DAY_PARTS.map((p) => perHour[p] ?? 0));
  return (
    <Card title={t.stats.peak}>
      {peak ? (
        <p className="-mt-2 mb-3 text-sm text-ink-600">{t.stats.peakIs(t.stats.parts[peak])}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {DAY_PARTS.map((part) => {
          const value = perHour[part] ?? 0;
          return (
            <li
              key={part}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm"
            >
              <span className="font-medium text-ink-700">{t.stats.partsTitle[part]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                <span
                  className={cx(
                    'block h-full rounded-full',
                    part === peak ? 'bg-ink-900' : 'bg-pink-400',
                  )}
                  style={{ width: `${Math.round((value / max) * 100)}%` }}
                />
              </span>
              <span className="tabular text-right text-xs font-semibold text-ink-600">
                {formatMinutes(value)}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** All time, streak, binge, years, months, genres and faces. */
function Extras({ stats }: { stats: WatchingStats }) {
  const t = useWatchingT();
  const year = new Date().getFullYear();
  const genreMax = Math.max(1, ...stats.topGenres.map((g) => g.minutes));
  const total = stats.total;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <section className="col-span-2 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-ink-600">{t.stats.allTime}</h3>
          <p className="tabular mt-0.5 text-[1.5rem] font-bold leading-tight">
            {formatLongMinutes(total.minutes)}
          </p>
          <p className="mt-0.5 text-sm text-ink-600">
            {t.stats.allTimeLine(t.common.plays(total.plays), t.common.titles(total.titles))}
          </p>
        </section>
        <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
          <h3 className="flex items-center gap-1 text-sm font-semibold text-ink-600">
            <FireIcon fontSize="inherit" className="text-peach-800" />
            {t.stats.streak}
          </h3>
          <p className="tabular mt-0.5 text-[1.0625rem] font-bold leading-tight">
            {t.stats.streakNow(stats.streak.current)}
          </p>
          <p className="mt-0.5 text-xs text-ink-500">{t.stats.streakBest(stats.streak.best)}</p>
        </section>
        <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-sm font-semibold text-ink-600">{t.stats.binge}</h3>
          {stats.bingeDay ? (
            <>
              <p className="tabular mt-0.5 text-[1.0625rem] font-bold leading-tight">
                {formatMinutes(stats.bingeDay.minutes)}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {t.stats.bingeLine(
                  stats.bingeDay.episodes,
                  watchedWhen(stats.bingeDay.date, 'day'),
                )}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-ink-500">—</p>
          )}
        </section>
      </div>

      {stats.perYear.length > 1 ? (
        <Card title={t.stats.byYear}>
          <BarChart
            label={t.stats.byYear}
            format={formatMinutes}
            bars={stats.perYear.map((y) => ({
              key: String(y.year),
              label: String(y.year),
              value: y.minutes,
              current: y.year === year,
            }))}
          />
        </Card>
      ) : null}

      {stats.perMonth.length > 1 ? (
        <Card title={t.stats.byMonth}>
          <BarChart
            label={t.stats.byMonth}
            format={formatMinutes}
            bars={stats.perMonth.slice(-12).map((m) => ({
              key: m.month,
              label: monthShortName(m.month),
              value: m.minutes,
              title: monthName(m.month),
            }))}
          />
        </Card>
      ) : null}

      {stats.topGenres.length ? (
        <Card title={t.stats.topGenres}>
          <ul className="flex flex-col gap-2">
            {stats.topGenres.slice(0, 6).map((g) => (
              <li
                key={g.id}
                className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 text-sm"
              >
                <span className="truncate font-medium text-ink-700">{g.name}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                  <span
                    className="block h-full rounded-full bg-lav-400"
                    style={{ width: `${Math.round((g.minutes / genreMax) * 100)}%` }}
                  />
                </span>
                <span className="tabular text-right text-xs font-semibold text-ink-600">
                  {formatMinutes(g.minutes)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {stats.topActors.length ? (
        <Card title={t.stats.topActors}>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none]">
            {stats.topActors.map((a) => (
              <li key={a.id} className="w-[4.75rem] shrink-0 text-center">
                <Link to={`/watching/person/${a.id}`} viewTransition className="press block">
                  <Face path={a.profilePath} className="mx-auto w-16" />
                  <span className="mt-1 line-clamp-2 text-xs font-semibold leading-tight">
                    {a.name}
                  </span>
                  <span className="tabular text-[0.6875rem] text-ink-500">
                    {t.common.titles(a.titles)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

/** This year in one card: time, plays, the show watched most, the favourite genre. */
function YearCard() {
  const t = useWatchingT();
  const { view } = useWatchView();
  const year = new Date().getFullYear();
  const review = useQuery({
    queryKey: watchingKeys.year(view, year),
    queryFn: () => watchingApi.year(view, year),
  });
  const data = review.data;
  if (!data || !data.minutes) return null;
  const top = data.topShows[0] ?? data.topMovies[0];
  const genre = data.topGenres[0];
  return (
    <section className="rounded-[1.5rem] bg-pink-200 p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm font-semibold text-pink-800">{t.stats.review(year)}</p>
      <p className="tabular mt-1 text-[1.75rem] font-bold leading-tight tracking-[-0.025em]">
        {t.stats.reviewTime(formatLongMinutes(data.minutes))}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-800">{monthLine(data)}</p>
      {top ? (
        <p className="mt-2 text-sm font-medium text-ink-800">
          {t.stats.reviewTop(top.title.title)}
        </p>
      ) : null}
      {genre ? (
        <p className="text-sm font-medium text-ink-800">{t.stats.reviewGenre(genre.name)}</p>
      ) : null}
    </section>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 md:grid md:grid-cols-2">
      <Skeleton className="h-44 rounded-[1.5rem]" />
      <Skeleton className="h-44 rounded-[1.5rem]" />
      <Skeleton className="h-36 rounded-[1.5rem]" />
    </div>
  );
}
