import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
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
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys, kitchenwareApi } from '../api';
import { useCatalog, useProductSearch } from '../catalog';
import { parseAmount, unitsFor } from '../format';
import { FOOD_ICON_KEYS } from '../icons/art';
import { FoodIcon } from '../icons/FoodIcon';
import type { Recipe, RecipeInput, ToolNeedInput, Unit } from '../types';

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
}

let nextKey = 1;
const blankRow = (): Row => ({
  key: nextKey++,
  name: '',
  amount: '',
  unit: '',
  note: '',
  optional: false,
  variant: '',
  or: '',
  kept: true,
});

interface ToolRow {
  toolId?: string;
  name: string;
  icon: string;
  count: number;
  /** One each: times the servings (plates, cutlery, lunch boxes). */
  perServing: boolean;
  /** Or one of these instead (the grill for a frying pan). */
  or: Array<{ toolId?: string; name: string }>;
}

/**
 * Write or change a recipe: ingredients linked to the kitchen (with a kind when only one will do,
 * and what can go in instead), the kitchenware it needs, steps in order.
 */
export default function RecipeEditorPage() {
  const { id } = useParams();
  const recipe = useQuery({
    queryKey: foodKeys.recipe(id ?? '', undefined),
    queryFn: () => foodApi.recipe(id!),
    enabled: Boolean(id),
  });
  if (id && recipe.isPending) {
    return (
      <Screen tone="white">
        <PageHeader back={`/food/recipes/${id}`} title="Edit recipe" centered />
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [icon, setIcon] = useState(initial?.icon ?? 'pot');
  const [allIcons, setAllIcons] = useState(false);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [servings, setServings] = useState(initial?.servings ?? 2);
  const [prep, setPrep] = useState(initial?.prepMinutes ? String(initial.prepMinutes) : '');
  const [cook, setCook] = useState(initial?.cookMinutes ? String(initial.cookMinutes) : '');
  const [tags, setTags] = useState(initial?.tags.join(', ') ?? '');
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.ingredients.length
      ? initial.ingredients.map((i) => ({
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
        }))
      : [blankRow(), blankRow()],
  );
  const [tools, setTools] = useState<ToolRow[]>(() =>
    (initial?.tools ?? []).map((t) => ({
      toolId: t.toolId,
      name: t.name,
      icon: t.icon,
      // A per-serving need comes back times the servings shown: kept per person here.
      count: t.perServing
        ? Math.max(1, Math.round(t.count / Math.max(1, initial?.shownServings ?? 1)))
        : t.count,
      perServing: t.perServing,
      or: t.options
        .filter((o) => o.toolId !== t.toolId)
        .map((o) => ({ toolId: o.toolId, name: o.name })),
    })),
  );
  const [steps, setSteps] = useState<string[]>(initial?.steps.length ? initial.steps : ['']);
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [favorite, setFavorite] = useState(initial?.favorite ?? false);
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
    ingredients: rows
      .filter((r) => r.name.trim())
      .map((r) => ({
        ...(r.productId ? { productId: r.productId } : {}),
        name: r.name.trim(),
        amount: parseAmount(r.amount),
        unit: parseAmount(r.amount) && r.unit ? r.unit : null,
        note: r.note.trim(),
        optional: r.optional,
        ...(r.kept ? {} : { link: false }),
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
      })),
    tools: tools.map((t): ToolNeedInput => ({
      ...(t.toolId ? { toolId: t.toolId } : { name: t.name }),
      count: t.count,
      perServing: t.perServing,
      or: t.or.map((o) => (o.toolId ? { toolId: o.toolId } : { name: o.name })),
    })),
  });

  const save = useMutation({
    mutationFn: () =>
      initial ? foodApi.updateRecipe(initial.id, body()) : foodApi.createRecipe(body()),
    onSuccess: (saved) => {
      haptic('success');
      toast.success(initial ? 'Recipe saved' : 'Recipe added');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      navigate(`/food/recipes/${saved.id}`, { replace: true });
    },
    onError: () => haptic('error'),
  });
  const remove = useMutation({
    mutationFn: () => foodApi.deleteRecipe(initial!.id),
    onSuccess: () => {
      toast.success('Recipe deleted');
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const iconChoices = allIcons
    ? FOOD_ICON_KEYS
    : DISHES.includes(icon)
      ? DISHES
      : [icon, ...DISHES];

  return (
    <Screen tone="white">
      <PageHeader
        back={initial ? `/food/recipes/${initial.id}` : '/food/recipes'}
        title={initial ? 'Edit recipe' : 'New recipe'}
        centered
      />
      <form
        onSubmit={submit}
        noValidate
        className="gutter-x mx-auto mt-6 flex max-w-2xl flex-col gap-6 md:max-w-3xl md:px-5 lg:px-8"
      >
        <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <TextField
            label="Name"
            placeholder="Chicken soup"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={fields.title}
            maxLength={120}
            autoFocus={!initial}
          />
          <fieldset>
            <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">Picture</legend>
            <div
              role="radiogroup"
              aria-label="Picture"
              className={cx(
                'grid grid-cols-7 gap-1.5',
                allIcons && 'max-h-60 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-10',
              )}
            >
              {iconChoices.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={icon === key}
                  aria-label={key.replace('-', ' ')}
                  onClick={() => setIcon(key)}
                  className={cx(
                    'press grid aspect-square place-items-center rounded-xl transition-colors',
                    icon === key
                      ? 'bg-butter-100 shadow-[inset_0_0_0_2px_var(--color-ink-900)]'
                      : 'hover:bg-ink-50',
                  )}
                >
                  <FoodIcon name={key} className="size-8" />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAllIcons((v) => !v)}
              className="mt-2 text-sm font-semibold text-lav-700 hover:text-lav-800"
            >
              {allIcons ? 'Fewer pictures' : 'All pictures'}
            </button>
          </fieldset>
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">About it</span>
            <textarea
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional: what it is, why it’s good"
              maxLength={1000}
              className="min-h-20 resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <div className="grid grid-cols-[8.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">Serves</span>
              <div className="flex h-14 items-center justify-between rounded-[1.125rem] bg-ink-50 px-1.5">
                <button
                  type="button"
                  aria-label="Fewer servings"
                  disabled={servings <= 1}
                  onClick={() => setServings((v) => v - 1)}
                  className="press grid size-10 place-items-center rounded-xl bg-white text-lg shadow-xs disabled:opacity-40"
                >
                  <RemoveIcon fontSize="inherit" />
                </button>
                <span className="tabular font-bold">{servings}</span>
                <button
                  type="button"
                  aria-label="More servings"
                  onClick={() => setServings((v) => Math.min(100, v + 1))}
                  className="press grid size-10 place-items-center rounded-xl bg-ink-900 text-lg text-white"
                >
                  <AddIcon fontSize="inherit" />
                </button>
              </div>
            </div>
            <TextField
              label="Prep (min)"
              inputMode="numeric"
              placeholder="—"
              value={prep}
              onChange={(event) => setPrep(event.target.value)}
            />
            <TextField
              label="Cook (min)"
              inputMode="numeric"
              placeholder="—"
              value={cook}
              onChange={(event) => setCook(event.target.value)}
            />
          </div>
          <TextField
            label="Tags"
            placeholder="dinner, quick, soup"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            hint="Separate with commas"
          />
        </section>

        <section>
          <h2 className="mb-2.5 px-1 text-h3 font-bold">Ingredients</h2>
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
            Add ingredient
          </Button>
        </section>

        <ToolsEditor tools={tools} onChange={setTools} />

        <section>
          <h2 className="mb-2.5 px-1 text-h3 font-bold">Steps</h2>
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
                  aria-label={`Step ${index + 1}`}
                  rows={2}
                  value={step}
                  placeholder={index === 0 ? 'Chop the onion and fry it until soft.' : 'Next step'}
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
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => setSteps((current) => swap(current, index, index - 1))}
                    className="press grid size-8 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"
                  >
                    <ArrowUpIcon fontSize="inherit" />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === steps.length - 1}
                    onClick={() => setSteps((current) => swap(current, index, index + 1))}
                    className="press grid size-8 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-30"
                  >
                    <ArrowDownIcon fontSize="inherit" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove step"
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
            Add step
          </Button>
        </section>

        <section className="flex flex-col gap-4 rounded-[2rem] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <TextField
            label="Link to the original"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            error={fields.sourceUrl}
          />
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Tips, swaps, what the kids think of it"
              maxLength={2000}
              className="min-h-24 resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <Switch checked={favorite} onChange={setFavorite} label="Favourite" />
        </section>

        {save.error && !Object.keys(fields).length ? (
          <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
        ) : null}
        {Object.keys(fields).some((k) => k.startsWith('ingredients')) ? (
          <p className="text-sm font-medium text-danger-600">
            Check the ingredients marked in red.
          </p>
        ) : null}

        <div className="flex flex-col gap-2.5 pb-4 sm:flex-row-reverse">
          <Button type="submit" fullWidth loading={save.isPending} disabled={!title.trim()}>
            {initial ? 'Save recipe' : 'Add recipe'}
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
              Delete recipe
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
          title={`Delete ${initial.title}?`}
          description="Meals already planned with it keep their own copy."
          confirmLabel="Delete"
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
          aria-label="Ingredient"
          value={row.name}
          placeholder="Ingredient"
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
          aria-label="Remove ingredient"
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
          aria-label="Amount"
          inputMode="decimal"
          value={row.amount}
          placeholder="Amount"
          onChange={(event) => onChange({ ...row, amount: event.target.value })}
          className="tabular h-10 min-w-0 rounded-xl bg-ink-50 px-3 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
        <select
          aria-label="Unit"
          value={row.unit}
          onChange={(event) => onChange({ ...row, unit: event.target.value })}
          className={cx(
            'h-10 min-w-0 rounded-xl bg-ink-50 px-2 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]',
            error && 'bg-danger-50',
          )}
        >
          <option value="">unit</option>
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <input
          aria-label="Note"
          value={row.note}
          placeholder="diced, to taste…"
          onChange={(event) => onChange({ ...row, note: event.target.value })}
          maxLength={120}
          className="h-10 min-w-0 rounded-xl bg-ink-50 px-3 text-[0.9375rem] outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 pl-[3.25rem]">
        {product?.variants.length || row.variant ? (
          <select
            aria-label="Kind"
            value={row.variant}
            onChange={(event) => onChange({ ...row, variant: event.target.value })}
            className="h-10 min-w-0 rounded-xl bg-ink-50 px-2 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            <option value="">Any kind</option>
            {[
              ...new Set([...(product?.variants ?? []), ...(row.variant ? [row.variant] : [])]),
            ].map((v) => (
              <option key={v} value={v}>
                Only {v}
              </option>
            ))}
          </select>
        ) : (
          <span />
        )}
        <input
          aria-label="Or instead"
          value={row.or}
          placeholder="Or instead: cream…"
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
          Optional
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={!row.kept}
            onChange={(event) => onChange({ ...row, kept: !event.target.checked })}
            className="size-4 accent-ink-900"
          />
          Not kept in the kitchen (tap water)
        </label>
      </div>
      {error ? (
        <p className="mt-1.5 pl-[3.25rem] text-sm font-medium text-danger-600">{error}</p>
      ) : null}
    </li>
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
  const kitchenware = useQuery({ queryKey: foodKeys.kitchenware, queryFn: kitchenwareApi.list });
  const [name, setName] = useState('');
  const have = new Set(tools.map((t) => t.toolId ?? t.name.toLowerCase()));
  const offer = [
    ...(kitchenware.data?.tools ?? []).map((t) => ({ toolId: t.id, name: t.name, icon: t.icon })),
    ...(kitchenware.data?.presets ?? [])
      .filter((p) => !(kitchenware.data?.tools ?? []).some((t) => t.name === p.name))
      .map((p) => ({ toolId: undefined, name: p.name, icon: p.icon })),
  ].filter((t) => !have.has(t.toolId ?? t.name.toLowerCase()));
  const kindOf = (tool: { toolId?: string; name: string }) =>
    kitchenware.data?.tools.find((t) => t.id === tool.toolId)?.kind ??
    kitchenware.data?.presets.find((p) => p.name === tool.name)?.kind ??
    'other';
  // Plates, cutlery, glasses, lunch boxes: one each, by default.
  const add = (tool: Omit<ToolRow, 'count' | 'perServing' | 'or'>) =>
    onChange([...tools, { ...tool, count: 1, perServing: kindOf(tool) === 'dishes', or: [] }]);
  // Picking what can be used instead of this one (the grill for the frying pan).
  const [orFor, setOrFor] = useState<number | null>(null);
  return (
    <section>
      <h2 className="mb-2.5 px-1 text-h3 font-bold">Kitchenware</h2>
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
                  {tool.name}
                  {tool.or.length ? (
                    <span className="font-medium text-ink-600">
                      {' '}
                      or {tool.or.map((o) => o.name.toLowerCase()).join(', or ')}
                    </span>
                  ) : null}
                </span>
                <button
                  type="button"
                  aria-pressed={tool.perServing}
                  title="One for each serving"
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
                  each
                </button>
                <button
                  type="button"
                  aria-pressed={orFor === index}
                  onClick={() => setOrFor(orFor === index ? null : index)}
                  className="press h-7 rounded-pill bg-white px-2 text-xs font-bold text-lav-800"
                >
                  or…
                </button>
                <button
                  type="button"
                  aria-label={`How many ${tool.name}: ${tool.count}; tap for more`}
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
                  aria-label={`Remove ${tool.name}`}
                  onClick={() => onChange(tools.filter((_, i) => i !== index))}
                  className="press grid size-7 place-items-center rounded-full text-ink-600 hover:bg-white"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-sm text-ink-600">
            What it’s cooked in: a big pot, a frying pan, a colander…
          </p>
        )}
        {orFor !== null && tools[orFor] ? (
          <p className="mt-2.5 px-1 text-xs font-semibold text-lav-800">
            Tap what can be used instead of the {tools[orFor].name.toLowerCase()}:
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
                        ? { ...t, or: [...t.or, { toolId: tool.toolId, name: tool.name }] }
                        : t,
                    ),
                  );
                  setOrFor(null);
                } else add(tool);
              }}
              className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-ink-50 pl-1 pr-3 text-sm font-semibold hover:bg-ink-100"
            >
              <FoodIcon name={tool.icon} className="size-6" />
              {tool.name}
            </button>
          ))}
          <span className="inline-flex h-9 shrink-0 items-center rounded-pill bg-ink-50 pl-3 pr-1">
            <input
              aria-label="Other kitchenware"
              value={name}
              placeholder="Other…"
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
                aria-label="Add"
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
