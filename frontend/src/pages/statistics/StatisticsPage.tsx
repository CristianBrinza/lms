import { useQueries, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, ButtonLink, Chips, Skeleton } from '@/components/ui';
import { ChevronRightIcon, FavoriteIcon, PhoneIphoneIcon } from '@/components/ui/icons';
import { foodApi, foodKeys } from '@/food/api';
import { addDays, localDate, money, plural } from '@/food/format';
import { trainingApi, trainingKeys } from '@/training/api';
import { PersonSwitcher } from '@/training/components/PersonSwitcher';
import { duration } from '@/training/format';
import { usePerson } from '@/training/person';
import type { HealthSummary, Person } from '@/training/types';
import { travelApi, travelKeys } from '@/travel/api';
import { cx } from '@/lib/cx';

type View = 'personal' | 'family';
type Range = 'week' | 'month' | 'quarter' | 'year';
const RANGE_DAYS: Record<Range, number> = { week: 7, month: 30, quarter: 91, year: 365 };
const RANGE_LABEL: Record<Range, string> = {
  week: '7 days',
  month: '30 days',
  quarter: '3 months',
  year: 'A year',
};

const avg = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const round = (n: number | null, digits = 0) =>
  n === null ? null : Math.round(n * 10 ** digits) / 10 ** digits;
const thousands = (n: number) => Math.round(n).toLocaleString('en-GB').replace(/,/g, ' ');

/** Averages over the days the phone sent something. */
function healthNumbers(health: HealthSummary | undefined) {
  const days = health?.days ?? [];
  const of = (kind: string) =>
    days
      .map((d) => (d.values as Record<string, number | undefined>)[kind])
      .filter((v): v is number => typeof v === 'number');
  return {
    steps: round(avg(of('steps'))),
    sleep: round(avg(of('sleep'))),
    active: round(avg(of('activeEnergy'))),
    weight: health?.latest.weight ?? null,
    restingHeartRate: health?.latest.restingHeartRate ?? null,
    synced: Object.keys(health?.lastSync ?? {}).length > 0,
  };
}

/**
 * Statistics, for one person or the whole family, over a range: body (from the phone's health
 * app), training, energy (eaten against burned), trips; and for the family the household's
 * shopping and travel. The phone's health data comes in through Training → Health.
 */
export default function StatisticsPage() {
  const [view, setView] = useState<View>('personal');
  const [range, setRange] = useState<Range>('month');
  const today = localDate();
  const from = addDays(today, -(RANGE_DAYS[range] - 1));
  return (
    <Screen tone="field">
      <PageHeader title="Statistics" subtitle={`${RANGE_LABEL[range]}, up to today`} />
      <div className="gutter-x mt-2 flex flex-col gap-3 md:px-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chips
            label="Whose statistics"
            value={view}
            onChange={setView}
            options={[
              { value: 'personal', label: 'Personal' },
              { value: 'family', label: 'Family' },
            ]}
          />
          <Chips
            label="Range"
            dense
            value={range}
            onChange={setRange}
            options={(Object.keys(RANGE_DAYS) as Range[]).map((r) => ({
              value: r,
              label: RANGE_LABEL[r],
            }))}
          />
        </div>
        {view === 'personal' ? (
          <Personal from={from} today={today} />
        ) : (
          <Family from={from} today={today} />
        )}
      </div>
    </Screen>
  );
}

