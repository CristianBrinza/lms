import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { TranslationFields } from '@/components/common/TranslationFields';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Skeleton, Switch, TextField, toast } from '@/components/ui';
import {
  AddIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CloseIcon,
  DeleteIcon,
  RemoveIcon,
} from '@/components/ui/icons';
import { getLocale, LOCALES, tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys, kitchenwareApi } from '../api';
import { useCatalog, useProductSearch } from '../catalog';
import { parseAmount, unitsFor } from '../format';
import { FOOD_ICON_KEYS } from '../icons/art';
import { isCustomIcon, useCustomIcons } from '../icons/custom';
import { FoodIcon } from '../icons/FoodIcon';
import { IconGroupLabel } from '../icons/IconGroupLabel';
import { useIconsT } from '../icons/icons.i18n';
import { COURSE_ORDER } from '../choices';
import { usePlanT } from '../plan/i18n';
import { useRecipesT } from '../recipes.i18n';
import type {
  IngredientInput,
  IngredientLine,
  PartKind,
  Recipe,
  RecipeChoiceInput,
  RecipeInput,
  ToolNeedInput,
  Unit,
} from '../types';

const DISHES = [
  'pot',
  'bowl',
  'soup',
  'salad',
  'pizza',
  'sandwich',
  'cake',
  'pancakes',
  'omelette',
  'spaghetti',
  'steak',
  'chicken',
  'fish',
  'container',
];
const ALL_UNITS: Unit[] = ['pcs', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup'];

interface Row {
  key: number;
  productId?: string;
  name: string;
  amount: string;
  unit: string;
  note: string;
  optional: boolean;
  /** Only this kind ('' for any). */
  variant: string;
  /** Or these instead, comma-separated ("Whipped cream, Cream"). */
  or: string;
  /** False for what the kitchen doesn't keep (tap water): never checked or taken. */
  kept: boolean;
  /** The section of the meal it is for ('' none). */
  course: PartKind | '';
  /** A line not kept in the kitchen keeps its names in other languages (Apă, Вода). */
  translations?: Translations;
}

let nextKey = 1;
const blankRow = (course: PartKind | '' = ''): Row => ({
  key: nextKey++,
  name: '',
  amount: '',
  unit: '',
  note: '',
  optional: false,
  variant: '',
  or: '',
  kept: true,
  course,
});

/** A line as the editor shows it. */
const lineRow = (i: IngredientLine): Row => ({
  key: nextKey++,
  productId: i.productId ?? undefined,
  name: i.name,
  amount: i.amount === null ? '' : String(i.amount),
  unit: i.unit ?? '',
  note: i.note,
  optional: i.optional,
  variant: i.variant,
  or: i.alternatives.map((alt) => alt.name).join(', '),
  kept: Boolean(i.productId),
  course: i.course ?? '',
  ...(i.productId ? {} : { translations: i.translations }),
});

/** A row as the API takes it. */
const rowInput = (r: Row): IngredientInput => ({
  ...(r.productId ? { productId: r.productId } : {}),
  name: r.name.trim(),
  amount: parseAmount(r.amount),
  unit: parseAmount(r.amount) && r.unit ? r.unit : null,
  note: r.note.trim(),
  optional: r.optional,
  ...(r.kept ? {} : { link: false }),
  ...(r.course ? { course: r.course } : {}),
  ...(!r.kept && r.translations ? { translations: r.translations } : {}),
  ...(r.variant.trim() ? { variant: r.variant.trim() } : {}),
  ...(r.or.trim()
    ? {
        or: r.or
          .split(',')
          .map((name) => name.trim())
          .filter(Boolean)
          .slice(0, 4)
          .map((name) => ({ name })),
      }
    : {}),
});

/** A choice being written: its section and options, each with its own lines and steps. */
interface ChoiceDraft {
  key: number;
  id?: string;
  name: string;
  course: PartKind | '';
  options: Array<{ key: number; id?: string; name: string; rows: Row[]; steps: string }>;
}

const blankOption = () => ({ key: nextKey++, name: '', rows: [blankRow()], steps: '' });

/** Whole: a name and at least two named options. */
const choiceReady = (choice: ChoiceDraft) =>
  Boolean(choice.name.trim()) && choice.options.filter((o) => o.name.trim()).length >= 2;

const choiceInput = (choice: ChoiceDraft): RecipeChoiceInput => ({
  ...(choice.id ? { id: choice.id } : {}),
  name: choice.name.trim(),
  course: choice.course || null,
  options: choice.options
    .filter((o) => o.name.trim())
    .map((o) => ({
      ...(o.id ? { id: o.id } : {}),
      name: o.name.trim(),
      ingredients: o.rows.filter((r) => r.name.trim()).map(rowInput),
      steps: o.steps
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
    })),
});

interface ToolRow {
  toolId?: string;
  name: string;
  /** Its name in other languages, to show it in this one. */
  translations?: Translations;
  icon: string;
  count: number;
  /** One each: times the servings (plates, cutlery, lunch boxes). */
  perServing: boolean;
  /** Or one of these instead (the grill for a frying pan). */
  or: Array<{ toolId?: string; name: string; translations?: Translations }>;
}

/** The texts a recipe has in other languages; steps are edited as one per line. */
const TEXT_FIELDS = ['title', 'description', 'notes'] as const;

/** Stored translations as the editor shows them: steps joined, one per line. */
function editableTranslations(value: Translations | undefined): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value?.[locale];
    if (!entry) continue;
    out[locale] = {
      ...entry,
      ...(Array.isArray(entry.steps) ? { steps: (entry.steps as string[]).join('\n') } : {}),
    };
  }
  return out;
}

