import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, IconButton, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CloseIcon,
  FireIcon,
  InsightsIcon,
  PlayIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import {
  dayAndMonth,
  localDate,
  relativeDay,
  relativeDayInline,
  weekdayShort,
} from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { trainingApi, trainingKeys } from '../api';
import { GenerateSheet } from '../components/GenerateSheet';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { QuickLogSheet } from '../components/QuickLogSheet';
import { distance, duration, setLabel } from '../format';
import { EquipmentIcon, ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { Pin, TrainingOverview, WorkoutSummary } from '../types';

/**
 * Training's front door, for whoever is chosen: today's workout with one big Start, the exercises
 * kept at hand for a set in passing, the week at a glance, the streak, and the way to everything
 * else. Phones: one column. iPads: today and the week on the left, the rest on the right.
 */
export default function TrainingHomePage() {
  const today = localDate();
  const { personId, person, isMe } = usePerson();
  const overview = useQuery({
    queryKey: trainingKeys.overview(personId, today),
    queryFn: () => trainingApi.overview(personId, today),
  });
  const [logging, setLogging] = useState<{ open: boolean; exerciseId: string | null }>({
    open: false,
    exerciseId: null,
  });
  const [making, setMaking] = useState(false);
  const data = overview.data;

  return (
    <Screen tone="field">
      <PageHeader
        compact
        back="/home"
        title="Training"
        subtitle={isMe ? 'Home workouts' : `${person?.name ?? ''}’s training`}
        actions={
          <IconButton
            icon={AddIcon}
            label="Log a set"
            variant="ink"
            size="sm"
            onClick={() => setLogging({ open: true, exerciseId: null })}
          />
        }
      />
      <PersonSwitcher className="gutter-x mt-3 md:px-5 lg:px-8" />

      {overview.isPending ? (
        <div className="gutter-x mt-3 grid gap-3 md:grid-cols-2 md:px-5 lg:px-8">
          <Skeleton className="h-48 rounded-[1.75rem]" />
          <Skeleton className="h-48 rounded-[1.75rem]" />
        </div>
      ) : overview.error || !data ? (
        <div className="gutter-x mt-3 md:px-5 lg:px-8">
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load training</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(overview.error)}</p>
            <Button
              size="sm"
              variant="tint"
              className="mt-3"
              onClick={() => void overview.refetch()}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <div className="gutter-x mt-3 grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-4 md:px-5 lg:px-8">
          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            <TodayCard data={data} onMake={() => setMaking(true)} />
            <QuickLog
              pins={data.pins}
              onLog={(exerciseId) => setLogging({ open: true, exerciseId })}
            />
            <Week data={data} />
          </div>
          <div className="flex min-w-0 flex-col gap-3 md:gap-4">
            <StreakCard data={data} />
            <Sections equipment={data.equipment} />
            <LoggedToday data={data} />
          </div>
        </div>
      )}

      <QuickLogSheet
        open={logging.open}
        exerciseId={logging.exerciseId}
        onClose={() => setLogging((s) => ({ ...s, open: false }))}
      />
      <GenerateSheet open={making} onClose={() => setMaking(false)} date={today} />
    </Screen>
  );
}

// ---------------------------------------------------------------- today

