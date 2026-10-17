import { TagsInput } from '../components/TagsInput';
import { usePerson } from '../person';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type ReactNode } from 'react';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, IconButton, Sheet, Switch, TextField, toast } from '@/components/ui';
import {
  AddIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  ExpandMoreIcon,
  LanguageIcon,
} from '@/components/ui/icons';
import { Stepper } from '@/food/kitchenware/Stepper';
import { getLocale, LOCALE_NAMES, LOCALES, tr, type Locale, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys, type ExerciseInput } from '../api';
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  distance,
  duration,
  IMPACT_LABEL,
  LEVEL_LABEL,
  MEASURE_LABEL,
  MUSCLE_LABEL,
  MUSCLE_ORDER,
} from '../format';
import { EquipmentIcon, EXERCISE_ICON_KEYS, ExerciseIcon } from '../icons/TrainingIcon';
import type { Exercise, ExerciseCategory, Measure, Muscle } from '../types';
import { useExerciseEditorT } from './ExerciseEditorSheet.i18n';

const MAX_STEPS = 10;
const MAX_MAIN = 6;
const MAX_HELPERS = 8;

/** Steps in another language, as typed: one per line. */
type StepsText = Partial<Record<Locale, string>>;

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
  /** name and note in the other languages (and steps, merged in from stepsText on save). */
  translations: Translations;
  stepsText: StepsText;
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
  translations: {},
  stepsText: {},
});

const stepsTextOf = (translations: Translations): StepsText => {
  const text: StepsText = {};
  for (const locale of LOCALES) {
    const steps = translations[locale]?.steps;
    if (Array.isArray(steps)) text[locale] = steps.map(String).join('\n');
  }
  return text;
};

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
  translations: e.translations ?? {},
  stepsText: stepsTextOf(e.translations ?? {}),
});

