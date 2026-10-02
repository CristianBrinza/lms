import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, RemoveIcon, SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { normalize } from '../catalog';
import { addDays, dayAndMonth, plural, relativeDay, SLOT_LABEL, SLOT_TIME, weekdayShort } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { Recipe, Slot } from '../types';

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
  return (
    <Sheet open={open} onClose={onClose} title="Add a meal" size="lg">
      {open ? <Form key={`${day}-${recipeId ?? ''}`} day={day} today={today} recipeId={recipeId ?? null} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Form({ day: initialDay, today, recipeId, onClose }: { day: string; today: string; recipeId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const [day, setDay] = useState(initialDay < today ? today : initialDay);
  const [slot, setSlot] = useState<Slot>(defaultSlot());
  const [time, setTime] = useState(SLOT_TIME[defaultSlot()]);
  const [picked, setPicked] = useState<string | null>(recipeId);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [servings, setServings] = useState<number | null>(null);
  const recipe = recipes.data?.find((r) => r.id === picked) ?? null;
  const shownServings = servings ?? recipe?.servings ?? 2;

  const add = useMutation({
    mutationFn: () => foodApi.planMeal({ date: day, time, slot, ...(recipe ? { recipeId: recipe.id } : { title: title.trim() }), servings: shownServings }),
    onSuccess: (meal) => {
      haptic('success');
      const missing = meal.availability.missing;
      toast.success(`${meal.title} · ${relativeDay(meal.date, today)}${meal.time ? ` at ${meal.time}` : ''}`, {
        description: missing.length ? `${plural(missing.length, 'thing')} to buy: ${missing.map((m) => m.name.toLowerCase()).join(', ')}` : 'Everything’s in the kitchen',
        duration: missing.length ? 9000 : undefined,
        // What's missing, onto the lists in one tap: needed by that day, so it's bought the day before.
        action: missing.length
          ? {
              label: 'Add to lists',
              onClick: () =>
                void foodApi
                  .addLines(
                    missing.map((m) => ({ productId: m.productId, amount: m.missing || undefined, unit: m.missing ? m.unit : undefined, needBy: meal.date })),
                    'plan',
                  )
                  .then(() => {
                    toast.success(`${plural(missing.length, 'thing')} on the lists`, { description: `Needed by ${relativeDay(meal.date, today).toLowerCase()}` });
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
    .filter((r) => !query.trim() || normalize(r.title).includes(normalize(query)))
    .sort((a, b) => Number(b.availability.ready) - Number(a.availability.ready) || b.availability.useSoon - a.availability.useSoon || a.title.localeCompare(b.title));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">Day</span>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={d === day}
              onClick={() => setDay(d)}
              className={cx(
                'press flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-semibold transition-colors',
                d === day ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              <span>{d === today ? 'Today' : weekdayShort(d)}</span>
              <span className="text-base font-bold">{dayAndMonth(d).split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">When</span>
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
              className={cx('press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors', s === slot ? 'bg-butter-300 text-ink-900' : 'bg-butter-100 text-ink-800 hover:bg-butter-200')}
            >
              {SLOT_LABEL[s]}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-sm text-ink-600">
            <span className="sr-only">Time</span>
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
        <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">What</span>
        {recipe ? (
          <div className="flex items-center gap-3 rounded-2xl bg-mint-100 p-2.5">
            <FoodIconTile name={recipe.icon} tone="bg-white" className="size-10 rounded-xl [&>svg]:size-7" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{recipe.title}</span>
              <span className="block text-xs text-mint-800">{recipe.availability.ready ? 'Everything’s in the kitchen' : `${recipe.availability.missing.length} missing`}</span>
            </span>
            <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <TextField label="Find a recipe" hideLabel dense icon={SearchIcon} placeholder="Find a recipe" value={query} onChange={(event) => setQuery(event.target.value)} />
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {list.map((r) => (
                <RecipeChoice key={r.id} recipe={r} onPick={() => setPicked(r.id)} />
              ))}
              {!list.length ? <li className="px-1 py-2 text-sm text-ink-500">{recipes.data?.length ? 'No recipe by that name' : 'No recipes yet'}</li> : null}
            </ul>
            <TextField label="Or just a name" dense placeholder="Eat out, leftovers, pizza night…" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-ink-50 px-3.5 py-2">
        <span className="text-sm font-semibold">Servings</span>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Fewer servings" disabled={shownServings <= 1} onClick={() => setServings(shownServings - 1)} className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40">
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular w-8 text-center font-bold">{shownServings}</span>
          <button type="button" aria-label="More servings" onClick={() => setServings(Math.min(100, shownServings + 1))} className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white">
            <AddIcon fontSize="inherit" />
          </button>
        </div>
      </div>

      <Button fullWidth onClick={() => add.mutate()} loading={add.isPending} disabled={!recipe && !title.trim()}>
        Add to {relativeDay(day, today).toLowerCase()}
      </Button>
    </div>
  );
}

function RecipeChoice({ recipe, onPick }: { recipe: Recipe; onPick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onPick} className="press flex w-full items-center gap-3 rounded-2xl p-1.5 text-left transition-colors hover:bg-ink-50">
        <FoodIconTile name={recipe.icon} className="size-10 rounded-xl [&>svg]:size-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{recipe.title}</span>
          <span className="block text-xs text-ink-600">{plural(recipe.servings, 'serving')}</span>
        </span>
        {recipe.availability.ready ? (
          <span className="h-6 shrink-0 rounded-pill bg-mint-100 px-2 text-xs font-semibold leading-6 text-mint-800">Ready</span>
        ) : (
          <span className="h-6 shrink-0 rounded-pill bg-peach-100 px-2 text-xs font-semibold leading-6 text-peach-800">{recipe.availability.missing.length} missing</span>
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
