import PushPinIcon from '@mui/icons-material/PushPinRounded';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, IconButton, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, HomeIcon, SearchIcon, VisibilityIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useWide } from '@/lib/useMediaQuery';
import { trainingApi, trainingKeys } from '../api';
import { PersonSwitcher } from '../components/PersonSwitcher';
import { ExerciseEditorSheet } from '../exercises/ExerciseEditorSheet';
import { ExercisePanel, ExerciseSheet, LevelDots } from '../exercises/ExerciseDetail';
import { CATEGORY_LABEL, CATEGORY_ORDER, LEVEL_LABEL, MUSCLE_LABEL, MUSCLE_ORDER } from '../format';
import { ExerciseIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { EquipmentPreset, ExerciseCategory, LibraryExercise, Muscle } from '../types';

type Category = 'all' | ExerciseCategory;
type MuscleFilter = 'any' | Muscle;

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

/**
 * The household's exercises: the built-in ones and its own. At first only what the equipment at
 * home allows; search, a kind and a muscle narrow it down. Pinned ones (kept at hand for quick
 * logging, per person) come first. A row opens the exercise — over the list on a phone, beside it
 * on a tablet. `?exercise=<id>` opens one directly.
 */
export default function ExercisesPage() {
  const [params, setParams] = useSearchParams();
  const { personId } = usePerson();
  const wide = useWide();
  const [query, setQuery] = useState('');
  const [atHome, setAtHome] = useState(true);
  const [category, setCategory] = useState<Category>('all');
  const [muscle, setMuscle] = useState<MuscleFilter>('any');
  const [hidden, setHidden] = useState(false);
  const [creating, setCreating] = useState(false);

  const list = useQuery({
    queryKey: trainingKeys.exercises(personId),
    queryFn: () => trainingApi.exercises(personId),
  });
  const archived = useQuery({
    queryKey: [...trainingKeys.exercises(personId), 'archived'],
    queryFn: () =>
      trainingApi.exercises(personId, true).then((all) => all.filter((e) => e.archived)),
    enabled: hidden,
  });
  const equipment = useQuery({ queryKey: trainingKeys.equipment, queryFn: trainingApi.equipment });

  const openId = params.get('exercise');
  const setOpen = (id: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set('exercise', id);
        else next.delete('exercise');
        return next;
      },
      { replace: !id },
    );

  const all = useMemo(() => list.data ?? [], [list.data]);
  const source = hidden ? (archived.data ?? []) : all;
  const available = all.filter((e) => e.available).length;

  const narrowed = source
    .filter((e) => hidden || !atHome || e.available)
    .filter((e) => muscle === 'any' || e.muscles.includes(muscle) || e.secondary.includes(muscle))
    .filter((e) => !query.trim() || fold(e.name).includes(fold(query)));
  const counts: Record<Category, number> = {
    all: 0,
    strength: 0,
    cardio: 0,
    core: 0,
    mobility: 0,
    stretch: 0,
  };
  for (const e of narrowed) {
    counts.all += 1;
    counts[e.category] += 1;
  }
  const shown = narrowed.filter((e) => category === 'all' || e.category === category);
  const pinned = hidden ? [] : shown.filter((e) => e.pinned);
  const groups = CATEGORY_ORDER.map((c) => ({
    category: c,
    items: shown.filter((e) => !e.pinned || hidden).filter((e) => e.category === c),
  })).filter((g) => g.items.length);
  const presets = equipment.data?.presets ?? [];
  const filtered = Boolean(query.trim()) || category !== 'all' || muscle !== 'any';
  const selected = wide ? openId : null;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/training"
        title={hidden ? 'Hidden exercises' : 'Exercises'}
        subtitle={list.data ? `${available} of ${all.length} possible at home` : ' '}
        actions={
          <IconButton
            icon={AddIcon}
            label="New exercise"
            variant="ink"
            size="sm"
            onClick={() => setCreating(true)}
          />
        }
      />

      <div className="md:grid md:grid-cols-2 md:items-start md:gap-4 md:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(26rem,0.9fr)] lg:gap-6 lg:px-8">
        <div className="min-w-0">
          <div className="gutter-x mt-2.5 flex flex-col gap-2 md:px-0">
            <PersonSwitcher />
            <TextField
              label="Search exercises"
              hideLabel
              dense
              icon={SearchIcon}
              surface="raised"
              placeholder="Search exercises"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex items-center gap-2">
              {!hidden ? (
                <button
                  type="button"
                  aria-pressed={atHome}
                  onClick={() => {
                    haptic('tap');
                    setAtHome((v) => !v);
                  }}
                  className={cx(
                    'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill pl-2.5 pr-3.5 text-sm font-semibold transition-colors',
                    atHome
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-800 shadow-[var(--shadow-xs)] ring-1 ring-inset ring-ink-100 hover:bg-ink-50',
                  )}
                >
                  <HomeIcon fontSize="inherit" className="text-[1.1rem]" />
                  Can do at home
                </button>
              ) : null}
              <Chips
                label="Kind"
                tone="sheet"
                dense
                className="min-w-0 flex-1"
                value={category}
                onChange={setCategory}
                options={[
                  { value: 'all' as const, label: 'All', count: counts.all },
                  ...CATEGORY_ORDER.filter((c) => counts[c] || c === category).map((c) => ({
                    value: c,
                    label: CATEGORY_LABEL[c],
                    count: counts[c],
                  })),
                ]}
              />
            </div>
            <MusclePicker value={muscle} onChange={setMuscle} />
          </div>

          <div className="gutter-x mt-3 md:px-0">
            {list.isPending || (hidden && archived.isPending) ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-64 rounded-[1.25rem]" />
                <Skeleton className="h-40 rounded-[1.25rem]" />
              </div>
            ) : list.error || (hidden && archived.error) ? (
              <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
                <p className="font-semibold text-danger-700">Couldn’t load the exercises</p>
                <p className="mt-1 text-sm text-ink-600">
                  {errorMessage(list.error ?? archived.error)}
                </p>
                <Button
                  size="sm"
                  variant="tint"
                  className="mt-3"
                  onClick={() => void (hidden ? archived.refetch() : list.refetch())}
                >
                  Try again
                </Button>
              </div>
            ) : !shown.length ? (
              <NothingFound
                hidden={hidden}
                atHome={atHome}
                filtered={filtered}
                query={query}
                onShowAll={() => setAtHome(false)}
                onClear={() => {
                  setQuery('');
                  setCategory('all');
                  setMuscle('any');
                }}
                onCreate={() => setCreating(true)}
              />
            ) : (
              <div className="2xl:columns-2 2xl:gap-6">
                {pinned.length ? (
                  <Group
                    title="Pinned"
                    pin
                    items={pinned}
                    presets={presets}
                    personId={personId}
                    onOpen={setOpen}
                    selected={selected}
                  />
                ) : null}
                {groups.map((g) => (
                  <Group
                    key={g.category}
                    title={CATEGORY_LABEL[g.category]}
                    items={g.items}
                    presets={presets}
                    personId={personId}
                    onOpen={setOpen}
                    selected={selected}
                  />
                ))}
              </div>
            )}

            {list.data ? (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 pb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={VisibilityIcon}
                  onClick={() => setHidden((v) => !v)}
                >
                  {hidden ? 'Back to the library' : 'Hidden exercises'}
                </Button>
                {!hidden && atHome && all.length > available ? (
                  <Button variant="ghost" size="sm" onClick={() => setAtHome(false)}>
                    Show all {all.length}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Tablets: the exercise stands beside the list. */}
        {wide ? (
          <aside className="sticky top-3 mt-2.5 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] [scrollbar-width:thin]">
            {openId ? (
              <ExercisePanel key={openId} exerciseId={openId} onClose={() => setOpen(null)} />
            ) : (
              <div className="flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
                <div className="flex items-end gap-1" aria-hidden="true">
                  <ExerciseIcon name="squat" className="size-16" />
                  <ExerciseIcon name="plank" className="size-20" />
                </div>
                <p className="mt-3 text-[1.0625rem] font-bold">Tap an exercise</p>
                <p className="mt-1 max-w-xs text-sm text-ink-600">
                  How to do it, what it works and needs, the bests so far, and a quick way to log a
                  set.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      <ExerciseSheet exerciseId={wide ? null : openId} onClose={() => setOpen(null)} />
      <ExerciseEditorSheet
        open={creating}
        onClose={() => setCreating(false)}
        exercise={null}
        onSaved={(saved) => {
          setHidden(false);
          setOpen(saved.id);
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- filters

const BODY: Array<{ label: string; muscles: Muscle[] }> = [
  { label: 'Upper', muscles: ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms'] },
  { label: 'Middle', muscles: ['core', 'obliques', 'hips'] },
  { label: 'Legs', muscles: ['glutes', 'quads', 'hamstrings', 'calves'] },
  { label: 'Heart', muscles: ['heart'] },
];

/** "Any muscle" or one: a row of pills, grouped upper / middle / legs so the eye finds them. */
function MusclePicker({
  value,
  onChange,
}: {
  value: MuscleFilter;
  onChange: (value: MuscleFilter) => void;
}) {
  const pill = (active: boolean) =>
    cx(
      'press inline-flex h-8 shrink-0 items-center rounded-pill px-3 text-[0.8125rem] font-semibold transition-colors',
      active ? 'bg-lav-600 text-white' : 'bg-lav-50 text-ink-800 hover:bg-lav-100',
    );
  return (
    <div
      role="radiogroup"
      aria-label="Muscle"
      className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'any'}
        onClick={() => onChange('any')}
        className={pill(value === 'any')}
      >
        Any muscle
      </button>
      {BODY.map((part) => (
        <span key={part.label} className="flex shrink-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className="ml-1 text-[0.6875rem] font-bold uppercase tracking-wide text-ink-400"
          >
            {part.label}
          </span>
          {part.muscles
            .filter((m) => MUSCLE_ORDER.includes(m))
            .map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value === m}
                onClick={() => onChange(value === m ? 'any' : m)}
                className={pill(value === m)}
              >
                {MUSCLE_LABEL[m]}
              </button>
            ))}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the list

function Group({
  title,
  pin,
  items,
  presets,
  personId,
  onOpen,
  selected,
}: {
  title: string;
  pin?: boolean;
  items: LibraryExercise[];
  presets: EquipmentPreset[];
  personId: string;
  onOpen: (id: string) => void;
  selected: string | null;
}) {
  return (
    <section className="mb-3.5 break-inside-avoid">
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
        {pin ? <PushPinIcon fontSize="inherit" className="text-base text-butter-800" /> : null}
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{items.length}</span>
      </h2>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {items.map((e) => (
          <ExerciseRow
            key={e.id}
            exercise={e}
            presets={presets}
            personId={personId}
            onOpen={() => onOpen(e.id)}
            selected={selected === e.id}
          />
        ))}
      </ul>
    </section>
  );
}

/** "Pull-up bar", "Bench or Chair", "Dumbbells + Bench". */
function needsLine(needs: string[][], presets: EquipmentPreset[]): string {
  const name = (kind: string) =>
    presets.find((p) => p.kind === kind)?.name ?? kind.replace(/_/g, ' ');
  const options = needs.map((alt) => alt.map(name).join(' + '));
  return options.length > 2 ? `${options.slice(0, 2).join(' or ')} or more` : options.join(' or ');
}

function ExerciseRow({
  exercise,
  presets,
  personId,
  onOpen,
  selected,
}: {
  exercise: LibraryExercise;
  presets: EquipmentPreset[];
  personId: string;
  onOpen: () => void;
  selected: boolean;
}) {
  const queryClient = useQueryClient();
  const pin = useMutation({
    mutationFn: (pinned: boolean) => trainingApi.pin(exercise.id, pinned, personId),
    onMutate: (pinned) => {
      haptic('tap');
      queryClient.setQueryData<LibraryExercise[]>(trainingKeys.exercises(personId), (old) =>
        old?.map((e) => (e.id === exercise.id ? { ...e, pinned } : e)),
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: trainingKeys.all }),
  });
  const muscles = [...exercise.muscles, ...exercise.secondary]
    .slice(0, 4)
    .map((m) => MUSCLE_LABEL[m]);

  return (
    <li className={cx('flex items-center', selected && 'bg-butter-100')}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className="press flex min-w-0 flex-1 items-center gap-3 py-2 pl-2.5 pr-2 text-left transition-colors hover:bg-ink-50"
      >
        <span
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-[0.875rem]',
            exercise.available ? 'bg-butter-100' : 'bg-ink-100',
          )}
        >
          <ExerciseIcon
            name={exercise.icon}
            className={cx('size-10', !exercise.available && 'opacity-60')}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate text-[0.9375rem] font-semibold',
              !exercise.available && 'text-ink-700',
            )}
          >
            {exercise.name}
          </span>
          <span className="block truncate text-[0.8125rem] text-ink-600">
            {muscles.join(' · ') || CATEGORY_LABEL[exercise.category]}
          </span>
          {!exercise.available ? (
            <span className="block truncate text-xs font-semibold text-peach-800">
              needs: {needsLine(exercise.equipment, presets)}
            </span>
          ) : null}
        </span>
        <span
          className="flex shrink-0 flex-col items-end gap-1 text-ink-700"
          title={LEVEL_LABEL[exercise.level]}
        >
          <LevelDots level={exercise.level} />
          <span className="sr-only">{LEVEL_LABEL[exercise.level]}</span>
          {exercise.impact === 'high' ? (
            <span className="text-[0.6875rem] font-semibold text-peach-800">Jumps</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        aria-pressed={exercise.pinned}
        aria-label={`${exercise.pinned ? 'Unpin' : 'Pin'} ${exercise.name}`}
        title={exercise.pinned ? 'Pinned: kept at hand for quick logging' : 'Pin for quick logging'}
        onClick={() => pin.mutate(!exercise.pinned)}
        disabled={pin.isPending}
        className={cx(
          'press mr-1.5 grid size-11 shrink-0 place-items-center rounded-full text-[1.2rem] transition-colors',
          exercise.pinned
            ? 'text-ink-900 hover:bg-butter-200'
            : 'text-ink-300 hover:bg-ink-50 hover:text-ink-600',
        )}
      >
        <PushPinIcon fontSize="inherit" className={cx(exercise.pinned && 'rotate-[30deg]')} />
      </button>
    </li>
  );
}

function NothingFound({
  hidden,
  atHome,
  filtered,
  query,
  onShowAll,
  onClear,
  onCreate,
}: {
  hidden: boolean;
  atHome: boolean;
  filtered: boolean;
  query: string;
  onShowAll: () => void;
  onClear: () => void;
  onCreate: () => void;
}) {
  if (hidden && !filtered)
    return (
      <p className="rounded-3xl bg-white p-6 text-center text-[0.9375rem] text-ink-600 shadow-[var(--shadow-card)]">
        Nothing hidden. Hiding an exercise keeps it out of the library and generated workouts.
      </p>
    );
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-8 text-center shadow-[var(--shadow-card)]">
      <ExerciseIcon name="hamstring-stretch" className="size-16" />
      <p className="mt-3 text-[1.0625rem] font-bold">
        {query.trim() ? `No “${query.trim()}”` : 'No exercises match'}
      </p>
      <p className="mt-1 max-w-xs text-sm text-ink-600">
        {atHome && !hidden
          ? 'Only what the equipment at home allows is shown.'
          : 'Try fewer filters.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {atHome && !hidden ? (
          <Button size="sm" variant="tint" onClick={onShowAll}>
            Show all exercises
          </Button>
        ) : null}
        {filtered ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear filters
          </Button>
        ) : null}
        {!hidden ? (
          <Button size="sm" icon={AddIcon} onClick={onCreate}>
            New exercise
          </Button>
        ) : null}
      </div>
    </div>
  );
}
