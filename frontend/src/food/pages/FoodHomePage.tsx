import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, ButtonLink, IconLink, Skeleton, toast } from '@/components/ui';
import { AddIcon, ArrowOutIcon, ChevronRightIcon, SparkleIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { ExpiryChip } from '../components/ExpiryChip';
import { MealStatus } from '../components/MealStatus';
import { dayLong, formatQty, localDate, plural, SLOT_LABEL } from '../format';
import { FoodIcon, FoodIconTile, SceneArt } from '../icons/FoodIcon';
import type { FoodOverview } from '../types';

/**
 * Food's front door. On a phone, "Today" comes first (what's for lunch, what to use up, what ran
 * low), then the four big cards: Kitchen, Recipes, Shopping, Plan. On desktop the cards lead on
 * the left and Today stands beside them.
 */
export default function FoodHomePage() {
  const today = localDate();
  const overview = useQuery({ queryKey: [...foodKeys.overview, today], queryFn: () => foodApi.overview(today) });
  const data = overview.data;

  return (
    <Screen tone="field" className="lg:grid lg:grid-cols-[minmax(0,1fr)_25rem] lg:items-start lg:gap-8 lg:pr-8">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <PageHeader
          back="/home"
          title="Food"
          subtitle={data ? data.kitchen.name : 'Your kitchen, recipes, shopping and plan'}
          actions={<IconLink to="/settings/ai" icon={SparkleIcon} label="Plan with Claude" variant="white" />}
        />
      </div>

      <div className="gutter-x mt-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-8 lg:px-0 lg:sticky lg:top-4">
        <Today overview={overview.data} loading={overview.isPending} error={overview.error} onRetry={() => void overview.refetch()} today={today} />
        <AskClaude className="mt-4 hidden lg:flex" />
      </div>

      <section aria-label="Sections" className="gutter-x mt-6 lg:col-start-1 lg:row-start-2 lg:mt-7 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <SectionCard
            to="/food/kitchen"
            title="Kitchen"
            scene="kitchen"
            tone="ink"
            index={0}
            value={data ? String(data.stock.products) : null}
            unit={data ? (data.stock.products === 1 ? 'item' : 'items') : ''}
            detail={data ? (data.stock.expiring.length ? `${data.stock.expiring.length} to use soon` : 'Nothing expiring') : null}
          />
          <SectionCard
            to="/food/recipes"
            title="Recipes"
            scene="recipes"
            tone="butter"
            index={1}
            value={data ? String(data.recipes.total) : null}
            unit={data ? (data.recipes.total === 1 ? 'recipe' : 'recipes') : ''}
            detail={data ? (data.recipes.total ? `${data.recipes.ready} ready to cook` : 'Add your first') : null}
          />
          <SectionCard
            to="/food/shopping"
            title="Shopping"
            scene="shopping"
            tone="cyan"
            index={2}
            value={data ? String(data.shopping.open) : null}
            unit="to buy"
            detail={data ? shoppingDetail(data) : null}
          />
          <SectionCard
            to="/food/plan"
            title="Plan"
            scene="plan"
            tone="white"
            index={3}
            value={data ? String(data.meals.plannedThisWeek) : null}
            unit={data ? (data.meals.plannedThisWeek === 1 ? 'meal' : 'meals') : ''}
            detail={data ? 'planned this week' : null}
          />
        </div>
        <AskClaude className="mt-4 lg:hidden" />
      </section>
    </Screen>
  );
}

function shoppingDetail(data: FoodOverview): string {
  const stores = data.shopping.stores.filter((s) => s.open > 0);
  if (!stores.length) return data.shopping.open ? 'On the list' : 'Lists are empty';
  return stores
    .slice(0, 2)
    .map((s) => `${s.name} ${s.open}`)
    .join(' · ');
}

const CARD_TONES = {
  ink: { surface: 'bg-ink-900 text-white shadow-[var(--shadow-tile)]', muted: 'text-white/70', button: 'bg-butter-300 text-ink-900' },
  butter: { surface: 'bg-butter-300 text-ink-900 shadow-[0_18px_34px_-22px_rgb(110_80_0/0.7)]', muted: 'text-butter-800', button: 'bg-white text-ink-900' },
  cyan: { surface: 'bg-cyan-200 text-ink-900 shadow-[0_18px_34px_-22px_rgb(20_94_112/0.6)]', muted: 'text-cyan-800', button: 'bg-ink-900 text-white' },
  white: { surface: 'bg-white text-ink-900 shadow-[var(--shadow-tile)]', muted: 'text-ink-600', button: 'bg-butter-300 text-ink-900' },
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
        'group/card animate-deal relative flex min-h-[12.5rem] flex-col overflow-hidden rounded-[1.75rem] p-4 sm:min-h-[13.5rem] sm:p-5 lg:min-h-[15rem] lg:p-6',
        'transition-[translate,box-shadow] duration-300 ease-(--ease-lift) hover:-translate-y-1 focus-visible:-translate-y-1 active:translate-y-0 active:duration-100',
        t.surface,
      )}
    >
      <span className="text-[1.375rem] font-bold leading-[1.1] tracking-[-0.025em]">{title}</span>
      <span className="mt-2 flex items-baseline gap-1.5">
        {value === null ? <Skeleton className="h-8 w-12 opacity-40" /> : <span className="tabular text-[2rem] font-bold leading-none tracking-[-0.03em]">{value}</span>}
        <span className={cx('text-sm font-semibold', t.muted)}>{unit}</span>
      </span>
      <span className={cx('mt-1 line-clamp-2 max-w-[9rem] text-[0.8125rem] font-medium leading-snug', t.muted)}>{detail ?? ' '}</span>
      <span className="mt-auto flex items-end justify-between">
        <span aria-hidden="true" className={cx('grid size-11 place-items-center rounded-full text-[1.25rem] transition-transform duration-300 ease-(--ease-lift) group-hover/card:rotate-45', t.button)}>
          <ArrowOutIcon fontSize="inherit" />
        </span>
      </span>
      <SceneArt
        scene={scene}
        className="pointer-events-none absolute -bottom-2 -right-1 size-[5.75rem] transition-transform duration-500 ease-(--ease-lift) group-hover/card:-rotate-6 group-hover/card:scale-105 sm:size-24 lg:size-28"
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
  return (
    <section aria-labelledby="today-title" className="rounded-[2rem] bg-white p-5 shadow-[var(--shadow-raised)] lg:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="today-title" className="text-h2 font-bold">
          Today
        </h2>
        <span className="truncate text-sm font-medium text-ink-500">{dayLong(today)}</span>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : error ? (
        <div className="mt-4 rounded-2xl bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">Couldn’t load your kitchen</p>
          <p className="mt-1 text-sm text-ink-600">{errorMessage(error)}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : overview ? (
        <>
          <Meals overview={overview} />
          <UseSoon overview={overview} today={today} />
          <RunningLow overview={overview} />
        </>
      ) : null}
    </section>
  );
}

