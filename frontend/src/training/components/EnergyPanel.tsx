import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui';
import { addDays, weekdayShort } from '@/food/format';
import { cx } from '@/lib/cx';
import { trainingApi, trainingKeys } from '../api';
import type { EnergyDay, EnergySummary } from '../types';

const kcal = (n: number) => `${Math.round(n).toLocaleString('en').replace(/,/g, ' ')} kcal`;

/**
 * Energy in and out for one person: today eaten against the goal's target, what the day burned
 * and where that number comes from, protein / fat / carbs, and the week's balance. Plain numbers;
 * the formulas are named, not hidden.
 */
export function EnergyPanel({ personId, today }: { personId: string; today: string }) {
  const from = addDays(today, -6);
  const energy = useQuery({
    queryKey: trainingKeys.energy(personId, from, today),
    queryFn: () => trainingApi.energy(personId, from, today, today),
  });
  if (energy.isPending) return <Skeleton className="h-64 rounded-[1.5rem]" />;
  if (!energy.data) return null;
  const e = energy.data;
  const day = e.days.find((d) => d.day === today) ?? null;
  return (
    <section aria-labelledby="energy" className="flex flex-col gap-3">
      <h2 id="energy" className="sr-only">
        Energy
      </h2>
      <Today e={e} day={day} />
      <Macros e={e} day={day} />
      <Week days={e.days} today={today} />
      {e.insights.length ? (
        <ul className="flex flex-col gap-1.5">
          {e.insights.map((i) => (
            <li
              key={i.text}
              className={cx(
                'rounded-2xl px-4 py-2.5 text-sm',
                i.tone === 'good'
                  ? 'bg-mint-100'
                  : i.tone === 'watch'
                    ? 'bg-peach-100'
                    : 'bg-lav-100',
              )}
            >
              {i.text}
            </li>
          ))}
        </ul>
      ) : null}
      {e.person.bmr === null ? (
        <p className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-700 shadow-[var(--shadow-card)]">
          Rest energy is a rough guess until the profile has height, birth date and sex.{' '}
          <Link to="/profile" className="font-semibold text-lav-800 underline">
            Add them
          </Link>
        </p>
      ) : null}
    </section>
  );
}

function Today({ e, day }: { e: EnergySummary; day: EnergyDay | null }) {
  const eaten = day?.eaten?.kcal ?? 0;
  const target = e.target.kcal;
  const share = Math.min(1, eaten / Math.max(1, target));
  const over = eaten > target;
  return (
    <div className="rounded-[1.5rem] bg-ink-900 p-4 text-white shadow-[var(--shadow-tile)] sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-white/70">Eaten today</p>
        <p className="text-sm text-white/70">Target {kcal(target)}</p>
      </div>
      <p className="tabular mt-1 text-[2.25rem] font-bold leading-none tracking-[-0.03em]">
        {kcal(eaten)}
      </p>
      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={eaten}
        aria-label="Eaten of target"
      >
        <div
          className={cx('h-full rounded-full', over ? 'bg-peach-200' : 'bg-butter-300')}
          style={{ width: `${Math.max(2, share * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-white/70">
        {over ? `${kcal(eaten - target)} over` : `${kcal(target - eaten)} left`} · {e.target.why}
      </p>
      {day ? (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-sm">
          <div>
            <dt className="text-white/60">At rest</dt>
            <dd className="tabular font-semibold">{kcal(day.burned.resting)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Moving</dt>
            <dd className="tabular font-semibold">{kcal(day.burned.active)}</dd>
          </div>
          <div>
            <dt className="text-white/60">Training</dt>
            <dd className="tabular font-semibold">{kcal(day.burned.training)}</dd>
          </div>
        </dl>
      ) : null}
      <p className="mt-2 text-xs text-white/50">
        {day?.burned.source === 'phone'
          ? 'Rest and moving from the phone; training from the sets logged here.'
          : 'Rest by Mifflin–St Jeor, moving by your usual day, training by the Compendium of Physical Activities.'}
        {e.burn.measured !== null
          ? ` Measured from meals and weight: ${kcal(e.burn.measured)} a day.`
          : ''}
      </p>
    </div>
  );
}

function Macros({ e, day }: { e: EnergySummary; day: EnergyDay | null }) {
  const rows: Array<[string, number, number]> = [
    ['Protein', day?.eaten?.protein ?? 0, e.target.protein],
    ['Fat', day?.eaten?.fat ?? 0, e.target.fat],
    ['Carbs', day?.eaten?.carbs ?? 0, e.target.carbs],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {rows.map(([label, value, target]) => (
        <div key={label} className="rounded-[1.25rem] bg-white p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold text-ink-600">{label}</p>
          <p className="tabular mt-0.5 text-lg font-bold">
            {Math.round(value)}
            <span className="text-sm font-semibold text-ink-500"> / {target} g</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className={cx(
                'h-full rounded-full',
                label === 'Protein'
                  ? 'bg-lav-500'
                  : label === 'Fat'
                    ? 'bg-butter-400'
                    : 'bg-cyan-400',
              )}
              style={{ width: `${Math.min(100, (value / Math.max(1, target)) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Week({ days, today }: { days: EnergyDay[]; today: string }) {
  const max = Math.max(1, ...days.flatMap((d) => [d.eaten?.kcal ?? 0, d.burned.total]));
  return (
    <div className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-baseline justify-between">
        <p className="text-[1.0625rem] font-bold">This week</p>
        <p className="flex gap-3 text-xs text-ink-600">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-butter-400" /> eaten
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-ink-300" /> burned
          </span>
        </p>
      </div>
      <ol
        className="mt-3 grid grid-cols-7 items-end gap-1.5"
        aria-label="Eaten and burned each day"
      >
        {days.map((d) => (
          <li
            key={d.day}
            className="flex flex-col items-center gap-1"
            aria-label={`${weekdayShort(d.day)}: eaten ${d.eaten ? kcal(d.eaten.kcal) : 'not logged'}, burned ${kcal(d.burned.total)}`}
          >
            <div className="flex h-24 items-end gap-0.5">
              <div
                className="w-2.5 rounded-t bg-butter-400"
                style={{ height: `${((d.eaten?.kcal ?? 0) / max) * 100}%` }}
              />
              <div
                className="w-2.5 rounded-t bg-ink-300"
                style={{ height: `${(d.burned.total / max) * 100}%` }}
              />
            </div>
            <span
              className={cx(
                'text-[0.6875rem] font-semibold',
                d.day === today ? 'text-ink-900' : 'text-ink-500',
              )}
            >
              {weekdayShort(d.day).slice(0, 2)}
            </span>
            <span
              className={cx(
                'tabular text-[0.625rem]',
                d.balance === null
                  ? 'text-ink-400'
                  : d.balance < 0
                    ? 'text-mint-800'
                    : 'text-peach-800',
              )}
            >
              {d.balance === null ? '—' : `${d.balance > 0 ? '+' : ''}${d.balance}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
