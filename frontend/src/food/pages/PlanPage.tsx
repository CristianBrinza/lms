import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Skeleton } from '@/components/ui';
import { AddIcon, AddShoppingCartIcon, ChevronRightIcon, FoodIcon } from '@/components/ui/icons';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { useMediaQuery } from '@/lib/useMediaQuery';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { MealStatus } from '../components/MealStatus';
import { addDays, localDate, weekStart } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import { AddMealSheet } from '../plan/AddMealSheet';
import { AteSheet } from '../plan/AteSheet';
import { formatKcal, kcalEach } from '../nutrition';
import { MealPanel, MealSheet } from '../plan/MealSheet';
import { NeedsSheet } from '../plan/NeedsSheet';
import { dayAndMonth, relativeDay, usePlanT, weekdayShort } from '../plan/i18n';
import type { Meal } from '../types';

/**
 * The meal plan, a week at a time. On a phone: a strip of days, then the chosen day's meals in
 * eating order. On an iPad held upright: the day beside the open meal (or, with none open, what
 * to pack tonight). On wide screens: the whole week in seven columns. A meal opens to mark it
 * eaten (the ingredients leave the kitchen) or change it for that day.
 */
export default function PlanPage() {
  const t = usePlanT();
  const today = localDate();
  const [params, setParams] = useSearchParams();
  const day = params.get('day') ?? today;
  const start = weekStart(day);
  const end = addDays(start, 6);
  const meals = useQuery({
    queryKey: foodKeys.meals(start, end),
    queryFn: () => foodApi.meals(start, end),
  });
  const kitchen = useQuery({ queryKey: foodKeys.kitchen, queryFn: foodApi.kitchen });
  const [adding, setAdding] = useState<{ open: boolean; day: string }>({
    open: Boolean(params.get('recipe')),
    day,
  });

  const set = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );

  const byDay = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const meal of meals.data ?? []) map.set(meal.date, [...(map.get(meal.date) ?? []), meal]);
    return map;
  }, [meals.data]);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const openMeal = (meals.data ?? []).find((m) => m.id === params.get('meal')) ?? null;
  const planned = (meals.data ?? []).filter(
    (m) => m.status === 'planned' && m.date >= today,
  ).length;
  // Split view between a tablet held upright and a wide screen, where the week fits.
  const split = useMediaQuery('(min-width: 44rem) and (max-width: 63.99rem)');
  const tomorrow = addDays(today, 1);
  const tomorrowMeals = useQuery({
    queryKey: foodKeys.meals(tomorrow, tomorrow),
    queryFn: () => foodApi.meals(tomorrow, tomorrow),
  });
  const toPack = (tomorrowMeals.data ?? []).filter((m) => m.toGo && m.status === 'planned');

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/food"
        title={t.title}
        subtitle={t.subtitle(dayAndMonth(start), dayAndMonth(end), planned)}
        actions={
          <>
            <IconButton
              icon={FoodIcon}
              label={t.ateSomething}
              size="sm"
              onClick={() => set({ ate: '1' })}
            />
            <IconButton
              icon={AddShoppingCartIcon}
              label={t.needs}
              size="sm"
              onClick={() => set({ needs: '1' })}
            />
            <IconButton
              icon={AddIcon}
              label={t.addMeal}
              variant="ink"
              size="sm"
              onClick={() => setAdding({ open: true, day })}
            />
          </>
        }
      />

      <div className="gutter-x mt-2.5 md:px-5 lg:px-8">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t.previousWeek}
            onClick={() => set({ day: addDays(start, -7) })}
            className="press grid size-9 shrink-0 place-items-center rounded-full text-[1.3rem] text-ink-600 hover:bg-ink-100"
          >
            <ChevronRightIcon fontSize="inherit" className="rotate-180" />
          </button>
          <div role="tablist" aria-label={t.days} className="grid flex-1 grid-cols-7 gap-1">
            {days.map((d) => {
              const count = (byDay.get(d) ?? []).length;
              const active = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => set({ day: d })}
                  className={cx(
                    'press flex h-14 flex-col items-center justify-center rounded-2xl text-[0.6875rem] font-semibold transition-colors',
                    active
                      ? 'bg-ink-900 text-white'
                      : d === today
                        ? 'bg-butter-100 text-ink-900'
                        : 'bg-white text-ink-700 shadow-xs hover:bg-ink-50',
                  )}
                >
                  <span>{weekdayShort(d)}</span>
                  <span className="text-base font-bold leading-tight">{Number(d.slice(8))}</span>
                  <span className="flex h-1.5 gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                      <span
                        key={i}
                        className={cx(
                          'size-1 rounded-full',
                          active ? 'bg-butter-300' : 'bg-lav-500',
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label={t.nextWeek}
            onClick={() => set({ day: addDays(start, 7) })}
            className="press grid size-9 shrink-0 place-items-center rounded-full text-[1.3rem] text-ink-600 hover:bg-ink-100"
          >
            <ChevronRightIcon fontSize="inherit" />
          </button>
        </div>
        {day !== today ? (
          <button
            type="button"
            onClick={() => set({ day: today })}
            className="mt-1.5 text-sm font-semibold text-lav-700 hover:text-lav-800"
          >
            {t.backToToday}
          </button>
        ) : null}
      </div>

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {meals.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-16 rounded-2xl" />
          </div>
        ) : meals.error ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-danger-700 shadow-[var(--shadow-card)]">
            {errorMessage(meals.error)}
          </p>
        ) : (
          <>
            {/* Phone: the chosen day. Tablet: the day beside the open meal. */}
            <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:items-start md:gap-4 lg:hidden">
              <section aria-label={relativeDay(day, today)}>
                {day === today && toPack.length && !split ? (
                  <PackTonight meals={toPack} onOpen={(id) => set({ meal: id, day: tomorrow })} />
                ) : null}
                <DayMeals
                  meals={byDay.get(day) ?? []}
                  onOpen={(id) => set({ meal: id })}
                  onAdd={() => setAdding({ open: true, day })}
                  title={relativeDay(day, today)}
                  selected={split ? openMeal?.id : null}
                />
              </section>
              {split ? (
                <aside className="sticky top-3 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] [scrollbar-width:thin]">
                  {openMeal ? (
                    <MealPanel
                      key={openMeal.id}
                      meal={openMeal}
                      kitchen={kitchen.data ?? []}
                      onClose={() => set({ meal: null })}
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {toPack.length ? (
                        <PackTonight
                          meals={toPack}
                          onOpen={(id) => set({ meal: id, day: tomorrow })}
                        />
                      ) : null}
                      <div className="rounded-[1.75rem] bg-white p-5 text-center shadow-[var(--shadow-card)]">
                        <p className="text-[1.0625rem] font-bold">{t.tapMeal}</p>
                        <p className="mt-1 text-sm text-ink-600">{t.tapMealHint}</p>
                      </div>
                    </div>
                  )}
                </aside>
              ) : null}
            </div>
            {/* Desktop: the week. */}
            <div className="hidden gap-3 lg:grid lg:grid-cols-7">
              {days.map((d) => (
                <section
                  key={d}
                  aria-label={relativeDay(d, today)}
                  className={cx(
                    'min-w-0 rounded-[1.25rem] p-2',
                    d === today ? 'bg-butter-100' : 'bg-white/60',
                  )}
                >
                  <DayMeals
                    meals={byDay.get(d) ?? []}
                    onOpen={(id) => set({ meal: id })}
                    onAdd={() => setAdding({ open: true, day: d })}
                    title={`${weekdayShort(d)} ${Number(d.slice(8))}`}
                    compact
                  />
                </section>
              ))}
            </div>
          </>
        )}
      </div>

      <MealSheet
        meal={split ? null : openMeal}
        kitchen={kitchen.data ?? []}
        onClose={() => set({ meal: null })}
      />
      <AddMealSheet
        open={adding.open}
        day={adding.day}
        today={today}
        recipeId={params.get('recipe')}
        options={params.get('options')}
        onClose={() => {
          setAdding({ open: false, day });
          set({ recipe: null, options: null });
        }}
      />
      <AteSheet open={params.get('ate') === '1'} onClose={() => set({ ate: null })} />
      <NeedsSheet
        open={params.get('needs') === '1'}
        today={today}
        onClose={() => set({ needs: null })}
      />
    </Screen>
  );
}