function TodayCard({ data, onMake }: { data: TrainingOverview; onMake: () => void }) {
  const navigate = useNavigate();
  const todays = data.todays.filter((w) => w.status !== 'skipped');
  return (
    <section
      aria-labelledby="today"
      className="animate-deal relative overflow-hidden rounded-[1.75rem] bg-ink-900 p-4 text-white shadow-[var(--shadow-tile)] sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="today" className="text-[1.125rem] font-bold tracking-[-0.02em]">
          Today
        </h2>
        <span className="text-sm text-white/70">
          {relativeDay(data.today) === 'Today' ? dayAndMonth(data.today) : relativeDay(data.today)}
        </span>
      </div>
      {todays.length ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          {todays.map((w) => (
            <li key={w.id}>
              <TodayWorkout
                workout={w}
                onPlay={() => navigate(`/training/workouts/${w.id}/play`)}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3">
          <p className="text-[1.375rem] font-bold leading-tight tracking-[-0.02em]">
            Nothing planned
          </p>
          <p className="mt-1 text-sm text-white/70">
            {data.next
              ? `Next: ${data.next.title}, ${relativeDayInline(data.next.date)}.`
              : 'Make one up from what’s at home, or plan the week.'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" icon={SparkleIcon} onClick={onMake}>
              Make one up
            </Button>
            <ButtonLink
              to="/training/plan"
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/15"
            >
              Plan
            </ButtonLink>
          </div>
        </div>
      )}
      {todays.length && data.next ? (
        <Link
          to={`/training/workouts/${data.next.id}`}
          className="mt-3 flex items-center gap-2 text-sm text-white/70 hover:text-white"
        >
          Next: {data.next.title}, {relativeDayInline(data.next.date)}
          <ChevronRightIcon fontSize="inherit" className="text-[1.1rem]" />
        </Link>
      ) : null}
    </section>
  );
}

function TodayWorkout({ workout, onPlay }: { workout: WorkoutSummary; onPlay: () => void }) {
  const done = workout.status === 'done';
  return (
    <div className="flex items-center gap-3 rounded-[1.25rem] bg-white/8 p-3">
      <Link
        to={`/training/workouts/${workout.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white">
          <ExerciseIcon name={workout.exercises[0]?.icon ?? 'squat'} className="size-11" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[1.0625rem] font-bold">{workout.title}</span>
          <span className="block text-sm text-white/70">
            {done
              ? `Done${workout.durationSeconds ? ` · ${duration(workout.durationSeconds)}` : ''} · ${workout.setsDone} sets`
              : workout.status === 'active'
                ? `${workout.setsDone} of ${workout.setsPlanned} sets done`
                : `${workout.exercises.length} exercises · about ${duration(workout.estimatedSeconds)}${workout.time ? ` · ${workout.time}` : ''}`}
          </span>
          {workout.missing.length && !done ? (
            <span className="block text-xs text-peach-200">Needs equipment that isn’t at home</span>
          ) : null}
        </span>
      </Link>
      {done ? (
        <CheckCircleIcon
          fontSize="inherit"
          className="shrink-0 text-[2rem] text-mint-200"
          aria-label="Done"
        />
      ) : (
        <button
          type="button"
          onClick={onPlay}
          aria-label={
            workout.status === 'active' ? `Continue ${workout.title}` : `Start ${workout.title}`
          }
          className="press grid size-14 shrink-0 place-items-center rounded-full bg-butter-300 text-[2rem] text-ink-900 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.55)]"
        >
          <PlayIcon fontSize="inherit" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- a set in passing

function QuickLog({ pins, onLog }: { pins: Pin[]; onLog: (exerciseId: string | null) => void }) {
  return (
    <section
      aria-labelledby="quick"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="quick" className="text-[1.0625rem] font-bold">
          Log a set
        </h2>
        <Link
          to="/training/exercises"
          className="text-sm font-semibold text-ink-600 hover:text-ink-900"
        >
          Pin more
        </Link>
      </div>
      {pins.length ? (
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {pins.map((pin) => (
            <button
              key={pin.id}
              type="button"
              onClick={() => onLog(pin.id)}
              className="press flex w-[6.5rem] shrink-0 flex-col items-center gap-1 rounded-2xl bg-butter-100 px-2 py-3 text-center transition-colors hover:bg-butter-200"
            >
              <ExerciseIcon name={pin.icon} className="size-11" />
              <span className="line-clamp-2 text-sm font-semibold leading-tight">{pin.name}</span>
              <span className="tabular text-xs text-butter-800">
                {pin.today
                  ? `${pin.measure === 'time' ? duration(pin.today) : pin.today} today`
                  : 'Tap to log'}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onLog(null)}
            className="press flex w-[6.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-ink-50 px-2 py-3 text-center text-ink-700 hover:bg-ink-100"
          >
            <AddIcon fontSize="inherit" className="text-[1.75rem]" />
            <span className="text-sm font-semibold">Something else</span>
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-600">
            Pin the exercises you do often to log a set in one tap.
          </p>
          <Button size="sm" variant="tint" icon={AddIcon} onClick={() => onLog(null)}>
            Log a set
          </Button>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- the week

function Week({ data }: { data: TrainingOverview }) {
  return (
    <section
      aria-labelledby="week"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="week" className="text-[1.0625rem] font-bold">
          This week
        </h2>
        <Link to="/training/plan" className="text-sm font-semibold text-ink-600 hover:text-ink-900">
          Plan
        </Link>
      </div>
      <ol className="mt-3 grid grid-cols-7 gap-1">
        {data.week.map((d) => {
          const isToday = d.day === data.today;
          const done = d.workouts.some((w) => w.status === 'done') || d.sets > 0;
          const planned = d.workouts.some((w) => w.status === 'planned' || w.status === 'active');
          const past = d.day < data.today;
          return (
            <li key={d.day}>
              <Link
                to={`/training/plan?day=${d.day}`}
                aria-label={`${relativeDay(d.day)}: ${done ? 'trained' : planned ? 'planned' : past ? 'rest' : 'nothing yet'}`}
                className={cx(
                  'press flex flex-col items-center gap-1.5 rounded-2xl py-2 transition-colors hover:bg-ink-50',
                  isToday && 'bg-lav-100',
                )}
              >
                <span
                  className={cx('text-xs font-semibold', isToday ? 'text-ink-900' : 'text-ink-500')}
                >
                  {weekdayShort(d.day).slice(0, 2)}
                </span>
                <span
                  className={cx(
                    'grid size-9 place-items-center rounded-full text-sm font-bold tabular',
                    done
                      ? 'bg-mint-200 text-ink-900'
                      : planned
                        ? 'bg-white text-ink-900 ring-2 ring-inset ring-ink-900'
                        : 'bg-ink-50 text-ink-400',
                  )}
                >
                  {done ? <CheckIcon /> : Number(d.day.slice(8))}
                </span>
                <span className="tabular h-4 text-[0.6875rem] text-ink-500">
                  {d.minutes
                    ? `${d.minutes}′`
                    : d.sets
                      ? `${d.sets} ${d.sets === 1 ? 'set' : 'sets'}`
                      : ''}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

const CheckIcon = () => <CheckCircleIcon fontSize="inherit" className="text-[1.25rem]" />;

function StreakCard({ data }: { data: TrainingOverview }) {
  const t = data.totals;
  return (
    <section aria-label="This week in numbers" className="grid grid-cols-2 gap-2.5">
      <div className="flex flex-col justify-between rounded-[1.5rem] bg-butter-300 p-4 shadow-[0_18px_34px_-22px_rgb(110_80_0/0.7)]">
        <FireIcon fontSize="inherit" className="text-[1.75rem]" />
        <div className="mt-3">
          <p className="tabular text-[2rem] font-bold leading-none tracking-[-0.03em]">
            {data.streak.current}
          </p>
          <p className="mt-1 text-sm font-semibold text-butter-800">
            {data.streak.current === 1 ? 'day in a row' : 'days in a row'}
          </p>
          <p className="text-xs text-butter-800">
            Best {data.streak.best} · {data.streak.weeks}{' '}
            {data.streak.weeks === 1 ? 'week' : 'weeks'} running
          </p>
        </div>
      </div>
      <Link
        to="/training/progress"
        className="press flex flex-col justify-between rounded-[1.5rem] bg-cyan-200 p-4 shadow-[0_18px_34px_-22px_rgb(20_94_112/0.6)]"
      >
        <InsightsIcon fontSize="inherit" className="text-[1.75rem]" />
        <dl className="mt-3 grid gap-0.5 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-cyan-800">Workouts</dt>
            <dd className="tabular font-bold">{t.workouts}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-cyan-800">Minutes</dt>
            <dd className="tabular font-bold">{t.minutes}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-cyan-800">Sets</dt>
            <dd className="tabular font-bold">{t.sets}</dd>
          </div>
          {t.distance ? (
            <div className="flex justify-between gap-2">
              <dt className="text-cyan-800">Distance</dt>
              <dd className="tabular font-bold">{distance(t.distance)}</dd>
            </div>
          ) : null}
        </dl>
      </Link>
    </section>
  );
}

function Sections({ equipment }: { equipment: number }) {
  const rows = [
    {
      to: '/training/plan',
      title: 'Plan',
      detail: 'Days, workouts, saved routines',
      icon: <CalendarIcon fontSize="inherit" className="text-[1.6rem]" />,
    },
    {
      to: '/training/exercises',
      title: 'Exercises',
      detail: 'What you can do at home',
      icon: <ExerciseIcon name="push-up" className="size-9" />,
    },
    {
      to: '/training/equipment',
      title: 'Equipment',
      detail: equipment
        ? `${equipment} ${equipment === 1 ? 'thing' : 'things'} at home`
        : 'Say what you have at home',
      icon: <EquipmentIcon name="dumbbells" className="size-9" />,
    },
    {
      to: '/training/health',
      title: 'Health and energy',
      detail: 'Eaten, burned, steps, sleep, weight',
      icon: <FireIcon fontSize="inherit" className="text-[1.6rem]" />,
    },
    {
      to: '/training/progress',
      title: 'Progress',
      detail: 'Bests, streaks, muscles',
      icon: <InsightsIcon fontSize="inherit" className="text-[1.6rem]" />,
    },
  ];
  return (
    <nav
      aria-label="Training"
      className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]"
    >
      <ul className="divide-y divide-ink-100">
        {rows.map((row) => (
          <li key={row.to}>
            <Link
              to={row.to}
              viewTransition
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-lav-50"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-50 text-ink-800">
                {row.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{row.title}</span>
                <span className="block truncate text-sm text-ink-600">{row.detail}</span>
              </span>
              <ChevronRightIcon fontSize="inherit" className="text-[1.3rem] text-ink-400" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function LoggedToday({ data }: { data: TrainingOverview }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => trainingApi.removeSet(id),
    onSuccess: () => {
      toast.success('Set removed');
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const loose = data.loggedToday.filter((s) => !s.workoutId);
  if (!loose.length) return null;
  return (
    <section
      aria-labelledby="logged"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="logged" className="text-[1.0625rem] font-bold">
        Logged today
      </h2>
      <ul className="mt-2 flex flex-col">
        {loose.slice(0, 8).map((s) => (
          <li key={s.id} className="flex items-center gap-3 py-1.5">
            <ExerciseIcon name={s.icon} className="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-semibold">{s.exercise}</span>
              <span className="block text-xs text-ink-600">
                {setLabel(s)} ·{' '}
                {s.timeKnown ? new Date(s.performedAt).toTimeString().slice(0, 5) : 'today'}
              </span>
            </span>
            <IconButton
              icon={CloseIcon}
              label={`Remove ${s.exercise}, ${setLabel(s)}`}
              size="sm"
              variant="ghost"
              disabled={remove.isPending}
              onClick={() => remove.mutate(s.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