/**
 * The translations as the API takes them, every field in every language so a cleared one is
 * cleared there too. A text changed above replaces its old translation in the language it was
 * written in (the one the app speaks now), so the edit is what shows.
 */
function translationsBody(
  value: Translations,
  changed: Partial<Record<(typeof TEXT_FIELDS)[number] | 'steps', boolean>>,
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value[locale] ?? {};
    const own = locale === getLocale();
    const fields: Record<string, unknown> = {};
    for (const key of TEXT_FIELDS)
      fields[key] = own && changed[key] ? '' : String(entry[key] ?? '').trim();
    fields.steps =
      own && changed.steps
        ? []
        : String(entry.steps ?? '')
            .split('\n')
            .map((step) => step.trim())
            .filter(Boolean);
    out[locale] = fields;
  }
  return out;
}

/**
 * Write or change a recipe: ingredients linked to the kitchen (with a kind when only one will do,
 * and what can go in instead), the kitchenware it needs, steps in order.
 */
export default function RecipeEditorPage() {
  const t = useRecipesT();
  const { id } = useParams();
  const recipe = useQuery({
    queryKey: foodKeys.recipe(id ?? '', undefined),
    queryFn: () => foodApi.recipe(id!),
    enabled: Boolean(id),
  });
  if (id && recipe.isPending) {
    return (
      <Screen tone="white">
        <PageHeader back={`/food/recipes/${id}`} title={t.editRecipe} centered />
        <div className="gutter-x mt-6 flex flex-col gap-3">
          <Skeleton className="h-14" />
          <Skeleton className="h-40" />
        </div>
      </Screen>
    );
  }
  return <Editor key={recipe.data?.id ?? 'new'} initial={id ? recipe.data : undefined} />;
}

