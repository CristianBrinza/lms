import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Badge, Button, IconButton, IconLink, Sheet, Skeleton, Switch, toast } from '@/components/ui';
import {
  AccessTimeIcon,
  AddIcon,
  AddShoppingCartIcon,
  CalendarIcon,
  CheckIcon,
  EditIcon,
  FavoriteBorderIcon,
  FavoriteIcon,
  RemoveIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { DockBar } from '../components/DockBar';
import { formatAmount, formatQty, plural } from '../format';
import { FoodIcon, FoodIconTile } from '../icons/FoodIcon';
import type { IngredientLine, Recipe } from '../types';

/**
 * A recipe, scaled to how many are eating: what's in the kitchen and what's missing (one tap to
 * the list), the steps with a cook mode that keeps the screen on, and "Cook now", which takes the
 * ingredients out of the kitchen.
 */
export default function RecipePage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const [servings, setServings] = useState<number | null>(null);
  const recipe = useQuery({ queryKey: foodKeys.recipe(id, servings ?? undefined), queryFn: () => foodApi.recipe(id, servings ?? undefined), placeholderData: keepPreviousData });
  const [cooking, setCooking] = useState(false);
  const data = recipe.data;

  const favorite = useMutation({
    mutationFn: (value: boolean) => foodApi.updateRecipe(id, { favorite: value }),
    onSuccess: (updated) => {
      haptic('tap');
      toast.success(updated.favorite ? 'Added to favourites' : 'Removed from favourites');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
  });

  if (recipe.isPending) {
    return (
      <Screen tone="white">
        <PageHeader back="/food/recipes" title="Recipe" centered />
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
        <PageHeader back="/food/recipes" title="Recipe" centered />
        <p className="gutter-x mt-8 text-center text-ink-600">{errorMessage(recipe.error)}</p>
      </Screen>
    );
  }

  const shown = data.shownServings;
  const minutes = (data.prepMinutes ?? 0) + (data.cookMinutes ?? 0);

  return (
    <Screen tone="white" className="pb-[calc(var(--tabbar-h)+var(--safe-bottom)+5rem)] lg:pb-0">
      <PageHeader
        back="/food/recipes"
        title={data.title}
        centered
        actions={
          <div className="flex gap-2">
            <IconButton
              icon={data.favorite ? FavoriteIcon : FavoriteBorderIcon}
              label={data.favorite ? 'Remove from favourites' : 'Add to favourites'}
              onClick={() => favorite.mutate(!data.favorite)}
              className={data.favorite ? 'text-pink-800' : undefined}
            />
            <IconLink to={`/food/recipes/${id}/edit`} icon={EditIcon} label="Edit recipe" variant="ink" />
          </div>
        }
      />

      <div className="gutter-x mt-5 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-8 lg:px-8">
        <div className="lg:sticky lg:top-4">
          <section className="flex flex-col items-center rounded-[2rem] bg-butter-100 px-5 pb-5 pt-6 text-center">
            <FoodIcon name={data.icon} className="size-24 animate-pop" />
            <h2 className="mt-3 text-h1 font-bold">{data.title}</h2>
            {data.description ? <p className="mt-2 max-w-md text-[0.9375rem] text-butter-800">{data.description}</p> : null}
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {minutes ? (
                <Badge tone="muted" className="gap-1 bg-white">
                  <AccessTimeIcon fontSize="inherit" className="text-sm" />
                  {data.prepMinutes ? `${data.prepMinutes} prep · ` : ''}
                  {data.cookMinutes ? `${data.cookMinutes} cook` : `${minutes} min`}
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
                  By Claude
                </Badge>
              ) : null}
              {data.timesCooked ? <Badge tone="mint">Cooked {plural(data.timesCooked, 'time')}</Badge> : null}
            </div>
          </section>

          <Ingredients recipe={data} servings={shown} onServings={setServings} />
        </div>

        <div className="mt-6 lg:mt-0">
          <Steps recipe={data} />
          {data.notes ? (
            <section className="mt-6">
              <h2 className="text-h3 font-bold">Notes</h2>
              <p className="mt-2 whitespace-pre-line text-[0.9375rem] text-ink-700">{data.notes}</p>
            </section>
          ) : null}
          {data.sourceUrl ? (
            <a href={data.sourceUrl} target="_blank" rel="noreferrer noopener" className="mt-4 inline-block text-sm font-semibold text-lav-700 underline underline-offset-4">
              Original recipe
            </a>
          ) : null}
        </div>
      </div>

      <DockBar tone="white">
        <Actions recipe={data} onCook={() => setCooking(true)} />
      </DockBar>
      <CookSheet open={cooking} recipe={data} servings={shown} onClose={() => setCooking(false)} />
    </Screen>
  );
}

function Actions({ recipe, onCook }: { recipe: Recipe; onCook: () => void }) {
  const navigate = useNavigate();
  return (
    <>
      <Button variant="tint" size="md" icon={CalendarIcon} fullWidth onClick={() => navigate(`/food/plan?recipe=${recipe.id}`)}>
        Plan it
      </Button>
      <Button size="md" fullWidth onClick={onCook}>
        Cook now
      </Button>
    </>
  );
}

function Ingredients({ recipe, servings, onServings }: { recipe: Recipe; servings: number; onServings: (value: number) => void }) {
  const queryClient = useQueryClient();
  const missing = recipe.ingredients.filter((i) => i.enough === false && !i.optional);
  const toList = useMutation({
    mutationFn: () =>
      foodApi.addLines(
        missing.map((i) => ({ productId: i.productId!, amount: i.amount ?? undefined, unit: i.amount ? (i.unit ?? i.baseUnit) : undefined })),
        'recipe',
      ),
    onSuccess: (lines) => {
      haptic('success');
      toast.success(`${plural(lines.length, 'item')} on the shopping list`, { description: 'Each to its usual store' });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="mt-4 rounded-[2rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="text-h3 font-bold">Ingredients</h2>
        <div className="flex items-center gap-1 rounded-pill bg-ink-50 p-1">
          <button type="button" aria-label="Fewer servings" disabled={servings <= 1} onClick={() => onServings(servings - 1)} className="press grid size-8 place-items-center rounded-full bg-white text-base shadow-xs disabled:opacity-40">
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular min-w-[4.5rem] text-center text-sm font-semibold">{plural(servings, 'serving')}</span>
          <button type="button" aria-label="More servings" disabled={servings >= 100} onClick={() => onServings(servings + 1)} className="press grid size-8 place-items-center rounded-full bg-ink-900 text-base text-white">
            <AddIcon fontSize="inherit" />
          </button>
        </div>
      </div>
      {recipe.ingredients.length ? (
        <ul className="mt-3 flex flex-col">
          {recipe.ingredients.map((line) => (
            <IngredientRow key={line.id} line={line} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 px-1 text-sm text-ink-600">No ingredients yet.</p>
      )}
      {missing.length ? (
        <Button size="md" variant="tint" icon={AddShoppingCartIcon} fullWidth className="mt-3" onClick={() => toList.mutate()} loading={toList.isPending}>
          Add {plural(missing.length, 'missing item')} to the list
        </Button>
      ) : recipe.availability.total ? (
        <p className="mt-3 rounded-2xl bg-mint-100 px-4 py-3 text-center text-sm font-semibold text-mint-800">Everything’s in the kitchen</p>
      ) : null}
    </section>
  );
}

function IngredientRow({ line }: { line: IngredientLine }) {
  const measured = line.baseUnit ? { unit: line.baseUnit } : null;
  return (
    <li className="flex items-center gap-3 border-b border-ink-100 py-2.5 last:border-0">
      <FoodIconTile name={line.icon} className="size-10 rounded-xl [&>svg]:size-7" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">
          {line.name}
          {line.optional ? <span className="font-medium text-ink-500"> (optional)</span> : null}
        </span>
        <span className="block truncate text-sm text-ink-600">
          {[line.amount && line.unit ? formatAmount(line.amount, line.unit) : line.amount ? String(line.amount) : 'to taste', line.note || null].filter(Boolean).join(' · ')}
        </span>
      </span>
      {line.enough === true ? (
        <span className="inline-flex h-7 items-center gap-1 rounded-pill bg-mint-100 px-2.5 text-xs font-semibold text-mint-800">
          <CheckIcon fontSize="inherit" className="text-sm" />
          Have
        </span>
      ) : line.enough === false ? (
        <span className="inline-flex h-7 items-center rounded-pill bg-peach-100 px-2.5 text-xs font-semibold text-peach-800">
          {line.missing && measured ? `Need ${formatQty(line.missing, measured)}` : 'Missing'}
        </span>
      ) : null}
    </li>
  );
}

function Steps({ recipe }: { recipe: Recipe }) {
  const [cookMode, setCookMode] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  // Cook mode keeps the screen awake, where the browser allows it.
  useEffect(() => {
    if (!cookMode || !('wakeLock' in navigator)) return;
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
  }, [cookMode]);

  if (!recipe.steps.length) return null;
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3 font-bold">Steps</h2>
        <Switch checked={cookMode} onChange={setCookMode} label="Cook mode" className="w-auto" />
      </div>
      <ol className="mt-3 flex flex-col gap-2.5">
        {recipe.steps.map((step, index) => {
          const isDone = done.has(index);
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() =>
                  setDone((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  })
                }
                className={cx(
                  'press flex w-full items-start gap-3.5 rounded-[1.5rem] p-4 text-left transition-colors',
                  isDone ? 'bg-mint-100/60' : 'bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70',
                  cookMode && 'p-5',
                )}
              >
                <span className={cx('grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold', isDone ? 'bg-mint-200 text-mint-800' : 'bg-butter-300 text-ink-900')}>
                  {isDone ? <CheckIcon fontSize="inherit" /> : index + 1}
                </span>
                <span className={cx('pt-1 leading-relaxed', cookMode ? 'text-lg' : 'text-[0.9375rem]', isDone && 'text-ink-500 line-through decoration-ink-300')}>{step}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CookSheet({ open, recipe, servings, onClose }: { open: boolean; recipe: Recipe; servings: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [leftovers, setLeftovers] = useState(0);
  const cook = useMutation({
    mutationFn: () => foodApi.cook(recipe.id, { servings, ...(leftovers ? { leftovers: { portions: leftovers } } : {}) }),
    onSuccess: ({ meal, shortfalls }) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(`Enjoy your ${recipe.title.toLowerCase()}!`, {
        description: shortfalls.length ? `Not enough: ${shortfalls.map((s) => s.name).join(', ')}` : 'The ingredients are out of the kitchen.',
        action: {
          label: 'Undo',
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
  const missing = recipe.availability.missing;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cook it now?"
      description={`For ${plural(servings, 'serving')}. The ingredients come out of the kitchen, first-expiring first.`}
      footer={
        <Button fullWidth onClick={() => cook.mutate()} loading={cook.isPending}>
          Cooked it
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {missing.length ? (
          <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-medium text-peach-800">
            Not enough {missing.map((m) => m.name).join(', ')} in the kitchen — it will take what there is.
          </p>
        ) : null}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 p-3.5">
          <span>
            <span className="block text-[0.9375rem] font-semibold">Leftovers</span>
            <span className="block text-sm text-ink-600">Portions to keep in the fridge</span>
          </span>
          <div className="flex items-center gap-1 rounded-pill bg-white p-1 shadow-xs">
            <button type="button" aria-label="Fewer portions" disabled={!leftovers} onClick={() => setLeftovers((v) => Math.max(0, v - 1))} className="press grid size-9 place-items-center rounded-full bg-ink-50 text-lg disabled:opacity-40">
              <RemoveIcon fontSize="inherit" />
            </button>
            <span className="tabular w-8 text-center font-bold">{leftovers}</span>
            <button type="button" aria-label="More portions" onClick={() => setLeftovers((v) => Math.min(20, v + 1))} className="press grid size-9 place-items-center rounded-full bg-ink-900 text-lg text-white">
              <AddIcon fontSize="inherit" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