/** Tomorrow's lunch to take along: made and packed tonight, after the last meal. */
function PackTonight({ meals, onOpen }: { meals: Meal[]; onOpen: (id: string) => void }) {
  const t = usePlanT();
  return (
    <section className="mb-3 rounded-[1.25rem] bg-lav-100 p-3">
      <h2 className="px-1 text-[0.9375rem] font-bold">{t.packTonight}</h2>
      <p className="px-1 text-xs text-lav-800">{t.packHint}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {meals.map((meal) => (
          <li key={meal.id}>
            <button
              type="button"
              onClick={() => onOpen(meal.id)}
              className="press flex w-full items-center gap-2.5 rounded-2xl bg-white p-2 text-left hover:bg-ink-50"
            >
              <FoodIconTile
                name={meal.icon}
                tone="bg-butter-100"
                className="size-9 rounded-xl [&>svg]:size-6"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">
                  {tr(meal, 'title')}
                </span>
                <span className="block truncate text-xs text-ink-600">
                  {t.tomorrowAt(meal.time ?? t.slot[meal.slot])} · {t.servings(meal.servings)}
                </span>
              </span>
              <MealStatus meal={meal} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DayMeals({
  meals,
  onOpen,
  onAdd,
  title,
  compact,
  selected,
}: {
  meals: Meal[];
  onOpen: (id: string) => void;
  onAdd: () => void;
  title: string;
  compact?: boolean;
  selected?: string | null;
}) {
  const t = usePlanT();
  return (
    <>
      <h2 className={cx('mb-1.5 px-1 font-bold', compact ? 'text-sm' : 'text-[0.9375rem]')}>
        {title}
      </h2>
      {meals.length ? (
        <ul className={cx('flex flex-col', compact ? 'gap-1.5' : 'gap-2')}>
          {meals.map((meal) => (
            <li key={meal.id}>
              <button
                type="button"
                onClick={() => onOpen(meal.id)}
                aria-current={selected === meal.id ? 'true' : undefined}
                className={cx(
                  'press flex w-full items-center gap-2.5 rounded-[1.25rem] text-left shadow-[var(--shadow-card)] ring-1 ring-inset transition-colors hover:bg-ink-50',
                  selected === meal.id ? 'bg-butter-100 ring-ink-900' : 'bg-white ring-ink-100/70',
                  compact ? 'flex-col items-start p-2' : 'p-2',
                  meal.status !== 'planned' && 'opacity-70',
                )}
              >
                {compact ? null : (
                  <span className="tabular w-12 shrink-0 truncate text-center text-sm font-bold text-ink-700">
                    {meal.time ?? t.slotShort[meal.slot]}
                  </span>
                )}
                <FoodIconTile
                  name={meal.icon}
                  tone={meal.status === 'done' ? 'bg-mint-100' : 'bg-butter-100'}
                  className="size-10 rounded-xl [&>svg]:size-7"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cx(
                      'block truncate font-semibold',
                      compact ? 'text-xs' : 'text-[0.9375rem]',
                      meal.status === 'done' && 'line-through decoration-ink-400',
                    )}
                  >
                    {tr(meal, 'title')}
                  </span>
                  <span className="block truncate text-xs text-ink-600">
                    {compact ? `${meal.time ?? t.slot[meal.slot]} · ` : `${t.slot[meal.slot]} · `}
                    {t.servings(meal.servings)}
                    {meal.parts.length > 1 ? ` · ${t.parts(meal.parts.length)}` : ''}
                    {meal.toGo ? ` · ${t.toGo}` : ''}
                    {meal.status === 'done' && kcalEach(meal) !== null
                      ? ` · ${t.kcal(formatKcal(kcalEach(meal)!), meal.servings > 1)}`
                      : ''}
                  </span>
                  {meal.status === 'planned' &&
                  meal.tools.some((tool) => tool.status === 'dirty') ? (
                    <span className="block truncate text-xs font-semibold text-peach-800">
                      {t.washFirst(
                        meal.tools
                          .filter((tool) => tool.status === 'dirty')
                          .map((tool) => tr(tool, 'name').toLowerCase())
                          .join(', '),
                      )}
                    </span>
                  ) : null}
                </span>
                {compact ? null : <MealStatus meal={meal} />}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className={cx(
            'rounded-[1.25rem] bg-white px-3 text-ink-500 shadow-[var(--shadow-card)]',
            compact ? 'py-3 text-xs' : 'py-4 text-sm',
          )}
        >
          {t.nothingPlanned}
        </p>
      )}
      <Button variant="tint" size="sm" icon={AddIcon} className="mt-2" onClick={onAdd}>
        {t.add}
      </Button>
    </>
  );
}