function Editor({ initial }: { initial?: Recipe }) {
  const t = useRecipesT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'pot');
  const [allIcons, setAllIcons] = useState(false);
  const groups = useIconsT();
  const customIcons = useCustomIcons();
  const [description, setDescription] = useState(initial?.description ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [prep, setPrep] = useState(initial?.prepMinutes ? String(initial.prepMinutes) : '');
  const [cook, setCook] = useState(initial?.cookMinutes ? String(initial.cookMinutes) : '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.ingredients.length
      ? initial.ingredients.map(lineRow)
      : [blankRow(), blankRow()],
  );
  const [choices, setChoices] = useState<ChoiceDraft[]>(() =>
    (initial?.choices ?? []).map((choice) => ({
      key: nextKey++,
      id: choice.id,
      name: choice.name,
      course: choice.course ?? '',
      options: choice.options.map((option) => ({
        key: nextKey++,
        id: option.id,
        name: option.name,
        rows: option.ingredients.length ? option.ingredients.map(lineRow) : [blankRow()],
        steps: option.steps.join('\n'),
      })),
    })),
  );
  const [tools, setTools] = useState<ToolRow[]>(() =>
    (initial?.tools ?? []).map((t) => ({
      toolId: t.toolId,
      name: t.name,
      translations: t.translations,
      icon: t.icon,
      // A per-serving need comes back times the servings shown: kept per person here.
      count: t.perServing
        ? Math.max(1, Math.round(t.count / Math.max(1, initial?.shownServings ?? 1)))
        : t.count,
      perServing: t.perServing,
      or: t.options
        .filter((o) => o.toolId !== t.toolId)
        .map((o) => ({ toolId: o.toolId, name: o.name, translations: o.translations })),
    })),
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : ['']);
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
  const [translations, setTranslations] = useState<Translations>(() =>
    editableTranslations(initial?.translations),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const body = (): RecipeInput => ({
    title: title.trim(),
    description: description.trim(),
    servings,
    prepMinutes: parseAmount(prep) ? Math.round(parseAmount(prep)!) : null,
    cookMinutes: parseAmount(cook) ? Math.round(parseAmount(cook)!) : null,
    tags: [
      ...new Set(
        tags
          .split(',')
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    ],
    steps: steps.map((s) => s.trim()).filter(Boolean),
    icon,
    sourceUrl: sourceUrl.trim(),
    notes: notes.trim(),
    favorite,
    ingredients: rows.filter((r) => r.name.trim()).map(rowInput),
    // Sent when there are any, or to clear the ones the recipe had.
    ...(choices.length || initial?.choices.length ? { choices: choices.map(choiceInput) } : {}),
    tools: tools.map((tool): ToolNeedInput => ({
      ...(tool.toolId ? { toolId: tool.toolId } : { name: tool.name }),
      count: tool.count,
      perServing: tool.perServing,
      or: tool.or.map((o) => (o.toolId ? { toolId: o.toolId } : { name: o.name })),
    })),
    translations: translationsBody(translations, {
      title: Boolean(initial) && title.trim() !== initial!.title,
      description: Boolean(initial) && description.trim() !== initial!.description,
      notes: Boolean(initial) && notes.trim() !== initial!.notes,
      steps:
        Boolean(initial) &&
        steps
          .map((s) => s.trim())
          .filter(Boolean)
          .join('\n') !== initial!.steps.join('\n'),
    }),
  });

  const save = useMutation({
    mutationFn: () =>
      initial ? foodApi.updateRecipe(initial.id, body()) : foodApi.createRecipe(body()),
    onSuccess: (saved) => {
      haptic('success');
      toast.success(initial ? t.saved : t.added);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      navigate(`/food/recipes/${saved.id}`, { replace: true });
    },
    onError: () => haptic('error'),
  });
  const remove = useMutation({
    mutationFn: () => foodApi.deleteRecipe(initial!.id),
    onSuccess: () => {
      toast.success(t.deleted);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      navigate('/food/recipes', { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  // The API names ingredient problems by position among the lines that were sent.
  const sentRows = rows.filter((r) => r.name.trim());
  const rowError = (row: Row) => {
    const index = sentRows.indexOf(row);
    return index < 0
      ? undefined
      : (fields[`ingredients.${index}.unit`] ?? fields[`ingredients.${index}.lotId`]);
  };

  const [choicesError, setChoicesError] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!choices.every(choiceReady)) {
      setChoicesError(true);
      haptic('error');
      return;
    }
    setChoicesError(false);
    save.mutate();
  };

  const iconChoices = allIcons
    ? FOOD_ICON_KEYS
    : DISHES.includes(icon) || isCustomIcon(icon)
      ? DISHES
      : [icon, ...DISHES];

  return (
    <Screen tone="white">
      <PageHeader
        back={initial ? `/food/recipes/${initial.id}` : '/food/recipes'}
        title={initial ? t.editRecipe : t.newRecipeTitle}
        centered
      />
      <form
        onSubmit={submit}
        noValidate
        className="gutter-x mx-auto mt-6 flex max-w-2xl flex-col gap-6 md:max-w-3xl md:px-5 lg:px-8"
      >
        <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <TextField
            label={t.name}
            placeholder={t.namePlaceholder}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={fields.title}
            maxLength={120}
            autoFocus={!initial}
          />
          <fieldset>
            <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">
              {t.picture}
            </legend>
            <div
              role="radiogroup"
              aria-label={t.picture}
              className={cx(
                'grid grid-cols-7 gap-1.5',
                allIcons && 'max-h-60 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-10',
              )}
            >
              {customIcons.length > 0 && <IconGroupLabel>{groups.yours}</IconGroupLabel>}
              {[
                ...customIcons.map((custom) => ({ key: custom.key, label: tr(custom, 'name') })),
                ...(customIcons.length ? [null] : []),
                ...iconChoices.map((key) => ({ key, label: key.replace(/-/g, ' ') })),
              ].map((choice) =>
                choice === null ? (
                  <IconGroupLabel key="built-in">{groups.builtIn}</IconGroupLabel>
                ) : (
                  <button
                    key={choice.key}
                    type="button"
                    role="radio"
                    aria-checked={icon === choice.key}
                    aria-label={choice.label}
                    onClick={() => setIcon(choice.key)}
                    className={cx(
                      'press grid aspect-square place-items-center rounded-xl transition-colors',
                      icon === choice.key
                        ? 'bg-butter-100 shadow-[inset_0_0_0_2px_var(--color-ink-900)]'
                        : 'hover:bg-ink-50',
                    )}
                  >
                    <FoodIcon name={choice.key} className="size-8" />
                  </button>
                ),
              )}
            </div>
            <button
              type="button"
              onClick={() => setAllIcons((v) => !v)}
              className="mt-2 text-sm font-semibold text-lav-700 hover:text-lav-800"
            >
              {allIcons ? t.fewerPictures : t.allPictures}
            </button>
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.about}</span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t.aboutPlaceholder}
              maxLength={1000}
              className="min-h-20 resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <div className="grid grid-cols-[8.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">{t.serves}</span>
              <div className="flex h-14 items-center justify-between rounded-[1.125rem] bg-ink-50 px-1.5">
                <button
                  type="button"
                  aria-label={t.fewerServings}
                  disabled={servings <= 1}
                  onClick={() => setServings((v) => v - 1)}
                  className="press grid size-10 place-items-center rounded-xl bg-white text-lg shadow-xs disabled:opacity-40"
                >
                  <RemoveIcon fontSize="inherit" />
                </button>
                <span className="tabular font-bold">{servings}</span>
                <button
                  type="button"
                  aria-label={t.moreServings}
                  onClick={() => setServings((v) => Math.min(100, v + 1))}
                  className="press grid size-10 place-items-center rounded-xl bg-ink-900 text-lg text-white"
                >
                  <AddIcon fontSize="inherit" />
                </button>
              </div>
            </div>
            <TextField
              label={t.prepMin}
              inputMode="numeric"
              placeholder="—"
              value={prep}
              onChange={(event) => setPrep(event.target.value)}
            />
            <TextField
              label={t.cookMin}
              inputMode="numeric"
              placeholder="—"
              value={cook}
              onChange={(event) => setCook(event.target.value)}
            />
          </div>
          <TextField
            label={t.tags}
            placeholder={t.tagsPlaceholder}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            hint={t.tagsHint}
          />
        </section>

        <section>
          <h2 className="mb-2.5 px-1 text-h3 font-bold">{t.ingredients}</h2>
          <ul className="flex flex-col gap-2.5">
            {rows.map((row, index) => (
              <IngredientEditor
                key={row.key}
                row={row}
                error={rowError(row)}
                onChange={(next) =>
                  setRows((current) => current.map((r) => (r.key === row.key ? next : r)))
                }
                onRemove={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                autoFocus={index === rows.length - 1 && rows.length > 2 && !row.name}
              />
            ))}
          </ul>
          <Button
            type="button"
            variant="tint"
            size="md"
            icon={AddIcon}
            className="mt-3"
            onClick={() => setRows((current) => [...current, blankRow()])}
          >
            {t.addIngredient}
          </Button>
        </section>

        <ChoicesEditor
          choices={choices}
          onChange={(next) => {
            setChoices(next);
            if (choicesError && next.every(choiceReady)) setChoicesError(false);
          }}
          error={choicesError}
        />

        <ToolsEditor tools={tools} onChange={setTools} />

        <section>
          <h2 className="mb-2.5 px-1 text-h3 font-bold">{t.steps}</h2>
          <ol className="flex flex-col gap-2.5">
            {steps.map((step, index) => (
              <li
                key={index}
                className="flex items-start gap-2.5 rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
              >
                <span className="mt-2.5 grid size-8 shrink-0 place-items-center rounded-full bg-butter-300 text-sm font-bold">
                  {index + 1}
                </span>
                <textarea
                  aria-label={t.step(index + 1)}
                  rows={2}
                  value={step}
                  placeholder={index === 0 ? t.firstStepPlaceholder : t.nextStepPlaceholder}
                  onChange={(event) =>
                    setSteps((current) =>
                      current.map((s, i) => (i === index ? event.target.value : s)),
                    )
                  }
                  maxLength={2000}
                  className="min-h-16 flex-1 resize-y rounded-xl bg-ink-50 px-3 py-2.5 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                />
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    aria-label={t.moveUp}
                    disabled={index === 0}
                    onClick={() => setSteps((current) => swap(current, index, index - 1))}
                    className="press grid size-8 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"
                  >
                    <ArrowUpIcon fontSize="inherit" />
                  </button>
                  <button
                    type="button"
                    aria-label={t.moveDown}
                    disabled={index === steps.length - 1}
                    onClick={() => setSteps((current) => swap(current, index, index + 1))}
                    className="press grid size-8 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"
                  >
                    <ArrowDownIcon fontSize="inherit" />
                  </button>
                  <button
                    type="button"
                    aria-label={t.removeStep}
                    onClick={() =>
                      setSteps((current) =>
                        current.length > 1 ? current.filter((_, i) => i !== index) : [''],
                      )
                    }
                    className="press grid size-8 place-items-center rounded-full text-ink-600 hover:bg-ink-50"
                  >
                    <CloseIcon fontSize="inherit" />
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="tint"
            size="md"
            icon={AddIcon}
            className="mt-3"
            onClick={() => setSteps((current) => [...current, ''])}
          >
            {t.addStep}
          </Button>
        </section>

        <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <TextField
            label={t.link}
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            error={fields.sourceUrl}
          />
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.notes}</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t.notesPlaceholder}
              maxLength={2000}
              className="min-h-24 resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <Switch checked={favorite} onChange={setFavorite} label={t.favourite} />
          <TranslationFields
            fields={[
              { key: 'title', label: t.name, maxLength: 120 },
              { key: 'description', label: t.about, multiline: true, maxLength: 1000 },
              { key: 'steps', label: t.stepsPerLine, multiline: true },
              { key: 'notes', label: t.notes, multiline: true, maxLength: 2000 },
            ]}
            value={translations}
            onChange={setTranslations}
          />
        </section>

        {save.error && !Object.keys(fields).length ? (
          <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
        ) : null}
        {Object.keys(fields).some((k) => k.startsWith('ingredients')) ? (
          <p className="text-sm font-medium text-danger-600">{t.checkIngredients}</p>
        ) : null}

        <div className="flex flex-col gap-2.5 pb-4 sm:flex-row-reverse">
          <Button type="submit" fullWidth loading={save.isPending} disabled={!title.trim()}>
            {initial ? t.saveRecipe : t.addRecipeButton}
          </Button>
          {initial ? (
            <Button
              type="button"
              variant="ghost"
              fullWidth
              icon={DeleteIcon}
              className="text-danger-600"
              onClick={() => setConfirmDelete(true)}
            >
              {t.deleteRecipe}
            </Button>
          ) : null}
        </div>
      </form>
      {initial ? (
        <ConfirmSheet
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={() => remove.mutate()}
          loading={remove.isPending}
          tone="danger"
          title={t.deleteTitle(tr(initial, 'title'))}
          description={t.deleteText}
          confirmLabel={t.delete}
        />
      ) : null}
    </Screen>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b]!, next[a]!];
  return next;
}

function IngredientEditor({
  row,
  error,
  onChange,
  onRemove,
  autoFocus,
}: {
  row: Row;
  error?: string;
  onChange: (row: Row) => void;
  onRemove: () => void;
  autoFocus?: boolean;
}) {
  const t = useRecipesT();
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | undefined>(undefined);
  const catalog = useCatalog();
  const { results } = useProductSearch(row.name, 5);
  const product = catalog.data?.find((p) => p.id === row.productId);
  const units = product ? unitsFor(product, { cooking: true }) : ALL_UNITS;
  const exact = results.find((r) => r.name.toLowerCase() === row.name.trim().toLowerCase());
  // Typed a name the kitchen knows: it is linked, and there is nothing left to suggest.
  const suggestions = focused && row.name.trim().length > 1 && !exact ? results : [];

  return (
    <li
      className={cx(
        'relative rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset',
        error ? 'ring-danger-600' : 'ring-ink-100/70',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink-50">
          <FoodIcon
            name={
              product?.icon ??
              results.find((r) => r.name.toLowerCase() === row.name.toLowerCase())?.icon ??
              'basket'
            }
            className="size-7"
          />
        </span>
        <input
          aria-label={t.ingredient}
          value={row.name}
          placeholder={t.ingredient}
          autoFocus={autoFocus}
          autoComplete="off"
          onFocus={() => {
            window.clearTimeout(blurTimer.current);
            setFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = window.setTimeout(() => setFocused(false), 150);
          }}
          onChange={(event) => {
            const name = event.target.value;
            const match = results.find((r) => r.name.toLowerCase() === name.trim().toLowerCase());
            onChange({
              ...row,
              name,
              productId: match?.productId,
              unit: row.unit || (match ? (match.unit === 'pcs' ? 'pcs' : match.unit) : ''),
            });
          }}
          className="h-11 min-w-0 flex-1 rounded-xl bg-ink-50 px-3 text-[0.9375rem] font-semibold outline-none placeholder:font-medium placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
        <button
          type="button"
          aria-label={t.removeIngredient}
          onClick={onRemove}
          className="press grid size-10 shrink-0 place-items-center rounded-full text-lg text-ink-500 hover:bg-ink-50"
        >
          <CloseIcon fontSize="inherit" />
        </button>
      </div>
      {suggestions.length ? (
        <ul className="absolute inset-x-3 top-[3.75rem] z-20 overflow-hidden rounded-2xl bg-white p-1.5 shadow-[var(--shadow-float)] ring-1 ring-ink-100">
          {suggestions.map((pick) => (
            <li key={pick.productId ?? pick.name}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange({
                    ...row,
                    name: pick.name,
                    productId: pick.productId,
                    unit: row.unit || (pick.unit === 'pcs' ? 'pcs' : pick.unit),
                  });
                  setFocused(false);
                }}
                className="press flex w-full items-center gap-2.5 rounded-xl p-1.5 text-left hover:bg-ink-50"
              >
                <FoodIcon name={pick.icon} className="size-7" />
                <span className="truncate text-[0.9375rem] font-semibold">{pick.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 grid grid-cols-[5.5rem_6rem_minmax(0,1fr)] gap-2 pl-[3.25rem]">
        <input
          aria-label={t.amount}
          inputMode="decimal"
          value={row.amount}
          placeholder={t.amount}
          onChange={(event) => onChange({ ...row, amount: event.target.value })}
          className="tabular h-10 min-w-0 rounded-xl bg-ink-50 px-3 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
        <select
          aria-label={t.unit}
          value={row.unit}
          onChange={(event) => onChange({ ...row, unit: event.target.value })}
          className={cx(
            'h-10 min-w-0 rounded-xl bg-ink-50 px-2 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]',
            error && 'bg-danger-50',
          )}
        >
          <option value="">{t.unitPlaceholder}</option>
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {t.units[unit as Unit] ?? unit}
            </option>
          ))}
        </select>
        <input
          aria-label={t.note}
          value={row.note}
          placeholder={t.notePlaceholder}
          onChange={(event) => onChange({ ...row, note: event.target.value })}
          maxLength={120}
          className="h-10 min-w-0 rounded-xl bg-ink-50 px-3 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 pl-[3.25rem]">
        {product?.variants.length || row.variant ? (
          <select
            aria-label={t.kind}
            value={row.variant}
            onChange={(event) => onChange({ ...row, variant: event.target.value })}
            className="h-10 min-w-0 rounded-xl bg-ink-50 px-2 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            <option value="">{t.anyKind}</option>
            {[
              ...new Set([...(product?.variants ?? []), ...(row.variant ? [row.variant] : [])]),
            ].map((v) => (
              <option key={v} value={v}>
                {t.onlyKind(v)}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <input
          aria-label={t.orInstead}
          value={row.or}
          placeholder={t.orPlaceholder}
          onChange={(event) => onChange({ ...row, or: event.target.value })}
          maxLength={160}
          className="h-10 min-w-0 rounded-xl bg-ink-50 px-3 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
      </div>
      <div className="mt-2 ml-[3.25rem] flex flex-wrap gap-x-4 gap-y-1">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={row.optional}
            onChange={(event) => onChange({ ...row, optional: event.target.checked })}
            className="size-4 accent-ink-900"
          />
          {t.optionalLabel}
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={!row.kept}
            onChange={(event) => onChange({ ...row, kept: !event.target.checked })}
            className="size-4 accent-ink-900"
          />
          {t.notKept}
        </label>
        <CourseSelect
          value={row.course}
          onChange={(course) => onChange({ ...row, course })}
          className="ml-auto"
        />
      </div>
      {error ? (
        <p className="mt-1.5 pl-[3.25rem] text-sm font-medium text-danger-600">{error}</p>
      ) : null}
    </li>
  );
}

/** Which section of the meal a line or a choice is for (none, first course, second…). */
function CourseSelect({
  value,
  onChange,
  className,
}: {
  value: PartKind | '';
  onChange: (value: PartKind | '') => void;
  className?: string;
}) {
  const t = useRecipesT();
  const plan = usePlanT();
  return (
    <select
      aria-label={t.section}
      value={value}
      onChange={(event) => onChange(event.target.value as PartKind | '')}
      className={cx(
        'h-8 min-w-0 rounded-lg bg-ink-50 px-2 text-sm font-medium text-ink-700 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]',
        className,
      )}
    >
      <option value="">{value ? t.noSection : t.section}</option>
      {COURSE_ORDER.map((course) => (
        <option key={course} value={course}>
          {plan.partKind[course]}
        </option>
      ))}
    </select>
  );
}

/**
 * Parts made one way or another — the drink is a creamy coffee or a tea: each choice is named and
 * put in a section, and each of its options has its own ingredient lines (the same rows as the
 * recipe's) and its own steps.
 */
function ChoicesEditor({
  choices,
  onChange,
  error,
}: {
  choices: ChoiceDraft[];
  onChange: (choices: ChoiceDraft[]) => void;
  error: boolean;
}) {
  const t = useRecipesT();
  const change = (key: number, next: Partial<ChoiceDraft>) =>
    onChange(choices.map((c) => (c.key === key ? { ...c, ...next } : c)));
  const changeOption = (
    choice: ChoiceDraft,
    key: number,
    next: Partial<ChoiceDraft['options'][number]>,
  ) =>
    change(choice.key, {
      options: choice.options.map((o) => (o.key === key ? { ...o, ...next } : o)),
    });
  return (
    <section>
      <h2 className="px-1 text-h3 font-bold">{t.choices}</h2>
      <p className="mb-2.5 mt-1 px-1 text-sm text-ink-600">{t.choicesHint}</p>
      <div className="flex flex-col gap-3">
        {choices.map((choice) => (
          <div
            key={choice.key}
            className={cx(
              'flex flex-col gap-3 rounded-[1.75rem] bg-butter-50 p-3 ring-1 ring-inset',
              error && !choiceReady(choice) ? 'ring-danger-600' : 'ring-butter-200',
            )}
          >
            <div className="flex items-center gap-2">
              <input
                aria-label={t.choiceName}
                value={choice.name}
                placeholder={t.choicePlaceholder}
                maxLength={80}
                onChange={(event) => change(choice.key, { name: event.target.value })}
                className="h-11 min-w-0 flex-1 rounded-xl bg-white px-3 text-[0.9375rem] font-bold outline-none placeholder:font-medium placeholder:text-ink-500 focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              />
              <CourseSelect
                value={choice.course}
                onChange={(course) => change(choice.key, { course })}
                className="h-11 rounded-xl bg-white"
              />
              <button
                type="button"
                aria-label={t.removeChoice}
                onClick={() => onChange(choices.filter((c) => c.key !== choice.key))}
                className="press grid size-10 shrink-0 place-items-center rounded-full text-lg text-ink-500 hover:bg-white"
              >
                <DeleteIcon fontSize="inherit" />
              </button>
            </div>
            {choice.options.map((option, index) => (
              <div
                key={option.key}
                className="flex flex-col gap-2.5 rounded-[1.5rem] bg-white/70 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-butter-300 text-sm font-bold">
                    {index + 1}
                  </span>
                  <input
                    aria-label={t.option(index + 1)}
                    value={option.name}
                    placeholder={index === 0 ? t.optionPlaceholder : t.option(index + 1)}
                    maxLength={80}
                    onChange={(event) =>
                      changeOption(choice, option.key, { name: event.target.value })
                    }
                    className="h-10 min-w-0 flex-1 rounded-xl bg-ink-50 px-3 text-[0.9375rem] font-semibold outline-none placeholder:font-medium placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                  />
                  <button
                    type="button"
                    aria-label={t.removeOption}
                    onClick={() =>
                      change(choice.key, {
                        options: choice.options.filter((o) => o.key !== option.key),
                      })
                    }
                    className="press grid size-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-50"
                  >
                    <CloseIcon fontSize="inherit" />
                  </button>
                </div>
                <ul className="flex flex-col gap-2">
                  {option.rows.map((row) => (
                    <IngredientEditor
                      key={row.key}
                      row={row}
                      onChange={(next) =>
                        changeOption(choice, option.key, {
                          rows: option.rows.map((r) => (r.key === row.key ? next : r)),
                        })
                      }
                      onRemove={() =>
                        changeOption(choice, option.key, {
                          rows: option.rows.filter((r) => r.key !== row.key),
                        })
                      }
                    />
                  ))}
                </ul>
                <Button
                  type="button"
                  variant="tint"
                  size="sm"
                  icon={AddIcon}
                  className="w-fit"
                  onClick={() =>
                    changeOption(choice, option.key, { rows: [...option.rows, blankRow()] })
                  }
                >
                  {t.addIngredient}
                </Button>
                <label className="flex flex-col gap-1.5">
                  <span className="px-1 text-[0.8125rem] font-semibold text-ink-700">
                    {t.optionSteps}
                  </span>
                  <textarea
                    rows={2}
                    value={option.steps}
                    placeholder={t.optionStepsPlaceholder}
                    onChange={(event) =>
                      changeOption(choice, option.key, { steps: event.target.value })
                    }
                    className="min-h-16 resize-y rounded-xl bg-ink-50 px-3 py-2.5 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                  />
                </label>
              </div>
            ))}
            {choice.options.length < 6 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                icon={AddIcon}
                className="w-fit"
                onClick={() => change(choice.key, { options: [...choice.options, blankOption()] })}
              >
                {t.addOption}
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? (
        <p className="mt-2 px-1 text-sm font-medium text-danger-600">{t.needTwoOptions}</p>
      ) : null}
      {choices.length < 5 ? (
        <Button
          type="button"
          variant="tint"
          size="md"
          icon={AddIcon}
          className="mt-3"
          onClick={() =>
            onChange([
              ...choices,
              { key: nextKey++, name: '', course: '', options: [blankOption(), blankOption()] },
            ])
          }
        >
          {t.addChoice}
        </Button>
      ) : null}
    </section>
  );
}

/** The kitchenware a recipe needs: picked from the kitchen's, or named (it is added then). */
function ToolsEditor({
  tools,
  onChange,
}: {
  tools: ToolRow[];
  onChange: (tools: ToolRow[]) => void;
}) {
  const t = useRecipesT();
  const kitchenware = useQuery({ queryKey: foodKeys.kitchenware, queryFn: kitchenwareApi.list });
  const [name, setName] = useState('');
  const have = new Set(tools.map((t) => t.toolId ?? t.name.toLowerCase()));
  const offer = [
    ...(kitchenware.data?.tools ?? []).map((tool) => ({
      toolId: tool.id,
      name: tool.name,
      translations: tool.translations,
      icon: tool.icon,
    })),
    ...(kitchenware.data?.presets ?? [])
      .filter((p) => !(kitchenware.data?.tools ?? []).some((tool) => tool.name === p.name))
      .map((p: { name: string; icon: string; translations?: Translations }) => ({
        toolId: undefined,
        name: p.name,
        translations: p.translations,
        icon: p.icon,
      })),
  ].filter((tool) => !have.has(tool.toolId ?? tool.name.toLowerCase()));
  const kindOf = (tool: { toolId?: string; name: string }) =>
    kitchenware.data?.tools.find((known) => known.id === tool.toolId)?.kind ??
    kitchenware.data?.presets.find((p) => p.name === tool.name)?.kind ??
    'other';
  // Plates, cutlery, glasses, lunch boxes: one each, by default.
  const add = (tool: Omit<ToolRow, 'count' | 'perServing' | 'or'>) =>
    onChange([...tools, { ...tool, count: 1, perServing: kindOf(tool) === 'dishes', or: [] }]);
  // Picking what can be used instead of this one (the grill for the frying pan).
  const [orFor, setOrFor] = useState<number | null>(null);
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-h3 font-bold">{t.kitchenware}</h2>
      <div className="rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {tools.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {tools.map((tool, index) => (
              <li
                key={tool.toolId ?? tool.name}
                className="inline-flex h-10 items-center gap-1 rounded-pill bg-butter-100 pl-1 pr-1"
              >
                <FoodIcon name={tool.icon} className="size-7" />
                <span className="text-sm font-semibold">
                  {tr(tool, 'name')}
                  {tool.or.length ? (
                    <span className="font-medium text-ink-600">
                      {' '}
                      {t.orTools(tool.or.map((o) => tr(o, 'name').toLowerCase()))}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-pressed={tool.perServing}
                  title={t.oneEachTitle}
                  onClick={() =>
                    onChange(
                      tools.map((t, i) => (i === index ? { ...t, perServing: !t.perServing } : t)),
                    )
                  }
                  className={cx(
                    'press h-7 rounded-pill px-2 text-xs font-bold',
                    tool.perServing ? 'bg-ink-900 text-white' : 'bg-white text-ink-600',
                  )}
                >
                  {t.each}
                </button>
                <button
                  type="button"
                  aria-pressed={orFor === index}
                  onClick={() => setOrFor(orFor === index ? null : index)}
                  className="press h-7 rounded-pill bg-white px-2 text-xs font-bold text-lav-800"
                >
                  {t.orMore}
                </button>
                <button
                  type="button"
                  aria-label={t.howMany(tr(tool, 'name'), tool.count)}
                  onClick={() =>
                    onChange(
                      tools.map((t, i) =>
                        i === index ? { ...t, count: t.count >= 4 ? 1 : t.count + 1 } : t,
                      ),
                    )
                  }
                  className="press tabular grid h-7 min-w-7 place-items-center rounded-full bg-white px-1.5 text-xs font-bold"
                >
                  ×{tool.count}
                </button>
                <button
                  type="button"
                  aria-label={t.remove(tr(tool, 'name'))}
                  onClick={() => onChange(tools.filter((_, i) => i !== index))}
                  className="press grid size-7 place-items-center rounded-full text-ink-600 hover:bg-white"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-ink-600">{t.toolsEmpty}</p>
        )}
        {orFor !== null && tools[orFor] ? (
          <p className="mt-2.5 px-1 text-xs font-semibold text-lav-800">
            {t.insteadOf(tr(tools[orFor], 'name').toLowerCase())}
          </p>
        ) : null}
        <div className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:flex-wrap">
          {offer.slice(0, 16).map((tool) => (
            <button
              key={tool.toolId ?? tool.name}
              type="button"
              onClick={() => {
                if (orFor !== null && tools[orFor]) {
                  onChange(
                    tools.map((t, i) =>
                      i === orFor
                        ? {
                            ...t,
                            or: [
                              ...t.or,
                              {
                                toolId: tool.toolId,
                                name: tool.name,
                                translations: tool.translations,
                              },
                            ],
                          }
                        : t,
                    ),
                  );
                  setOrFor(null);
                } else add(tool);
              }}
              className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-ink-50 pl-1 pr-3 text-sm font-semibold hover:bg-ink-100"
            >
              <FoodIcon name={tool.icon} className="size-6" />
              {tr(tool, 'name')}
            </button>
          ))}
          <span className="inline-flex h-9 shrink-0 items-center rounded-pill bg-ink-50 pl-3 pr-1">
            <input
              aria-label={t.otherTool}
              value={name}
              placeholder={t.otherPlaceholder}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !name.trim()) return;
                event.preventDefault();
                add({ name: name.trim(), icon: 'box' });
                setName('');
              }}
              className="w-24 bg-transparent text-sm outline-none placeholder:text-ink-500"
            />
            {name.trim() ? (
              <button
                type="button"
                aria-label={t.add}
                onClick={() => {
                  add({ name: name.trim(), icon: 'box' });
                  setName('');
                }}
                className="press grid size-7 place-items-center rounded-full bg-ink-900 text-white"
              >
                <AddIcon fontSize="inherit" />
              </button>
            ) : null}
          </span>
        </div>
      </div>
    </section>
  );
}
