import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { TranslationFields } from '@/components/common/TranslationFields';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircleIcon,
  CloseIcon,
  ContentCopyIcon,
  DeleteIcon,
  PlayIcon,
  WarningIcon,
} from '@/components/ui/icons';
import { dayLong, localDate, relativeDay, relativeDayInline } from '@/food/format';
import { Stepper } from '@/food/kitchenware/Stepper';
import { formatNumber, intlLocale, tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { ExercisePicker } from '../components/ExercisePicker';
import { WayChips } from '../components/WayChips';
import {
  BLOCK_LABEL,
  clock,
  distance,
  duration,
  kg,
  plan,
  setLabel,
  STATUS_LABEL,
  wayName,
} from '../format';
import { useTrainingT } from '../i18n';
import { ExerciseIcon } from '../icons/TrainingIcon';
import type { Block, LibraryExercise, Workout, WorkoutItem, WorkoutItemView } from '../types';
import { useWorkoutT } from './WorkoutPage.i18n';

const BLOCKS: Block[] = ['warmup', 'main', 'cooldown'];

type Draft = { items: WorkoutItemView[]; rounds: number; roundRest: number };

/**
 * One workout: its exercises in order, each with its sets, target and rest, what was done last
 * time and what to aim for. Planned or under way, every part can be changed in place (a bar
 * saves it); then one big button starts the player. Done, it shows what was done.
 */
export default function WorkoutPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useWorkoutT();
  const workout = useQuery({
    queryKey: trainingKeys.workout(id),
    queryFn: () => trainingApi.workout(id),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picking, setPicking] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'move' | 'copy' | 'routine' | 'delete' | null>(null);

  const data = workout.data;
  const current: Draft | null =
    draft ?? (data ? { items: data.items, rounds: data.rounds, roundRest: data.roundRest } : null);
  const dirty = draft !== null;
  const editable = data ? data.status !== 'done' : false;

  const refresh = (next?: Workout) => {
    if (next) queryClient.setQueryData(trainingKeys.workout(id), next);
    void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
  };
  const save = useMutation({
    mutationFn: (d: Draft) =>
      trainingApi.updateWorkout(id, {
        items: d.items.map(({ exercise: _e, last: _l, suggest: _s, ...item }) => item),
        rounds: d.rounds,
        roundRest: d.roundRest,
      }),
    onSuccess: (next) => {
      setDraft(null);
      refresh(next);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const status = useMutation({
    mutationFn: (to: 'planned' | 'skipped') => trainingApi.updateWorkout(id, { status: to }),
    onSuccess: (next) => {
      haptic('tap');
      refresh(next);
      toast.success(next.status === 'skipped' ? t.toast.skipped : t.toast.plannedAgain);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const removeSet = useMutation({
    mutationFn: (setId: string) => trainingApi.removeSet(setId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trainingKeys.workout(id) });
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const change = (fn: (d: Draft) => Draft) => current && setDraft(fn(current));
  const updateItem = (index: number, patch: Partial<WorkoutItem>) =>
    change((d) => ({
      ...d,
      items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  const move = (index: number, by: -1 | 1) =>
    change((d) => {
      const items = [...d.items];
      const [item] = items.splice(index, 1);
      items.splice(index + by, 0, item!);
      setOpen(index + by);
      return { ...d, items };
    });
  const add = (exercise: LibraryExercise) => {
    haptic('tap');
    change((d) => ({
      ...d,
      items: [
        ...d.items,
        {
          exerciseId: exercise.id,
          sets: exercise.category === 'mobility' || exercise.category === 'stretch' ? 1 : 3,
          reps: exercise.measure === 'reps' ? (exercise.reps ?? 10) : null,
          seconds: exercise.measure === 'time' ? (exercise.seconds ?? 30) : null,
          distance: exercise.measure === 'distance' ? (exercise.distance ?? 1000) : null,
          weight:
            exercise.weighted && exercise.weights.length
              ? exercise.weights[Math.floor((exercise.weights.length - 1) / 2)]!.kg
              : null,
          rest: exercise.rest,
          exercise,
          last: null,
          suggest: null,
        },
      ],
    }));
    toast.success(t.toast.added(tr(exercise, 'name')));
  };

  const play = async () => {
    if (dirty && current) await save.mutateAsync(current);
    navigate(`/training/workouts/${id}/play`);
  };

  const grouped = current
    ? BLOCKS.map((block) => ({
        block,
        items: current.items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => (item.block ?? 'main') === block),
      })).filter((group) => group.items.length || group.block === 'main')
    : [];

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back={data ? `/training/plan?day=${data.date}` : '/training/plan'}
        title={data ? tr(data, 'title') : t.workout}
        subtitle={
          data
            ? `${relativeDay(data.date)}${data.time ? ` · ${data.time}` : ''} · ${data.person}`
            : ' '
        }
      />
      {workout.isPending ? (
        <div className="gutter-x mt-3 flex flex-col gap-3 md:px-5 lg:px-8">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
          <Skeleton className="h-20 rounded-3xl" />
        </div>
      ) : workout.error || !data || !current ? (
        <div className="gutter-x mt-3 md:px-5 lg:px-8">
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">{t.loadError}</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(workout.error)}</p>
            <Button
              size="sm"
              variant="tint"
              className="mt-3"
              onClick={() => void workout.refetch()}
            >
              {t.tryAgain}
            </Button>
          </div>
        </div>
      ) : (
        <div className="gutter-x mt-3 grid gap-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:px-8">
          <div className="flex min-w-0 flex-col gap-4">
            <StatusCard
              workout={data}
              draft={current}
              onPlay={() => void play()}
              saving={save.isPending}
            />
            {data.missing.length ? (
              <p className="flex items-start gap-2 rounded-2xl bg-peach-100 px-4 py-3 text-sm text-ink-800">
                <WarningIcon fontSize="inherit" className="mt-0.5 shrink-0 text-[1.1rem]" />
                {t.missing}
              </p>
            ) : null}

            {grouped.map((group) => (
              <section key={group.block} aria-labelledby={`block-${group.block}`}>
                <h2
                  id={`block-${group.block}`}
                  className="mb-1.5 flex items-baseline gap-2 px-1 text-[0.9375rem] font-bold"
                >
                  {BLOCK_LABEL[group.block]}
                  {group.block === 'main' && current.rounds > 1 ? (
                    <span className="text-sm font-semibold text-ink-500">
                      {t.roundsBetween(current.rounds, duration(current.roundRest))}
                    </span>
                  ) : null}
                </h2>
                <ol className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
                  {group.items.map(({ item, index }) => (
                    <ItemRow
                      key={`${item.exerciseId}-${index}`}
                      item={item}
                      index={index}
                      count={current.items.length}
                      expanded={open === index}
                      editable={editable}
                      done={data.sets.filter((s) => s.itemIndex === index).length}
                      onToggle={() => setOpen(open === index ? null : index)}
                      onChange={(patch) => updateItem(index, patch)}
                      onMove={(by) => move(index, by)}
                      onRemove={() => {
                        change((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }));
                        setOpen(null);
                      }}
                    />
                  ))}
                  {!group.items.length ? (
                    <li className="px-4 py-5 text-sm text-ink-600">{t.noExercises}</li>
                  ) : null}
                </ol>
              </section>
            ))}

            {editable ? (
              <div className="flex flex-col gap-3">
                <Button variant="soft" icon={AddIcon} onClick={() => setPicking(true)}>
                  {t.addExercise}
                </Button>
                <div className="grid gap-2 rounded-[1.25rem] bg-white p-3 shadow-[var(--shadow-card)] sm:grid-cols-2">
                  <Stepper
                    label={t.rounds}
                    value={current.rounds}
                    min={1}
                    max={20}
                    onChange={(rounds) => change((d) => ({ ...d, rounds }))}
                  />
                  {current.rounds > 1 ? (
                    <Stepper
                      label={t.betweenRounds}
                      value={current.roundRest}
                      min={0}
                      max={600}
                      step={15}
                      format={(v) => (v ? duration(v) : t.none)}
                      onChange={(roundRest) => change((d) => ({ ...d, roundRest }))}
                    />
                  ) : (
                    <p className="self-center px-2 text-sm text-ink-600">{t.circuitHint}</p>
                  )}
                </div>
              </div>
            ) : null}

            {data.sets.length ? (
              <DoneSets
                workout={data}
                onRemove={(setId) => removeSet.mutate(setId)}
                removing={removeSet.isPending}
              />
            ) : null}
          </div>

          <aside className="flex flex-col gap-2 lg:sticky lg:top-4">
            <h2 className="px-1 text-[0.9375rem] font-bold">{t.thisWorkout}</h2>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              <Button
                variant="soft"
                onClick={() => setSheet('move')}
                disabled={data.status === 'done'}
              >
                {t.action.move}
              </Button>
              <Button variant="soft" icon={ContentCopyIcon} onClick={() => setSheet('copy')}>
                {t.action.copy}
              </Button>
              <Button variant="soft" onClick={() => setSheet('routine')}>
                {t.action.routine}
              </Button>
              {data.status === 'skipped' || data.status === 'done' ? (
                <Button
                  variant="soft"
                  loading={status.isPending}
                  onClick={() => status.mutate('planned')}
                >
                  {data.status === 'done' ? t.action.reopen : t.action.planAgain}
                </Button>
              ) : (
                <Button
                  variant="soft"
                  loading={status.isPending}
                  onClick={() => status.mutate('skipped')}
                >
                  {t.action.skip}
                </Button>
              )}
              <Button
                variant="ghost"
                icon={DeleteIcon}
                className="text-danger-700"
                onClick={() => setSheet('delete')}
              >
                {t.action.delete}
              </Button>
            </div>
          </aside>
        </div>
      )}

      {dirty && current ? (
        <div data-fab className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-30 flex justify-center px-4 md:bottom-6">
          <div className="flex w-full max-w-md items-center gap-2 rounded-full bg-ink-900 p-1.5 pl-5 text-white shadow-[var(--shadow-tile)]">
            <span className="min-w-0 flex-1 text-sm leading-tight font-semibold">{t.unsaved}</span>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/10"
              onClick={() => setDraft(null)}
            >
              {t.undo}
            </Button>
            <Button
              size="sm"
              variant="accent"
              loading={save.isPending}
              onClick={() => save.mutate(current)}
            >
              {t.save}
            </Button>
          </div>
        </div>
      ) : null}

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={add}
        added={current?.items.map((i) => i.exerciseId)}
      />
      {data ? <WorkoutSheets workout={data} sheet={sheet} onClose={() => setSheet(null)} /> : null}
    </Screen>
  );
}

function StatusCard({
  workout,
  draft,
  onPlay,
  saving,
}: {
  workout: Workout;
  draft: Draft;
  onPlay: () => void;
  saving: boolean;
}) {
  const t = useWorkoutT();
  const tt = useTrainingT();
  const done = workout.status === 'done';
  const kcal = `${formatNumber(workout.kcal)} ${tt.unit.kcal}`;
  const sets = draft.items.reduce(
    (sum, i) =>
      sum +
      i.sets *
        (i.exercise.unilateral ? 2 : 1) *
        ((i.block ?? 'main') === 'main' ? draft.rounds : 1),
    0,
  );
  return (
    <section
      className={cx(
        'rounded-[1.5rem] p-4 sm:p-5',
        done ? 'bg-mint-100' : 'bg-ink-900 text-white shadow-[var(--shadow-tile)]',
      )}
    >
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className={cx('text-sm font-semibold', done ? 'text-mint-800' : 'text-white/70')}>
            {STATUS_LABEL[workout.status]}
          </p>
          <p className="mt-0.5 text-[1.375rem] font-bold leading-tight tracking-[-0.02em]">
            {done
              ? `${workout.durationSeconds ? duration(workout.durationSeconds) : ''}${workout.durationSeconds ? ' · ' : ''}${tt.sets(workout.setsDone)} · ${kcal}`
              : workout.status === 'active'
                ? t.status.setsOf(workout.setsDone, sets)
                : `${tt.exercises(draft.items.length)} · ${tt.sets(sets)}`}
          </p>
          <p className={cx('text-sm', done ? 'text-ink-700' : 'text-white/70')}>
            {done
              ? [
                  workout.feeling ? t.status.feeling[workout.feeling] : null,
                  workout.finishedAt
                    ? t.status.finished(
                        new Intl.DateTimeFormat(intlLocale(), {
                          hour: '2-digit',
                          minute: '2-digit',
                        }).format(new Date(workout.finishedAt)),
                      )
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : t.status.about(duration(workout.estimatedSeconds), kcal, dayLong(workout.date))}
          </p>
          {workout.note ? (
            <p className={cx('mt-1 text-sm italic', done ? 'text-ink-700' : 'text-white/80')}>
              “{workout.note}”
            </p>
          ) : null}
        </div>
        {done ? (
          <CheckCircleIcon fontSize="inherit" className="shrink-0 text-[2.75rem] text-mint-800" />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            disabled={!draft.items.length || saving || workout.status === 'skipped'}
            aria-label={workout.status === 'active' ? t.status.continue : t.status.start}
            className="press grid size-16 shrink-0 place-items-center rounded-full bg-butter-300 text-[2.25rem] text-ink-900 shadow-[0_8px_16px_-8px_rgb(0_0_0/0.55)] disabled:opacity-40"
          >
            <PlayIcon fontSize="inherit" />
          </button>
        )}
      </div>
      {!done && workout.date !== localDate() && workout.status === 'planned' ? (
        <p className="mt-2 text-xs text-white/60">
          {t.status.plannedFor(relativeDayInline(workout.date))}
        </p>
      ) : null}
    </section>
  );
}

function ItemRow({
  item,
  index,
  count,
  expanded,
  editable,
  done,
  onToggle,
  onChange,
  onMove,
  onRemove,
}: {
  item: WorkoutItemView;
  index: number;
  count: number;
  expanded: boolean;
  editable: boolean;
  done: number;
  onToggle: () => void;
  onChange: (patch: Partial<WorkoutItem>) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = useWorkoutT();
  const tt = useTrainingT();
  const e = item.exercise;
  const name = tr(e, 'name');
  const chip = (active: boolean) =>
    cx(
      'press h-10 min-w-10 rounded-full px-3 text-sm font-semibold tabular transition-colors',
      active
        ? 'bg-ink-900 text-white'
        : 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-lav-50',
    );
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-lav-50"
      >
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-butter-100">
          <ExerciseIcon name={e.icon} className="size-11" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{name}</span>
          <span className="block text-sm text-ink-700">
            {plan(item, e)}
            {item.variant ? ` · ${wayName(item.exercise, item.variant)}` : ''}
            {item.rest ? (
              <span className="text-ink-500"> · {t.item.rest(duration(item.rest))}</span>
            ) : null}
          </span>
          {item.suggest ? (
            <span className="block truncate text-xs text-lav-800">{item.suggest.text}</span>
          ) : item.last ? (
            <span className="block truncate text-xs text-ink-500">
              {t.item.lastTime(item.last.sets.map(setLabel).join(', '))}
            </span>
          ) : null}
          {!e.available ? (
            <span className="block text-xs font-semibold text-danger-700">
              {t.item.needsEquipment}
            </span>
          ) : null}
        </span>
        {done ? (
          <span className="tabular shrink-0 rounded-full bg-mint-100 px-2.5 py-1 text-xs font-bold text-mint-800">
            {t.item.done(done)}
          </span>
        ) : null}
      </button>
      {expanded && editable ? (
        <div className="flex flex-col gap-2 border-t border-ink-100 bg-ink-50/50 p-3">
          <Stepper
            label={t.item.sets}
            value={item.sets}
            min={1}
            max={20}
            onChange={(sets) => onChange({ sets })}
          />
          {e.measure === 'reps' ? (
            <Stepper
              label={e.unilateral ? t.item.repsEachSide : tt.measure.reps}
              value={item.reps ?? 10}
              min={1}
              max={500}
              onChange={(reps) => onChange({ reps })}
            />
          ) : e.measure === 'time' ? (
            <Stepper
              label={e.unilateral ? t.item.eachSide : tt.measure.time}
              value={item.seconds ?? 30}
              min={5}
              max={3600}
              step={5}
              format={duration}
              onChange={(seconds) => onChange({ seconds })}
            />
          ) : (
            <Stepper
              label={tt.measure.distance}
              value={item.distance ?? 1000}
              min={100}
              max={100_000}
              step={100}
              format={distance}
              onChange={(d) => onChange({ distance: d })}
            />
          )}
          <Stepper
            label={t.item.restAfter}
            value={item.rest}
            min={0}
            max={600}
            step={15}
            format={(v) => (v ? clock(v) : t.none)}
            onChange={(rest) => onChange({ rest })}
          />
          {e.options.length ? (
            <div className="rounded-[1.125rem] bg-ink-50 p-3">
              <p className="mb-2 text-[0.9375rem] font-semibold text-ink-800">{tt.how}</p>
              <WayChips
                options={e.options}
                value={item.variant}
                onChange={(variant, option) =>
                  onChange({
                    variant,
                    ...(option && option.kg !== null ? { weight: option.kg } : {}),
                  })
                }
              />
            </div>
          ) : null}
          {e.weighted && e.weights.length ? (
            <div className="rounded-[1.125rem] bg-ink-50 p-3">
              <p className="mb-2 text-[0.9375rem] font-semibold text-ink-800">{t.item.weight}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={chip(!item.weight)}
                  onClick={() => onChange({ weight: null })}
                >
                  {t.item.noWeight}
                </button>
                {e.weights.map((w) => (
                  <button
                    key={w.kg}
                    type="button"
                    className={chip(item.weight === w.kg)}
                    onClick={() => onChange({ weight: w.kg })}
                  >
                    {kg(w.kg)}
                    {w.pair ? <span className="ml-1 text-xs opacity-70">×2</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            {BLOCKS.map((b) => (
              <button
                key={b}
                type="button"
                aria-pressed={(item.block ?? 'main') === b}
                className={chip((item.block ?? 'main') === b)}
                onClick={() => onChange({ block: b })}
              >
                {BLOCK_LABEL[b]}
              </button>
            ))}
            <span className="ml-auto flex gap-1">
              <IconButton
                icon={ArrowUpIcon}
                label={t.item.moveUp}
                size="sm"
                variant="outline"
                disabled={index === 0}
                onClick={() => onMove(-1)}
              />
              <IconButton
                icon={ArrowDownIcon}
                label={t.item.moveDown}
                size="sm"
                variant="outline"
                disabled={index === count - 1}
                onClick={() => onMove(1)}
              />
              <IconButton
                icon={CloseIcon}
                label={t.item.remove(name)}
                size="sm"
                variant="outline"
                onClick={onRemove}
              />
            </span>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function DoneSets({
  workout,
  onRemove,
  removing,
}: {
  workout: Workout;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const t = useWorkoutT();
  const byExercise = new Map<string, typeof workout.sets>();
  for (const s of workout.sets)
    byExercise.set(tr(s, 'exercise'), [...(byExercise.get(tr(s, 'exercise')) ?? []), s]);
  return (
    <section aria-labelledby="done-sets">
      <h2 id="done-sets" className="mb-1.5 px-1 text-[0.9375rem] font-bold">
        {t.done.title}
      </h2>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)]">
        {[...byExercise].map(([name, sets]) => (
          <li key={name} className="flex items-start gap-3 p-3">
            <ExerciseIcon name={sets[0]!.icon} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{name}</p>
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {sets.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 rounded-full bg-ink-50 py-1 pr-1 pl-3 text-sm"
                  >
                    <span className="tabular">
                      {s.side ? `${s.side === 'left' ? t.done.left : t.done.right} ` : ''}
                      {setLabel(s)}
                      {s.variant ? ` · ${tr(s, 'variant')}` : ''}
                    </span>
                    <button
                      type="button"
                      disabled={removing}
                      onClick={() => onRemove(s.id)}
                      aria-label={t.done.remove(setLabel(s))}
                      className="press grid size-7 place-items-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                    >
                      <CloseIcon fontSize="inherit" className="text-[1rem]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function WorkoutSheets({
  workout,
  sheet,
  onClose,
}: {
  workout: Workout;
  sheet: 'move' | 'copy' | 'routine' | 'delete' | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const t = useWorkoutT();
  const [day, setDay] = useState(workout.date);
  const [name, setName] = useState(tr(workout, 'title'));
  const [translations, setTranslations] = useState<Translations>({});
  // Each time a sheet opens it starts from the workout as it is.
  const [shown, setShown] = useState(sheet);
  if (shown !== sheet) {
    setShown(sheet);
    if (sheet) {
      setDay(sheet === 'copy' ? localDate() : workout.date);
      setName(tr(workout, 'title'));
      setTranslations({});
    }
  }
  const done = (message: string) => {
    haptic('success');
    void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
    toast.success(message);
    onClose();
  };
  const act = useMutation({
    mutationFn: async () => {
      if (sheet === 'move')
        return trainingApi
          .updateWorkout(workout.id, { date: day })
          .then(() => done(t.toast.movedTo(relativeDayInline(day))));
      if (sheet === 'copy')
        return trainingApi.copyWorkout(workout.id, { date: day }).then((copy) => {
          done(t.toast.copiedTo(relativeDayInline(day)));
          navigate(`/training/workouts/${copy.id}`);
        });
      if (sheet === 'routine')
        return trainingApi
          .createRoutine({
            userId: workout.userId,
            name,
            note: workout.note,
            items: workout.items.map(({ exercise: _e, last: _l, suggest: _s, ...item }) => item),
            rounds: workout.rounds,
            roundRest: workout.roundRest,
            translations,
          })
          .then(() => done(t.toast.savedRoutine));
      if (sheet === 'delete')
        return trainingApi.removeWorkout(workout.id).then(() => {
          done(t.toast.deleted);
          navigate(`/training/plan?day=${workout.date}`, { replace: true });
        });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <Sheet
      open={sheet !== null}
      onClose={onClose}
      title={sheet ? t.sheet[sheet] : ''}
      description={
        sheet === 'delete'
          ? workout.setsDone
            ? t.sheet.deleteSets(workout.setsDone)
            : t.sheet.nothingLogged
          : undefined
      }
    >
      <div className="flex flex-col gap-3">
        {sheet === 'move' || sheet === 'copy' ? (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3">
            <span className="font-semibold">{t.sheet.day}</span>
            <input
              type="date"
              value={day}
              onChange={(event) => setDay(event.target.value)}
              className="tabular bg-transparent text-base font-semibold outline-none"
            />
          </label>
        ) : sheet === 'routine' ? (
          <>
            <TextField
              label={t.sheet.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
            <TranslationFields
              fields={[{ key: 'name', label: t.sheet.name, maxLength: 80 }]}
              value={translations}
              onChange={setTranslations}
            />
          </>
        ) : null}
        <Button
          size="lg"
          variant={sheet === 'delete' ? 'danger' : 'primary'}
          loading={act.isPending}
          disabled={!day || (sheet === 'routine' && !name.trim())}
          onClick={() => act.mutate()}
        >
          {sheet === 'delete'
            ? t.sheet.doDelete
            : sheet === 'routine'
              ? t.sheet.doSave
              : sheet === 'copy'
                ? t.sheet.doCopy
                : t.sheet.doMove}
        </Button>
      </div>
    </Sheet>
  );
}
