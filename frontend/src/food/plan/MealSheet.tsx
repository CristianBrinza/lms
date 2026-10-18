import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, IconButton, Sheet, Switch, toast } from '@/components/ui';
import {
  AddIcon,
  AddShoppingCartIcon,
  ArrowOutIcon,
  CheckIcon,
  CloseIcon,
  DeleteIcon,
  RemoveIcon,
  SearchIcon,
  UndoIcon,
} from '@/components/ui/icons';
import { formatList, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys, peopleApi } from '../api';
import { normalize, useCatalog } from '../catalog';
import { AddToListSheet } from '../components/AddToListSheet';
import { isIncluded, sectionsOf } from '../choices';
import { SectionHeading } from '../components/SectionHeading';
import { ChoiceSwitch } from '../components/ChoiceSwitch';
import { MealStatus } from '../components/MealStatus';
import { NutritionStrip } from '../components/NutritionStrip';
import { WhoEats } from '../components/WhoEats';
import { formatKcal } from '../nutrition';
import { OptionChips } from '../components/OptionChips';
import { EatOutSheet } from './EatOutSheet';
import { KindPicker } from './KindPicker';
import { hasKinds } from '../lots';
import { clockTime, dayAndMonth, dayLong, usePlanT } from './i18n';
import { formatAmount, formatQty, LOCATION_LABEL, parseAmount, trText } from '../format';
import { openedText } from '../opened';
import { FoodIconTile } from '../icons/FoodIcon';
import { parseLine } from '../shopping/parseLine';
import type {
  IngredientInput,
  IngredientLine,
  Meal,
  MealPart,
  PartKind,
  StockedProduct,
  ToolNeed,
} from '../types';

/**
 * One meal on the plan, which can be several things — an omelette, a coffee, bread with
 * Philadelphia and salmon on the side, a sauce: when, for how many, each part with what it takes
 * from the kitchen (change an amount or pick the exact piece, for this day only), what instead
 * when there isn't enough, the kitchenware and whether it's clean, and the big button: eaten. A
 * recipe's choice (coffee or tea) switches here; an optional line can be left out this time. A
 * sheet on phones; a panel beside the day on tablets (MealPanel).
 */
