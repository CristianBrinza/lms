import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, RemoveIcon, SearchIcon } from '@/components/ui/icons';
import { formatList, getLocale, intlLocale, tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys, peopleApi } from '../api';
import { normalize } from '../catalog';
import { addDays, SLOT_TIME } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { OutKind, Recipe, Slot } from '../types';
import { relativeDay, relativeDayInline, usePlanT, weekdayShort } from './i18n';
import { OUT_KINDS } from './out';

const SLOTS: Slot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

/**
 * Putting a meal on the plan in three taps: the day, the time (a meal slot or exact), and a recipe
 * — ready-to-cook ones first — or just a name ("Eat out"). Servings default to the recipe's.
 */
export function AddMealSheet({
  open,
  onClose,
  day,
  today,
  recipeId,
}: {
  open: boolean;
  onClose: () => void;
  day: string;
  today: string;
  recipeId?: string | null;
}) {
  const t = usePlanT();
  return (
    <Sheet open={open} onClose={onClose} title={t.addMeal} size="lg">
      {open ? (
        <Form
          key={`${day}-${recipeId ?? ''}`}
          day={day}
          today={today}
          recipeId={recipeId ?? null}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function Form({
  day: initialDay,
  today,
  recipeId,
  onClose,
}: {
  day: string;
  today: string;
  recipeId: string | null;
  onClose: () => void;
}) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const [day, setDay] = useState(initialDay < today ? today : initialDay);
  const [slot, setSlot] = useState<Slot>(defaultSlot());
  const [time, setTime] = useState(SLOT_TIME[defaultSlot()]);
  const [picked, setPicked] = useState<string | null>(recipeId);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [servings, setServings] = useState<number | null>(null);
  // Eating out, planned ahead (a restaurant on Saturday): nothing is taken from the kitchen.
  const [out, setOut] = useState<OutKind | null>(null);
  const recipe = recipes.data?.find((r) => r.id === picked) ?? null;
  // At least everyone in the kitchen (a one-person recipe for the two of us comes out doubled);
  // a batch recipe keeps its own yield.
  const people = useQuery({ queryKey: foodKeys.people, queryFn: peopleApi.list });
  const kitchenSize = people.data?.people.length ?? 0;
  const shownServings = servings ?? (Math.max(kitchenSize, recipe?.servings ?? 0) || 2);

  const add = useMutation({
    mutationFn: () =>
      foodApi.planMeal({
        date: day,
        time,
        slot,
        ...(out
          ? { out: { kind: out, place: title.trim() }, title: title.trim() || t.out[out] }
          : recipe
            ? { recipeId: recipe.id }
            : { title: title.trim() }),
        servings: shownServings,
      }),
    onSuccess: (meal) => {
      haptic('success');
      const missing = meal.availability.missing;
      toast.success(t.addedAt(tr(meal, 'title'), relativeDay(meal.date, today), meal.time), {
        description: missing.length
          ? t.toBuy(missing.length, formatList(missing.map((m) => tr(m, 'name').toLowerCase())))
          : t.allHere,
        duration: missing.length ? 9000 : undefined,
        // What's missing, onto the lists in one tap: needed by that day, so it's bought the day before.
        action: missing.length
          ? {
              label: t.addToLists,
              onClick: () =>
                void foodApi
                  .addLines(
                    missing.map((m) => ({
                      productId: m.productId,
                      amount: m.missing || undefined,
                      unit: m.missing ? m.unit : undefined,
                      needBy: meal.date,
                    })),
                    'plan',
                  )
                  .then(() => {
                    toast.success(t.onLists(missing.length), {
                      description: t.neededBy(relativeDayInline(meal.date, today)),
                    });
                    return queryClient.invalidateQueries({ queryKey: foodKeys.all });
                  }),
            }
          : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const days = Array.from({ length: 10 }, (_, i) => addDays(today, i));
  const list = (recipes.data ?? [])
    .filter(
      (r) =>
        !query.trim() ||
        normalize(r.title).includes(normalize(query)) ||
        normalize(tr(r, 'title')).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        Number(b.availability.ready) - Number(a.availability.ready) ||
        b.availability.useSoon - a.availability.useSoon ||
        tr(a, 'title').localeCompare(tr(b, 'title'), intlLocale(getLocale())),
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">{t.day}</span>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === day}
              onClick={() => setDay(d)}
              className={cx(
                'press flex h-14 min-w-12 shrink-0 flex-col items-center justify-center rounded-2xl px-1 text-xs font-semibold transition-colors',
                d === day ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              <span className="whitespace-nowrap">{d === today ? t.today : weekdayShort(d)}</span>
              <span className="text-base font-bold">{Number(d.slice(8))}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">{t.when}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {SLOTS.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={s === slot}
              onClick={() => {
                setSlot(s);
                setTime(SLOT_TIME[s]);
              }}
              className={cx(
                'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                s === slot
                  ? 'bg-butter-300 text-ink-900'
                  : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
              )}
            >
              {t.slot[s]}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-sm text-ink-600">
            <span className="sr-only">{t.time}</span>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              className="tabular h-9 rounded-xl bg-ink-50 px-2 font-semibold text-ink-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          </label>
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">{t.what}</span>
        {recipe ? (
          <div className="flex items-center gap-3 rounded-2xl bg-mint-100 p-2.5">
            <FoodIconTile
              name={recipe.icon}
              tone="bg-white"
              className="size-10 rounded-xl [&>svg]:size-7"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{tr(recipe, 'title')}</span>
              <span className="block text-xs text-mint-800">
                {recipe.availability.ready
                  ? t.allHere
                  : t.missing(recipe.availability.missing.length)}
              </span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              {t.change}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField
              label={t.findRecipe}
              hideLabel
              dense
              icon={SearchIcon}
              placeholder={t.findRecipe}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {list.map((r) => (
                <RecipeChoice key={r.id} recipe={r} onPick={() => setPicked(r.id)} />
              ))}
              {!list.length ? (
                <li className="px-1 py-2 text-sm text-ink-500">
                  {recipes.data?.length ? t.noRecipeByName : t.noRecipes}
                </li>
              ) : null}
            </ul>
            <TextField
              label={out ? t.where : t.orName}
              dense
              placeholder={out ? t.wherePlaceholder : t.namePlaceholder}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={120}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[0.8125rem] font-semibold text-ink-700">
                {t.eatingOut}
              </span>
              {OUT_KINDS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={out === value}
                  onClick={() => setOut(out === value ? null : value)}
                  className={cx(
                    'press h-8 rounded-pill px-3 text-xs font-semibold',
                    out === value
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  )}
                >
                  {t.out[value]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-ink-50 px-3.5 py-2">
        <span className="text-sm font-semibold">{t.servingsLabel}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={t.fewerServings}
            disabled={shownServings <= 1}
            onClick={() => setServings(shownServings - 1)}
            className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40"
          >
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular w-8 text-center font-bold">{shownServings}</span>
          <button
            type="button"
            aria-label={t.moreServings}
            onClick={() => setServings(Math.min(100, shownServings + 1))}
            className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white"
          >
            <AddIcon fontSize="inherit" />
          </button>
        </div>
      </div>

      <Button
        fullWidth
        onClick={() => add.mutate()}
        loading={add.isPending}
        disabled={!recipe && !title.trim() && !out}
      >
        {t.addTo(relativeDayInline(day, today))}
      </Button>
    </div>
  );
}

function RecipeChoice({ recipe, onPick }: { recipe: Recipe; onPick: () => void }) {
  const t = usePlanT();
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="press flex w-full items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-ink-50"
      >
        <FoodIconTile name={recipe.icon} className="size-10 rounded-xl [&>svg]:size-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">
            {tr(recipe, 'title')}
          </span>
          <span className="block text-xs text-ink-600">{t.servings(recipe.servings)}</span>
        </span>
        {recipe.availability.ready ? (
          <span className="h-6 shrink-0 rounded-pill bg-mint-100 px-2 text-xs font-semibold leading-6 text-mint-800">
            {t.ready}
          </span>
        ) : (
          <span className="h-6 shrink-0 rounded-pill bg-peach-100 px-2 text-xs font-semibold leading-6 text-peach-800">
            {t.missing(recipe.availability.missing.length)}
          </span>
        )}
      </button>
    </li>
  );
}

function defaultSlot(): Slot {
  const hour = new Date().getHours();
  if (hour < 10) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}
