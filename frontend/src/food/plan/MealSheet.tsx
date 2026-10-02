import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, Sheet, toast } from '@/components/ui';
import { AddIcon, ArrowOutIcon, CheckIcon, DeleteIcon, RemoveIcon, UndoIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { MealStatus } from '../components/MealStatus';
import { dayLong, formatAmount, formatQty, parseAmount, plural, SLOT_LABEL } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { IngredientInput, IngredientLine, Meal, StockedProduct } from '../types';

/**
 * One planned meal: when, for how many, what it takes from the kitchen (change an amount or pick
 * the exact piece for this day only), and the big button: eaten. Eaten takes the ingredients out
 * of the kitchen, with Undo; a done meal can be reopened to put them back.
 */
export function MealSheet({ meal, kitchen, onClose }: { meal: Meal | null; kitchen: StockedProduct[]; onClose: () => void }) {
  return (
    <Sheet
      open={Boolean(meal)}
      onClose={onClose}
      title={meal?.title ?? 'Meal'}
      description={meal ? `${dayLong(meal.date)} · ${meal.time ?? SLOT_LABEL[meal.slot]}` : undefined}
      size="lg"
    >
      {meal ? <MealBody key={`${meal.id}-${meal.status}-${meal.servings}`} meal={meal} kitchen={kitchen} onClose={onClose} /> : null}
    </Sheet>
  );
}

type Draft = Record<string, { amount: string; lotId: string | null }>;

function MealBody({ meal, kitchen, onClose }: { meal: Meal; kitchen: StockedProduct[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });
  const [leftovers, setLeftovers] = useState(0);
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(meal.ingredients.map((i) => [i.id, { amount: i.amount === null ? '' : String(i.amount), lotId: i.lotId }])),
  );
  const dirty = meal.ingredients.some((i) => {
    const d = draft[i.id]!;
    return (parseAmount(d.amount) ?? null) !== i.amount || d.lotId !== i.lotId;
  });
  const done = meal.status === 'done';

  const saveIngredients = useMutation({
    mutationFn: () =>
      foodApi.setMealIngredients(
        meal.id,
        meal.ingredients.map(
          (i): IngredientInput => ({
            ...(i.productId ? { productId: i.productId } : { link: false }),
            name: i.name,
            amount: parseAmount(draft[i.id]!.amount),
            unit: parseAmount(draft[i.id]!.amount) ? (i.unit ?? i.baseUnit) : null,
            note: i.note,
            optional: i.optional,
            lotId: draft[i.id]!.lotId,
          }),
        ),
      ),
    onSuccess: () => {
      toast.success('Changed for this meal');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const eat = useMutation({
    mutationFn: async () => {
      if (dirty) await saveIngredients.mutateAsync();
      return foodApi.completeMeal(meal.id, leftovers ? { leftovers: { portions: leftovers } } : {});
    },
    onSuccess: ({ shortfalls }) => {
      haptic('success');
      void refresh();
      toast.success(`${meal.title} — eaten`, {
        description: shortfalls.length ? `Not enough: ${shortfalls.map((s) => s.name).join(', ')}` : 'The ingredients are out of the kitchen.',
        action: { label: 'Undo', onClick: () => void foodApi.reopenMeal(meal.id).then(refresh) },
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reopen = useMutation({
    mutationFn: () => foodApi.reopenMeal(meal.id),
    onSuccess: () => {
      toast.success('Back to planned', { description: 'What it used is back in the kitchen.' });
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const servings = useMutation({
    mutationFn: (value: number) => foodApi.updateMeal(meal.id, { servings: value }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const skip = useMutation({
    mutationFn: () => foodApi.updateMeal(meal.id, { status: meal.status === 'skipped' ? 'planned' : 'skipped' }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => foodApi.deleteMeal(meal.id),
    onSuccess: () => {
      toast.success('Removed from the plan');
      void refresh();
      onClose();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MealStatus meal={meal} />
        {meal.recipeId ? (
          <Link to={`/food/recipes/${meal.recipeId}`} className="inline-flex h-7 items-center gap-1 rounded-pill bg-lav-100 px-2.5 text-xs font-semibold text-lav-800 hover:bg-lav-200">
            Recipe
            <ArrowOutIcon fontSize="inherit" className="text-sm" />
          </Link>
        ) : null}
        <div className="ml-auto flex items-center gap-1 rounded-pill bg-ink-50 p-1">
          <button
            type="button"
            aria-label="Fewer servings"
            disabled={done || meal.servings <= 1 || servings.isPending}
            onClick={() => servings.mutate(meal.servings - 1)}
            className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40"
          >
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular min-w-[4.75rem] text-center text-sm font-semibold">{plural(meal.servings, 'serving')}</span>
          <button
            type="button"
            aria-label="More servings"
            disabled={done || servings.isPending}
            onClick={() => servings.mutate(meal.servings + 1)}
            className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white disabled:opacity-40"
          >
            <AddIcon fontSize="inherit" />
          </button>
        </div>
      </div>

      {meal.ingredients.length ? (
        <ul className="flex flex-col divide-y divide-ink-100 rounded-[1.25rem] bg-white ring-1 ring-inset ring-ink-100">
          {meal.ingredients.map((line) => (
            <IngredientRow
              key={line.id}
              line={line}
              product={kitchen.find((p) => p.id === line.productId)}
              draft={draft[line.id]!}
              disabled={done}
              onChange={(next) => setDraft((current) => ({ ...current, [line.id]: next }))}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">No ingredients: nothing leaves the kitchen when it’s eaten.</p>
      )}

      {dirty && !done ? (
        <Button variant="tint" size="md" onClick={() => saveIngredients.mutate()} loading={saveIngredients.isPending}>
          Save changes for this meal
        </Button>
      ) : null}

      {done ? (
        <Button fullWidth variant="tint" icon={UndoIcon} onClick={() => reopen.mutate()} loading={reopen.isPending}>
          Not eaten after all (put it back)
        </Button>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3.5 py-2.5">
            <span className="text-sm font-semibold">Leftovers to keep</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Fewer portions" disabled={!leftovers} onClick={() => setLeftovers((v) => v - 1)} className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40">
                <RemoveIcon fontSize="inherit" />
              </button>
              <span className="tabular w-7 text-center font-bold">{leftovers}</span>
              <button type="button" aria-label="More portions" onClick={() => setLeftovers((v) => Math.min(20, v + 1))} className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white">
                <AddIcon fontSize="inherit" />
              </button>
            </div>
          </div>
          <Button fullWidth icon={CheckIcon} onClick={() => eat.mutate()} loading={eat.isPending}>
            Eaten
          </Button>
        </>
      )}

      <div className="flex gap-2">
        {!done ? (
          <Button size="sm" variant="ghost" fullWidth onClick={() => skip.mutate()} loading={skip.isPending}>
            {meal.status === 'skipped' ? 'Not skipped' : 'Skip it'}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" fullWidth icon={DeleteIcon} className="text-danger-600" onClick={() => remove.mutate()} loading={remove.isPending}>
          Remove
        </Button>
      </div>
    </div>
  );
}

function IngredientRow({
  line,
  product,
  draft,
  disabled,
  onChange,
}: {
  line: IngredientLine;
  product?: StockedProduct;
  draft: { amount: string; lotId: string | null };
  disabled: boolean;
  onChange: (next: { amount: string; lotId: string | null }) => void;
}) {
  const lots = product?.trackMode === 'exact' ? product.lots : [];
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <FoodIconTile name={line.icon} className="size-9 rounded-xl [&>svg]:size-6" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">
            {line.name}
            {line.optional ? <span className="font-medium text-ink-500"> (optional)</span> : null}
          </span>
          <span className={cx('block truncate text-xs', line.enough === false ? 'font-semibold text-peach-800' : 'text-ink-600')}>
            {line.level
              ? line.level === 'full'
                ? 'In the kitchen'
                : line.level === 'low'
                  ? 'Running low'
                  : 'Out'
              : line.enough === false
                ? `Missing ${line.missing && line.baseUnit ? formatQty(line.missing, { unit: line.baseUnit }) : 'some'}`
                : line.inStock !== null && line.baseUnit
                  ? `${formatQty(line.inStock, { unit: line.baseUnit })} in the kitchen`
                  : line.note || 'Not kept in the kitchen'}
          </span>
        </span>
        {line.unit && line.amount !== null && !disabled ? (
          <label className="flex w-24 shrink-0 items-center rounded-xl bg-ink-50 px-2.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
            <span className="sr-only">Amount of {line.name}</span>
            <input
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => onChange({ ...draft, amount: event.target.value })}
              className="tabular h-9 w-full min-w-0 bg-transparent text-right text-sm font-semibold outline-none"
            />
            <span className="ml-1 text-xs text-ink-500">{line.unit}</span>
          </label>
        ) : line.amount !== null && line.unit ? (
          <span className="tabular shrink-0 text-sm font-semibold">{formatAmount(line.amount, line.unit)}</span>
        ) : null}
      </div>
      {lots.length > 1 && !disabled ? (
        <label className="ml-[2.875rem] flex items-center gap-2 text-xs text-ink-600">
          <span>Use</span>
          <select
            value={draft.lotId ?? ''}
            onChange={(event) => onChange({ ...draft, lotId: event.target.value || null })}
            className="h-8 min-w-0 flex-1 rounded-lg bg-ink-50 px-2 text-xs font-semibold text-ink-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            <option value="">first to expire</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {formatQty(lot.quantity, product!)}
                {lot.expiresOn ? ` · until ${lot.expiresOn.slice(5)}` : ''} · {lot.location}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </li>
  );
}
