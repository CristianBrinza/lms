import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, Switch, toast } from '@/components/ui';
import { dayAndMonth, localDate, relativeDayInline } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { duration, FOCUS_LABEL, LEVEL_LABEL } from '../format';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { Focus, Generated } from '../types';

const MINUTES = [10, 20, 30, 45];
const FOCUSES = Object.keys(FOCUS_LABEL) as Focus[];

/**
 * A workout made up from what's at home: how long, what for, how hard, quiet or not. Shows what it
 * came up with (shuffle for another), then plans it on the day — or starts it right away.
 */
export function GenerateSheet({
  open,
  onClose,
  date,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { personId, person, isMe } = usePerson();
  const [minutes, setMinutes] = useState(20);
  const [focus, setFocus] = useState<Focus>('full');
  const [level, setLevel] = useState(1);
  const [quiet, setQuiet] = useState(false);
  const [circuit, setCircuit] = useState(false);
  const [result, setResult] = useState<Generated | null>(null);

  const make = useMutation({
    mutationFn: () =>
      trainingApi.generate({
        userId: personId,
        minutes,
        focus,
        level,
        quiet,
        style: circuit ? 'circuit' : 'sets',
      }),
    onSuccess: (workout) => {
      haptic('tap');
      setResult(workout);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const plan = useMutation({
    mutationFn: (start: boolean) =>
      trainingApi
        .createWorkout({
          userId: personId,
          date,
          title: result!.title,
          items: result!.items,
          rounds: result!.rounds,
          roundRest: result!.roundRest,
        })
        .then((workout) => ({ workout, start })),
    onSuccess: ({ workout, start }) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      setResult(null);
      onClose();
      if (start) navigate(`/training/workouts/${workout.id}/play`);
      else
        toast.success(`Planned for ${relativeDayInline(date)}`, {
          description: workout.title,
        });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const chip = (active: boolean) =>
    cx(
      'press h-11 rounded-full px-4 text-[0.9375rem] font-semibold transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-800 hover:bg-ink-100',
    );
  const isToday = date === localDate();

  return (
    <Sheet
      open={open}
      onClose={() => {
        setResult(null);
        onClose();
      }}
      title="Make up a workout"
      description={`From what’s at home${isMe ? '' : `, for ${person?.name ?? 'them'}`} · ${isToday ? 'today' : dayAndMonth(date)}`}
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-butter-100 px-4 py-3">
            <p className="font-bold">{result.title}</p>
            <p className="text-sm text-butter-800">
              About {duration(result.estimatedSeconds)}
              {result.rounds > 1 ? ` · ${result.rounds} rounds` : ''} · {result.items.length}{' '}
              exercises
            </p>
          </div>
          <ol className="flex flex-col gap-1.5">
            {result.items.map((item, index) => {
              const e = result.exercises[index]!;
              return (
                <li
                  key={`${item.exerciseId}-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
                    <ExerciseIcon name={e.icon} className="size-9" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{e.name}</span>
                    <span className="block text-xs text-ink-600">
                      {item.block && item.block !== 'main'
                        ? `${item.block === 'warmup' ? 'Warm-up' : 'Cool-down'} · `
                        : ''}
                      {item.sets > 1 ? `${item.sets} × ` : ''}
                      {item.reps ? `${item.reps} reps` : item.seconds ? duration(item.seconds) : ''}
                      {item.weight ? ` · ${item.weight} kg` : ''}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="soft" loading={make.isPending} onClick={() => make.mutate()}>
              Try another
            </Button>
            <Button
              variant="tint"
              loading={plan.isPending && plan.variables === false}
              disabled={plan.isPending}
              onClick={() => plan.mutate(false)}
            >
              Plan it
            </Button>
          </div>
          {isToday ? (
            <Button
              size="lg"
              loading={plan.isPending && plan.variables === true}
              disabled={plan.isPending}
              onClick={() => plan.mutate(true)}
            >
              Start now
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink-700">How long</legend>
            <div className="flex flex-wrap gap-1.5">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={minutes === m}
                  className={chip(minutes === m)}
                  onClick={() => setMinutes(m)}
                >
                  {m} min
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink-700">What for</legend>
            <div className="flex flex-wrap gap-1.5">
              {FOCUSES.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={focus === f}
                  className={chip(focus === f)}
                  onClick={() => setFocus(f)}
                >
                  {FOCUS_LABEL[f]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink-700">How hard</legend>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3].map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={level === l}
                  className={chip(level === l)}
                  onClick={() => setLevel(l)}
                >
                  {LEVEL_LABEL[l]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col divide-y divide-ink-100 rounded-2xl bg-ink-50 px-4">
            <Switch
              checked={quiet}
              onChange={setQuiet}
              label="Quiet"
              hint="Leaves out jumping exercises"
              className="py-3"
            />
            <Switch
              checked={circuit}
              onChange={setCircuit}
              label="Circuit"
              hint="Rounds through every exercise instead of sets in a row"
              className="py-3"
            />
          </div>
          <Button size="lg" loading={make.isPending} onClick={() => make.mutate()}>
            Create workout
          </Button>
        </div>
      )}
    </Sheet>
  );
}
