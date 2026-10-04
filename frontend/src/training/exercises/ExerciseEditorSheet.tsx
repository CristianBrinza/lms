import { TagsInput } from '../components/TagsInput';
import { usePerson } from '../person';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Button, IconButton, Sheet, Switch, TextField, toast } from '@/components/ui';
import { AddIcon, CheckIcon, CloseIcon, DeleteIcon } from '@/components/ui/icons';
import { Stepper } from '@/food/kitchenware/Stepper';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys, type ExerciseInput } from '../api';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  distance,
  duration,
  LEVEL_LABEL,
  MUSCLE_LABEL,
  MUSCLE_ORDER,
} from '../format';
import { EquipmentIcon, EXERCISE_ICON_KEYS, ExerciseIcon } from '../icons/TrainingIcon';
import type { Exercise, ExerciseCategory, Measure, Muscle } from '../types';

const MEASURE_LABEL: Record<Measure, string> = { reps: 'Reps', time: 'Time', distance: 'Distance' };
const MAX_STEPS = 10;
const MAX_MAIN = 6;
const MAX_HELPERS = 8;

/** Common ways, per kind, to tap in rather than type. */
const WAY_SUGGESTIONS: Record<ExerciseCategory, string[]> = {
  strength: [
    'Wide grip',
    'Close grip',
    'Single arm',
    'Single leg',
    'Slow down, 3 s',
    'Pause at the bottom',
  ],
  core: ['Knees bent', 'Legs straight', 'Arms straight', 'With a twist'],
  cardio: ['Easy', 'Intervals', 'Fast'],
  mobility: ['Seated', 'Standing', 'Lying'],
  stretch: ['Seated', 'Standing', 'Lying'],
};

interface Draft {
  name: string;
  category: ExerciseCategory;
  measure: Measure;
  weighted: boolean;
  unilateral: boolean;
  reps: number;
  seconds: number;
  distance: number;
  rest: number;
  level: number;
  impact: 'low' | 'high';
  muscles: Muscle[];
  secondary: Muscle[];
  equipment: string[][];
  icon: string;
  steps: string[];
  note: string;
  variants: string[];
}

const blank = (): Draft => ({
  name: '',
  category: 'strength',
  measure: 'reps',
  weighted: false,
  unilateral: false,
  reps: 10,
  seconds: 30,
  distance: 1000,
  rest: 60,
  level: 1,
  impact: 'low',
  muscles: [],
  secondary: [],
  equipment: [],
  icon: '',
  steps: [''],
  note: '',
  variants: [],
});

const fromExercise = (e: Exercise): Draft => ({
  name: e.name,
  category: e.category,
  measure: e.measure,
  weighted: e.weighted,
  unilateral: e.unilateral,
  reps: e.reps ?? 10,
  seconds: e.seconds ?? 30,
  distance: e.distance ?? 1000,
  rest: e.rest,
  level: e.level,
  impact: e.impact,
  muscles: e.muscles,
  secondary: e.secondary,
  equipment: e.equipment,
  icon: e.icon,
  steps: e.steps.length ? e.steps : [''],
  note: e.note,
  variants: e.variants,
});

/**
 * Creating an exercise, or changing one. The household's own exercises change entirely; the
 * built-in ones keep what they are (name, muscles, equipment, picture) and take the household's
 * rest, target, steps and note.
 */
