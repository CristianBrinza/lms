import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button, Sheet, Skeleton, toast } from '@/components/ui';
import { ArrowBackIcon, SearchIcon } from '@/components/ui/icons';
import { addDays, localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { Stepper } from '@/food/kitchenware/Stepper';
import { trainingApi, trainingKeys } from '../api';
import { distance as formatDistance, duration, kg, RECORD_LABEL, setLabel } from '../format';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { LibraryExercise, SetInput } from '../types';

type When = 'now' | 'earlier' | 'day';

const REP_CHIPS = [1, 5, 10, 15, 20, 30];
const SECOND_CHIPS = [15, 30, 45, 60, 90, 120];

/**
 * A set on its own, the moment it happens ("one push-up passing by") or after the fact: earlier
 * today at a time, or on another day when only the day is known. Pinned exercises come first;
 * the amount starts at the exercise's usual target. Undo sits in the toast.
 */
export function QuickLogSheet({
  open,
  onClose,
  exerciseId = null,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId?: string | null;
}) {
  const { personId, person, isMe } = usePerson();
  const exercises = useQuery({
    queryKey: trainingKeys.exercises(personId),
    queryFn: () => trainingApi.exercises(personId),
    enabled: open,
  });
  const [picked, setPicked] = useState<string | null>(exerciseId);
  // Opening again (or for another exercise) starts from what was asked for.
  const [asked, setAsked] = useState({ open, exerciseId });
  if (asked.open !== open || asked.exerciseId !== exerciseId) {
    setAsked({ open, exerciseId });
    if (open) setPicked(exerciseId);
  }
  const exercise = exercises.data?.find((e) => e.id === picked) ?? null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise ? exercise.name : 'Log a set'}
      description={
        exercise
          ? isMe
            ? 'Done just now, or earlier.'
            : `For ${person?.name ?? 'them'}.`
          : isMe
            ? 'What did you just do?'
            : `What did ${person?.name ?? 'they'} do?`
      }
    >
      {exercises.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
          <Skeleton className="h-12 rounded-2xl" />
        </div>
      ) : exercises.error ? (
        <div className="rounded-2xl bg-danger-50 p-4">
          <p className="text-sm text-danger-700">{errorMessage(exercises.error)}</p>
          <Button
            size="sm"
            variant="tint"
            className="mt-2"
            onClick={() => void exercises.refetch()}
          >
            Try again
          </Button>
        </div>
      ) : exercise ? (
        <Amount
          key={exercise.id}
          exercise={exercise}
          personId={personId}
          onBack={exerciseId ? null : () => setPicked(null)}
          onDone={onClose}
        />
      ) : (
        <Picker exercises={exercises.data ?? []} onPick={setPicked} />
      )}
    </Sheet>
  );
}