function Personal({ from, today }: { from: string; today: string }) {
  const { personId, person, isMe } = usePerson();
  const health = useQuery({
    queryKey: trainingKeys.health(personId, from, today),
    queryFn: () => trainingApi.health(personId, from, today),
  });
  const stats = useQuery({
    queryKey: trainingKeys.stats(personId, from, today),
    queryFn: () => trainingApi.stats(personId, from, today, today),
  });
  const energy = useQuery({
    queryKey: trainingKeys.energy(personId, from, today),
    queryFn: () => trainingApi.energy(personId, from, today, today),
  });
  const travel = useQuery({
    queryKey: travelKeys.home(today),
    queryFn: () => travelApi.home(today),
  });
  const h = healthNumbers(health.data);
  const totals = stats.data?.totals;
  const days = energy.data?.days ?? [];
  const eaten = round(avg(days.filter((d) => d.eaten).map((d) => d.eaten!.kcal)));
  const burned = round(avg(days.map((d) => d.burned.total)));
  const trips = (travel.data?.trips ?? []).filter(
    (t) => t.people.includes(personId) && t.endDate >= from && t.startDate <= today,
  );
  const name = isMe ? 'You' : (person?.name ?? 'They');

  return (
    <>
      <PersonSwitcher />
      {health.data && !h.synced ? <ConnectCard isMe={isMe} name={person?.name} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <Card title="Body" to="/training/health" loading={health.isPending}>
          <Tiles>
            <Tile
              label="Weight"
              value={h.weight ? `${round(h.weight.value, 1)} kg` : '—'}
              hint={
                h.weight ? `on ${h.weight.day.slice(5).split('-').reverse().join('.')}` : undefined
              }
            />
            <Tile label="Steps a day" value={h.steps !== null ? thousands(h.steps) : '—'} />
            <Tile label="Sleep a night" value={h.sleep !== null ? duration(h.sleep * 60) : '—'} />
            <Tile
              label="Resting heart rate"
              value={h.restingHeartRate ? `${Math.round(h.restingHeartRate.value)} bpm` : '—'}
            />
          </Tiles>
        </Card>
        <Card title="Training" to="/training/progress" loading={stats.isPending}>
          <Tiles>
            <Tile label="Workouts" value={totals ? String(totals.workouts) : '—'} />
            <Tile label="Days active" value={totals ? String(totals.activeDays) : '—'} />
            <Tile label="Time" value={totals ? duration(totals.minutes * 60) : '—'} />
            <Tile
              label="Streak"
              value={stats.data ? plural(stats.data.streak.current, 'day') : '—'}
              hint={stats.data ? `best ${stats.data.streak.best}` : undefined}
            />
          </Tiles>
        </Card>
        <Card title="Energy" to="/training/health" loading={energy.isPending}>
          <Tiles>
            <Tile label="Eaten a day" value={eaten !== null ? `${thousands(eaten)} kcal` : '—'} />
            <Tile
              label="Burned a day"
              value={burned !== null ? `${thousands(burned)} kcal` : '—'}
            />
            <Tile
              label="Target"
              value={energy.data ? `${thousands(energy.data.target.kcal)} kcal` : '—'}
            />
            <Tile
              label="Moving a day"
              value={h.active !== null ? `${thousands(h.active)} kcal` : '—'}
            />
          </Tiles>
        </Card>
        <Card title="Trips" to="/travel" loading={travel.isPending}>
          <Tiles>
            <Tile label="Trips" value={String(trips.length)} />
            <Tile label="Days away" value={String(trips.reduce((sum, t) => sum + t.days, 0))} />
          </Tiles>
          {trips.length ? (
            <p className="mt-2 truncate text-sm text-ink-600">
              {trips.map((t) => t.name).join(', ')}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-600">{name} went nowhere in this range.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function Family({ from, today }: { from: string; today: string }) {
  const { people } = usePerson();
  const stats = useQueries({
    queries: people.map((p) => ({
      queryKey: trainingKeys.stats(p.id, from, today),
      queryFn: () => trainingApi.stats(p.id, from, today, today),
    })),
  });
  const health = useQueries({
    queries: people.map((p) => ({
      queryKey: trainingKeys.health(p.id, from, today),
      queryFn: () => trainingApi.health(p.id, from, today),
    })),
  });
  const shops = useQuery({ queryKey: foodKeys.trips, queryFn: foodApi.trips });
  const travel = useQuery({
    queryKey: travelKeys.home(today),
    queryFn: () => travelApi.home(today),
  });

  const inRange = (shops.data ?? []).filter((t) => t.finishedAt.slice(0, 10) >= from);
  const spent = inRange.reduce((sum, t) => sum + (t.total ?? 0), 0);
  const trips = (travel.data?.trips ?? []).filter((t) => t.endDate >= from && t.startDate <= today);
  const workouts = stats.reduce((sum, s) => sum + (s.data?.totals.workouts ?? 0), 0);

  return (
    <>
      <Card title="The household">
        <Tiles>
          <Tile
            label="Spent shopping"
            value={shops.data ? money(Math.round(spent)) : '—'}
            hint={plural(inRange.length, 'shop')}
          />
          <Tile label="Trips" value={travel.data ? String(trips.length) : '—'} />
          <Tile label="Workouts, all of you" value={String(workouts)} />
          <Tile label="People" value={String(people.length)} />
        </Tiles>
      </Card>
      <ul className="grid gap-3 md:grid-cols-2">
        {people.map((p, i) => (
          <li key={p.id}>
            <PersonCard
              person={p}
              stats={stats[i]?.data}
              health={health[i]?.data}
              trips={trips.filter((t) => t.people.includes(p.id)).length}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function PersonCard({
  person,
  stats,
  health,
  trips,
}: {
  person: Person;
  stats: Awaited<ReturnType<typeof trainingApi.stats>> | undefined;
  health: HealthSummary | undefined;
  trips: number;
}) {
  const h = healthNumbers(health);
  return (
    <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center gap-3">
        <Avatar person={person} />
        <p className="min-w-0 flex-1 truncate text-[1.0625rem] font-bold">
          {person.name} {person.surname}
        </p>
        {!h.synced && health ? (
          <span className="rounded-pill bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-600">
            Phone not connected
          </span>
        ) : null}
      </div>
      <Tiles>
        <Tile label="Workouts" value={stats ? String(stats.totals.workouts) : '—'} />
        <Tile label="Time" value={stats ? duration(stats.totals.minutes * 60) : '—'} />
        <Tile label="Steps a day" value={h.steps !== null ? thousands(h.steps) : '—'} />
        <Tile label="Weight" value={h.weight ? `${round(h.weight.value, 1)} kg` : '—'} />
        <Tile label="Sleep" value={h.sleep !== null ? duration(h.sleep * 60) : '—'} />
        <Tile label="Trips" value={String(trips)} />
      </Tiles>
    </section>
  );
}

/** Where the phone's health data comes from: Apple Health (a Shortcut) or Health Connect (the app). */
function ConnectCard({ isMe, name }: { isMe: boolean; name?: string }) {
  return (
    <section className="flex flex-col gap-3 rounded-[1.5rem] bg-ink-900 p-4 text-white shadow-[var(--shadow-tile)] sm:flex-row sm:items-center">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-[1.5rem] text-butter-300">
        <PhoneIphoneIcon fontSize="inherit" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold">
          {isMe
            ? 'Bring in your phone’s health data'
            : `${name ?? 'They'} haven’t connected a phone`}
        </p>
        <p className="mt-0.5 text-sm text-white/70">
          Weight, steps, sleep, heart rate and workouts from Apple Health (iPhone) or Health Connect
          (Android), every day by themselves.
        </p>
      </div>
      {isMe ? (
        <ButtonLink to="/training/health" variant="accent" size="sm" icon={FavoriteIcon}>
          Connect
        </ButtonLink>
      ) : null}
    </section>
  );
}

function Card({
  title,
  to,
  loading,
  children,
}: {
  title: string;
  to?: string;
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 flex items-center justify-between text-[1.0625rem] font-bold">
        {title}
        {to ? (
          <Link
            to={to}
            aria-label={`More about ${title.toLowerCase()}`}
            className="press grid size-9 place-items-center rounded-full text-[1.3rem] text-ink-500 hover:bg-ink-50"
          >
            <ChevronRightIcon fontSize="inherit" />
          </Link>
        ) : null}
      </h2>
      {loading ? <Skeleton className="h-28 rounded-2xl" /> : children}
    </section>
  );
}

function Tiles({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-4">
      {children}
    </dl>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={cx('rounded-2xl bg-ink-50 p-3')}>
      <dt className="text-xs font-semibold text-ink-600">{label}</dt>
      <dd className="tabular mt-0.5 text-[1.1875rem] font-bold leading-tight">{value}</dd>
      {hint ? <dd className="text-xs text-ink-500">{hint}</dd> : null}
    </div>
  );
}
