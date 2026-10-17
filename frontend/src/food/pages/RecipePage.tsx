import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Badge, Button, IconButton, IconLink, Sheet, Skeleton, toast } from '@/components/ui';
import {
  AccessTimeIcon,
  AddIcon,
  AddShoppingCartIcon,
  ArrowBackIcon,
  ArrowForwardIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  EditIcon,
  FavoriteBorderIcon,
  FavoriteIcon,
  RemoveIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { formatList, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { DockBar } from '../components/DockBar';
import { formatAmount, formatQty, localDate } from '../format';
import { AddToListSheet } from '../components/AddToListSheet';
import { OptionChips } from '../components/OptionChips';
import { withChoice } from '../options';
import { openedText } from '../opened';
import { FoodIcon, FoodIconTile } from '../icons/FoodIcon';
import { NutritionStrip } from '../components/NutritionStrip';
import { clockTime, relativeDayInline } from '../plan/i18n';
import { useRecipesT } from '../recipes.i18n';
import type { IngredientLine, Recipe, ToolNeed } from '../types';

/**
 * A recipe, scaled to how many are eating: what's in the kitchen and what's missing (tap it to
 * put it on a list), which kind or what instead (milk, or whipped cream), who must not eat what,
 * the kitchenware it needs and whether it's clean, the steps with a cook mode that keeps the
 * screen on (full screen on a tablet on the counter), and "Cook now", which takes the ingredients
 * out of the kitchen and says what it opened.
 */
export default function RecipePage() {
  const t = useRecipesT();
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [servings, setServings] = useState<number | null>(null);
  const recipe = useQuery({
    queryKey: foodKeys.recipe(id, servings ?? undefined),
    queryFn: () => foodApi.recipe(id, servings ?? undefined),
    placeholderData: keepPreviousData,
  });
  const [cooking, setCooking] = useState(false);
  // Milk or whipped cream: what was picked here, by the ingredient's place (else the recipe's pick).
  const [choices, setChoices] = useState<Record<number, number>>({});
  const data = recipe.data;
  const lines = data
    ? data.ingredients.map((line, index) => withChoice(line, choices[index] ?? line.chosen))
    : [];

  const favorite = useMutation({
    mutationFn: (value: boolean) => foodApi.updateRecipe(id, { favorite: value }),
    onSuccess: (updated) => {
      haptic('tap');
      toast.success(updated.favorite ? t.favoriteAdded : t.favoriteRemoved);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
  });

  if (recipe.isPending) {
    return (
      <Screen tone="white">
        <PageHeader back="/food/recipes" title={t.recipe} centered />
        <div className="gutter-x mt-6 flex flex-col gap-3">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-60 rounded-3xl" />
        </div>
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen tone="white">
        <PageHeader back="/food/recipes" title={t.recipe} centered />
        <p className="gutter-x mt-8 text-center text-ink-600">{errorMessage(recipe.error)}</p>
      </Screen>
    );
  }

  const shown = data.shownServings;
  const minutes = (data.prepMinutes ?? 0) + (data.cookMinutes ?? 0);
  const title = tr(data, 'title');
  const description = tr(data, 'description');
  const notes = tr(data, 'notes');

  return (
    <Screen tone="white" className="pb-[calc(var(--tabbar-h)+var(--safe-bottom)+5rem)] md:pb-0">
      <PageHeader
        back="/food/recipes"
        title={title}
        centered
        actions={
          <div className="flex gap-2">
            <IconButton
              icon={data.favorite ? FavoriteIcon : FavoriteBorderIcon}
              label={data.favorite ? t.removeFavorite : t.addFavorite}
              onClick={() => favorite.mutate(!data.favorite)}
              className={data.favorite ? 'text-pink-800' : undefined}
            />
            <IconLink
              to={`/food/recipes/${id}/edit`}
              icon={EditIcon}
              label={t.editRecipe}
              variant="ink"
            />
          </div>
        }
      />

      <div className="gutter-x mt-5 md:grid md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start md:gap-5 md:px-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:gap-8 lg:px-8">
        <div className="md:sticky md:top-4">
          <section className="flex flex-col items-center rounded-[2rem] bg-butter-100 px-5 pb-5 pt-6 text-center">
            <FoodIcon name={data.icon} className="size-24 animate-pop" />
            <h2 className="mt-3 text-h1 font-bold">{title}</h2>
            {description ? (
              <p className="mt-2 max-w-md text-[0.9375rem] text-butter-800">{description}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {minutes ? (
                <Badge tone="muted" className="gap-1 bg-white">
                  <AccessTimeIcon fontSize="inherit" className="text-sm" />
                  {t.time(data.prepMinutes, data.cookMinutes, minutes)}
                </Badge>
              ) : null}
              {data.tags.map((tag) => (
                <Badge key={tag} tone="muted" className="bg-white">
                  #{tag}
                </Badge>
              ))}
              {data.createdVia === 'ai' ? (
                <Badge tone="lav" className="gap-1">
                  <SparkleIcon fontSize="inherit" className="text-sm" />
                  {t.byClaude}
                </Badge>
              ) : null}
              {data.timesCooked ? <Badge tone="mint">{t.cooked(data.timesCooked)}</Badge> : null}
            </div>
          </section>

          <Ingredients
            recipe={data}
            lines={lines}
            servings={shown}
            onServings={setServings}
            onChoose={(index, choice) => setChoices((current) => ({ ...current, [index]: choice }))}
          />
          <Tools tools={data.tools} />
        </div>

        <div className="mt-6 md:mt-0">
          <Steps recipe={data} servings={shown} />
          {notes ? (
            <section className="mt-6">
              <h2 className="text-h3 font-bold">{t.notes}</h2>
              <p className="mt-2 whitespace-pre-line text-[0.9375rem] text-ink-700">{notes}</p>
            </section>
          ) : null}
          {data.sourceUrl ? (
            <a
              href={data.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block text-sm font-semibold text-lav-700 underline underline-offset-4"
            >
              {t.original}
            </a>
          ) : null}
        </div>
      </div>

      <DockBar tone="white">
        <Actions recipe={data} onCook={() => setCooking(true)} />
      </DockBar>
      <CookSheet
        open={cooking}
        recipe={data}
        lines={lines}
        servings={shown}
        onClose={() => setCooking(false)}
      />
    </Screen>
  );
}

function Actions({ recipe, onCook }: { recipe: Recipe; onCook: () => void }) {
  const t = useRecipesT();
  const navigate = useNavigate();
  return (
    <>
      <Button
        variant="tint"
        size="md"
        icon={CalendarIcon}
        fullWidth
        onClick={() => navigate(`/food/plan?recipe=${recipe.id}`)}
      >
        {t.planIt}
      </Button>
      <Button size="md" fullWidth onClick={onCook}>
        {t.cookNow}
      </Button>
    </>
  );
}

function Ingredients({
  recipe,
  lines,
  servings,
  onServings,
  onChoose,
}: {
  recipe: Recipe;
  lines: IngredientLine[];
  servings: number;
  onServings: (value: number) => void;
  onChoose: (index: number, choice: number) => void;
}) {
  const t = useRecipesT();
  const queryClient = useQueryClient();
  const [missingLine, setMissingLine] = useState<IngredientLine | null>(null);
  const missing = lines.filter((i) => i.enough === false && !i.optional);
  const toList = useMutation({
    mutationFn: () =>
      foodApi.addLines(
        missing.map((i) => {
          // What's missing of the picked option (the whipped cream), else of the item itself.
          const alt = i.using ? i.alternatives[i.chosen - 1] : undefined;
          return alt?.productId
            ? {
                productId: alt.productId,
                amount: alt.missing || undefined,
                unit: alt.missing ? (alt.baseUnit ?? undefined) : undefined,
                ...(alt.variant ? { variant: alt.variant } : {}),
              }
            : {
                productId: i.productId!,
                amount: i.amount ?? undefined,
                unit: i.amount ? (i.unit ?? i.baseUnit) : undefined,
              };
        }),
        'recipe',
      ),
    onSuccess: (lines) => {
      haptic('success');
      toast.success(t.onList(lines.length), { description: t.onListHint });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="mt-4 rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-h3 font-bold">{t.ingredients}</h2>
        <div className="flex items-center gap-1 rounded-pill bg-ink-50 p-1">
          <button
            type="button"
            aria-label={t.fewerServings}
            disabled={servings <= 1}
            onClick={() => onServings(servings - 1)}
            className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40"
          >
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular min-w-[4.5rem] text-center text-sm font-semibold">
            {t.servings(servings)}
          </span>
          <button
            type="button"
            aria-label={t.moreServings}
            disabled={servings >= 100}
            onClick={() => onServings(servings + 1)}
            className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white"
          >
            <AddIcon fontSize="inherit" />
          </button>
        </div>
      </div>
      <NutritionStrip nutrition={recipe.nutrition} servings={servings} />
      {recipe.ingredients.length ? (
        <ul className="mt-3 flex flex-col">
          {lines.map((line, index) => (
            <IngredientRow
              key={line.id}
              line={line}
              onMissing={() => setMissingLine(line)}
              onChoose={(choice) => onChoose(index, choice)}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 px-1 text-sm text-ink-600">{t.noIngredients}</p>
      )}
      {missing.length ? (
        <Button
          size="md"
          variant="tint"
          icon={AddShoppingCartIcon}
          fullWidth
          className="mt-3"
          onClick={() => toList.mutate()}
          loading={toList.isPending}
        >
          {t.addMissing(missing.length)}
        </Button>
      ) : recipe.availability.total ? (
        <p className="mt-3 rounded-2xl bg-mint-100 px-4 py-3 text-center text-sm font-semibold text-mint-800">
          {t.allHere}
        </p>
      ) : null}
      {recipe.availability.warnings.length ? (
        <Warnings warnings={recipe.availability.warnings} />
      ) : null}
      <AddToListSheet line={missingLine} onClose={() => setMissingLine(null)} />
    </section>
  );
}

/** Who must not eat what in it: allergies first, marked, then foods someone avoids. */
function Warnings({ warnings }: { warnings: Recipe['availability']['warnings'] }) {
  const t = useRecipesT();
  const allergies = warnings.filter((w) => w.kind === 'allergy');
  const avoids = warnings.filter((w) => w.kind === 'avoid');
  return (
    <div className="mt-3 flex flex-col gap-1.5 text-sm">
      {allergies.length ? (
        <p className="rounded-2xl bg-danger-50 px-4 py-2.5 font-semibold text-danger-700">
          <span aria-hidden="true">* </span>
          {allergies.map((w) => t.allergicTo(w.person, tr(w, 'item').toLowerCase())).join('; ')}
        </p>
      ) : null}
      {avoids.length ? (
        <p className="rounded-2xl bg-peach-100 px-4 py-2.5 font-medium text-peach-800">
          {avoids.map((w) => t.doesntEat(w.person, tr(w, 'item').toLowerCase())).join('; ')}
        </p>
      ) : null}
    </div>
  );
}

const TOOL_TONE: Record<ToolNeed['status'], string> = {
  ready: 'bg-mint-100 text-mint-800',
  washing: 'bg-lav-100 text-lav-800',
  dirty: 'bg-peach-100 text-peach-800',
  missing: 'bg-danger-50 text-danger-700',
};

/** The kitchenware it needs, and whether it's clean. */
function Tools({ tools }: { tools: ToolNeed[] }) {
  const t = useRecipesT();
  if (!tools.length) return null;
  return (
    <section className="mt-4 rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
      <h2 className="px-1 text-h3 font-bold">{t.youllNeed}</h2>
      <ul className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-1.5">
        {tools.map((tool) => {
          const using = tool.options.find((o) => o.toolId === tool.using) ?? tool;
          const others = tool.options
            .filter((o) => o.toolId !== using.toolId)
            .map((o) => tr(o, 'name').toLowerCase());
          return (
            <li
              key={tool.toolId}
              className="flex items-center gap-2 rounded-2xl bg-ink-50 p-1.5 pr-2"
            >
              <FoodIconTile
                name={using.icon}
                tone="bg-white"
                className="size-9 rounded-xl [&>svg]:size-6"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {tool.count > 1 ? `${tool.count} × ` : ''}
                  {tr(using, 'name')}
                  {tool.perServing ? (
                    <span className="font-medium text-ink-500"> · {t.oneEach}</span>
                  ) : null}
                </span>
                {others.length ? (
                  <span className="block truncate text-xs text-ink-600">{t.orTools(others)}</span>
                ) : null}
                <span
                  className={cx(
                    'mt-0.5 inline-flex h-5 items-center rounded-pill px-1.5 text-[0.6875rem] font-semibold',
                    TOOL_TONE[tool.status],
                  )}
                >
                  {tool.status === 'washing' && tool.readyAt
                    ? t.cleanAt(clockTime(tool.readyAt))
                    : t.toolState[tool.status]}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function IngredientRow({
  line,
  onMissing,
  onChoose,
}: {
  line: IngredientLine;
  onMissing?: () => void;
  onChoose?: (choice: number) => void;
}) {
  const t = useRecipesT();
  // Amounts missing are in the unit of the option used (grams of whipped cream, millilitres of milk).
  const unit = line.using
    ? (line.alternatives[line.chosen - 1]?.baseUnit ?? line.baseUnit)
    : line.baseUnit;
  const measured = unit ? { unit } : null;
  const today = localDate();
  const allergy = line.warnings.some((w) => w.kind === 'allergy');
  const amount =
    line.amount && line.unit
      ? formatAmount(line.amount, line.unit)
      : line.amount
        ? String(line.amount)
        : t.toTaste;
  return (
    <li className="flex items-start gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <FoodIconTile
        name={line.using?.icon ?? line.icon}
        className="size-10 rounded-xl [&>svg]:size-7"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">
          {tr(line, 'name')}
          {line.variant ? (
            <span className="font-medium text-ink-600"> · {tr(line, 'variant')}</span>
          ) : null}
          {line.warnings.length ? (
            <span
              className={cx('ml-0.5 font-bold', allergy ? 'text-danger-600' : 'text-peach-800')}
              title={line.warnings
                .map((w) =>
                  w.kind === 'allergy' ? t.allergicShort(w.person) : t.doesntEatShort(w.person),
                )
                .join(', ')}
            >
              *
            </span>
          ) : null}
          {line.optional ? <span className="font-medium text-ink-500"> {t.optional}</span> : null}
        </span>
        <span className="block truncate text-sm text-ink-600">
          {[amount, line.note || null].filter(Boolean).join(' · ')}
        </span>
        {line.warnings.length ? (
          <span
            className={cx(
              'block truncate text-xs font-semibold',
              allergy ? 'text-danger-700' : 'text-peach-800',
            )}
          >
            {line.warnings
              .map((w) => (w.kind === 'allergy' ? t.isAllergic(w.person) : t.doesntEatIt(w.person)))
              .join(' · ')}
          </span>
        ) : null}
        {line.reservedFor && line.enough === false ? (
          <span className="block truncate text-xs font-medium text-lav-800">
            {t.keptFor(
              tr(line.reservedFor, 'title'),
              relativeDayInline(line.reservedFor.date, today),
            )}
          </span>
        ) : null}
        {onChoose ? <OptionChips line={line} value={line.chosen} onChange={onChoose} /> : null}
      </span>
      {line.level && line.level !== 'full' ? (
        <span
          className={cx(
            'inline-flex h-7 items-center rounded-pill px-2.5 text-xs font-semibold',
            line.level === 'out' ? 'bg-peach-100 text-peach-800' : 'bg-butter-100 text-butter-800',
          )}
        >
          {line.level === 'out' ? t.levelOut : t.levelLow}
        </span>
      ) : line.enough === true ? (
        <span className="inline-flex h-7 items-center gap-1 rounded-pill bg-mint-100 px-2.5 text-xs font-semibold text-mint-800">
          <CheckIcon fontSize="inherit" className="text-sm" />
          {t.have}
        </span>
      ) : line.enough === false ? (
        <button
          type="button"
          onClick={onMissing}
          disabled={!onMissing || !line.productId}
          className="press inline-flex h-8 items-center gap-1 rounded-pill bg-peach-100 px-2.5 text-xs font-semibold text-peach-800 hover:bg-peach-200"
          aria-label={t.putOnList(tr(line, 'name'))}
        >
          {line.missing && measured ? t.need(formatQty(line.missing, measured)) : t.missingWord}
          <AddShoppingCartIcon fontSize="inherit" className="text-sm" />
        </button>
      ) : null}
    </li>
  );
}

/** Keeps the screen awake while cooking, where the browser allows it. */
function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    void navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      void lock?.release();
    };
  }, [on]);
}

function Steps({ recipe, servings }: { recipe: Recipe; servings: number }) {
  const t = useRecipesT();
  const steps = tr(recipe, 'steps');
  const [cookMode, setCookMode] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());
  const toggle = (index: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  if (!steps.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3 font-bold">{t.steps}</h2>
        <Button size="sm" variant="tint" onClick={() => setCookMode(true)}>
          {t.cookMode}
        </Button>
      </div>
      <ol className="mt-3 flex flex-col gap-2.5">
        {steps.map((step, index) => {
          const isDone = done.has(index);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => toggle(index)}
                className={cx(
                  'press flex w-full items-start gap-3.5 rounded-[1.5rem] p-4 text-left transition-colors',
                  isDone
                    ? 'bg-mint-100/60'
                    : 'bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70',
                )}
              >
                <span
                  className={cx(
                    'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                    isDone ? 'bg-mint-200 text-mint-800' : 'bg-butter-300 text-ink-900',
                  )}
                >
                  {isDone ? <CheckIcon fontSize="inherit" /> : index + 1}
                </span>
                <span
                  className={cx(
                    'pt-1 text-[0.9375rem] leading-relaxed',
                    isDone && 'text-ink-500 line-through decoration-ink-300',
                  )}
                >
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {cookMode ? (
        <CookMode recipe={recipe} servings={servings} onClose={() => setCookMode(false)} />
      ) : null}
    </section>
  );
}

/**
 * The phone or tablet propped up on the counter: one step at a time in big type, the screen kept
 * on, big Back / Next targets for a floury finger, and on a tablet the ingredients beside the step
 * to tick off as they go in.
 */
function CookMode({
  recipe,
  servings,
  onClose,
}: {
  recipe: Recipe;
  servings: number;
  onClose: () => void;
}) {
  const t = useRecipesT();
  const steps = tr(recipe, 'steps');
  const title = tr(recipe, 'title');
  const [step, setStep] = useState(0);
  const [added, setAdded] = useState<Set<string>>(new Set());
  useWakeLock(true);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight' || event.key === ' ')
        setStep((s) => Math.min(steps.length - 1, s + 1));
      if (event.key === 'ArrowLeft') setStep((s) => Math.max(0, s - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, steps.length]);
  const last = step === steps.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.cooking(title)}
      className="fixed inset-0 z-50 flex flex-col bg-butter-100 pb-[max(1rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.75rem)]"
    >
      <header className="flex items-center gap-3 px-4 md:px-6">
        <FoodIcon name={recipe.icon} className="size-10" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{title}</p>
          <p className="text-sm font-medium text-butter-800">
            {t.stepOf(t.servings(servings), step + 1, steps.length)}
          </p>
        </div>
        <IconButton icon={CloseIcon} label={t.doneCooking} variant="ink" onClick={onClose} />
      </header>
      <div className="mt-3 flex min-h-0 flex-1 gap-4 px-4 md:px-6">
        {/* Tablets: what goes in, to tick as it does. */}
        <aside className="hidden w-[18rem] shrink-0 overflow-y-auto rounded-[1.75rem] bg-white p-3 md:block lg:w-[22rem]">
          <h2 className="px-1 text-[0.9375rem] font-bold">{t.ingredients}</h2>
          <ul className="mt-1">
            {recipe.ingredients.map((line) => {
              const on = added.has(line.id);
              return (
                <li key={line.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setAdded((current) => {
                        const next = new Set(current);
                        if (next.has(line.id)) next.delete(line.id);
                        else next.add(line.id);
                        return next;
                      })
                    }
                    className={cx(
                      'press flex w-full items-center gap-2.5 rounded-2xl p-1.5 text-left',
                      on && 'opacity-50',
                    )}
                  >
                    <FoodIconTile
                      name={line.using?.icon ?? line.icon}
                      className="size-9 rounded-xl [&>svg]:size-6"
                      tone={on ? 'bg-mint-100' : 'bg-ink-50'}
                    />
                    <span className={cx('min-w-0 flex-1 text-[0.9375rem]', on && 'line-through')}>
                      <span className="font-semibold">
                        {line.using ? tr(line.using, 'name') : tr(line, 'name')}
                      </span>
                      <span className="text-ink-600">
                        {' '}
                        ·{' '}
                        {line.amount && line.unit
                          ? formatAmount(line.amount, line.unit)
                          : t.toTaste}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
        <button
          type="button"
          onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          className="flex min-w-0 flex-1 flex-col justify-center overflow-y-auto rounded-[2rem] bg-white p-6 text-left shadow-[var(--shadow-card)] md:p-10"
          aria-label={t.nextStep}
        >
          <span className="grid size-12 place-items-center rounded-full bg-butter-300 text-xl font-bold">
            {step + 1}
          </span>
          <span className="mt-5 text-[1.5rem] font-semibold leading-snug tracking-[-0.01em] md:text-[2rem]">
            {steps[step]}
          </span>
          {steps[step + 1] ? (
            <span className="mt-6 text-base text-ink-500 md:text-lg">
              {t.nextPrefix(steps[step + 1]!)}
            </span>
          ) : null}
        </button>
      </div>
      <footer className="mt-3 flex gap-3 px-4 md:px-6">
        <Button
          size="lg"
          variant="tint"
          icon={ArrowBackIcon}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="flex-1"
        >
          {t.back}
        </Button>
        {last ? (
          <Button size="lg" icon={CheckIcon} onClick={onClose} className="flex-1">
            {t.done}
          </Button>
        ) : (
          <Button
            size="lg"
            icon={ArrowForwardIcon}
            onClick={() => setStep((s) => s + 1)}
            className="flex-1"
          >
            {t.next}
          </Button>
        )}
      </footer>
    </div>,
    document.body,
  );
}

function CookSheet({
  open,
  recipe,
  lines,
  servings,
  onClose,
}: {
  open: boolean;
  recipe: Recipe;
  lines: IngredientLine[];
  servings: number;
  onClose: () => void;
}) {
  const t = useRecipesT();
  // Picked options must be there: cooking with whipped cream there isn't can't happen.
  const blocked = lines.filter(
    (line) => line.alternatives.length && !line.optional && line.enough === false,
  );
  const choices = Object.fromEntries(
    lines.flatMap((line, index) =>
      line.alternatives.length ? [[String(index), line.chosen]] : [],
    ),
  );
  const queryClient = useQueryClient();
  const [leftovers, setLeftovers] = useState(0);
  const cook = useMutation({
    mutationFn: () =>
      foodApi.cook(recipe.id, {
        servings,
        choices,
        ...(leftovers ? { leftovers: { portions: leftovers } } : {}),
      }),
    onSuccess: ({ meal, shortfalls, opened }) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(t.enjoy(tr(recipe, 'title')), {
        duration: opened.length ? 9000 : undefined,
        description: [
          shortfalls.length ? t.notEnough(formatList(shortfalls.map((s) => tr(s, 'name')))) : null,
          opened.length
            ? t.opened(openedText(opened, localDate()))
            : shortfalls.length
              ? null
              : t.outOfKitchen,
        ]
          .filter(Boolean)
          .join(' '),
        action: {
          label: t.undo,
          onClick: () =>
            void foodApi
              .reopenMeal(meal.id)
              .then(() => foodApi.deleteMeal(meal.id))
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
        },
      });
      setLeftovers(0);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const missing = lines.filter(
    (line) => line.enough === false && !line.optional && !line.alternatives.length,
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.cookTitle}
      description={t.cookDescription(servings)}
      footer={
        <Button
          fullWidth
          onClick={() => cook.mutate()}
          loading={cook.isPending}
          disabled={blocked.length > 0}
        >
          {t.cookedIt}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {blocked.length ? (
          <p className="rounded-2xl bg-danger-50 px-4 py-3 text-sm font-semibold text-danger-700">
            {t.blocked(
              blocked.map((line) => usedName(line).toLowerCase()).join(', '),
              blocked
                .map((line) =>
                  (line.using ? tr(line, 'name') : (altName(line) ?? t.another)).toLowerCase(),
                )
                .join(', '),
            )}
          </p>
        ) : null}
        {lines.some((line) => line.alternatives.length) ? (
          <p className="text-sm text-ink-600">
            {t.using(
              lines
                .filter((line) => line.alternatives.length)
                .map((line) => usedName(line).toLowerCase())
                .join(', '),
            )}
          </p>
        ) : null}
        {missing.length ? (
          <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-medium text-peach-800">
            {t.takesWhatThereIs(formatList(missing.map((m) => tr(m, 'name'))))}
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 p-3.5">
          <span>
            <span className="block text-[0.9375rem] font-semibold">{t.leftovers}</span>
            <span className="block text-sm text-ink-600">{t.leftoversHint}</span>
          </span>
          <div className="flex items-center gap-1 rounded-pill bg-white p-1 shadow-xs">
            <button
              type="button"
              aria-label={t.fewerPortions}
              disabled={!leftovers}
              onClick={() => setLeftovers((v) => Math.max(0, v - 1))}
              className="press grid size-9 place-items-center rounded-full bg-ink-50 text-lg disabled:opacity-40"
            >
              <RemoveIcon fontSize="inherit" />
            </button>
            <span className="tabular w-8 text-center font-bold">{leftovers}</span>
            <button
              type="button"
              aria-label={t.morePortions}
              onClick={() => setLeftovers((v) => Math.min(20, v + 1))}
              className="press grid size-9 place-items-center rounded-full bg-ink-900 text-lg text-white"
            >
              <AddIcon fontSize="inherit" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** What a line will use, in the current language: the alternative picked, else the item itself. */
const usedName = (line: IngredientLine) => (line.using ? tr(line.using, 'name') : tr(line, 'name'));

/** The first alternative there is enough of, in the current language. */
function altName(line: IngredientLine): string | undefined {
  const alt = line.alternatives.find((option) => option.enough);
  return alt ? tr(alt, 'name') : undefined;
}
