import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '@/app/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  ArrowOutIcon,
  ChevronRightIcon,
  FoodIcon as EatIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { formatList, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys, peopleApi } from '../api';
import { ExpiryChip } from '../components/ExpiryChip';
import { MealStatus } from '../components/MealStatus';
import { dayLong, formatQty, LOCATION_LABEL, localDate, SLOT_LABEL } from '../format';
import { FoodIcon, FoodIconTile, SceneArt } from '../icons/FoodIcon';
import { KitchenwareEntry } from '../kitchenware/KitchenwareEntry';
import { eatenBy, formatKcal, kcalUnit } from '../nutrition';
import { AteSheet } from '../plan/AteSheet';
import type { FoodOverview } from '../types';
import { foodHomeT } from './home.i18n';

/**
 * Food's front door. On a phone, "Today" comes first (what's for lunch, what's opened, what to use
 * up, what ran low), then the four big cards: Kitchen, Recipes, Shopping, Plan. On an iPad held
 * upright Today opens into two columns and the cards stand in one row; on wide screens the cards
 * lead on the left and Today stands beside them.
 */
export default function FoodHomePage() {
  const t = foodHomeT();
  const today = localDate();
  const overview = useQuery({
    queryKey: [...foodKeys.overview, today],
    queryFn: () => foodApi.overview(today),
  });
  const data = overview.data;

  return (
    <Screen
      tone="field"
      className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-x-6 lg:pr-8"
    >
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <PageHeader
          compact
          back="/home"
          title={t.title}
          subtitle={data ? data.kitchen.name : ' '}
        />
      </div>

      <div className="gutter-x mt-3 md:px-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-6 lg:px-0">
        <Today
          overview={overview.data}
          loading={overview.isPending}
          error={overview.error}
          onRetry={() => void overview.refetch()}
          today={today}
        />
        <AskClaude className="mt-3 hidden lg:flex" />
      </div>

      <section
        aria-label={t.sections}
        className="gutter-x mt-3 md:px-5 lg:col-start-1 lg:row-start-2 lg:mt-5 lg:px-8"
      >
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3 lg:grid-cols-2 lg:gap-4">
          <SectionCard
            to="/food/kitchen"
            title={t.kitchen}
            scene="kitchen"
            tone="ink"
            index={0}
            value={data ? String(data.stock.products) : null}
            unit={data ? t.itemsWord(data.stock.products) : ''}
            detail={
              data
                ? data.stock.expiring.length
                  ? t.toUseSoon(data.stock.expiring.length)
                  : t.nothingExpiring
                : null
            }
          />
          <SectionCard
            to="/food/recipes"
            title={t.recipes}
            scene="recipes"
            tone="butter"
            index={1}
            value={data ? String(data.recipes.total) : null}
            unit={data ? t.recipesWord(data.recipes.total) : ''}
            detail={
              data ? (data.recipes.total ? t.readyToCook(data.recipes.ready) : t.addFirst) : null
            }
          />
          <SectionCard
            to="/food/shopping"
            title={t.shopping}
            scene="shopping"
            tone="cyan"
            index={2}
            value={data ? String(data.shopping.open) : null}
            unit={t.toBuyWord}
            detail={data ? shoppingDetail(data) : null}
          />
          <SectionCard
            to="/food/plan"
            title={t.plan}
            scene="plan"
            tone="white"
            index={3}
            value={data ? String(data.meals.plannedThisWeek) : null}
            unit={data ? t.mealsWord(data.meals.plannedThisWeek) : ''}
            detail={data ? t.plannedThisWeek : null}
          />
        </div>
        {/* Beside the four areas, not one of them: pots, pans, glasses — clean or in the wash. */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <KitchenwareEntry />
          <AskClaude className="lg:hidden" />
        </div>
      </section>
    </Screen>
  );
}

function shoppingDetail(data: FoodOverview): string {
  const t = foodHomeT();
  const stores = data.shopping.stores.filter((s) => s.open > 0);
  if (!stores.length) return data.shopping.open ? t.onList : t.listsEmpty;
  return stores
    .slice(0, 2)
    .map((s) => `${tr(s, 'name')} ${s.open}`)
    .join(' · ');
}

const CARD_TONES = {
  ink: {
    surface: 'bg-ink-900 text-white shadow-[var(--shadow-tile)]',
    muted: 'text-white/70',
    button: 'bg-butter-300 text-ink-900',
  },
  butter: {
    surface: 'bg-butter-300 text-ink-900 shadow-[0_18px_34px_-22px_rgb(110_80_0/0.7)]',
    muted: 'text-butter-800',
    button: 'bg-white text-ink-900',
  },
  cyan: {
    surface: 'bg-cyan-200 text-ink-900 shadow-[0_18px_34px_-22px_rgb(20_94_112/0.6)]',
    muted: 'text-cyan-800',
    button: 'bg-ink-900 text-white',
  },
  white: {
    surface: 'bg-white text-ink-900 shadow-[var(--shadow-tile)]',
    muted: 'text-ink-600',
    button: 'bg-butter-300 text-ink-900',
  },
} as const;

function SectionCard({
  to,
  title,
  scene,
  tone,
  value,
  unit,
  detail,
  index,
}: {
  to: string;
  title: string;
  scene: 'kitchen' | 'recipes' | 'shopping' | 'plan';
  tone: keyof typeof CARD_TONES;
  value: string | null;
  unit: string;
  detail: string | null;
  index: number;
}) {
  const t = CARD_TONES[tone];
  return (
    <Link
      to={to}
      viewTransition
      style={{ animationDelay: `${60 + index * 60}ms` }}
      className={cx(
        'group/card animate-deal relative flex min-h-[8.75rem] flex-col overflow-hidden rounded-[1.5rem] p-3.5 sm:min-h-[10rem] sm:p-4 lg:min-h-[12rem] lg:p-5',
        'transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-1 focus-visible:-translate-y-1 active:translate-y-0 active:duration-100',
        t.surface,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[1.125rem] font-bold leading-tight tracking-[-0.02em] lg:text-[1.375rem]">
          {title}
        </span>
        <span
          aria-hidden="true"
          className={cx(
            'grid size-8 shrink-0 place-items-center rounded-full text-base transition-transform duration-300 ease-(--ease-lift) group-hover/card:rotate-45',
            t.button,
          )}
        >
          <ArrowOutIcon fontSize="inherit" />
        </span>
      </span>
      <span className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">
        {value === null ? (
          <Skeleton className="h-7 w-10 opacity-40" />
        ) : (
          <span className="tabular text-[1.75rem] font-bold leading-none tracking-[-0.03em]">
            {value}
          </span>
        )}
        <span className={cx('text-[0.8125rem] font-semibold', t.muted)}>{unit}</span>
      </span>
      <span
        className={cx('mt-1 line-clamp-2 max-w-[62%] text-xs font-medium leading-snug', t.muted)}
      >
        {detail ?? ' '}
      </span>
      {/* The drawing sits wholly inside the corner, clear of the text. */}
      <SceneArt
        scene={scene}
        className="pointer-events-none absolute bottom-2.5 right-2.5 size-[3.75rem] transition-transform duration-500 ease-(--ease-lift) group-hover/card:-rotate-6 group-hover/card:scale-105 sm:size-[4.5rem] lg:bottom-4 lg:right-4 lg:size-24"
      />
    </Link>
  );
}

function Today({
  overview,
  loading,
  error,
  onRetry,
  today,
}: {
  overview: FoodOverview | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  today: string;
}) {
  const t = foodHomeT();
  return (
    <section
      aria-labelledby="today-title"
      className="rounded-[1.5rem] bg-white p-3.5 shadow-[var(--shadow-raised)] lg:rounded-[2rem] lg:p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-title" className="text-h3 font-bold">
          {t.today}
        </h2>
        <span className="truncate text-[0.8125rem] font-medium text-ink-500">{dayLong(today)}</span>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">{t.couldntLoad}</p>
          <p className="mt-1 text-sm text-ink-600">{errorMessage(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            {t.tryAgain}
          </Button>
        </div>
      ) : overview ? (
        <>
          <Eaten meals={overview.meals.today} />
          {/* Two columns on an iPad held upright: the day's meals beside what to use up. */}
          <div className="md:grid md:grid-cols-2 md:gap-x-6 lg:block">
            <div className="min-w-0">
              <Meals overview={overview} />
              <CookIdeas
                planned={
                  new Set(
                    overview.meals.today
                      .map((m) => m.recipeId)
                      .filter((id): id is string => Boolean(id)),
                  )
                }
              />
            </div>
            <div className="min-w-0">
              <Opened overview={overview} today={today} />
              <UseSoon overview={overview} today={today} />
              <RunningLow overview={overview} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

/**
 * What the signed-in person ate today (their share of each meal eaten), linked to their energy in
 * Health, and the quick way to log something eaten outside the plan.
 */
function Eaten({ meals }: { meals: FoodOverview['meals']['today'] }) {
  const t = foodHomeT();
  const me = useUser();
  const [logging, setLogging] = useState(false);
  const people = useQuery({ queryKey: foodKeys.people, queryFn: peopleApi.list });
  const household = people.data?.people.length;
  const eaten = household ? eatenBy(meals, me.id, household) : null;
  return (
    <div className="mt-2.5 flex items-center justify-between gap-3">
      {eaten?.meals ? (
        <Link
          to="/training/health"
          className="press inline-flex min-w-0 items-center gap-1 text-sm font-semibold text-ink-700 hover:text-ink-900"
        >
          <span className="truncate">
            {t.eatenToday}{' '}
            <span className="tabular text-ink-900">
              {formatKcal(eaten.kcal)} {kcalUnit()}
            </span>
          </span>
          <ChevronRightIcon fontSize="inherit" className="shrink-0 text-base text-ink-500" />
        </Link>
      ) : (
        <span className="min-w-0 text-sm text-ink-500">{t.nothingEaten}</span>
      )}
      <Button
        size="sm"
        variant="tint"
        icon={EatIcon}
        className="shrink-0"
        onClick={() => setLogging(true)}
      >
        {t.ateSomething}
      </Button>
      <AteSheet open={logging} onClose={() => setLogging(false)} />
    </div>
  );
}

function Meals({ overview }: { overview: FoodOverview }) {
  const t = foodHomeT();
  const meals = overview.meals.today;
  if (!meals.length) {
    const next = overview.meals.upcoming[0];
    return (
      <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
        <FoodIconTile name="pot" tone="bg-white" className="size-10 rounded-xl [&>svg]:size-7" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold">{t.noMeals}</p>
          <p className="truncate text-sm text-ink-600">
            {next ? t.next(tr(next, 'title')) : t.planWhat}
          </p>
        </div>
        <ButtonLink to="/food/plan" size="sm" variant="primary" icon={AddIcon}>
          {t.planButton}
        </ButtonLink>
      </div>
    );
  }
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {meals.map((meal) => (
        <li key={meal.id}>
          <Link
            to={`/food/plan?meal=${meal.id}`}
            className={cx(
              'press -mx-1.5 flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-ink-50',
              meal.status !== 'planned' && 'opacity-70',
            )}
          >
            <FoodIconTile
              name={meal.icon}
              tone={meal.status === 'done' ? 'bg-mint-100' : 'bg-butter-100'}
              className="size-10 rounded-xl [&>svg]:size-7"
            />
            <span className="min-w-0 flex-1">
              <span
                className={cx(
                  'block truncate text-[0.9375rem] font-semibold',
                  meal.status === 'done' && 'line-through decoration-ink-400',
                )}
              >
                {tr(meal, 'title')}
              </span>
              <span className="block truncate text-sm text-ink-600">
                {meal.time ?? SLOT_LABEL[meal.slot]} · {t.servings(meal.servings)}
                {meal.toGo ? ` · ${t.toGo}` : ''}
              </span>
              <ToolWarning meal={meal} />
            </span>
            <MealStatus meal={meal} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Kitchenware a planned meal needs that is still dirty or in the dishwasher. */
function ToolWarning({ meal }: { meal: FoodOverview['meals']['today'][number] }) {
  const t = foodHomeT();
  if (meal.status !== 'planned') return null;
  const dirty = meal.tools.filter((tool) => tool.status === 'dirty');
  const washing = meal.tools.filter((tool) => tool.status === 'washing');
  if (!dirty.length && !washing.length) return null;
  const names = (tools: typeof dirty) =>
    formatList(tools.map((tool) => tr(tool, 'name').toLowerCase()));
  return (
    <span className="mt-0.5 block truncate text-xs font-semibold text-peach-800">
      {dirty.length ? t.washFirst(names(dirty)) : t.inDishwasher(names(washing))}
    </span>
  );
}

/** Packages already started: use them before they spoil, rather than opening new ones. */
function Opened({ overview, today }: { overview: FoodOverview; today: string }) {
  const t = foodHomeT();
  const items = overview.stock.opened;
  if (!items.length) return null;
  return (
    <div className="mt-3.5 md:mt-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[0.9375rem] font-bold">{t.openedFirst}</h3>
        <Link
          to="/food/kitchen"
          className="inline-flex shrink-0 items-center text-sm font-semibold text-lav-700 hover:text-lav-800"
        >
          {t.kitchen}
          <ChevronRightIcon fontSize="inherit" className="text-lg" />
        </Link>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {items.slice(0, 4).map((item) => (
          <li key={item.lotId} className="flex items-center gap-1">
            <Link
              to={`/food/kitchen?item=${item.productId}`}
              className="press -mx-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-ink-50"
            >
              <FoodIconTile
                name={item.icon}
                tone="bg-peach-100"
                className="size-10 rounded-xl [&>svg]:size-7"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">
                  {tr(item, 'name')}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {t.left(formatQty(item.quantity, item))} · {LOCATION_LABEL[item.location]}
                </span>
              </span>
              <ExpiryChip expiresOn={item.expiresOn} today={today} compact />
            </Link>
            {item.recipes ? (
              <Link
                to={`/food/recipes?uses=${item.productId}`}
                className="press inline-flex h-8 shrink-0 items-center rounded-pill bg-ink-900 px-3 text-xs font-semibold text-white"
                aria-label={t.recipesWith(tr(item, 'name'))}
              >
                {t.recipeCount(item.recipes)}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** What can be cooked right now from the kitchen, the ones using up food first. */
function CookIdeas({ planned }: { planned: Set<string> }) {
  const t = foodHomeT();
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const ideas = (recipes.data ?? [])
    .filter((r) => r.availability.ready && r.availability.total > 0 && !planned.has(r.id))
    .sort(
      (a, b) =>
        b.availability.useSoon - a.availability.useSoon || Number(b.favorite) - Number(a.favorite),
    )
    .slice(0, 3);
  if (!ideas.length) return null;
  return (
    <div className="mt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[0.9375rem] font-bold">{t.fromWhatYouHave}</h3>
        <Link
          to="/food/recipes"
          className="inline-flex shrink-0 items-center text-sm font-semibold text-lav-700 hover:text-lav-800"
        >
          {t.recipes}
          <ChevronRightIcon fontSize="inherit" className="text-lg" />
        </Link>
      </div>
      <ul className="mt-1.5 flex flex-col gap-1">
        {ideas.map((recipe) => (
          <li key={recipe.id}>
            <Link
              to={`/food/recipes/${recipe.id}`}
              className="press -mx-1.5 flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-ink-50"
            >
              <FoodIconTile
                name={recipe.icon}
                tone="bg-mint-100"
                className="size-10 rounded-xl [&>svg]:size-7"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">
                  {tr(recipe, 'title')}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {recipe.availability.useSoon
                    ? t.usesSoon(recipe.availability.useSoon)
                    : t.allInKitchen}
                </span>
              </span>
              <span className="inline-flex h-8 shrink-0 items-center rounded-pill bg-ink-900 px-3 text-xs font-semibold text-white">
                {t.cook}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UseSoon({ overview, today }: { overview: FoodOverview; today: string }) {
  const t = foodHomeT();
  // Opened packages are listed above already.
  const opened = new Set(overview.stock.opened.map((item) => item.lotId));
  const items = overview.stock.expiring.filter((item) => !opened.has(item.lotId));
  if (!items.length) return null;
  return (
    <div className="mt-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-[0.9375rem] font-bold">{t.useSoon}</h3>
        <Link
          to="/food/kitchen"
          className="inline-flex shrink-0 items-center text-sm font-semibold text-lav-700 hover:text-lav-800"
        >
          {t.kitchen}
          <ChevronRightIcon fontSize="inherit" className="text-lg" />
        </Link>
      </div>
      <ul className="-mx-3.5 mt-2 flex gap-2 overflow-x-auto px-3.5 pb-0.5 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 lg:-mx-5 lg:flex-nowrap lg:px-5">
        {items.map((item) => (
          <li key={item.lotId} className="shrink-0">
            <Link
              to={`/food/kitchen?item=${item.productId}`}
              className="press flex w-[7.5rem] flex-col gap-1.5 rounded-2xl bg-ink-50 p-2.5 transition-colors hover:bg-ink-100"
            >
              <span className="flex items-start justify-between">
                <FoodIcon name={item.icon} className="size-8" />
                <ExpiryChip expiresOn={item.expiresOn} today={today} compact />
              </span>
              <span className="truncate text-sm font-semibold">{tr(item, 'name')}</span>
              <span className="-mt-1.5 text-xs font-medium text-ink-600">
                {formatQty(item.quantity, item)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunningLow({ overview }: { overview: FoodOverview }) {
  const t = foodHomeT();
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (item: FoodOverview['stock']['low'][number]) =>
      foodApi.addLines([{ productId: item.productId }], 'low_stock'),
    onSuccess: (_lines, item) => {
      toast.success(t.onListToast(tr(item, 'name')));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const items = overview.stock.low;
  if (!items.length) return null;
  return (
    <div className="mt-3.5">
      <h3 className="text-[0.9375rem] font-bold">{t.runningLow}</h3>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li key={item.productId}>
            <button
              type="button"
              onClick={() => add.mutate(item)}
              disabled={add.isPending && add.variables?.productId === item.productId}
              className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-peach-100 pl-1 pr-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-peach-200 disabled:opacity-60"
              aria-label={t.addToList(tr(item, 'name'))}
            >
              <span className="grid size-8 place-items-center rounded-full bg-white">
                <FoodIcon name={item.icon} className="size-6" />
              </span>
              {tr(item, 'name')}
              <AddIcon fontSize="inherit" className="text-lg text-peach-800" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskClaude({ className }: { className?: string }) {
  const t = foodHomeT();
  return (
    <Link
      to="/settings/ai"
      className={cx(
        'press group/ai flex items-center gap-3 rounded-[1.5rem] bg-lav-100 p-3 transition-colors hover:bg-lav-200',
        className,
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink-900 text-[1.2rem] text-butter-300">
        <SparkleIcon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold">{t.planWithClaude}</span>
        <span className="block text-[0.8125rem] leading-snug text-ink-600">{t.claudeHint}</span>
      </span>
      <ChevronRightIcon
        fontSize="inherit"
        className="shrink-0 text-[1.4rem] text-ink-500 transition-transform group-hover/ai:translate-x-0.5"
      />
    </Link>
  );
}
