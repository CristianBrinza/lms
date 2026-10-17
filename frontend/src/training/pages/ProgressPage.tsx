import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, Chips, Skeleton } from '@/components/ui';
import { ChevronRightIcon, FireIcon } from '@/components/ui/icons';
import { addDays, localDate, weekStart } from '@/food/format';
import { formatList, formatNumber, getLocale, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { trainingApi, trainingKeys } from '../api';
import { weeklyTotals } from '../components/chartData';
import { BarChart, HeatMap } from '../components/charts';
import { dayMonth as dayAndMonth, weekday as weekdayShort } from '../components/charts.i18n';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { distance, duration, MUSCLE_LABEL, MUSCLE_ORDER } from '../format';
import { trainingT } from '../i18n';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { DayActivity, Muscle, Stats } from '../types';
import { progressT, useProgressT } from './ProgressPage.i18n';

type Range = 'week' | 'month' | 'quarter' | 'year';

/**
 * Worth some attention: under two sets this week and under a quarter of the busiest muscle's (so a
 * young week, when everything is low, doesn't flag everything).
 */
const neglectedBelow = (max: number) => Math.min(2, max * 0.25);

const minutes = (value: number) => (value > 0 ? duration(value * 60) : progressT().minutesOnly(0));
/** For the small tiles: 203 → "3h 23m", 45 → "45 min". */
const shortMinutes = (value: number) => {
  const t = progressT();
  if (value < 60) return t.minutesOnly(Math.max(0, Math.round(value)));
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return h >= 10 || !m ? t.hoursOnly(h) : t.hoursMinutes(h, m);
};
const sets = (value: number) => formatNumber(value, { maximumFractionDigits: 1 });

/**
 * How the chosen person's training adds up: totals for a range, streaks, a calendar of days
 * trained, what each muscle got this week, the exercises done most, minutes week by week.
 * Phones: one column; tablets and up: two.
 */
export default function ProgressPage() {
  const t = useProgressT();
  const RANGE_LABEL = t.range.long;
  const { personId, person, people, isMe } = usePerson();
  const [range, setRange] = useState<Range>('month');
  const today = localDate();
  const thisWeek = weekStart(today);
  const froms: Record<Range, string> = {
    week: thisWeek,
    month: addDays(today, -29),
    quarter: addDays(thisWeek, -12 * 7),
    year: addDays(thisWeek, -51 * 7),
  };
  const from = froms[range];
  // The calendar and the weekly bars show at least three months: a week alone says little.
  const calendarFrom = range === 'year' ? froms.year : froms.quarter;

  const statsQuery = (start: string) => ({
    queryKey: trainingKeys.stats(personId, start, today),
    queryFn: () => trainingApi.stats(personId, start, today, today),
  });
  const ranged = useQuery(statsQuery(from));
  const week = useQuery(statsQuery(thisWeek));
  const calendar = useQuery(statsQuery(calendarFrom));

  const error = ranged.error ?? week.error ?? calendar.error;
  const retry = () => {
    void ranged.refetch();
    void week.refetch();
    void calendar.refetch();
  };

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/training"
        title={t.title}
        subtitle={
          people.length > 1 && person
            ? `${isMe ? t.you : person.name} · ${t.range.inline[range]}`
            : RANGE_LABEL[range]
        }
      />

      <div className="gutter-x mt-2.5 flex flex-col gap-2 md:px-5 lg:px-8">
        <PersonSwitcher />
        <Chips
          label={t.range.label}
          tone="sheet"
          dense
          value={range}
          onChange={setRange}
          options={(['week', 'month', 'quarter', 'year'] as const).map((value) => ({
            value,
            label: t.range.chip[value],
          }))}
        />
      </div>

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {error ? (
          <div className="mb-3 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">{t.loadFailed}</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={retry}>
              {t.tryAgain}
            </Button>
          </div>
        ) : null}

        <div className="mb-3 md:mb-4 lg:mb-6">
          <Card title={RANGE_LABEL[range]}>
            {ranged.data ? <Totals stats={ranged.data} /> : <TilesSkeleton />}
            {ranged.data && !ranged.data.totals.activeDays ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-butter-100 px-3.5 py-3">
                <p className="text-sm font-medium text-ink-800">
                  {isMe ? t.nothingMine : t.nothingTheirs(person?.name ?? null)}
                </p>
                <ButtonLink to="/training" size="sm" variant="primary">
                  {t.startWorkout}
                </ButtonLink>
              </div>
            ) : null}
          </Card>
        </div>

        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:items-start md:gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6">
          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            <Card title={t.card.streaks}>
              {(ranged.data ?? calendar.data) ? (
                <Streaks stats={(ranged.data ?? calendar.data)!} />
              ) : (
                <Skeleton className="h-20 rounded-2xl" />
              )}
            </Card>

            <Card title={t.card.days} aside={RANGE_LABEL[range === 'year' ? 'year' : 'quarter']}>
              {calendar.data ? (
                <Calendar stats={calendar.data} from={calendarFrom} today={today} />
              ) : (
                <Skeleton className="h-40 rounded-2xl" />
              )}
            </Card>

            <Card title={t.card.minutes} aside={RANGE_LABEL[range === 'year' ? 'year' : 'quarter']}>
              {calendar.data ? (
                <BarChart
                  label={t.minutesChart}
                  format={minutes}
                  bars={weeklyTotals(
                    calendar.data.days.map((d) => ({ day: d.day, value: d.minutes })),
                    calendarFrom,
                    today,
                  ).map((w) => ({
                    key: w.week,
                    label: dayAndMonth(w.week),
                    title: t.weekOf(dayAndMonth(w.week)),
                    value: w.value,
                    current: w.week === thisWeek,
                  }))}
                />
              ) : (
                <Skeleton className="h-40 rounded-2xl" />
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            <Card title={t.card.muscles} aside={t.card.musclesAside}>
              {week.data ? (
                <Muscles muscles={week.data.muscles} />
              ) : (
                <Skeleton className="h-72 rounded-2xl" />
              )}
            </Card>

            <Card title={t.card.top} aside={RANGE_LABEL[range]}>
              {ranged.data ? (
                <TopExercises top={ranged.data.top} />
              ) : (
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-14 rounded-2xl" />
                  <Skeleton className="h-14 rounded-2xl" />
                  <Skeleton className="h-14 rounded-2xl" />
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------- pieces

function Card({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] lg:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h2 className="text-h3 font-bold">{title}</h2>
        {aside ? <span className="text-xs font-semibold text-ink-500">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

function TilesSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-[4.25rem] rounded-2xl" />
      ))}
    </div>
  );
}

function Totals({ stats }: { stats: Stats }) {
  const words = useProgressT().tile;
  const t = stats.totals;
  const tiles: Array<{ key: string; label: string; value: string; strong?: boolean }> = [
    {
      key: 'days',
      label: words.daysTrained(t.activeDays),
      value: formatNumber(t.activeDays),
      strong: true,
    },
    { key: 'workouts', label: words.workouts(t.workouts), value: formatNumber(t.workouts) },
    { key: 'minutes', label: words.trained, value: shortMinutes(t.minutes) },
    { key: 'sets', label: words.sets, value: formatNumber(t.sets) },
    { key: 'reps', label: words.reps, value: formatNumber(t.reps) },
    { key: 'distance', label: words.distance, value: t.distance ? distance(t.distance) : '—' },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2 lg:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className={cx(
            'flex min-w-0 flex-col-reverse justify-end rounded-2xl px-3 py-2.5',
            tile.strong ? 'bg-ink-900 text-white' : 'bg-ink-50',
          )}
        >
          <dt
            className={cx(
              'text-xs font-semibold [overflow-wrap:break-word]',
              tile.strong ? 'text-white/70' : 'text-ink-600',
            )}
          >
            {tile.label}
          </dt>
          <dd className="tabular truncate text-[1.25rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.375rem]">
            {tile.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Streaks({ stats }: { stats: Stats }) {
  const { current, best, weeks } = stats.streak;
  const words = useProgressT().streak;
  const tiles = [
    {
      key: 'now',
      value: current,
      label: current ? words.now(current) : words.start,
    },
    { key: 'best', value: best, label: words.best(best) },
    { key: 'weeks', value: weeks, label: words.weeks(weeks) },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {tiles.map((tile, i) => (
        <div
          key={tile.key}
          className={cx(
            'flex min-w-0 flex-col-reverse justify-end rounded-2xl px-3 py-2.5',
            i === 0 && current ? 'bg-peach-100' : 'bg-ink-50',
          )}
        >
          <dt className="mt-0.5 text-xs font-semibold leading-snug text-ink-600 [overflow-wrap:break-word]">
            {tile.label}
          </dt>
          <dd className="tabular flex items-center gap-1 text-[1.25rem] font-bold leading-tight tracking-[-0.02em] sm:text-[1.375rem]">
            {formatNumber(tile.value)}
            {i === 0 ? (
              <FireIcon
                fontSize="inherit"
                aria-hidden="true"
                className={cx('text-[1.15rem]', current ? 'text-peach-800' : 'text-ink-300')}
              />
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Calendar({ stats, from, today }: { stats: Stats; from: string; today: string }) {
  const byDay = new Map<string, DayActivity>(stats.days.map((d) => [d.day, d]));
  const values = new Map(stats.days.map((d) => [d.day, d.sets || d.minutes]));
  const t = useProgressT();
  return (
    <HeatMap
      from={from}
      to={today}
      today={today}
      values={values}
      describe={(day) => {
        const d = byDay.get(day);
        const when = `${weekdayShort(day)} ${dayAndMonth(day)}`;
        if (!d) return t.rest(when);
        return `${when}: ${trainingT().sets(d.sets)}${d.minutes ? ` · ${minutes(d.minutes)}` : ''}`;
      }}
    />
  );
}

function Muscles({ muscles }: { muscles: Partial<Record<Muscle, number>> }) {
  const t = useProgressT().muscles;
  const max = Math.max(0, ...MUSCLE_ORDER.map((m) => muscles[m] ?? 0));
  if (!max)
    return <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{t.empty}</p>;
  const neglected = MUSCLE_ORDER.filter((m) => (muscles[m] ?? 0) < neglectedBelow(max));
  return (
    <div>
      <ul className="flex flex-col gap-1.5" aria-label={t.list}>
        {MUSCLE_ORDER.map((m) => {
          const value = muscles[m] ?? 0;
          const low = neglected.includes(m);
          return (
            <li
              key={m}
              className={cx(
                'grid items-center gap-2',
                // Romanian and Russian muscle names run longer ("Ischiogambieri", "Бицепс бедра").
                getLocale() === 'en'
                  ? 'grid-cols-[5.5rem_minmax(0,1fr)_2.25rem]'
                  : 'grid-cols-[7rem_minmax(0,1fr)_2.25rem]',
              )}
            >
              <span
                className={cx(
                  'truncate text-[0.8125rem] font-semibold',
                  low ? 'text-peach-800' : 'text-ink-800',
                )}
              >
                {MUSCLE_LABEL[m]}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  'h-3 overflow-hidden rounded-pill',
                  low ? 'bg-peach-100' : 'bg-ink-50',
                )}
              >
                <span
                  className={cx(
                    'block h-full rounded-pill transition-[width] duration-500 ease-(--ease-out)',
                    low ? 'bg-peach-200' : 'bg-lav-500',
                  )}
                  style={{ width: value ? `max(${(value / max) * 100}%, 0.75rem)` : 0 }}
                />
              </span>
              <span className="tabular text-right text-[0.8125rem] font-bold">
                {value ? sets(value) : '—'}
                <span className="sr-only">
                  {t.sets(value)}
                  {low ? t.low : ''}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {neglected.length ? (
        <p className="mt-3 rounded-2xl bg-peach-100 px-3.5 py-2.5 text-[0.8125rem] font-medium text-peach-800">
          {t.needMore(formatList(neglected.map((m) => MUSCLE_LABEL[m])))}
        </p>
      ) : null}
    </div>
  );
}

function TopExercises({ top }: { top: Stats['top'] }) {
  const t = useProgressT();
  const words = trainingT();
  if (!top.length)
    return <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{t.topEmpty}</p>;
  return (
    <ol className="-mx-1.5 flex flex-col">
      {top.map((e, i) => (
        <li key={e.exerciseId}>
          <Link
            to={`/training/exercises?exercise=${encodeURIComponent(e.exerciseId)}`}
            className="press flex items-center gap-3 rounded-2xl px-1.5 py-1.5 transition-colors hover:bg-ink-50"
          >
            <span className="tabular w-4 shrink-0 text-center text-xs font-bold text-ink-400">
              {i + 1}
            </span>
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-butter-100">
              <ExerciseIcon name={e.icon} className="size-9" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-semibold">{tr(e, 'name')}</span>
              <span className="tabular block truncate text-[0.8125rem] text-ink-600">
                {[
                  words.sets(e.sets),
                  e.reps ? words.reps(e.reps) : null,
                  e.seconds ? duration(e.seconds) : null,
                  e.distance ? distance(e.distance) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
            <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.3rem] text-ink-400" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
