import PushPinIcon from '@mui/icons-material/PushPinRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button, IconButton, Sheet, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  CheckCircleIcon,
  CloseIcon,
  EditIcon,
  VisibilityIcon,
  VisibilityOffIcon,
} from '@/components/ui/icons';
import { dayAndMonth, relativeDay, localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { LineChart } from '../components/charts';
import { QuickLogSheet } from '../components/QuickLogSheet';
import {
  CATEGORY_LABEL,
  distance,
  duration,
  kg,
  LEVEL_LABEL,
  MUSCLE_LABEL,
  pace,
  RECORD_LABEL,
  setLabel,
  target,
} from '../format';
import { EquipmentIcon, ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { Equipment, EquipmentPreset, ExerciseHistory, LibraryExercise } from '../types';
import { ExerciseEditorSheet } from './ExerciseEditorSheet';

/**
 * One exercise: its picture, what it works and needs, how to do it, and the chosen person's
 * bests and recent days, with logging a set, pinning, editing and hiding at hand. The same body
 * fills the phone's sheet and the tablet's panel beside the library.
 */

export function ExerciseSheet({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null;
  onClose: () => void;
}) {
  const { personId } = usePerson();
  const detail = useQuery({
    queryKey: trainingKeys.exercise(exerciseId ?? '', personId),
    queryFn: () => trainingApi.exercise(exerciseId!, personId),
    enabled: Boolean(exerciseId),
  });
  return (
    <Sheet
      open={Boolean(exerciseId)}
      onClose={onClose}
      title={detail.data?.exercise.name ?? 'Exercise'}
      size="lg"
    >
      {exerciseId ? <ExerciseDetail exerciseId={exerciseId} /> : null}
    </Sheet>
  );
}

/** Beside the list on tablets and wider. */
export function ExercisePanel({
  exerciseId,
  onClose,
}: {
  exerciseId: string;
  onClose: () => void;
}) {
  const { personId } = usePerson();
  const detail = useQuery({
    queryKey: trainingKeys.exercise(exerciseId, personId),
    queryFn: () => trainingApi.exercise(exerciseId, personId),
  });
  return (
    <section
      aria-label={detail.data?.exercise.name ?? 'Exercise'}
      className="animate-fade-in rounded-[1.75rem] bg-white p-5 shadow-[var(--shadow-card)]"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <h2 className="min-w-0 text-h2 font-bold">{detail.data?.exercise.name ?? ' '}</h2>
        <IconButton icon={CloseIcon} label="Close" size="sm" variant="outline" onClick={onClose} />
      </header>
      <ExerciseDetail exerciseId={exerciseId} />
    </section>
  );
}

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const queryClient = useQueryClient();
  const { personId, person, isMe } = usePerson();
  const detail = useQuery({
    queryKey: trainingKeys.exercise(exerciseId, personId),
    queryFn: () => trainingApi.exercise(exerciseId, personId),
  });
  const equipment = useQuery({ queryKey: trainingKeys.equipment, queryFn: trainingApi.equipment });
  const [logging, setLogging] = useState(false);
  const [editing, setEditing] = useState(false);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: trainingKeys.all });

  const pin = useMutation({
    mutationFn: (pinned: boolean) => trainingApi.pin(exerciseId, pinned, personId),
    onMutate: (pinned) => {
      haptic('tap');
      queryClient.setQueryData<ExerciseHistory>(
        trainingKeys.exercise(exerciseId, personId),
        (old) => (old ? { ...old, exercise: { ...old.exercise, pinned } } : old),
      );
      queryClient.setQueryData<LibraryExercise[]>(trainingKeys.exercises(personId), (old) =>
        old?.map((e) => (e.id === exerciseId ? { ...e, pinned } : e)),
      );
    },
    onSuccess: (_, pinned) =>
      toast.success(pinned ? 'Pinned' : 'Unpinned', {
        description: pinned ? 'Kept at hand for quick logging' : undefined,
      }),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: refresh,
  });

  const archive = useMutation({
    mutationFn: (archived: boolean) => trainingApi.updateExercise(exerciseId, { archived }),
    onSuccess: (saved, archived) => {
      haptic('success');
      refresh();
      toast.success(archived ? `${saved.name} hidden` : `${saved.name} is back`, {
        description: archived ? 'It leaves the library and generated workouts' : undefined,
        action: archived
          ? {
              label: 'Undo',
              onClick: () =>
                void trainingApi.updateExercise(exerciseId, { archived: false }).then(refresh),
            }
          : undefined,
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (detail.isPending)
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="flex gap-4">
          <Skeleton className="size-28 shrink-0 rounded-[1.75rem]" />
          <div className="flex flex-1 flex-col gap-2 pt-1">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-12 rounded-pill" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  if (detail.error)
    return (
      <div className="rounded-2xl bg-danger-50 p-4">
        <p className="font-semibold text-danger-700">Couldn’t load this exercise</p>
        <p className="mt-1 text-sm text-ink-600">{errorMessage(detail.error)}</p>
        <Button size="sm" variant="tint" className="mt-3" onClick={() => void detail.refetch()}>
          Try again
        </Button>
      </div>
    );

  const { exercise, bests, days } = detail.data;
  const presets = equipment.data?.presets ?? [];
  const owned = equipment.data?.equipment ?? [];
  const pinned = pin.isPending && pin.variables !== undefined ? pin.variables : exercise.pinned;
  const whose = isMe ? 'Your' : `${person?.name ?? 'Their'}’s`;

  return (
    <div className="flex flex-col gap-5">
      {/* The picture and what kind of exercise it is. */}
      <div className="flex items-start gap-4">
        <span className="grid size-28 shrink-0 place-items-center rounded-[1.75rem] bg-butter-100 sm:size-32">
          <ExerciseIcon name={exercise.icon} className="size-24 sm:size-28" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="lav">{CATEGORY_LABEL[exercise.category]}</Pill>
            <Pill tone="muted">
              <LevelDots level={exercise.level} />
              {LEVEL_LABEL[exercise.level] ?? ''}
            </Pill>
            {exercise.archived ? <Pill tone="muted">Hidden</Pill> : null}
          </div>
          <p
            className={cx(
              'text-sm font-semibold',
              exercise.impact === 'high' ? 'text-peach-800' : 'text-mint-800',
            )}
          >
            {exercise.impact === 'high' ? 'Jumps — loud for neighbours' : 'Quiet — fine for a flat'}
          </p>
          <p className="tabular text-sm text-ink-600">
            {target(exercise, exercise.measure)}
            {exercise.unilateral ? ' each side' : ''}
            {exercise.rest ? ` · rest ${duration(exercise.rest)}` : ''}
          </p>
          {!exercise.available ? (
            <p className="text-sm font-semibold text-peach-800">Not possible with what’s at home</p>
          ) : null}
        </div>
      </div>

      {/* What to do with it. */}
      <div className="grid grid-cols-2 gap-2">
        <Button size="md" icon={AddIcon} onClick={() => setLogging(true)} className="col-span-2">
          Log a set
        </Button>
        <button
          type="button"
          aria-pressed={pinned}
          onClick={() => pin.mutate(!pinned)}
          title={
            pinned
              ? 'Kept at hand for quick logging. Tap to unpin'
              : 'Keep at hand for quick logging'
          }
          className={cx(
            'press inline-flex h-12 min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-4 text-[0.9375rem] font-semibold transition-colors',
            pinned
              ? 'bg-butter-300 text-ink-900 hover:bg-butter-400'
              : 'bg-lav-100 text-ink-900 hover:bg-lav-200',
          )}
        >
          <PushPinIcon
            fontSize="inherit"
            className={cx('text-[1.3rem]', !pinned && 'text-ink-500')}
          />
          {pinned ? 'Pinned' : 'Pin'}
        </button>
        <Button
          size="md"
          variant="outline"
          icon={EditIcon}
          aria-label={`Edit ${exercise.name}`}
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
      </div>
      {!isMe ? (
        <p className="-mt-3 text-[0.8125rem] font-medium text-ink-500">
          Pins, bests and sets are {person?.name ?? 'their'}’s.
        </p>
      ) : null}

      <Section title="Muscles">
        <div className="flex flex-wrap gap-1.5">
          {exercise.muscles.map((m) => (
            <Pill key={m} tone="ink">
              {MUSCLE_LABEL[m]}
            </Pill>
          ))}
          {exercise.secondary.map((m) => (
            <Pill key={m} tone="muted">
              {MUSCLE_LABEL[m]}
            </Pill>
          ))}
          {!exercise.muscles.length && !exercise.secondary.length ? (
            <span className="text-sm text-ink-600">Not set</span>
          ) : null}
        </div>
        {exercise.secondary.length && exercise.muscles.length ? (
          <p className="mt-1.5 text-xs font-medium text-ink-500">
            Dark: works it most · light: helps
          </p>
        ) : null}
      </Section>

      <Section title="Equipment">
        <EquipmentNeeds
          needs={exercise.equipment}
          uses={exercise.uses}
          presets={presets}
          owned={owned}
        />
      </Section>

      {exercise.weights.length ? (
        <Section title="Weights at home">
          <div className="flex flex-wrap gap-1.5">
            {exercise.weights.map((w) => (
              <Pill key={w.kg} tone="butter">
                <span className="tabular">{kg(w.kg)}</span>
                {w.pair ? <span className="text-butter-800">×2</span> : null}
              </Pill>
            ))}
          </div>
        </Section>
      ) : null}

      {exercise.steps.length ? (
        <Section title="How to do it">
          <ol className="flex flex-col gap-2.5">
            {exercise.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[0.9375rem] leading-snug text-ink-800">
                <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-lav-100 text-xs font-bold text-lav-800">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {exercise.note ? (
        <p className="rounded-2xl bg-butter-50 px-4 py-3 text-sm text-ink-800">{exercise.note}</p>
      ) : null}

      <Section title={`${whose} bests`}>
        <Bests bests={bests} />
      </Section>

      {days.length > 1 ? (
        <Section title="Over time">
          <Progress days={days} measure={exercise.measure} />
        </Section>
      ) : null}

      {days.length ? (
        <Section title="Recent days">
          <ul className="flex flex-col divide-y divide-ink-100 rounded-2xl bg-ink-50 px-3.5">
            {days.slice(0, 6).map((d) => (
              <li key={d.day} className="py-2.5">
                <p className="text-sm font-semibold text-ink-800">
                  {relativeDay(d.day, localDate())}
                  <span className="tabular ml-1.5 font-medium text-ink-500">
                    {d.sets.length} {d.sets.length === 1 ? 'set' : 'sets'}
                  </span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {d.sets.map((s) => (
                    <span
                      key={s.id}
                      className="tabular inline-flex h-7 items-center rounded-pill bg-white px-2.5 text-xs font-semibold text-ink-800 shadow-[var(--shadow-xs)]"
                    >
                      {s.side ? (
                        <span className="mr-1 text-ink-500">{s.side === 'left' ? 'L' : 'R'}</span>
                      ) : null}
                      {setLabel(s)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="flex flex-wrap gap-2 border-t border-ink-100 pt-4">
        <Button
          variant="ghost"
          size="sm"
          icon={exercise.archived ? VisibilityIcon : VisibilityOffIcon}
          loading={archive.isPending}
          onClick={() => archive.mutate(!exercise.archived)}
        >
          {exercise.archived ? 'Show again' : 'Hide from the library'}
        </Button>
      </div>

      <QuickLogSheet open={logging} onClose={() => setLogging(false)} exerciseId={exercise.id} />
      <ExerciseEditorSheet open={editing} onClose={() => setEditing(false)} exercise={exercise} />
    </div>
  );
}

// ---------------------------------------------------------------- pieces

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[0.9375rem] font-bold">{title}</h3>
      {children}
    </section>
  );
}

const PILL_TONES = {
  ink: 'bg-ink-900 text-white',
  lav: 'bg-lav-100 text-lav-800',
  muted: 'bg-ink-100 text-ink-700',
  butter: 'bg-butter-100 text-ink-900',
  mint: 'bg-mint-100 text-mint-800',
  peach: 'bg-peach-100 text-peach-800',
} as const;

function Pill({ tone, children }: { tone: keyof typeof PILL_TONES; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-[0.8125rem] font-semibold',
        PILL_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

/** Three dots, the level's filled: ●○○ easy, ●●● hard. */
export function LevelDots({ level, className }: { level: number; className?: string }) {
  return (
    <span aria-hidden="true" className={cx('inline-flex gap-0.5', className)}>
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cx(
            'size-1.5 rounded-full',
            n <= level ? 'bg-current' : 'bg-current opacity-25',
          )}
        />
      ))}
    </span>
  );
}

function EquipmentNeeds({
  needs,
  uses,
  presets,
  owned,
}: {
  needs: string[][];
  uses: string[] | null;
  presets: EquipmentPreset[];
  owned: Equipment[];
}) {
  if (!needs.length)
    return <p className="text-[0.9375rem] text-ink-700">Nothing — just you and the floor.</p>;
  const have = new Set(owned.filter((item) => item.count > 0).map((item) => item.kind));
  const preset = (kind: string) => presets.find((p) => p.kind === kind);
  const usesKey = uses?.join('+');
  return (
    <ul className="flex flex-col gap-1.5">
      {needs.map((option, i) => {
        const ready = option.every((kind) => have.has(kind));
        return (
          <li key={option.join('+')}>
            {i > 0 ? (
              <p className="mb-1.5 pl-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                or
              </p>
            ) : null}
            <div
              className={cx(
                'flex items-center gap-2 rounded-2xl p-2 pr-3',
                ready ? 'bg-mint-100' : 'bg-ink-50',
                usesKey === option.join('+') && 'ring-2 ring-inset ring-mint-200',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                {option.map((kind) => (
                  <span key={kind} className="flex min-w-0 items-center gap-1.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white">
                      <EquipmentIcon name={preset(kind)?.icon ?? kind} className="size-7" />
                    </span>
                    <span
                      className={cx(
                        'truncate text-sm font-semibold',
                        have.has(kind) ? 'text-ink-900' : 'text-ink-600',
                      )}
                    >
                      {preset(kind)?.name ?? kind.replace(/_/g, ' ')}
                    </span>
                  </span>
                ))}
              </span>
              {ready ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-mint-800">
                  <CheckCircleIcon fontSize="inherit" className="text-base" />
                  At home
                </span>
              ) : (
                <span className="shrink-0 text-xs font-semibold text-ink-500">Not at home</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Bests({ bests }: { bests: ExerciseHistory['bests'] }) {
  const tiles: Array<{ key: keyof typeof RECORD_LABEL; value: string; detail: string }> = [];
  if (bests.reps)
    tiles.push({
      key: 'reps',
      value: `${bests.reps.value} reps`,
      detail: dayAndMonth(bests.reps.day),
    });
  if (bests.weight)
    tiles.push({
      key: 'weight',
      value: kg(bests.weight.value),
      detail: `${bests.weight.reps ? `× ${bests.weight.reps} · ` : ''}${dayAndMonth(bests.weight.day)}`,
    });
  if (bests.e1rm)
    tiles.push({
      key: 'e1rm',
      value: `≈ ${kg(bests.e1rm.value)}`,
      detail: `one rep, estimated · ${dayAndMonth(bests.e1rm.day)}`,
    });
  if (bests.seconds)
    tiles.push({
      key: 'seconds',
      value: duration(bests.seconds.value),
      detail: dayAndMonth(bests.seconds.day),
    });
  if (bests.distance)
    tiles.push({
      key: 'distance',
      value: distance(bests.distance.value),
      detail: [
        bests.distance.seconds ? pace(bests.distance.value, bests.distance.seconds) : '',
        dayAndMonth(bests.distance.day),
      ]
        .filter(Boolean)
        .join(' · '),
    });
  if (!tiles.length)
    return (
      <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
        No sets yet. Log one and the bests start here.
      </p>
    );
  return (
    <dl className="grid grid-cols-2 gap-2">
      {tiles.map((tile) => (
        <div key={tile.key} className="rounded-2xl bg-ink-50 px-3.5 py-3">
          <dt className="text-xs font-semibold text-ink-600">{RECORD_LABEL[tile.key]}</dt>
          <dd className="tabular mt-0.5 text-[1.25rem] font-bold leading-tight tracking-[-0.02em]">
            {tile.value}
          </dd>
          <dd className="tabular mt-0.5 truncate text-xs text-ink-500">{tile.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function Progress({
  days,
  measure,
}: {
  days: ExerciseHistory['days'];
  measure: LibraryExercise['measure'];
}) {
  const weighted = measure === 'reps' && days.some((d) => d.sets.some((s) => s.weight));
  const points = [...days]
    .reverse()
    .slice(-30)
    .map((d) => ({ day: d.day, value: d.best }));
  const [label, format] =
    measure === 'time'
      ? ['Longest set per day', (v: number) => duration(v)]
      : measure === 'distance'
        ? ['Furthest per day', (v: number) => distance(v)]
        : weighted
          ? ['Strongest set per day, as an estimated one-rep weight', (v: number) => kg(v)]
          : ['Most reps in a set per day', (v: number) => `${Math.round(v)} reps`];
  return (
    <div className="rounded-2xl bg-ink-50 p-3.5">
      <LineChart points={points} format={format} label={label} />
      <p className="mt-2 text-xs text-ink-500">{label}</p>
    </div>
  );
}
