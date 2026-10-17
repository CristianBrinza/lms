import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Skeleton, toast } from '@/components/ui';
import { CheckCircleIcon, ContentCopyIcon, InsightsIcon, WarningIcon } from '@/components/ui/icons';
import { keysApi } from '@/food/api';
import { addDays, localDate } from '@/food/format';
import { formatNumber, intlLocale } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { currentPlatform } from '@/lib/platform';
import { trainingApi, trainingKeys } from '../api';
import { BarChart, LineChart } from '../components/charts';
import { dayMonth as dayAndMonth, wholeNumber as thousands } from '../components/charts.i18n';
import { EnergyPanel } from '../components/EnergyPanel';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { trainingT } from '../i18n';
import { usePerson } from '../person';
import type { HealthKind, HealthSummary } from '../types';
import { decimal, healthT, useHealthT } from './HealthPage.i18n';

const RANGES = [14, 30, 90] as const;

/** Sleep in minutes: 425 → "7 h 05" ("7 ч 05"). */
const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)} ${trainingT().unit.h} ${String(Math.round(minutes % 60)).padStart(2, '0')}`;

/** How each reading is written, in the current language. */
const FORMAT: Record<HealthKind, (v: number) => string> = {
  steps: thousands,
  sleep: hours,
  restingHeartRate: (v) => `${Math.round(v)} ${trainingT().unit.bpm}`,
  heartRate: (v) => `${Math.round(v)} ${trainingT().unit.bpm}`,
  weight: (v) => `${decimal(v)} ${trainingT().unit.kg}`,
  bodyFat: (v) => formatNumber(v / 100, { style: 'percent', maximumFractionDigits: 1 }),
  distance: (v) => `${decimal(v / 1000)} ${trainingT().unit.km}`,
  activeEnergy: (v) => `${thousands(v)} ${trainingT().unit.kcal}`,
  exerciseMinutes: (v) => `${Math.round(v)} ${trainingT().unit.min}`,
  flights: (v) => healthT().flights(Math.round(v)),
  hrv: (v) => `${Math.round(v)} ${healthT().unit.ms}`,
  vo2max: (v) => `${decimal(v)} ${healthT().unit.mlKgMin}`,
};

/**
 * The connection steps' markup: **bold**, `code`, and {slot} for a piece the page fills in.
 */
function rich(text: string, slots: Record<string, ReactNode> = {}): ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\{\w+\})/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
    const slot = /^\{(\w+)\}$/.exec(part)?.[1];
    if (slot && slot in slots) return <Fragment key={i}>{slots[slot]}</Fragment>;
    return part;
  });
}

/**
 * Health from the phone, next to the training: steps, sleep, resting heart rate, weight. iPhones
 * send Apple Health through a Shortcut (web apps can't read Health themselves); Android through
 * the companion app; anything can be typed in. The page compares this week with the last and
 * says what stands out — observations, not medical advice.
 */
export default function HealthPage() {
  const t = useHealthT();
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
        title={t.title}
        subtitle={isMe ? t.subtitleMine : t.subtitleTheirs(person?.name ?? '')}
      />
      <PersonSwitcher className="gutter-x mt-3 md:px-5 lg:px-8" />
      <div className="gutter-x mt-3 grid gap-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:px-8">
        <div className="flex min-w-0 flex-col gap-4">
          <EnergyPanel personId={personId} today={today} />
          <div className="flex gap-1.5" role="group" aria-label={t.range.label}>
            {RANGES.map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={range === days}
                onClick={() => setRange(days)}
                className={cx(
                  'press h-10 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors',
                  range === days
                    ? 'bg-ink-900 text-white'
                    : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-50',
                )}
              >
                {t.range[days]}
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
              <p className="font-semibold text-danger-700">{t.loadFailed}</p>
              <p className="mt-1 text-sm text-ink-600">{errorMessage(health.error)}</p>
              <Button
                size="sm"
                variant="tint"
                className="mt-3"
                onClick={() => void health.refetch()}
              >
                {t.tryAgain}
              </Button>
            </div>
          ) : !data.days.length ? (
            <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
              <InsightsIcon fontSize="inherit" className="text-[2.25rem] text-ink-400" />
              <p className="mt-2 font-semibold">{t.empty}</p>
              <p className="mt-1 text-sm text-ink-600">{t.emptyHint}</p>
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
  const t = useHealthT();
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
          const w = data.week[kind];
          const value = kind === 'weight' ? data.latest.weight?.value : w?.now;
          const before = kind === 'weight' ? null : w?.before;
          const change = value && before ? Math.round(((value - before) / before) * 100) : null;
          return (
            <div
              key={kind}
              className="min-w-0 rounded-[1.25rem] bg-white p-3.5 shadow-[var(--shadow-card)]"
            >
              <p className="text-xs font-semibold text-ink-600">{t.kind[kind]}</p>
              <p className="tabular mt-1 text-[1.375rem] font-bold leading-tight tracking-[-0.02em]">
                {value ? FORMAT[kind](value) : '—'}
              </p>
              <p className="text-xs text-ink-500">
                {kind === 'weight' && data.latest.weight
                  ? dayAndMonth(data.latest.weight.day)
                  : t.perDayThisWeek}
                {change
                  ? ` · ${formatNumber(change / 100, { style: 'percent', signDisplay: 'exceptZero' })}`
                  : ''}
              </p>
            </div>
          );
        })}
      </div>
      {series('steps').length ? (
        <Card title={t.card.steps}>
          <BarChart
            label={t.chart.steps}
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
        <Card title={t.card.sleep}>
          <BarChart
            label={t.chart.sleep}
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
          <Card title={t.card.restingHeartRate}>
            <LineChart
              label={t.card.restingHeartRate}
              format={FORMAT.restingHeartRate}
              points={series('restingHeartRate')}
            />
          </Card>
        ) : null}
        {series('weight').length > 1 ? (
          <Card title={t.card.weight}>
            <LineChart label={t.card.weight} format={FORMAT.weight} points={series('weight')} />
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
  const t = useHealthT().connect;
  const platform = useMemo(() => currentPlatform(), []);
  const [tab, setTab] = useState<'ios' | 'android'>(platform.os === 'android' ? 'android' : 'ios');
  const [key, setKey] = useState<string | null>(null);
  const url = `${window.location.origin}/api/training/health`;
  const make = useMutation({
    mutationFn: () =>
      keysApi.create({
        name: t.keyName[tab],
        scope: 'food',
      }),
    onSuccess: (res) => setKey(res.token),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const copy = async (text: string, what: 'key' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t.copied[what]);
    } catch {
      toast.error(t.copyFailed);
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
            onClick={() => void copy(key, 'key')}
          >
            {t.copy}
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
          {t.makeKey}
        </Button>
      )}
      {key ? <span className="mt-1 block text-xs text-ink-600">{t.keyOnce}</span> : null}
    </>
  );
  const slots = {
    key: keyStep,
    url: (
      <button
        type="button"
        onClick={() => void copy(url, 'url')}
        className="font-semibold text-lav-800 underline [overflow-wrap:anywhere]"
      >
        {url}
      </button>
    ),
    energyUrl: <code>{url.replace('/health', '/energy/today')}</code>,
    download: (
      <a className="font-semibold text-lav-800 underline" href="/lms-health.apk" download>
        {t.download}
      </a>
    ),
  };
  return (
    <section
      aria-labelledby="connect"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="connect" className="text-[1.0625rem] font-bold">
        {t.title}
      </h2>
      <p className="mt-0.5 text-sm text-ink-600">
        {synced
          ? t.lastSync(
              new Date(synced).toLocaleString(intlLocale(), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            )
          : t.notYet}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button type="button" className={chip(tab === 'ios')} onClick={() => setTab('ios')}>
          {t.ios}
        </button>
        <button type="button" className={chip(tab === 'android')} onClick={() => setTab('android')}>
          {t.android}
        </button>
      </div>
      {tab === 'ios' ? (
        <div className="mt-3 flex flex-col gap-3 text-sm text-ink-800">
          <p className="text-ink-600">{t.iosIntro}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {t.iosSteps.map((step) => (
              <li key={step}>{rich(step, slots)}</li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 text-sm text-ink-800">
          <p className="text-ink-600">{t.androidIntro}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {t.androidSteps.map((step) => (
              <li key={step}>{rich(step, slots)}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function TypeIn({ personId, today }: { personId: string; today: string }) {
  const t = useHealthT().typeIn;
  const { unit } = trainingT();
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
      toast.success(t.saved);
      setWeight('');
      setSleep('');
      setSteps('');
      void queryClient.invalidateQueries({ queryKey: ['training', 'health'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const field = (label: string, value: string, set: (v: string) => void, unit: string) => (
    <label className="flex min-w-0 flex-col gap-1 rounded-2xl bg-ink-50 p-3">
      <span className="truncate text-xs font-semibold text-ink-600">{label}</span>
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
        {t.title}
      </h2>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {field(t.weight, weight, setWeight, unit.kg)}
        {field(t.sleep, sleep, setSleep, unit.h)}
        {field(t.steps, steps, setSteps, '')}
      </div>
      <Button
        className="mt-3 w-full"
        variant="tint"
        loading={save.isPending}
        disabled={!num(weight) && !num(sleep) && !num(steps)}
        onClick={() => save.mutate()}
      >
        {t.save}
      </Button>
    </section>
  );
}
