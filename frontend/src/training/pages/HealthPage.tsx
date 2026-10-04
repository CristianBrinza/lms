import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Skeleton, toast } from '@/components/ui';
import { CheckCircleIcon, ContentCopyIcon, InsightsIcon, WarningIcon } from '@/components/ui/icons';
import { keysApi } from '@/food/api';
import { addDays, dayAndMonth, localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { currentPlatform } from '@/lib/platform';
import { trainingApi, trainingKeys } from '../api';
import { BarChart, LineChart } from '../components/charts';
import { EnergyPanel } from '../components/EnergyPanel';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { usePerson } from '../person';
import type { HealthKind, HealthSummary } from '../types';

const RANGES = [
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'Month' },
  { days: 90, label: '3 months' },
] as const;

const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${String(Math.round(minutes % 60)).padStart(2, '0')}`;
const thousands = (n: number) => Math.round(n).toLocaleString('en').replace(/,/g, ' ');

const KIND: Partial<Record<HealthKind, { label: string; format: (v: number) => string }>> = {
  steps: { label: 'Steps a day', format: thousands },
  sleep: { label: 'Sleep', format: hours },
  restingHeartRate: { label: 'Resting heart rate', format: (v) => `${Math.round(v)} bpm` },
  weight: { label: 'Weight', format: (v) => `${v.toFixed(1)} kg` },
  distance: { label: 'Walked and ran', format: (v) => `${(v / 1000).toFixed(1)} km` },
  activeEnergy: { label: 'Active energy', format: (v) => `${thousands(v)} kcal` },
  hrv: { label: 'Heart rate variability', format: (v) => `${Math.round(v)} ms` },
};

/**
 * Health from the phone, next to the training: steps, sleep, resting heart rate, weight. iPhones
 * send Apple Health through a Shortcut (web apps can't read Health themselves); Android through
 * the companion app; anything can be typed in. The page compares this week with the last and
 * says what stands out — observations, not medical advice.
 */
export default function HealthPage() {
  const today = localDate();
  const { personId, person, isMe } = usePerson();
  const [range, setRange] = useState<number>(30);
  const from = addDays(today, -(range - 1));
  const health = useQuery({
    queryKey: trainingKeys.health(personId, from, today),
    queryFn: () => trainingApi.health(personId, from, today),
  });
  const data = health.data;
  const synced = data && (data.lastSync.apple || data.lastSync.google);

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/training"
        title="Health and energy"
        subtitle={
          isMe ? 'Eaten, burned, and the phone’s numbers' : `${person?.name ?? ''}’s health`
        }
      />
      <PersonSwitcher className="gutter-x mt-3 md:px-5 lg:px-8" />
      <div className="gutter-x mt-3 grid gap-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:px-8">
        <div className="flex min-w-0 flex-col gap-4">
          <EnergyPanel personId={personId} today={today} />
          <div className="flex gap-1.5" role="group" aria-label="Range">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={range === r.days}
                onClick={() => setRange(r.days)}
                className={cx(
                  'press h-10 rounded-full px-4 text-sm font-semibold transition-colors',
                  range === r.days
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-50',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          {health.isPending ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-28 rounded-3xl" />
              <Skeleton className="h-48 rounded-3xl sm:col-span-2" />
            </div>
          ) : health.error || !data ? (
            <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-danger-700">Couldn’t load health data</p>
              <p className="mt-1 text-sm text-ink-600">{errorMessage(health.error)}</p>
              <Button
                size="sm"
                variant="tint"
                className="mt-3"
                onClick={() => void health.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : !data.days.length ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
              <InsightsIcon fontSize="inherit" className="text-[2.25rem] text-ink-400" />
              <p className="mt-2 font-semibold">No health data yet</p>
              <p className="mt-1 text-sm text-ink-600">
                Connect the phone (below), or type today’s weight or sleep in.
              </p>
            </div>
          ) : (
            <HealthData data={data} />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
          {isMe ? <Connect synced={synced ? String(synced) : null} /> : null}
          <TypeIn personId={personId} today={today} />
        </div>
      </div>
    </Screen>
  );
}

function HealthData({ data }: { data: HealthSummary }) {
  const tiles: HealthKind[] = (
    [
      'steps',
      'sleep',
      'restingHeartRate',
      'weight',
      'distance',
      'activeEnergy',
      'hrv',
    ] as HealthKind[]
  ).filter((k) => data.week[k] || data.latest[k]);
  const series = (kind: HealthKind) =>
    data.days
      .filter((d) => d.values[kind] !== undefined)
      .map((d) => ({ day: d.day, value: d.values[kind]! }));
  return (
    <>
      {data.insights.length ? (
        <ul className="flex flex-col gap-1.5">
          {data.insights.map((i) => (
            <li
              key={i.text}
              className={cx(
                'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
                i.tone === 'good'
                  ? 'bg-mint-100'
                  : i.tone === 'watch'
                    ? 'bg-peach-100'
                    : 'bg-lav-100',
              )}
            >
              {i.tone === 'watch' ? (
                <WarningIcon fontSize="inherit" className="mt-0.5 shrink-0 text-[1.1rem]" />
              ) : (
                <CheckCircleIcon fontSize="inherit" className="mt-0.5 shrink-0 text-[1.1rem]" />
              )}
              {i.text}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {tiles.map((kind) => {
          const spec = KIND[kind]!;
          const w = data.week[kind];
          const value = kind === 'weight' ? data.latest.weight?.value : w?.now;
          const before = kind === 'weight' ? null : w?.before;
          const change = value && before ? Math.round(((value - before) / before) * 100) : null;
          return (
            <div
              key={kind}
              className="rounded-[1.25rem] bg-white p-3.5 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-semibold text-ink-600">{spec.label}</p>
              <p className="tabular mt-1 text-[1.375rem] font-bold leading-tight tracking-[-0.02em]">
                {value ? spec.format(value) : '—'}
              </p>
              <p className="text-xs text-ink-500">
                {kind === 'weight' && data.latest.weight
                  ? dayAndMonth(data.latest.weight.day)
                  : 'a day, this week'}
                {change ? ` · ${change > 0 ? '+' : ''}${change}%` : ''}
              </p>
            </div>
          );
        })}
      </div>
      {series('steps').length ? (
        <Card title="Steps">
          <BarChart
            label="Steps per day"
            format={thousands}
            bars={series('steps').map((p) => ({
              key: p.day,
              label: p.day.slice(8),
              value: p.value,
              title: `${dayAndMonth(p.day)}: ${thousands(p.value)}`,
            }))}
          />
        </Card>
      ) : null}
      {series('sleep').length ? (
        <Card title="Sleep">
          <BarChart
            label="Hours asleep per night"
            format={hours}
            bars={series('sleep').map((p) => ({
              key: p.day,
              label: p.day.slice(8),
              value: p.value,
              title: `${dayAndMonth(p.day)}: ${hours(p.value)}`,
            }))}
          />
        </Card>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {series('restingHeartRate').length > 1 ? (
          <Card title="Resting heart rate">
            <LineChart
              label="Resting heart rate"
              format={KIND.restingHeartRate!.format}
              points={series('restingHeartRate')}
            />
          </Card>
        ) : null}
        {series('weight').length > 1 ? (
          <Card title="Weight">
            <LineChart label="Weight" format={KIND.weight!.format} points={series('weight')} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
      <h2 className="mb-2 text-[1.0625rem] font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** Connecting the phone: a key for it, then the steps for this phone (both on a computer). */
function Connect({ synced }: { synced: string | null }) {
  const platform = useMemo(() => currentPlatform(), []);
  const [tab, setTab] = useState<'ios' | 'android'>(platform.os === 'android' ? 'android' : 'ios');
  const [key, setKey] = useState<string | null>(null);
  const url = `${window.location.origin}/api/training/health`;
  const make = useMutation({
    mutationFn: () =>
      keysApi.create({
        name: tab === 'ios' ? 'Health sync (iPhone)' : 'Health sync (Android)',
        scope: 'food',
      }),
    onSuccess: (res) => setKey(res.token),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error('Couldn’t copy. Select it and copy by hand.');
    }
  };
  const chip = (active: boolean) =>
    cx(
      'press h-9 rounded-full px-3.5 text-sm font-semibold',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
    );
  const keyStep = (
    <>
      {key ? (
        <span className="mt-1 flex items-center gap-2 rounded-xl bg-butter-100 p-2">
          <code className="min-w-0 flex-1 truncate text-xs">{key}</code>
          <Button
            size="sm"
            variant="soft"
            icon={ContentCopyIcon}
            onClick={() => void copy(key, 'Key')}
          >
            Copy
          </Button>
        </span>
      ) : (
        <Button
          size="sm"
          variant="tint"
          className="mt-1"
          loading={make.isPending}
          onClick={() => make.mutate()}
        >
          Make a key
        </Button>
      )}
      {key ? (
        <span className="mt-1 block text-xs text-ink-600">
          Shown once. It can be revoked in Settings → Claude access.
        </span>
      ) : null}
    </>
  );
  return (
    <section
      aria-labelledby="connect"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="connect" className="text-[1.0625rem] font-bold">
        Connect the phone
      </h2>
      <p className="mt-0.5 text-sm text-ink-600">
        {synced ? `Last sync ${new Date(synced).toLocaleString()}.` : 'Not connected yet.'}
      </p>
      <div className="mt-3 flex gap-1.5">
        <button type="button" className={chip(tab === 'ios')} onClick={() => setTab('ios')}>
          iPhone · Apple Health
        </button>
        <button type="button" className={chip(tab === 'android')} onClick={() => setTab('android')}>
          Android
        </button>
      </div>
      {tab === 'ios' ? (
        <div className="mt-3 flex flex-col gap-3 text-sm text-ink-800">
          <p className="text-ink-600">
            Apple lets only App Store apps ask for Health. A Shortcut on the iPhone does it instead:
            every evening it reads today’s numbers and sends them here.
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>A key for the phone: {keyStep}</li>
            <li>
              Shortcuts → Automation → New → <b>Time of Day</b> 23:30, Daily, <b>Run Immediately</b>{' '}
              → New Blank Automation.
            </li>
            <li>
              Add <b>Find Health Samples</b> (Steps, start date is today) →{' '}
              <b>Calculate Statistics</b> (Sum). Repeat for Walking + Running Distance (Sum, km),
              Active Energy (Sum), Resting Energy (Sum), Resting Heart Rate (Average), Weight (sort
              latest, limit 1), Sleep (hours, Sum).
            </li>
            <li>
              <b>Format Date</b>: Current Date, custom format <code>yyyy-MM-dd</code>.
            </li>
            <li>
              <b>Get Contents of URL</b>:{' '}
              <button
                type="button"
                onClick={() => void copy(url, 'Address')}
                className="font-semibold text-lav-800 underline"
              >
                {url}
              </button>
              , Method POST, Header <code>Authorization</code> = <code>Bearer</code> + the key,
              Request Body JSON: <code>date</code>, <code>steps</code>, <code>distanceKm</code>,{' '}
              <code>activeEnergy</code>, <code>restingEnergy</code>, <code>restingHeartRate</code>,{' '}
              <code>weight</code>, <code>sleepHours</code>, each set to its result.
            </li>
            <li>
              To see what you ate in Apple Health too: <b>Get Contents of URL</b>{' '}
              <code>{url.replace('/health', '/energy/today')}</code> (GET, same header), then{' '}
              <b>Get Dictionary Value</b> <code>eatenKcal</code>, then <b>Log Health Sample</b>:
              Dietary Energy, that value, today.
            </li>
            <li>
              Run it once by hand: allow Health when the iPhone asks. This page shows the day.
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 text-sm text-ink-800">
          <p className="text-ink-600">
            Health Connect opens only to installed apps, so a small LMS Health app does it: steps,
            sleep, heart rate, weight and workouts come here every 3 hours, and what you ate here
            goes back to Health Connect.
          </p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>
              <a className="font-semibold text-lav-800 underline" href="/lms-health.apk" download>
                Download LMS Health
              </a>{' '}
              (3 MB) on the phone and open it. Android asks to allow installing from the browser
              once.
            </li>
            <li>A key for the phone: {keyStep}</li>
            <li>
              In the app: paste the key, <b>Connect Health Connect</b> and allow what to share
              (including <b>access in the background</b>), then <b>Sync now</b>.
            </li>
            <li>
              Turn on <b>Sync every 3 hours</b>. This page shows the days as they come in.
            </li>
          </ol>
        </div>
      )}
    </section>
  );
}

function TypeIn({ personId, today }: { personId: string; today: string }) {
  const queryClient = useQueryClient();
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const num = (text: string) => {
    const n = Number(text.replace(',', '.').replace(/\s/g, ''));
    return text.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const save = useMutation({
    mutationFn: () =>
      trainingApi.addHealth({
        userId: personId,
        source: 'manual',
        date: today,
        weight: num(weight),
        sleepHours: num(sleep),
        steps: num(steps),
      }),
    onSuccess: () => {
      toast.success('Saved for today');
      setWeight('');
      setSleep('');
      setSteps('');
      void queryClient.invalidateQueries({ queryKey: ['training', 'health'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="flex flex-col gap-1 rounded-2xl bg-ink-50 p-3">
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      <span className="flex items-baseline gap-1">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => set(e.target.value)}
          placeholder="—"
          className="tabular w-full min-w-0 bg-transparent text-lg font-bold outline-none"
        />
        <span className="text-xs text-ink-500">{unit}</span>
      </span>
    </label>
  );
  return (
    <section
      aria-labelledby="type-in"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="type-in" className="text-[1.0625rem] font-bold">
        Type in today
      </h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {field('Weight', weight, setWeight, 'kg')}
        {field('Sleep', sleep, setSleep, 'h')}
        {field('Steps', steps, setSteps, '')}
      </div>
      <Button
        className="mt-3 w-full"
        variant="tint"
        loading={save.isPending}
        disabled={!num(weight) && !num(sleep) && !num(steps)}
        onClick={() => save.mutate()}
      >
        Save
      </Button>
    </section>
  );
}
