import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, IconButton, Sheet, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DeleteIcon,
  PlayIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import {
  addDays,
  dayLong,
  localDate,
  relativeDay,
  relativeDayInline,
  weekdayShort,
  weekStart,
} from '@/food/format';
import { intlLocale, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { GenerateSheet } from '../components/GenerateSheet';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { duration, STATUS_LABEL } from '../format';
import { useTrainingT } from '../i18n';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { Routine, WorkoutSummary } from '../types';
import { usePlanT } from './PlanPage.i18n';

const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
function monthEnd(day: string) {
  const [y, m] = day.split('-').map(Number) as [number, number];
  return `${day.slice(0, 7)}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
}
function shiftMonth(day: string, by: number) {
  const [y, m] = day.split('-').map(Number) as [number, number];
  const date = new Date(y, m - 1 + by, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

/**
 * The training calendar. A month of days with what's planned and what was done; tap a day to see
 * its workouts and add one — made up from what's at home, from a saved routine, or built by hand.
 * "Everyone" shows the whole family's days together. iPads: the month left, the day right.
 */
export default function PlanPage() {
  const t = usePlanT();
  const today = localDate();
  const [params, setParams] = useSearchParams();
  const selected = params.get('day') ?? today;
  const [month, setMonth] = useState(monthStart(selected));
  const [everyone, setEveryone] = useState(false);
  const { personId, person, people } = usePerson();
  const who = everyone ? 'everyone' : personId;

  // The grid runs Monday to Sunday, whole weeks.
  const gridFrom = weekStart(month);
  const gridTo = addDays(weekStart(monthEnd(month)), 6);
  const workouts = useQuery({
    queryKey: trainingKeys.workouts(who, gridFrom, gridTo),
    queryFn: () => trainingApi.workouts(who, gridFrom, gridTo),
  });
  const activity = useQuery({
    queryKey: trainingKeys.stats(personId, gridFrom, gridTo),
    queryFn: () => trainingApi.stats(personId, gridFrom, gridTo, today),
    enabled: !everyone,
  });
  const select = (day: string) => {
    haptic('tap');
    setParams({ day }, { replace: true });
  };
  const days: string[] = [];
  for (let d = gridFrom; d <= gridTo; d = addDays(d, 1)) days.push(d);
  const byDay = new Map<string, WorkoutSummary[]>();
  for (const w of workouts.data ?? []) byDay.set(w.date, [...(byDay.get(w.date) ?? []), w]);
  const trained = new Set((activity.data?.days ?? []).filter((d) => d.sets > 0).map((d) => d.day));
  // The grid starts on a Monday, so its first row names the weekdays in order.
  const weekdays = days.slice(0, 7).map(weekdayShort);
  const monthName = new Intl.DateTimeFormat(intlLocale(), { month: 'long', year: 'numeric' });

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/training"
        title={t.title}
        subtitle={everyone ? t.everyone : (person?.name ?? ' ')}
      />
      <div className="gutter-x mt-3 flex flex-wrap items-center gap-2 md:px-5 lg:px-8">
        {!everyone ? <PersonSwitcher /> : null}
        {people.length > 1 ? (
          <button
            type="button"
            aria-pressed={everyone}
            onClick={() => setEveryone(!everyone)}
            className={cx(
              'press h-11 rounded-full px-4 text-sm font-semibold transition-colors',
              everyone
                ? 'bg-ink-900 text-white'
                : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-50',
            )}
          >
            {t.everyone}
          </button>
        ) : null}
      </div>

      <div className="gutter-x mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] md:items-start md:px-5 lg:grid-cols-[minmax(0,1fr)_26rem] lg:px-8">
        <section
          aria-label={t.calendar}
          className="rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] sm:p-4"
        >
          <div className="mb-2 flex items-center gap-2">
            <h2 className="min-w-0 flex-1 text-[1.125rem] leading-tight font-bold capitalize">
              {monthName.format(new Date(`${month}T12:00:00`))}
            </h2>
            {month !== monthStart(today) ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMonth(monthStart(today));
                  select(today);
                }}
              >
                {t.today}
              </Button>
            ) : null}
            <IconButton
              icon={ChevronLeftIcon}
              label={t.previousMonth}
              size="sm"
              variant="outline"
              onClick={() => setMonth(shiftMonth(month, -1))}
            />
            <IconButton
              icon={ChevronRightIcon}
              label={t.nextMonth}
              size="sm"
              variant="outline"
              onClick={() => setMonth(shiftMonth(month, 1))}
            />
          </div>
          <div
            className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-500"
            aria-hidden="true"
          >
            {weekdays.map((d) => (
              <span key={d} className="truncate py-1">
                {d}
              </span>
            ))}
          </div>
          {workouts.isPending ? (
            <Skeleton className="mt-1 h-72 rounded-2xl" />
          ) : (
            <div role="grid" aria-label={t.days} className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const list = byDay.get(day) ?? [];
                const inMonth = day.slice(0, 7) === month.slice(0, 7);
                const isSelected = day === selected;
                const isToday = day === today;
                const did = trained.has(day) || list.some((w) => w.status === 'done');
                return (
                  <button
                    key={day}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${dayLong(day)}${list.length ? `: ${list.map((w) => `${tr(w, 'title')}, ${STATUS_LABEL[w.status]}`).join('; ')}` : ''}${did ? t.trained : ''}`}
                    onClick={() => select(day)}
                    className={cx(
                      'press flex aspect-square min-h-11 flex-col items-center justify-start gap-1 rounded-xl pt-1.5 transition-colors sm:aspect-[1/0.9]',
                      isSelected
                        ? 'bg-ink-900 text-white'
                        : did
                          ? 'bg-mint-100 hover:bg-mint-200'
                          : isToday
                            ? 'bg-lav-100 hover:bg-lav-200'
                            : 'hover:bg-ink-50',
                      !inMonth && !isSelected && 'opacity-40',
                    )}
                  >
                    <span
                      className={cx('tabular text-sm', isToday ? 'font-bold' : 'font-semibold')}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <span className="flex flex-wrap justify-center gap-0.5 px-0.5">
                      {list.slice(0, 3).map((w) => (
                        <span
                          key={w.id}
                          className={cx(
                            'size-1.5 rounded-full',
                            w.status === 'done'
                              ? isSelected
                                ? 'bg-mint-200'
                                : 'bg-mint-800'
                              : w.status === 'skipped'
                                ? 'bg-ink-300'
                                : w.status === 'active'
                                  ? 'bg-butter-400'
                                  : isSelected
                                    ? 'bg-white'
                                    : 'bg-ink-900',
                          )}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-ink-600">
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-ink-900" /> {t.legend.planned}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-mint-800" /> {t.legend.done}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded bg-mint-100" /> {t.legend.trained}
            </span>
          </p>
        </section>

        <div className="flex min-w-0 flex-col gap-4 md:sticky md:top-4">
          <DayPanel
            day={selected}
            workouts={byDay.get(selected) ?? []}
            everyone={everyone}
            loading={workouts.isPending}
          />
          <Routines day={selected} />
        </div>
      </div>
    </Screen>
  );
}

function DayPanel({
  day,
  workouts,
  everyone,
  loading,
}: {
  day: string;
  workouts: WorkoutSummary[];
  everyone: boolean;
  loading: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = usePlanT();
  const { personId } = usePerson();
  const [making, setMaking] = useState(false);
  const build = useMutation({
    mutationFn: () =>
      trainingApi.createWorkout({
        userId: personId,
        date: day,
        title: t.day.myWorkout,
        items: [],
      }),
    onSuccess: (workout) => {
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      navigate(`/training/workouts/${workout.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const past = day < localDate();
  return (
    <section
      aria-labelledby="day-title"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="day-title" className="text-[1.125rem] font-bold">
        {relativeDay(day)}
      </h2>
      <p className="text-sm text-ink-600">{dayLong(day)}</p>
      {loading ? (
        <Skeleton className="mt-3 h-20 rounded-2xl" />
      ) : workouts.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <WorkoutCard workout={w} showPerson={everyone} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-2xl bg-ink-50 px-4 py-5 text-center text-sm text-ink-600">
          {past ? t.day.nothingPast : t.day.nothing}
        </p>
      )}
      {!everyone ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button variant="tint" icon={SparkleIcon} onClick={() => setMaking(true)}>
            {t.day.makeOne}
          </Button>
          <Button
            variant="soft"
            icon={AddIcon}
            loading={build.isPending}
            onClick={() => build.mutate()}
          >
            {t.day.build}
          </Button>
        </div>
      ) : null}
      <GenerateSheet open={making} onClose={() => setMaking(false)} date={day} />
    </section>
  );
}

function WorkoutCard({ workout, showPerson }: { workout: WorkoutSummary; showPerson: boolean }) {
  const navigate = useNavigate();
  const t = usePlanT();
  const tt = useTrainingT();
  const canPlay = workout.status === 'planned' || workout.status === 'active';
  return (
    <div
      className={cx(
        'flex items-center gap-3 rounded-2xl p-2.5',
        workout.status === 'done'
          ? 'bg-mint-100'
          : workout.status === 'skipped'
            ? 'bg-ink-50 opacity-70'
            : 'bg-butter-100',
      )}
    >
      <Link
        to={`/training/workouts/${workout.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-white">
          <ExerciseIcon name={workout.exercises[0]?.icon ?? 'squat'} className="size-10" />
          {showPerson ? (
            <Avatar
              person={{ id: workout.userId, name: workout.person, surname: '' }}
              size="sm"
              className="absolute -right-1.5 -bottom-1.5 size-6 text-[0.625rem]"
            />
          ) : null}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{tr(workout, 'title')}</span>
          <span className="block truncate text-sm text-ink-600">
            {STATUS_LABEL[workout.status]}
            {workout.time ? ` · ${workout.time}` : ''}
            {workout.status === 'done' && workout.durationSeconds
              ? ` · ${duration(workout.durationSeconds)}`
              : workout.status === 'active'
                ? ` · ${workout.setsDone}/${tt.sets(workout.setsPlanned)}`
                : ` · ${tt.exercises(workout.exercises.length)} · ~${duration(workout.estimatedSeconds)}`}
          </span>
        </span>
      </Link>
      {canPlay ? (
        <IconButton
          icon={PlayIcon}
          label={t.day.start(tr(workout, 'title'))}
          variant="ink"
          onClick={() => navigate(`/training/workouts/${workout.id}/play`)}
        />
      ) : null}
    </div>
  );
}

function Routines({ day }: { day: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { personId } = usePerson();
  const t = usePlanT();
  const tt = useTrainingT();
  const routines = useQuery({
    queryKey: trainingKeys.routines(personId),
    queryFn: () => trainingApi.routines(personId),
  });
  const [removing, setRemoving] = useState<Routine | null>(null);
  const plan = useMutation({
    mutationFn: (routine: Routine) =>
      trainingApi.createWorkout({ userId: personId, date: day, routineId: routine.id }),
    onSuccess: (workout) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success(t.routines.planned(tr(workout, 'title'), relativeDayInline(day)), {
        action: {
          label: t.routines.open,
          onClick: () => navigate(`/training/workouts/${workout.id}`),
        },
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => trainingApi.removeRoutine(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ['training', 'routines'] });
      toast.success(t.routines.deleted);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  if (routines.isPending) return <Skeleton className="h-24 rounded-[1.5rem]" />;
  if (!routines.data?.length) {
    return (
      <p className="rounded-[1.5rem] bg-white p-4 text-sm text-ink-600 shadow-[var(--shadow-card)]">
        <span className="block font-semibold text-ink-900">{t.routines.title}</span>
        {t.routines.empty}
      </p>
    );
  }
  return (
    <section
      aria-labelledby="routines"
      className="rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="routines" className="text-[1.0625rem] font-bold">
        {t.routines.title}
      </h2>
      <p className="text-sm text-ink-600">{t.routines.tapToPlan(relativeDayInline(day))}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {routines.data.map((r) => (
          <li key={r.id} className="flex items-center gap-2">
            <button
              type="button"
              disabled={plan.isPending}
              onClick={() => plan.mutate(r)}
              className="press flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
            >
              <span className="flex -space-x-3">
                {r.exercises.slice(0, 3).map((e, i) => (
                  <span
                    key={`${e.id}-${i}`}
                    className="grid size-10 place-items-center rounded-full bg-butter-100 ring-2 ring-white"
                  >
                    <ExerciseIcon name={e.icon} className="size-8" />
                  </span>
                ))}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{tr(r, 'name')}</span>
                <span className="block truncate text-xs text-ink-600">
                  {tt.exercises(r.exercises.length)}
                  {r.rounds > 1 ? ` · ${tt.rounds(r.rounds)}` : ''} · ~
                  {duration(r.estimatedSeconds)}
                  {r.exercises.some((e) => !e.available) ? ` · ${t.routines.needsEquipment}` : ''}
                </span>
              </span>
            </button>
            <IconButton
              icon={DeleteIcon}
              label={t.routines.deleteLabel(tr(r, 'name'))}
              size="sm"
              variant="ghost"
              onClick={() => setRemoving(r)}
            />
          </li>
        ))}
      </ul>
      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t.routines.deleteTitle(removing ? tr(removing, 'name') : '')}
        description={t.routines.deleteHint}
      >
        <Button
          variant="danger"
          size="lg"
          loading={remove.isPending}
          onClick={() => removing && remove.mutate(removing.id)}
        >
          {t.routines.delete}
        </Button>
      </Sheet>
    </section>
  );
}