export function ExerciseEditorSheet({
  open,
  onClose,
  exercise,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** null: a new one. */
  exercise: Exercise | null;
  onSaved?: (exercise: Exercise) => void;
}) {
  const queryClient = useQueryClient();
  const { personId } = usePerson();
  const equipment = useQuery({
    queryKey: trainingKeys.equipment,
    queryFn: trainingApi.equipment,
    enabled: open,
  });
  const presets = equipment.data?.presets ?? [];
  const [draft, setDraft] = useState<Draft>(blank);
  const [picking, setPicking] = useState<number | null>(null);
  const catalog = Boolean(exercise?.preset);

  // Opening (or opening on another exercise) starts from it as saved.
  const loadKey = open ? (exercise?.id ?? 'new') : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== loadKey) {
    setLoadedFor(loadKey);
    if (loadKey) {
      setDraft(exercise ? fromExercise(exercise) : blank());
      setPicking(null);
    }
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const targets = (d: Draft) => ({
    reps: d.measure === 'reps' ? d.reps : null,
    seconds: d.measure === 'time' ? d.seconds : null,
    distance: d.measure === 'distance' ? d.distance : null,
  });

  const save = useMutation({
    mutationFn: () => {
      const steps = draft.steps.map((s) => s.trim()).filter(Boolean);
      if (exercise && catalog)
        return trainingApi.updateExercise(exercise.id, {
          ...targets(draft),
          rest: draft.rest,
          steps,
          note: draft.note.trim(),
          variants: draft.variants,
        });
      const body: ExerciseInput = {
        name: draft.name.trim(),
        category: draft.category,
        measure: draft.measure,
        weighted: draft.weighted,
        unilateral: draft.unilateral,
        ...targets(draft),
        rest: draft.rest,
        level: draft.level,
        impact: draft.impact,
        muscles: draft.muscles,
        secondary: draft.secondary.filter((m) => !draft.muscles.includes(m)),
        equipment: draft.equipment.filter((alt) => alt.length),
        ...(draft.icon ? { icon: draft.icon } : {}),
        steps,
        note: draft.note.trim(),
        variants: draft.variants,
      };
      return exercise
        ? trainingApi.updateExercise(exercise.id, body)
        : trainingApi.createExercise({ ...body, userId: personId });
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(exercise ? `${saved.name} saved` : `${saved.name} added to the library`);
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      onSaved?.(saved);
      onClose();
    },
  });
  const fields = fieldErrors(save.error);
  const general = save.isError && !Object.keys(fields).length ? errorMessage(save.error) : null;

  const toggleMuscle = (key: 'muscles' | 'secondary', muscle: Muscle) => {
    const list = draft[key];
    const limit = key === 'muscles' ? MAX_MAIN : MAX_HELPERS;
    if (list.includes(muscle))
      set(
        key,
        list.filter((m) => m !== muscle),
      );
    else if (list.length < limit) {
      haptic('tap');
      setDraft((d) => ({
        ...d,
        [key]: [...list, muscle],
        // A muscle is either worked or helping, not both.
        ...(key === 'muscles'
          ? { secondary: d.secondary.filter((m) => m !== muscle) }
          : { muscles: d.muscles.filter((m) => m !== muscle) }),
      }));
    }
  };

  const toggleKind = (index: number, kind: string) =>
    setDraft((d) => ({
      ...d,
      equipment: d.equipment.map((alt, i) =>
        i !== index
          ? alt
          : alt.includes(kind)
            ? alt.filter((k) => k !== kind)
            : alt.length < 4
              ? [...alt, kind]
              : alt,
      ),
    }));
  const addAlternative = () => {
    setDraft((d) => ({ ...d, equipment: [...d.equipment, []] }));
    setPicking(draft.equipment.length);
  };
  const removeAlternative = (index: number) => {
    setDraft((d) => ({ ...d, equipment: d.equipment.filter((_, i) => i !== index) }));
    setPicking(null);
  };
  const presetOf = (kind: string) => presets.find((p) => p.kind === kind);

  const iconKeys: readonly string[] =
    draft.icon && !EXERCISE_ICON_KEYS.includes(draft.icon)
      ? [draft.icon, ...EXERCISE_ICON_KEYS]
      : EXERCISE_ICON_KEYS;

  const targetStepper =
    draft.measure === 'reps' ? (
      <Stepper
        label={draft.unilateral ? 'Reps each side' : 'Reps'}
        value={draft.reps}
        onChange={(v) => set('reps', v)}
        min={1}
        max={500}
      />
    ) : draft.measure === 'time' ? (
      <Stepper
        label={draft.unilateral ? 'Time each side' : 'Time'}
        value={draft.seconds}
        onChange={(v) => set('seconds', v)}
        min={5}
        max={3600}
        step={draft.seconds >= 120 ? 30 : 5}
        format={duration}
      />
    ) : (
      <Stepper
        label="Distance"
        value={draft.distance}
        onChange={(v) => set('distance', v)}
        min={100}
        max={50_000}
        step={draft.distance >= 2000 ? 500 : 100}
        format={distance}
      />
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise ? `Edit ${exercise.name}` : 'New exercise'}
      description={
        catalog ? 'A built-in exercise: change its target, rest, steps and note.' : undefined
      }
      size="lg"
      footer={
        <div className="flex flex-col gap-2">
          {general ? <p className="text-sm font-medium text-danger-600">{general}</p> : null}
          <Button
            fullWidth
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!catalog && !draft.name.trim()}
          >
            {exercise ? 'Save' : 'Add to the library'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (catalog || draft.name.trim()) save.mutate();
        }}
      >
        <div className="flex flex-col gap-5 md:grid md:grid-cols-2 md:gap-x-6">
          <div className="flex flex-col gap-4">
            {!catalog ? (
              <>
                <TextField
                  label="Name"
                  placeholder="Wall sit, towel row…"
                  value={draft.name}
                  onChange={(event) => set('name', event.target.value)}
                  error={fields.name}
                  maxLength={80}
                  autoFocus={!exercise}
                />
                <Choice
                  label="Kind"
                  value={draft.category}
                  options={CATEGORY_ORDER.map((c) => [c, CATEGORY_LABEL[c]] as const)}
                  onChange={(v) => set('category', v)}
                />
                <Choice
                  label="Counted in"
                  value={draft.measure}
                  options={(['reps', 'time', 'distance'] as const).map(
                    (m) => [m, MEASURE_LABEL[m]] as const,
                  )}
                  onChange={(v) => set('measure', v)}
                />
                <div className="flex flex-col gap-1 rounded-[1.125rem] bg-ink-50 px-4 py-2.5">
                  <Switch
                    checked={draft.weighted}
                    onChange={(v) => set('weighted', v)}
                    label="With a weight"
                    hint="Dumbbells, a kettlebell, a backpack"
                  />
                  <Switch
                    checked={draft.unilateral}
                    onChange={(v) => set('unilateral', v)}
                    label="One side at a time"
                    hint="Left, then right"
                  />
                </div>
              </>
            ) : null}
            <Field label="Usual set">{targetStepper}</Field>
            <Stepper
              label="Rest after a set"
              value={draft.rest}
              onChange={(v) => set('rest', v)}
              min={0}
              max={600}
              step={15}
              format={(v) => (v ? duration(v) : 'None')}
            />
            {!catalog ? (
              <>
                <Choice
                  label="Level"
                  value={String(draft.level) as '1' | '2' | '3'}
                  options={(['1', '2', '3'] as const).map(
                    (l) => [l, LEVEL_LABEL[Number(l)]!] as const,
                  )}
                  onChange={(v) => set('level', Number(v))}
                />
                <Choice
                  label="Noise"
                  value={draft.impact}
                  options={[
                    ['low', 'Low impact'],
                    ['high', 'High impact (jumps)'],
                  ]}
                  onChange={(v) => set('impact', v)}
                />
              </>
            ) : null}
          </div>

          {!catalog ? (
            <div className="flex flex-col gap-4">
              <Field label={`Works most · ${draft.muscles.length}/${MAX_MAIN}`}>
                <MuscleChips
                  chosen={draft.muscles}
                  other={draft.secondary}
                  onToggle={(m) => toggleMuscle('muscles', m)}
                  tone="ink"
                />
              </Field>
              <Field label="Helps">
                <MuscleChips
                  chosen={draft.secondary}
                  other={draft.muscles}
                  onToggle={(m) => toggleMuscle('secondary', m)}
                  tone="lav"
                />
              </Field>

              <Field label="Equipment needed">
                <div className="flex flex-col gap-2">
                  {!draft.equipment.length ? (
                    <p className="text-sm text-ink-600">No equipment needed.</p>
                  ) : null}
                  {draft.equipment.map((alt, index) => (
                    <div key={index}>
                      {index > 0 ? (
                        <p className="mb-1.5 pl-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                          or
                        </p>
                      ) : null}
                      <div className="rounded-2xl bg-ink-50 p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {alt.map((kind) => (
                            <span
                              key={kind}
                              className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-white pl-1 pr-1 text-sm font-semibold shadow-[var(--shadow-xs)]"
                            >
                              <EquipmentIcon
                                name={presetOf(kind)?.icon ?? kind}
                                className="size-7"
                              />
                              {presetOf(kind)?.name ?? kind.replace(/_/g, ' ')}
                              <button
                                type="button"
                                onClick={() => toggleKind(index, kind)}
                                aria-label={`Remove ${presetOf(kind)?.name ?? kind}`}
                                className="press grid size-8 place-items-center rounded-full text-base text-ink-500 hover:bg-ink-100"
                              >
                                <CloseIcon fontSize="inherit" />
                              </button>
                            </span>
                          ))}
                          <button
                            type="button"
                            onClick={() => setPicking(picking === index ? null : index)}
                            aria-expanded={picking === index}
                            className="press inline-flex h-10 items-center gap-1 rounded-pill px-3 text-sm font-semibold text-ink-800 hover:bg-white"
                          >
                            {picking === index ? (
                              <CheckIcon fontSize="inherit" />
                            ) : (
                              <AddIcon fontSize="inherit" />
                            )}
                            {picking === index ? 'Done' : alt.length ? 'Together with' : 'Pick'}
                          </button>
                          <IconButton
                            icon={DeleteIcon}
                            label="Remove this option"
                            size="sm"
                            variant="ghost"
                            className="ml-auto"
                            onClick={() => removeAlternative(index)}
                          />
                        </div>
                        {picking === index ? (
                          <ul className="mt-2 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto rounded-xl bg-white p-1 sm:grid-cols-3 md:grid-cols-2">
                            {presets.map((preset) => {
                              const on = alt.includes(preset.kind);
                              return (
                                <li key={preset.kind}>
                                  <button
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => toggleKind(index, preset.kind)}
                                    className={cx(
                                      'press flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1.5 text-left text-[0.8125rem] font-semibold',
                                      on
                                        ? 'bg-butter-300 text-ink-900'
                                        : 'text-ink-800 hover:bg-ink-50',
                                    )}
                                  >
                                    <EquipmentIcon name={preset.icon} className="size-7 shrink-0" />
                                    <span className="min-w-0 truncate">{preset.name}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  {draft.equipment.length < 6 ? (
                    <Button
                      variant="tint"
                      size="sm"
                      icon={AddIcon}
                      className="self-start"
                      onClick={addAlternative}
                    >
                      {draft.equipment.length ? 'Or instead…' : 'Needs equipment'}
                    </Button>
                  ) : null}
                </div>
              </Field>

              <Field label="Picture">
                <div
                  role="radiogroup"
                  aria-label="Picture"
                  className="grid max-h-[11rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
                >
                  {iconKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={key === draft.icon}
                      aria-label={key.replace(/-/g, ' ')}
                      title={key.replace(/-/g, ' ')}
                      onClick={() => set('icon', key)}
                      className={cx(
                        'press grid aspect-square min-h-11 place-items-center rounded-xl transition-colors',
                        key === draft.icon
                          ? 'bg-butter-300 shadow-[var(--shadow-xs)]'
                          : 'hover:bg-white',
                      )}
                    >
                      <ExerciseIcon name={key} className="size-8" />
                    </button>
                  ))}
                </div>
                {!draft.icon ? (
                  <p className="mt-1.5 text-xs text-ink-500">
                    None picked: one is chosen from its kind.
                  </p>
                ) : null}
              </Field>
            </div>
          ) : null}
        </div>

        <Field label="Steps">
          <ol className="flex flex-col gap-2">
            {draft.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-lav-100 text-xs font-bold text-lav-800">
                  {i + 1}
                </span>
                <TextField
                  label={`Step ${i + 1}`}
                  hideLabel
                  dense
                  className="flex-1"
                  placeholder={i === 0 ? 'Feet under the hips, back straight…' : 'Then…'}
                  value={step}
                  maxLength={300}
                  onChange={(event) =>
                    set(
                      'steps',
                      draft.steps.map((s, j) => (j === i ? event.target.value : s)),
                    )
                  }
                />
                <IconButton
                  icon={CloseIcon}
                  label={`Remove step ${i + 1}`}
                  size="sm"
                  variant="ghost"
                  disabled={draft.steps.length === 1 && !step}
                  onClick={() =>
                    set(
                      'steps',
                      draft.steps.length === 1 ? [''] : draft.steps.filter((_, j) => j !== i),
                    )
                  }
                />
              </li>
            ))}
          </ol>
          {draft.steps.length < MAX_STEPS ? (
            <Button
              variant="ghost"
              size="sm"
              icon={AddIcon}
              className="mt-1.5"
              onClick={() => set('steps', [...draft.steps, ''])}
            >
              Add a step
            </Button>
          ) : null}
        </Field>

        <Field label="Ways to do it">
          <TagsInput
            label="Ways to do it"
            value={draft.variants}
            onChange={(variants) => set('variants', variants)}
            placeholder="Wide grip, single leg, arms straight…"
            suggestions={WAY_SUGGESTIONS[draft.category]}
          />
          <p className="mt-1.5 text-xs text-ink-500">
            Picked when planning or doing it, and kept with each set. Bands and the bar’s grips come
            from the equipment.
          </p>
        </Field>

        <TextField
          label="Note"
          placeholder="Optional"
          value={draft.note}
          onChange={(event) => set('note', event.target.value)}
          error={fields.note}
          maxLength={500}
        />
      </form>
    </Sheet>
  );
}

// ---------------------------------------------------------------- pieces

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">{label}</p>
      {children}
    </div>
  );
}

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map(([option, text]) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cx(
              'press h-11 rounded-pill px-3.5 text-sm font-semibold',
              value === option
                ? 'bg-butter-300 text-ink-900'
                : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function MuscleChips({
  chosen,
  other,
  onToggle,
  tone,
}: {
  chosen: Muscle[];
  /** Picked in the other list: shown, but faint. */
  other: Muscle[];
  onToggle: (muscle: Muscle) => void;
  tone: 'ink' | 'lav';
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {MUSCLE_ORDER.map((muscle) => {
        const on = chosen.includes(muscle);
        return (
          <button
            key={muscle}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(muscle)}
            className={cx(
              'press h-10 rounded-pill px-3 text-sm font-semibold transition-colors',
              on
                ? tone === 'ink'
                  ? 'bg-ink-900 text-white'
                  : 'bg-lav-300 text-ink-900'
                : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              !on && other.includes(muscle) && 'opacity-45',
            )}
          >
            {MUSCLE_LABEL[muscle]}
          </button>
        );
      })}
    </div>
  );
}