export function MealSheet({
  meal,
  kitchen,
  onClose,
}: {
  meal: Meal | null;
  kitchen: StockedProduct[];
  onClose: () => void;
}) {
  const t = usePlanT();
  return (
    <Sheet
      open={Boolean(meal)}
      onClose={onClose}
      title={meal ? tr(meal, 'title') : t.meal}
      description={meal ? `${dayLong(meal.date)} · ${meal.time ?? t.slot[meal.slot]}` : undefined}
      size="lg"
    >
      {meal ? (
        <MealBody
          key={`${meal.id}-${meal.status}-${meal.servings}-${meal.ingredients.length}-${mealChoices(meal)}`}
          meal={meal}
          kitchen={kitchen}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

export function MealPanel({
  meal,
  kitchen,
  onClose,
}: {
  meal: Meal;
  kitchen: StockedProduct[];
  onClose: () => void;
}) {
  const t = usePlanT();
  return (
    <section
      aria-label={tr(meal, 'title')}
      className="animate-fade-in rounded-[1.75rem] bg-white p-5 shadow-[var(--shadow-card)]"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h2 font-bold leading-tight">{tr(meal, 'title')}</h2>
          <p className="mt-1 text-[0.9375rem] text-ink-600">
            {dayLong(meal.date)} · {meal.time ?? t.slot[meal.slot]}
          </p>
        </div>
        <IconButton
          icon={CloseIcon}
          label={t.close}
          size="sm"
          variant="outline"
          onClick={onClose}
        />
      </header>
      <MealBody
        key={`${meal.id}-${meal.status}-${meal.servings}-${meal.ingredients.length}-${mealChoices(meal)}`}
        meal={meal}
        kitchen={kitchen}
        onClose={onClose}
      />
    </section>
  );
}

/** A line as changed here before saving: its amount, the piece, the kind (which tea). */
type LineDraft = { amount: string; lotId: string | null; variant: string };
type Draft = Record<string, LineDraft>;

/** The options a meal's parts make: switching one remounts the body, its lines being new. */
const mealChoices = (meal: Meal) =>
  meal.parts.flatMap((part) => part.choices.map((choice) => choice.chosen)).join(',');

/** Lines as the API takes them back, keeping what each one is (its part, kind, alternatives). */
function asInput(
  line: IngredientLine,
  draft: LineDraft | undefined,
): IngredientInput {
  const amount = draft ? parseAmount(draft.amount) : line.amount;
  return {
    ...(line.productId ? { productId: line.productId } : { link: false }),
    name: line.name,
    amount,
    unit: amount ? (line.unit ?? line.baseUnit) : null,
    note: line.note,
    optional: line.optional,
    lotId: draft ? draft.lotId : line.lotId,
    partId: line.partId,
    optionId: line.optionId,
    course: line.course,
    // Lines not kept in the kitchen keep their names in other languages.
    ...(!line.productId && line.translations ? { translations: line.translations } : {}),
    ...(line.optional && line.included !== null ? { included: line.included } : {}),
    ...((draft ? draft.variant : line.variant) ? { variant: draft ? draft.variant : line.variant } : {}),
    ...(line.alternatives.length
      ? {
          or: line.alternatives.map((alt) => ({
            ...(alt.productId ? { productId: alt.productId } : {}),
            name: alt.name,
            amount: alt.amount,
            unit: alt.unit,
            variant: alt.variant || undefined,
          })),
        }
      : {}),
  };
}

function MealBody({
  meal,
  kitchen,
  onClose,
}: {
  meal: Meal;
  kitchen: StockedProduct[];
  onClose: () => void;
}) {
  const t = usePlanT();
  const title = tr(meal, 'title');
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });
  const [leftovers, setLeftovers] = useState(0);
  const [missing, setMissing] = useState<IngredientLine | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [eatingOut, setEatingOut] = useState(false);
  const [moving, setMoving] = useState(false);
  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(
      meal.ingredients.map((i) => [
        i.id,
        { amount: i.amount === null ? '' : String(i.amount), lotId: i.lotId, variant: i.variant },
      ]),
    ),
  );
  const dirty = meal.ingredients.some((i) => {
    const d = draft[i.id]!;
    return (
      (parseAmount(d.amount) ?? null) !== i.amount || d.lotId !== i.lotId || d.variant !== i.variant
    );
  });
  const done = meal.status === 'done';

  const saveIngredients = useMutation({
    mutationFn: () =>
      foodApi.setMealIngredients(
        meal.id,
        meal.ingredients.map((i) => asInput(i, draft[i.id])),
      ),
    onSuccess: () => {
      toast.success(t.changedForMeal);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const eat = useMutation({
    mutationFn: async () => {
      if (dirty) await saveIngredients.mutateAsync();
      return foodApi.completeMeal(meal.id, leftovers ? { leftovers: { portions: leftovers } } : {});
    },
    onSuccess: ({ shortfalls, opened }) => {
      haptic('success');
      void refresh();
      toast.success(t.eaten(title), {
        duration: opened.length ? 9000 : undefined,
        description:
          [
            shortfalls.length
              ? t.notEnough(formatList(shortfalls.map((s) => tr(s, 'name'))))
              : null,
            opened.length ? t.opened(openedText(opened)) : null,
          ]
            .filter(Boolean)
            .join(' ') || t.outOfKitchen,
        action: { label: t.undo, onClick: () => void foodApi.reopenMeal(meal.id).then(refresh) },
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const reopen = useMutation({
    mutationFn: () => foodApi.reopenMeal(meal.id),
    onSuccess: () => {
      toast.success(t.backToPlanned, { description: t.backToPlannedText });
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const update = useMutation({
    mutationFn: (body: Parameters<typeof foodApi.updateMeal>[1]) =>
      foodApi.updateMeal(meal.id, body),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const people = useQuery({ queryKey: foodKeys.people, queryFn: peopleApi.list });
  const household = people.data?.people ?? [];
  // Who eats, as tapped: shown at once, saved behind.
  const eaters =
    update.isPending && update.variables.eaters ? update.variables.eaters : meal.eaters;
  const skip = useMutation({
    mutationFn: () =>
      foodApi.updateMeal(meal.id, { status: meal.status === 'skipped' ? 'planned' : 'skipped' }),
    onSuccess: () => {
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => foodApi.deleteMeal(meal.id),
    onSuccess: () => {
      toast.success(t.removedFromPlan);
      void refresh();
      onClose();
    },
  });

  // Lines grouped by part, in the meal's order; lines of no part last.
  const groups: Array<{ part: MealPart | null; lines: IngredientLine[] }> = [
    ...meal.parts.map((part) => ({
      part,
      lines: meal.ingredients.filter((i) => i.partId === part.id),
    })),
    {
      part: null,
      lines: meal.ingredients.filter(
        (i) => !i.partId || !meal.parts.some((p) => p.id === i.partId),
      ),
    },
  ].filter((group) => group.part || group.lines.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <MealStatus meal={meal} />
        {meal.recipeId && meal.parts.length <= 1 ? (
          <Link
            to={`/food/recipes/${meal.recipeId}`}
            className="inline-flex h-7 items-center gap-1 rounded-pill bg-lav-100 px-2.5 text-xs font-semibold text-lav-800 hover:bg-lav-200"
          >
            {t.recipe}
            <ArrowOutIcon fontSize="inherit" className="text-sm" />
          </Link>
        ) : null}
        {!done ? (
          <button
            type="button"
            onClick={() => setMoving((v) => !v)}
            className="press inline-flex h-7 items-center rounded-pill bg-ink-50 px-2.5 text-xs font-semibold text-ink-700 hover:bg-ink-100"
          >
            {moving ? t.done : t.move}
          </button>
        ) : null}
        <Stepper
          fewer={t.fewerServings}
          more={t.moreServings}
          format={t.servings}
          value={meal.servings}
          disabled={done || update.isPending}
          onChange={(value) => update.mutate({ servings: value })}
          className="ml-auto"
        />
      </div>

      {moving && !done ? (
        <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-ink-50 p-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
            {t.day}
            <input
              type="date"
              defaultValue={meal.date}
              onChange={(event) =>
                event.target.value && update.mutate({ date: event.target.value })
              }
              className="h-10 rounded-xl bg-white px-2 text-sm outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-ink-700">
            {t.time}
            <input
              type="time"
              defaultValue={meal.time ?? ''}
              onBlur={(event) =>
                event.target.value &&
                event.target.value !== meal.time &&
                update.mutate({ time: event.target.value })
              }
              className="h-10 rounded-xl bg-white px-2 text-sm outline-none focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
          <Switch
            className="col-span-2"
            checked={meal.toGo}
            onChange={(value) => update.mutate({ toGo: value })}
            label={t.toGoLabel}
            hint={t.toGoHint}
          />
        </div>
      ) : null}

      {meal.eatenOut ? (
        <button
          type="button"
          onClick={() => setEatingOut(true)}
          className="press flex items-center justify-between gap-3 rounded-2xl bg-lav-100 px-4 py-3 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[0.9375rem] font-semibold">
              {t.out[meal.eatenOut.kind]}
              {meal.eatenOut.place
                ? ` · ${trText(meal.eatenOut.place, meal.translations, 'place')}`
                : ''}
            </span>
            <span className="block text-sm text-lav-800">
              {t.nothingFromKitchen}
              {meal.eatenOut.cost !== null ? ` · ${t.costLei(meal.eatenOut.cost)}` : ''}
              {meal.eatenOut.kcal !== null
                ? ` · ${t.aboutKcalEach(formatKcal(meal.eatenOut.kcal))}`
                : ''}
            </span>
          </span>
          <span className="text-sm font-semibold text-lav-800">{t.change}</span>
        </button>
      ) : null}
      {meal.eatenOut ? null : (
        <NutritionStrip
          nutrition={meal.nutrition}
          servings={meal.servings}
          className="-mt-1 px-1"
        />
      )}
      {household.length > 1 ? (
        <WhoEats
          label={t.whoEats}
          people={household}
          value={eaters}
          onChange={(next) => update.mutate({ eaters: next })}
          hint={
            eaters.length
              ? undefined
              : meal.servings >= household.length
                ? t.everyoneHint
                : t.whoeverHint
          }
        />
      ) : null}
      {meal.availability.warnings.length ? (
        <p
          className={cx(
            'rounded-2xl px-4 py-2.5 text-sm font-semibold',
            meal.availability.warnings.some((w) => w.kind === 'allergy')
              ? 'bg-danger-50 text-danger-700'
              : 'bg-peach-100 text-peach-800',
          )}
        >
          {meal.availability.warnings
            .map((w) =>
              w.kind === 'allergy'
                ? t.allergicTo(w.person, tr(w, 'item').toLowerCase())
                : t.doesntEat(w.person, tr(w, 'item').toLowerCase()),
            )
            .join('; ')}
        </p>
      ) : null}

      {groups.length ? (
        groups.map(({ part, lines }) => (
          <PartBlock
            key={part?.id ?? 'own'}
            meal={meal}
            part={part}
            lines={lines}
            kitchen={kitchen}
            draft={draft}
            done={done}
            single={meal.parts.length <= 1}
            onDraft={(id, next) => setDraft((current) => ({ ...current, [id]: next }))}
            onMissing={setMissing}
          />
        ))
      ) : (
        <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">{t.noIngredients}</p>
      )}

      {!done ? (
        <Button variant="tint" size="md" icon={AddIcon} onClick={() => setAddingPart(true)}>
          {t.addToMeal}
        </Button>
      ) : null}

      <Tools tools={meal.tools} />

      {dirty && !done ? (
        <Button
          variant="tint"
          size="md"
          onClick={() => saveIngredients.mutate()}
          loading={saveIngredients.isPending}
        >
          {t.saveChanges}
        </Button>
      ) : null}

      {done ? (
        <Button
          fullWidth
          variant="tint"
          icon={UndoIcon}
          onClick={() => reopen.mutate()}
          loading={reopen.isPending}
        >
          {meal.eatenOut ? t.notEatenOut : t.notEaten}
        </Button>
      ) : (
        <>
          {meal.eatenOut ? null : (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3.5 py-2.5">
              <span className="text-sm font-semibold">{t.leftoversToKeep}</span>
              <Stepper
                fewer={t.fewerPortions}
                more={t.morePortions}
                value={leftovers}
                min={0}
                onChange={setLeftovers}
                bare
              />
            </div>
          )}
          <div className="flex gap-2.5">
            <Button fullWidth icon={CheckIcon} onClick={() => eat.mutate()} loading={eat.isPending}>
              {t.eatenButton}
            </Button>
            {meal.eatenOut ? null : (
              <Button fullWidth variant="tint" onClick={() => setEatingOut(true)}>
                {t.ateElsewhere}
              </Button>
            )}
          </div>
        </>
      )}

      <div className="flex gap-2">
        {!done ? (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            onClick={() => skip.mutate()}
            loading={skip.isPending}
          >
            {meal.status === 'skipped' ? t.notSkipped : t.skipIt}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          fullWidth
          icon={DeleteIcon}
          className="text-danger-600"
          onClick={() => remove.mutate()}
          loading={remove.isPending}
        >
          {t.remove}
        </Button>
      </div>

      <AddToListSheet line={missing} needBy={meal.date} onClose={() => setMissing(null)} />
      <AddPartSheet open={addingPart} meal={meal} onClose={() => setAddingPart(false)} />
      <EatOutSheet
        meal={eatingOut ? meal : null}
        onClose={() => setEatingOut(false)}
        onDone={onClose}
      />
    </div>
  );
}

function Stepper({
  fewer,
  more,
  format,
  value,
  onChange,
  disabled,
  min = 1,
  className,
  bare,
}: {
  /** The buttons' names: "Fewer servings", "More servings". */
  fewer: string;
  more: string;
  /** How the value reads ("2 servings"); bare steppers show the number. */
  format?: (value: number) => string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  className?: string;
  bare?: boolean;
}) {
  return (
    <div
      className={cx('flex items-center gap-1 rounded-pill p-1', bare ? '' : 'bg-ink-50', className)}
    >
      <button
        type="button"
        aria-label={fewer}
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
        className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40"
      >
        <RemoveIcon fontSize="inherit" />
      </button>
      <span
        className={cx(
          'tabular text-center text-sm font-semibold',
          bare ? 'w-7' : 'min-w-[4.75rem]',
        )}
      >
        {bare || !format ? value : format(value)}
      </span>
      <button
        type="button"
        aria-label={more}
        disabled={disabled || value >= 100}
        onClick={() => onChange(value + 1)}
        className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white disabled:opacity-40"
      >
        <AddIcon fontSize="inherit" />
      </button>
    </div>
  );
}

/** One part of the meal (the omelette, the coffee) with its lines; its own servings and a way to take it off. */
function PartBlock({
  meal,
  part,
  lines,
  kitchen,
  draft,
  done,
  single,
  onDraft,
  onMissing,
}: {
  meal: Meal;
  part: MealPart | null;
  lines: IngredientLine[];
  kitchen: StockedProduct[];
  draft: Draft;
  done: boolean;
  single: boolean;
  onDraft: (id: string, next: LineDraft) => void;
  onMissing: (line: IngredientLine) => void;
}) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });
  const change = useMutation({
    mutationFn: (servings: number) => foodApi.updatePart(meal.id, part!.id, { servings }),
    onSuccess: () => void refresh(),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => foodApi.removePart(meal.id, part!.id),
    onSuccess: () => {
      toast.success(t.partOff(tr(part!, 'title')));
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  // Coffee or tea for this meal: that choice's lines are swapped.
  const pick = useMutation({
    mutationFn: (optionId: string) => foodApi.setOption(meal.id, part!.id, optionId),
    onSuccess: () => {
      haptic('tap');
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <section className="rounded-[1.25rem] bg-white ring-1 ring-inset ring-ink-100">
      {part && !single ? (
        <header className="flex items-start gap-2.5 border-b border-ink-100 px-3 py-2">
          <FoodIconTile
            name={part.icon}
            tone="bg-butter-100"
            className="mt-0.5 size-9 rounded-xl [&>svg]:size-6"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-1">
              <span className="min-w-0 flex-1 text-[0.9375rem] font-bold leading-snug">
                {tr(part, 'title')}
              </span>
              {part.recipeId ? (
                <Link
                  to={`/food/recipes/${part.recipeId}`}
                  aria-label={t.partRecipe(tr(part, 'title'))}
                  className="press -mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-ink-600 hover:bg-ink-50"
                >
                  <ArrowOutIcon fontSize="inherit" />
                </Link>
              ) : null}
              {!done ? (
                <button
                  type="button"
                  aria-label={t.takeOff(tr(part, 'title'))}
                  onClick={() => remove.mutate()}
                  className="press -mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-ink-50"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-ink-600">{t.partKind[part.kind]}</span>
              {done ? (
                <span className="text-xs text-ink-600">{t.servings(part.servings)}</span>
              ) : (
                <Stepper
                  fewer={t.fewerServings}
                  more={t.moreServings}
                  format={t.servings}
                  value={part.servings}
                  onChange={(value) => change.mutate(value)}
                  disabled={change.isPending}
                />
              )}
            </div>
          </div>
        </header>
      ) : !part && meal.parts.length ? (
        <header className="border-b border-ink-100 px-3 py-2 text-sm font-bold">{t.also}</header>
      ) : null}
      {lines.length || part?.choices.length ? (
        // Its sections (Felul doi, Băuturi…), each with its choices (coffee or tea) and lines.
        sectionsOf(lines, part?.choices ?? []).map((section) => (
          <div key={section.course ?? '-'} className="border-b border-ink-100 last:border-0">
            {section.course ? (
              <SectionHeading className="px-3 pt-2.5">{t.partKind[section.course]}</SectionHeading>
            ) : null}
            {section.choices.map((choice) => (
              <ChoiceSwitch
                key={choice.id}
                className="px-3 pt-2"
                choice={choice}
                value={pick.isPending ? pick.variables : choice.chosen}
                onChange={(optionId) => pick.mutate(optionId)}
                disabled={done || pick.isPending}
              />
            ))}
            <ul className="divide-y divide-ink-100">
              {section.lines.map((line) => (
                <IngredientRow
                  key={line.id}
                  mealId={meal.id}
                  line={line}
                  product={kitchen.find((p) => p.id === line.productId)}
                  draft={draft[line.id]!}
                  disabled={done}
                  onChange={(next) => onDraft(line.id, next)}
                  onMissing={() => onMissing(line)}
                />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p className="px-3 py-2.5 text-sm text-ink-500">{t.nothingTaken}</p>
      )}
    </section>
  );
}

function IngredientRow({
  mealId,
  line,
  product,
  draft,
  disabled,
  onChange,
  onMissing,
}: {
  mealId: string;
  line: IngredientLine;
  product?: StockedProduct;
  draft: LineDraft;
  disabled: boolean;
  onChange: (next: LineDraft) => void;
  onMissing: () => void;
}) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  // Milk or whipped cream for this meal: saved on the meal, so the plan and the lists follow.
  const choose = useMutation({
    mutationFn: (choice: number) => foodApi.setChoice(mealId, line.id, choice),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  // An optional line, in or out this time: out, it isn't needed, bought, eaten or taken.
  const include = useMutation({
    mutationFn: (value: boolean) => foodApi.setIncluded(mealId, line.id, value),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const included = include.isPending ? include.variables : isIncluded(line);
  const off = line.optional && !included;
  const lots =
    product?.trackMode === 'exact'
      ? product.lots.filter(
          (lot) => !line.variant || lot.variant.toLowerCase() === line.variant.toLowerCase(),
        )
      : [];
  // Which piece to use (the 2 kg steak, the opened jar): only when asked, or already chosen.
  const [choosing, setChoosing] = useState(Boolean(draft.lotId));
  // An item with kinds (twelve teas) is picked by name, in a sheet.
  const pieces = product?.trackMode === 'exact' ? product.lots : [];
  const byKind = hasKinds(pieces);
  const [picking, setPicking] = useState(false);
  const pickedLot = draft.lotId ? pieces.find((lot) => lot.id === draft.lotId) : undefined;
  const pickedKind = pickedLot?.variant || draft.variant;
  const kindLot = pickedKind
    ? pieces.find((lot) => lot.variant.toLowerCase() === pickedKind.toLowerCase())
    : undefined;
  const pickedName = kindLot ? tr(kindLot, 'variant') || kindLot.variant : pickedKind || null;
  const allergy = line.warnings.some((w) => w.kind === 'allergy');
  const altUnit = line.using ? line.alternatives[line.chosen - 1]?.baseUnit : null;
  const measured = altUnit
    ? { unit: altUnit }
    : (product ?? (line.baseUnit ? { unit: line.baseUnit } : null));
  return (
    <li className="flex flex-col gap-1.5 px-3 py-2">
      <div className={cx('flex items-center gap-2.5 transition-opacity', off && 'opacity-50')}>
        <FoodIconTile
          name={line.using?.icon ?? line.icon}
          className="size-9 rounded-xl [&>svg]:size-6"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">
            {line.using ? tr(line.using, 'name') : tr(line, 'name')}
            {line.variant ? (
              <span className="font-medium text-ink-600"> · {tr(line, 'variant')}</span>
            ) : null}
            {line.warnings.length ? (
              <span
                className={cx('ml-0.5 font-bold', allergy ? 'text-danger-600' : 'text-peach-800')}
              >
                *
              </span>
            ) : null}
            {line.optional ? (
              <span className="font-medium text-ink-500"> {t.optionalMark}</span>
            ) : null}
          </span>
          <span
            className={cx(
              'block truncate text-xs',
              line.enough === false && !off ? 'font-semibold text-peach-800' : 'text-ink-600',
            )}
          >
            {off
              ? t.leftOut
              : line.using
              ? line.enough === false
                ? t.missingOf(
                    line.missing && measured ? formatQty(line.missing, measured) : null,
                    tr(line.using, 'name').toLowerCase(),
                  )
                : t.insteadOf(tr(line.using, 'name'), tr(line, 'name').toLowerCase())
              : line.level
                ? line.level === 'full'
                  ? t.inKitchen
                  : line.level === 'low'
                    ? t.runningLow
                    : t.levelOut
                : line.enough === false
                  ? `${t.missingAmount(line.missing && measured ? formatQty(line.missing, measured) : null)}${line.spoilsBefore ? t.spoils : line.reservedFor ? t.keptFor(tr(line.reservedFor, 'title')) : ''}`
                  : line.inStock !== null && measured
                    ? t.inStock(formatQty(line.inStock, measured))
                    : line.note || t.notKept}
          </span>
        </span>
        {line.enough === false && !disabled && line.productId && !off ? (
          <button
            type="button"
            onClick={onMissing}
            aria-label={t.putOnList(tr(line, 'name'))}
            className="press grid size-9 shrink-0 place-items-center rounded-full bg-peach-100 text-peach-800 hover:bg-peach-200"
          >
            <AddShoppingCartIcon fontSize="inherit" />
          </button>
        ) : null}
        {off ? null : line.unit && line.amount !== null && !disabled ? (
          <label className="flex w-24 shrink-0 items-center rounded-xl bg-ink-50 px-2.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
            <span className="sr-only">{t.amountOf(tr(line, 'name'))}</span>
            <input
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => onChange({ ...draft, amount: event.target.value })}
              className="tabular h-9 w-full min-w-0 bg-transparent text-right text-sm font-semibold outline-none"
            />
            <span className="ml-1 text-xs text-ink-500">{line.unit}</span>
          </label>
        ) : line.amount !== null && line.unit ? (
          <span className="tabular shrink-0 text-sm font-semibold">
            {formatAmount(line.amount, line.unit)}
          </span>
        ) : null}
      </div>
      {line.optional ? (
        <div className="ml-[2.875rem] flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={included}
            aria-label={t.includeLine(tr(line, 'name'))}
            disabled={disabled || include.isPending}
            onClick={() => {
              haptic('tap');
              include.mutate(!included);
            }}
            className={cx(
              'group/switch relative inline-flex h-6 w-10 shrink-0 items-center rounded-pill transition-colors duration-200 disabled:opacity-45',
              included ? 'bg-ink-900' : 'bg-ink-200',
            )}
          >
            <span
              aria-hidden="true"
              className={cx(
                'absolute left-0.5 size-5 rounded-full shadow-[0_2px_6px_rgb(29_29_36/0.25)] transition-[translate,background-color] duration-200',
                included ? 'translate-x-4 bg-butter-300' : 'translate-x-0 bg-white',
              )}
            />
          </button>
          <span className="text-xs font-semibold text-ink-700" aria-hidden="true">
            {t.include}
          </span>
        </div>
      ) : null}
      {line.alternatives.length && !off ? (
        <div className="ml-[2.875rem]">
          <OptionChips
            line={line}
            value={line.chosen}
            onChange={(choice) => choose.mutate(choice)}
            disabled={disabled || choose.isPending}
          />
        </div>
      ) : null}
      {byKind && !disabled && !line.using && !off && product ? (
        <>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="press ml-[2.875rem] inline-flex h-8 w-fit max-w-[calc(100%-2.875rem)] items-center gap-1.5 rounded-pill bg-lav-100 px-3 text-xs font-semibold text-lav-800 hover:bg-lav-200"
          >
            <span className="truncate">
              {pickedName
                ? `${t.use}: ${pickedName}${pickedLot ? ` · ${formatQty(pickedLot.quantity, product)}` : ''}`
                : t.whichOne}
            </span>
          </button>
          <KindPicker
            open={picking}
            onClose={() => setPicking(false)}
            product={product}
            lots={pieces}
            value={{ variant: draft.variant, lotId: draft.lotId }}
            onPick={(next) => onChange({ ...draft, ...next })}
          />
        </>
      ) : null}
      {lots.length > 1 && !disabled && !line.using && !choosing && !off && !byKind ? (
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="ml-[2.875rem] w-fit text-xs font-semibold text-lav-700 hover:text-lav-800"
        >
          {t.whichOne}
        </button>
      ) : null}
      {lots.length > 1 && !disabled && !line.using && choosing && !off && !byKind ? (
        <label className="ml-[2.875rem] flex items-center gap-2 text-xs text-ink-600">
          <span>{t.use}</span>
          <select
            value={draft.lotId ?? ''}
            onChange={(event) => onChange({ ...draft, lotId: event.target.value || null })}
            className="h-8 min-w-0 flex-1 rounded-lg bg-ink-50 px-2 text-xs font-semibold text-ink-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            <option value="">{t.autoLot}</option>
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {formatQty(lot.quantity, product!)}
                {lot.package ? ` ${lot.package}` : ''}
                {lot.openedAt ? t.openedMark : ''}
                {lot.expiresOn ? t.until(dayAndMonth(lot.expiresOn)) : ''} ·{' '}
                {LOCATION_LABEL[lot.location].toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </li>
  );
}

const TOOL_TONE: Record<ToolNeed['status'], string> = {
  ready: 'bg-mint-100 text-mint-800',
  washing: 'bg-lav-100 text-lav-800',
  dirty: 'bg-peach-100 text-peach-800',
  missing: 'bg-danger-50 text-danger-700',
};
function Tools({ tools }: { tools: ToolNeed[] }) {
  const t = usePlanT();
  if (!tools.length) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{t.kitchenware}</span>
      <ul className="flex flex-wrap gap-1.5">
        {tools.map((tool) => (
          <li
            key={tool.toolId}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-pill pl-1 pr-3 text-sm font-semibold',
              TOOL_TONE[tool.status],
            )}
          >
            <span className="grid size-7 place-items-center rounded-full bg-white">
              <FoodIconTile
                name={(tool.options.find((o) => o.toolId === tool.using) ?? tool).icon}
                tone="bg-transparent"
                className="size-7 rounded-full [&>svg]:size-5"
              />
            </span>
            {tool.count > 1 ? `${tool.count} × ` : ''}
            {tr(tool.options.find((o) => o.toolId === tool.using) ?? tool, 'name')}
            {tool.using !== tool.toolId ? t.forThe(tr(tool, 'name').toLowerCase()) : ''} ·{' '}
            {tool.status === 'washing' && tool.readyAt
              ? t.cleanAt(clockTime(tool.readyAt))
              : t.toolWord[tool.status]}
          </li>
        ))}
      </ul>
      {tools.some((tool) => tool.status === 'dirty') ? (
        <Link
          to="/food/kitchenware"
          className="text-sm font-semibold text-lav-700 hover:text-lav-800"
        >
          {t.washItFirst}
        </Link>
      ) : null}
    </div>
  );
}

const PART_KINDS: PartKind[] = ['first', 'dish', 'side', 'sauce', 'dessert', 'drink'];

/**
 * More on the plate: a recipe (another dish, a sauce made apart, a coffee) or something simple —
 * "2 apples", "coffee 10 g", "bread with salmon" — for this meal.
 */
function AddPartSheet({ open, meal, onClose }: { open: boolean; meal: Meal; onClose: () => void }) {
  const t = usePlanT();
  return (
    <Sheet open={open} onClose={onClose} title={t.addToMeal} description={tr(meal, 'title')}>
      {open ? <AddPartForm meal={meal} onClose={onClose} /> : null}
    </Sheet>
  );
}

function AddPartForm({ meal, onClose }: { meal: Meal; onClose: () => void }) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const catalog = useCatalog();
  const [kind, setKind] = useState<PartKind>('side');
  const [query, setQuery] = useState('');
  const typed = parseLine(query);
  const tagFor: Record<PartKind, string[]> = {
    first: ['soup', 'first'],
    dish: [],
    side: ['side', 'salad', 'snack'],
    sauce: ['sauce'],
    dessert: ['dessert', 'cake', 'sweet'],
    drink: ['drink', 'coffee', 'tea', 'cocktail'],
  };
  const list = (recipes.data ?? [])
    .filter((r) => !meal.parts.some((p) => p.recipeId === r.id))
    .filter(
      (r) =>
        !query.trim() ||
        normalize(r.title).includes(normalize(query)) ||
        normalize(tr(r, 'title')).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        Number(b.tags.some((tag) => tagFor[kind].includes(tag))) -
          Number(a.tags.some((tag) => tagFor[kind].includes(tag))) ||
        Number(b.availability.ready) - Number(a.availability.ready),
    )
    .slice(0, 8);
  const product = catalog.data?.find((p) => normalize(p.name) === normalize(typed.name));

  const add = useMutation({
    mutationFn: (body: Parameters<typeof foodApi.addPart>[1]) => foodApi.addPart(meal.id, body),
    onSuccess: (updated) => {
      haptic('success');
      toast.success(t.addedTo(tr(updated, 'title')));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const simple = () => {
    const name = typed.name.trim();
    if (!name) return;
    const title = name.charAt(0).toUpperCase() + name.slice(1);
    add.mutate({
      title,
      kind,
      ingredients: [
        {
          ...(product ? { productId: product.id } : {}),
          name: product?.name ?? title,
          amount: typed.amount,
          unit: typed.amount ? typed.unit : null,
        },
      ],
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t.whatItIs} className="flex flex-wrap gap-1.5">
        {PART_KINDS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cx(
              'press h-9 rounded-pill px-3.5 text-sm font-semibold',
              kind === value ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {t.partKind[value]}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 rounded-[1.125rem] bg-ink-50 px-3.5 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <SearchIcon fontSize="inherit" className="text-lg text-ink-500" />
        <span className="sr-only">{t.searchPart}</span>
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              simple();
            }
          }}
          placeholder={t.partPlaceholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-500"
        />
      </label>
      {typed.name.trim() ? (
        <button
          type="button"
          onClick={simple}
          className="press flex items-center gap-3 rounded-2xl bg-butter-100 p-2.5 text-left hover:bg-butter-200"
        >
          <FoodIconTile
            name={product?.icon ?? 'basket'}
            tone="bg-white"
            className="size-10 rounded-xl [&>svg]:size-7"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-semibold">
              {t.just(
                typed.amount
                  ? formatAmount(typed.amount, typed.unit ?? product?.unit ?? 'pcs')
                  : null,
                product ? tr(product, 'name').toLowerCase() : typed.name,
              )}
            </span>
            <span className="block text-sm text-ink-600">
              {product ? t.partFromKitchen : t.notARecipe}
            </span>
          </span>
        </button>
      ) : null}
      <ul className="flex flex-col">
        {list.map((recipe) => (
          <li key={recipe.id}>
            <button
              type="button"
              onClick={() => add.mutate({ recipeId: recipe.id, kind })}
              className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-50"
            >
              <FoodIconTile name={recipe.icon} className="size-10 rounded-xl [&>svg]:size-7" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">
                  {tr(recipe, 'title')}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {recipe.availability.ready
                    ? t.allHere
                    : t.missing(recipe.availability.missing.length)}
                  {recipe.tags.length ? ` · #${recipe.tags.slice(0, 2).join(' #')}` : ''}
                </span>
              </span>
              <AddIcon fontSize="inherit" className="text-xl text-ink-500" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