function Picker({
  exercises,
  onPick,
}: {
  exercises: LibraryExercise[];
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const pinned = exercises.filter((e) => e.pinned);
  const list = useMemo(
    () =>
      exercises
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .sort((a, b) => Number(b.available) - Number(a.available) || a.name.localeCompare(b.name))
        .slice(0, q ? 40 : 24),
    [exercises, q],
  );
  return (
    <div className="flex flex-col gap-4">
      {pinned.length && !q ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pinned.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => onPick(e.id)}
              className="press flex flex-col items-center gap-1 rounded-2xl bg-butter-100 p-3 text-center transition-colors hover:bg-butter-200"
            >
              <ExerciseIcon name={e.icon} className="size-12" />
              <span className="text-sm font-semibold leading-tight">{e.name}</span>
            </button>
          ))}
        </div>
      ) : null}
      <label className="flex h-12 items-center gap-2 rounded-2xl bg-ink-50 px-4 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <SearchIcon fontSize="inherit" className="text-[1.25rem] text-ink-500" />
        <span className="sr-only">Find an exercise</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Push-ups, plank, run…"
          className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-400"
        />
      </label>
      <ul className="flex flex-col gap-1">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e.id)}
              className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-ink-50"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-50">
                <ExerciseIcon name={e.icon} className="size-9" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{e.name}</span>
                {!e.available ? (
                  <span className="block text-xs text-ink-500">Needs equipment you don’t have</span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
        {!list.length ? (
          <li className="px-2 py-4 text-sm text-ink-600">
            Nothing called that. Add it under Exercises.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Amount({
  exercise,
  personId,
  onBack,
  onDone,
}: {
  exercise: LibraryExercise;
  personId: string;
  onBack: (() => void) | null;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const today = localDate();
  const [reps, setReps] = useState(exercise.reps ?? 10);
  const [seconds, setSeconds] = useState(exercise.seconds ?? 30);
  const [km, setKm] = useState(String((exercise.distance ?? 3000) / 1000));
  const [minutes, setMinutes] = useState('');
  const [weight, setWeight] = useState<number | null>(null);
  const [when, setWhen] = useState<When>('now');
  const [time, setTime] = useState(() =>
    new Date(Date.now() - 30 * 60_000).toTimeString().slice(0, 5),
  );
  const [day, setDay] = useState(addDays(today, -1));

  const body = (): SetInput | null => {
    const base: SetInput = {
      userId: personId,
      exerciseId: exercise.id,
      weight: exercise.weighted ? weight : null,
    };
    if (exercise.measure === 'reps') Object.assign(base, { reps });
    else if (exercise.measure === 'time') Object.assign(base, { seconds });
    else {
      const metres = Math.round(Number(km.replace(',', '.')) * 1000);
      if (!metres || metres < 0) return null;
      const mins = Number(minutes.replace(',', '.'));
      Object.assign(base, { distance: metres, seconds: mins > 0 ? Math.round(mins * 60) : null });
    }
    if (when === 'earlier') {
      const [h, m] = time.split(':').map(Number) as [number, number];
      const at = new Date();
      at.setHours(h, m, 0, 0);
      base.at = at.toISOString();
    } else if (when === 'day') base.day = day;
    return base;
  };

  const log = useMutation({
    mutationFn: (input: SetInput) => trainingApi.logSet(input),
    onSuccess: ({ set, records }) => {
      haptic(records.length ? 'success' : 'tap');
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      toast.success(`${exercise.name}: ${setLabel(set)}`, {
        description: records.length
          ? `New best · ${records.map((r) => RECORD_LABEL[r]).join(', ')}`
          : when === 'now'
            ? 'Logged just now'
            : undefined,
        action: {
          label: 'Undo',
          onClick: () =>
            void trainingApi
              .removeSet(set.id)
              .then(() => queryClient.invalidateQueries({ queryKey: trainingKeys.all })),
        },
      });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const chip = (active: boolean) =>
    cx(
      'press h-11 min-w-11 rounded-full px-3.5 text-[0.9375rem] font-semibold tabular transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-800 hover:bg-ink-100',
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Pick another exercise"
            className="press grid size-11 place-items-center rounded-full bg-ink-50 text-[1.25rem]"
          >
            <ArrowBackIcon fontSize="inherit" />
          </button>
        ) : null}
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-butter-100">
          <ExerciseIcon name={exercise.icon} className="size-12" />
        </span>
        <p className="text-sm text-ink-600">
          {exercise.unilateral ? 'Count one side; do the other the same. ' : ''}
          {exercise.measure === 'reps'
            ? 'How many?'
            : exercise.measure === 'time'
              ? 'How long?'
              : 'How far, and in how long?'}
        </p>
      </div>

      {exercise.measure === 'reps' ? (
        <>
          <Stepper label="Reps" value={reps} min={1} max={1000} onChange={setReps} />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
            {REP_CHIPS.map((n) => (
              <button key={n} type="button" className={chip(reps === n)} onClick={() => setReps(n)}>
                {n}
              </button>
            ))}
          </div>
        </>
      ) : exercise.measure === 'time' ? (
        <>
          <Stepper
            label="Time"
            value={seconds}
            min={5}
            max={3600}
            step={5}
            format={duration}
            onChange={setSeconds}
          />
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick times">
            {SECOND_CHIPS.map((n) => (
              <button
                key={n}
                type="button"
                className={chip(seconds === n)}
                onClick={() => setSeconds(n)}
              >
                {duration(n)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 rounded-2xl bg-ink-50 p-3">
            <span className="text-xs font-semibold text-ink-600">Distance, km</span>
            <input
              inputMode="decimal"
              value={km}
              onChange={(event) => setKm(event.target.value)}
              className="tabular bg-transparent text-xl font-bold outline-none"
            />
          </label>
          <label className="flex flex-col gap-1 rounded-2xl bg-ink-50 p-3">
            <span className="text-xs font-semibold text-ink-600">Time, min (optional)</span>
            <input
              inputMode="decimal"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              placeholder="—"
              className="tabular bg-transparent text-xl font-bold outline-none"
            />
          </label>
        </div>
      )}

      {exercise.weighted && exercise.weights.length ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold text-ink-700">Weight</legend>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={chip(weight === null)} onClick={() => setWeight(null)}>
              None
            </button>
            {exercise.weights.map((w) => (
              <button
                key={w.kg}
                type="button"
                className={chip(weight === w.kg)}
                onClick={() => setWeight(w.kg)}
                aria-label={`${kg(w.kg)}${w.pair ? ', a pair' : ', one'}`}
              >
                {kg(w.kg)}
                {w.pair ? <span className="ml-1 text-xs opacity-70">×2</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold text-ink-700">When</legend>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" className={chip(when === 'now')} onClick={() => setWhen('now')}>
            Just now
          </button>
          <button
            type="button"
            className={chip(when === 'earlier')}
            onClick={() => setWhen('earlier')}
          >
            Earlier today
          </button>
          <button type="button" className={chip(when === 'day')} onClick={() => setWhen('day')}>
            Another day
          </button>
        </div>
        {when === 'earlier' ? (
          <label className="mt-2 flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-2.5">
            <span className="text-sm font-semibold">At</span>
            <input
              type="time"
              value={time}
              max={new Date().toTimeString().slice(0, 5)}
              onChange={(event) => setTime(event.target.value)}
              className="tabular bg-transparent text-base font-semibold outline-none"
            />
          </label>
        ) : when === 'day' ? (
          <label className="mt-2 flex items-center justify-between rounded-2xl bg-ink-50 px-4 py-2.5">
            <span className="text-sm font-semibold">On</span>
            <input
              type="date"
              value={day}
              max={today}
              onChange={(event) => setDay(event.target.value)}
              className="tabular bg-transparent text-base font-semibold outline-none"
            />
          </label>
        ) : null}
      </fieldset>

      <Button
        size="lg"
        loading={log.isPending}
        onClick={() => {
          const input = body();
          if (!input) return toast.error('Enter how far');
          log.mutate(input);
        }}
      >
        Log{' '}
        {exercise.measure === 'reps'
          ? `${reps} ${reps === 1 ? 'rep' : 'reps'}`
          : exercise.measure === 'time'
            ? duration(seconds)
            : formatDistance(Math.round(Number(km.replace(',', '.')) * 1000) || 0)}
      </Button>
    </div>
  );
}