function Meals({ overview }: { overview: FoodOverview }) {
  const meals = overview.meals.today;
  if (!meals.length) {
    return (
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ink-50 p-3.5">
        <FoodIconTile name="pot" tone="bg-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] font-semibold">No meals today</p>
          <p className="truncate text-sm text-ink-600">{overview.meals.upcoming[0] ? `Next: ${overview.meals.upcoming[0].title}` : 'Plan what to cook'}</p>
        </div>
        <ButtonLink to="/food/plan" size="sm" variant="primary" icon={AddIcon}>
          Plan
        </ButtonLink>
      </div>
    );
  }
  return (
    <ul className="mt-3.5 flex flex-col gap-2">
      {meals.map((meal) => (
        <li key={meal.id}>
          <Link
            to={`/food/plan?meal=${meal.id}`}
            className={cx('press flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-ink-50', meal.status !== 'planned' && 'opacity-70')}
          >
            <FoodIconTile name={meal.icon} tone={meal.status === 'done' ? 'bg-mint-100' : 'bg-butter-100'} />
            <span className="min-w-0 flex-1">
              <span className={cx('block truncate text-[0.9375rem] font-semibold', meal.status === 'done' && 'line-through decoration-ink-400')}>{meal.title}</span>
              <span className="block text-sm text-ink-600">
                {meal.time ?? SLOT_LABEL[meal.slot]} · {plural(meal.servings, 'serving')}
              </span>
            </span>
            <MealStatus meal={meal} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function UseSoon({ overview, today }: { overview: FoodOverview; today: string }) {
  const items = overview.stock.expiring;
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <h3 className="text-h3 font-bold">Use soon</h3>
        <Link to="/food/kitchen" className="inline-flex items-center text-sm font-semibold text-lav-700 hover:text-lav-800">
          Kitchen
          <ChevronRightIcon fontSize="inherit" className="text-lg" />
        </Link>
      </div>
      <ul className="-mx-5 mt-2.5 flex gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:-mx-6 lg:px-6">
        {items.map((item) => (
          <li key={item.lotId} className="shrink-0">
            <Link to={`/food/kitchen?item=${item.productId}`} className="press flex w-[8.25rem] flex-col gap-2 rounded-2xl bg-ink-50 p-3 transition-colors hover:bg-ink-100">
              <span className="flex items-start justify-between">
                <FoodIcon name={item.icon} className="size-9" />
                <ExpiryChip expiresOn={item.expiresOn} today={today} compact />
              </span>
              <span className="truncate text-sm font-semibold">{item.name}</span>
              <span className="-mt-1.5 text-xs font-medium text-ink-600">{formatQty(item.quantity, item)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunningLow({ overview }: { overview: FoodOverview }) {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (item: FoodOverview['stock']['low'][number]) => foodApi.addLines([{ productId: item.productId }], 'low_stock'),
    onSuccess: (_lines, item) => {
      toast.success(`${item.name} is on the list`);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const items = overview.stock.low;
  if (!items.length) return null;
  return (
    <div className="mt-5">
      <h3 className="text-h3 font-bold">Running low</h3>
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.productId}>
            <button
              type="button"
              onClick={() => add.mutate(item)}
              disabled={add.isPending && add.variables?.productId === item.productId}
              className="press inline-flex h-11 items-center gap-2 rounded-pill bg-peach-100 pl-1.5 pr-3.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-peach-200 disabled:opacity-60"
              aria-label={`Add ${item.name} to the shopping list`}
            >
              <span className="grid size-8 place-items-center rounded-full bg-white">
                <FoodIcon name={item.icon} className="size-6" />
              </span>
              {item.name}
              <AddIcon fontSize="inherit" className="text-lg text-peach-800" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AskClaude({ className }: { className?: string }) {
  return (
    <Link
      to="/settings/ai"
      className={cx('press group/ai flex items-center gap-3.5 rounded-[1.75rem] bg-lav-100 p-4 transition-colors hover:bg-lav-200', className)}
    >
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ink-900 text-[1.35rem] text-butter-300">
        <SparkleIcon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-semibold">Plan with Claude</span>
        <span className="block text-sm leading-snug text-ink-600">Let Claude plan your week, fill the lists and save recipes.</span>
      </span>
      <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-500 transition-transform group-hover/ai:translate-x-0.5" />
    </Link>
  );
}