/** One `translations` for the API: the name and note fields, with each language's steps. */
function translationsOf(d: Draft): Translations {
  const next: Translations = { ...d.translations };
  for (const locale of LOCALES) {
    const text = d.stepsText[locale];
    if (locale === getLocale() || text === undefined) continue;
    const steps = text
      .split('\n')
      .map((line) => line.trim().slice(0, 300))
      .filter(Boolean)
      .slice(0, MAX_STEPS);
    // An emptied language goes as [] (like TranslationFields' ''), so the server clears it.
    next[locale] = { ...(next[locale] ?? {}), steps };
  }
  return next;
}

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
  const t = useExerciseEditorT();
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
      const translations = translationsOf(draft);
      if (exercise && catalog)
        return trainingApi.updateExercise(exercise.id, {
          ...targets(draft),
          rest: draft.rest,
          steps,
          note: draft.note.trim(),
          variants: draft.variants,
          translations,
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
        translations,
      };
      return exercise
        ? trainingApi.updateExercise(exercise.id, body)
        : trainingApi.createExercise({ ...body, userId: personId });
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(exercise ? t.saved(tr(saved, 'name')) : t.added(tr(saved, 'name')));
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
  const kindName = (kind: string) => {
    const preset = presetOf(kind);
    return preset ? tr(preset, 'name') : kind.replace(/_/g, ' ');
  };
  const pictureName = (key: string) => t.pictures[key] ?? key.replace(/-/g, ' ');

  const iconKeys: readonly string[] =
    draft.icon && !EXERCISE_ICON_KEYS.includes(draft.icon)
      ? [draft.icon, ...EXERCISE_ICON_KEYS]
      : EXERCISE_ICON_KEYS;

  const targetStepper =
    draft.measure === 'reps' ? (
      <Stepper
        label={draft.unilateral ? t.repsEachSide : MEASURE_LABEL.reps}
        value={draft.reps}
        onChange={(v) => set('reps', v)}
        min={1}
        max={500}
      />
    ) : draft.measure === 'time' ? (
      <Stepper
        label={draft.unilateral ? t.timeEachSide : MEASURE_LABEL.time}
        value={draft.seconds}
        onChange={(v) => set('seconds', v)}
        min={5}
        max={3600}
        step={draft.seconds >= 120 ? 30 : 5}
        format={duration}
      />
    ) : (
      <Stepper
        label={MEASURE_LABEL.distance}
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
      title={exercise ? t.editTitle(tr(exercise, 'name')) : t.newTitle}
      description={catalog ? t.catalogHint : undefined}
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
            {exercise ? t.save : t.addToLibrary}
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
                  label={t.name}
                  placeholder={t.namePlaceholder}
                  value={draft.name}
                  onChange={(event) => set('name', event.target.value)}
                  error={fields.name}
                  maxLength={80}
                  autoFocus={!exercise}
                />
                <Choice
                  label={t.kind}
                  value={draft.category}
                  options={CATEGORY_ORDER.map((c) => [c, CATEGORY_LABEL[c]] as const)}
                  onChange={(v) => set('category', v)}
                />
                <Choice
                  label={t.countedIn}
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
                    label={t.weighted}
                    hint={t.weightedHint}
                  />
                  <Switch
                    checked={draft.unilateral}
                    onChange={(v) => set('unilateral', v)}
                    label={t.unilateral}
                    hint={t.unilateralHint}
                  />
                </div>
              </>
            ) : null}
            <Field label={t.usualSet}>{targetStepper}</Field>
            <Stepper
              label={t.rest}
              value={draft.rest}
              onChange={(v) => set('rest', v)}
              min={0}
              max={600}
              step={15}
              format={(v) => (v ? duration(v) : t.noRest)}
            />
            {!catalog ? (
              <>
                <Choice
                  label={t.level}
                  value={String(draft.level) as '1' | '2' | '3'}
                  options={(['1', '2', '3'] as const).map(
                    (l) => [l, LEVEL_LABEL[Number(l)]!] as const,
                  )}
                  onChange={(v) => set('level', Number(v))}
                />
                <Choice
                  label={t.noise}
                  value={draft.impact}
                  options={[
                    ['low', IMPACT_LABEL.low],
                    ['high', t.highImpact],
                  ]}
                  onChange={(v) => set('impact', v)}
                />
              </>
            ) : null}
          </div>

          {!catalog ? (
            <div className="flex flex-col gap-4">
              <Field label={t.worksMost(draft.muscles.length, MAX_MAIN)}>
                <MuscleChips
                  chosen={draft.muscles}
                  other={draft.secondary}
                  onToggle={(m) => toggleMuscle('muscles', m)}
                  tone="ink"
                />
              </Field>
              <Field label={t.helps}>
                <MuscleChips
                  chosen={draft.secondary}
                  other={draft.muscles}
                  onToggle={(m) => toggleMuscle('secondary', m)}
                  tone="lav"
                />
              </Field>

              <Field label={t.equipment}>
                <div className="flex flex-col gap-2">
                  {!draft.equipment.length ? (
                    <p className="text-sm text-ink-600">{t.noEquipment}</p>
                  ) : null}
                  {draft.equipment.map((alt, index) => (
                    <div key={index}>
                      {index > 0 ? (
                        <p className="mb-1.5 pl-1 text-xs font-bold uppercase tracking-wide text-ink-400">
                          {t.or}
                        </p>
                      ) : null}
                      <div className="rounded-2xl bg-ink-50 p-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {alt.map((kind) => (
                            <span
                              key={kind}
                              className="inline-flex h-10 min-w-0 max-w-full items-center gap-1.5 rounded-pill bg-white pl-1 pr-1 text-sm font-semibold shadow-[var(--shadow-xs)]"
                            >
                              <EquipmentIcon
                                name={presetOf(kind)?.icon ?? kind}
                                className="size-7 shrink-0"
                              />
                              <span className="min-w-0 truncate">{kindName(kind)}</span>
                              <button
                                type="button"
                                onClick={() => toggleKind(index, kind)}
                                aria-label={t.remove(kindName(kind))}
                                className="press grid size-8 shrink-0 place-items-center rounded-full text-base text-ink-500 hover:bg-ink-100"
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
                            {picking === index ? t.done : alt.length ? t.togetherWith : t.pick}
                          </button>
                          <IconButton
                            icon={DeleteIcon}
                            label={t.removeOption}
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
                                    <span className="min-w-0 truncate">{tr(preset, 'name')}</span>
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
                      {draft.equipment.length ? t.orInstead : t.needsEquipment}
                    </Button>
                  ) : null}
                </div>
              </Field>

              <Field label={t.picture}>
                <div
                  role="radiogroup"
                  aria-label={t.picture}
                  className="grid max-h-[11rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
                >
                  {iconKeys.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={key === draft.icon}
                      aria-label={pictureName(key)}
                      title={pictureName(key)}
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
                {!draft.icon ? <p className="mt-1.5 text-xs text-ink-500">{t.noPicture}</p> : null}
              </Field>
            </div>
          ) : null}
        </div>

        <Field label={t.steps}>
          <ol className="flex flex-col gap-2">
            {draft.steps.map((step, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-lav-100 text-xs font-bold text-lav-800">
                  {i + 1}
                </span>
                <TextField
                  label={t.step(i + 1)}
                  hideLabel
                  dense
                  className="flex-1"
                  placeholder={i === 0 ? t.firstStep : t.nextStep}
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
                  label={t.removeStep(i + 1)}
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
              {t.addStep}
            </Button>
          ) : null}
        </Field>

        <Field label={t.ways}>
          <TagsInput
            label={t.ways}
            value={draft.variants}
            onChange={(variants) => set('variants', variants)}
            placeholder={t.waysPlaceholder}
            suggestions={t.waySuggestions[draft.category]}
          />
          <p className="mt-1.5 text-xs text-ink-500">{t.waysHint}</p>
        </Field>

        <TextField
          label={t.note}
          placeholder={t.optional}
          value={draft.note}
          onChange={(event) => set('note', event.target.value)}
          error={fields.note}
          maxLength={500}
        />

        <div className="flex flex-col gap-3">
          <TranslationFields
            key={`fields-${loadedFor ?? ''}`}
            fields={[
              ...(!catalog ? [{ key: 'name', label: t.name, maxLength: 80 }] : []),
              { key: 'note', label: t.note, multiline: true, maxLength: 500 },
            ]}
            value={draft.translations}
            onChange={(translations) => set('translations', translations)}
          />
          <StepsTranslations
            key={`steps-${loadedFor ?? ''}`}
            value={draft.stepsText}
            onChange={(locale, text) =>
              setDraft((d) => ({ ...d, stepsText: { ...d.stepsText, [locale]: text } }))
            }
          />
        </div>
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

const AREA =
  'min-h-20 w-full resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]';

/**
 * The steps in the app's other languages, folded away like TranslationFields: one step per line,
 * empty lines dropped on save.
 */
function StepsTranslations({
  value,
  onChange,
}: {
  value: StepsText;
  onChange: (locale: Locale, text: string) => void;
}) {
  const t = useExerciseEditorT();
  const id = useId();
  const others = LOCALES.filter((locale) => locale !== getLocale());
  const filled = others.filter((locale) => value[locale]?.trim()).length;
  const [open, setOpen] = useState(filled > 0);

  return (
    <div className="rounded-[1.25rem] bg-ink-50/60">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[0.9375rem] font-semibold text-ink-800"
      >
        <LanguageIcon fontSize="inherit" className="text-[1.25rem] text-ink-500" />
        <span className="flex-1">{t.stepsTranslations.toggle}</span>
        {filled ? (
          <span className="text-sm font-medium text-ink-500">
            {t.stepsTranslations.filled(filled)}
          </span>
        ) : null}
        <ExpandMoreIcon
          fontSize="inherit"
          className={cx('text-[1.25rem] text-ink-500 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-5 px-4 pb-4">
          {others.map((locale) => (
            <label key={locale} lang={locale} className="flex flex-col gap-2">
              <span className="text-sm font-bold text-ink-900">{LOCALE_NAMES[locale]}</span>
              <textarea
                aria-label={`${t.steps} · ${LOCALE_NAMES[locale]}`}
                rows={4}
                value={value[locale] ?? ''}
                onChange={(event) => onChange(locale, event.target.value)}
                className={AREA}
              />
            </label>
          ))}
          <p className="text-sm text-ink-500">{t.stepsTranslations.hint}</p>
        </div>
      ) : null}
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
