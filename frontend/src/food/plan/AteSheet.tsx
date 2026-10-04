import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useUser } from '@/app/auth';
import { Button, Chips, Sheet, Switch, TextField, toast } from '@/components/ui';
import { SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys, peopleApi } from '../api';
import { normalize, type PickedProduct } from '../catalog';
import { ProductPicker } from '../components/ProductPicker';
import { QuantityInput } from '../components/QuantityInput';
import { VariantChips } from '../components/VariantChips';
import { WhoEats } from '../components/WhoEats';
import { localDate, unitsFor } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import { formatKcal, nutrientsIn, PER_LABEL } from '../nutrition';
import type { Recipe } from '../types';

type Picked = { kind: 'item'; item: PickedProduct } | { kind: 'recipe'; recipe: Recipe };

/**
 * Something eaten outside the plan (a banana, a shake, a slice of cake), logged as it happens: a
 * meal already eaten for whoever ate it, taken from the kitchen unless it came from elsewhere. It
 * counts in the day's energy; Undo puts the food back and drops the meal.
 */
export function AteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="I ate…"
      description="Logged as eaten; it counts in the day’s energy."
    >
      {open ? <AteForm onClose={onClose} /> : null}
    </Sheet>
  );
}

function AteForm({ onClose }: { onClose: () => void }) {
  const [what, setWhat] = useState<'item' | 'recipe'>('item');
  const [picked, setPicked] = useState<Picked | null>(null);
  if (picked) return <Details picked={picked} onBack={() => setPicked(null)} onClose={onClose} />;
  return (
    <div className="flex flex-col gap-4">
      <Chips
        label="What"
        tone="sheet"
        dense
        value={what}
        onChange={setWhat}
        options={[
          { value: 'item', label: 'Food or drink' },
          { value: 'recipe', label: 'A recipe' },
        ]}
      />
      {what === 'item' ? (
        <ProductPicker
          autoFocus
          label="What did you eat?"
          onPick={(item) => setPicked({ kind: 'item', item })}
        />
      ) : (
        <RecipeList onPick={(recipe) => setPicked({ kind: 'recipe', recipe })} />
      )}
    </div>
  );
}

function RecipeList({ onPick }: { onPick: (recipe: Recipe) => void }) {
  const recipes = useQuery({ queryKey: foodKeys.recipes, queryFn: foodApi.recipes });
  const [query, setQuery] = useState('');
  const list = (recipes.data ?? [])
    .filter((r) => !query.trim() || normalize(r.title).includes(normalize(query)))
    .sort((a, b) => b.timesCooked - a.timesCooked)
    .slice(0, 10);
  return (
    <div className="flex flex-col gap-3">
      <TextField
        label="Which recipe?"
        hideLabel
        icon={SearchIcon}
        placeholder="Protein shake, pancakes…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        autoFocus
        autoComplete="off"
      />
      {recipes.isPending ? (
        <p className="px-1 text-sm text-ink-500">Loading recipes…</p>
      ) : list.length ? (
        <ul className="-mx-2 flex flex-col">
          {list.map((recipe) => (
            <li key={recipe.id}>
              <button
                type="button"
                onClick={() => onPick(recipe)}
                className="press flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-50"
              >
                <FoodIconTile name={recipe.icon} className="size-10 rounded-xl [&>svg]:size-7" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">
                    {recipe.title}
                  </span>
                  <span className="block truncate text-xs text-ink-600">
                    {recipe.nutrition.known
                      ? `${formatKcal(recipe.nutrition.perServing.kcal)} kcal a serving`
                      : 'Values unknown'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-1 text-sm text-ink-500">No recipe by that name.</p>
      )}
    </div>
  );
}

/** One piece, 100 g or 100 ml: what someone eats at a time when nothing else is known. */
function firstAmount(item: PickedProduct): { amount: number; unit: string } {
  const units = unitsFor(item);
  if (item.unit === 'pcs') return { amount: 1, unit: units[0] ?? 'pcs' };
  if (item.pieceSize) return { amount: 1, unit: 'pcs' };
  return { amount: 100, unit: item.unit };
}

const hhmm = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function Details({
  picked,
  onBack,
  onClose,
}: {
  picked: Picked;
  onBack: () => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const me = useUser();
  const people = useQuery({ queryKey: foodKeys.people, queryFn: peopleApi.list });
  const item = picked.kind === 'item' ? picked.item : null;
  const recipe = picked.kind === 'recipe' ? picked.recipe : null;
  const start = item ? firstAmount(item) : null;
  const [amount, setAmount] = useState<number | null>(start?.amount ?? null);
  const [unit, setUnit] = useState(start?.unit ?? 'pcs');
  const [variant, setVariant] = useState(item?.variant ?? '');
  const [eaters, setEaters] = useState([me.id]);
  const [when, setWhen] = useState<'now' | 'earlier'>('now');
  const [time, setTime] = useState(() => hhmm(new Date()));
  // Something not in the kitchen can't come out of it.
  const [fromKitchen, setFromKitchen] = useState(recipe ? true : Boolean(item?.productId));

  const each = item
    ? item.nutrition && amount
      ? (nutrientsIn(item.nutrition.entry, item, amount, unit, variant)?.kcal ?? null)
      : null
    : recipe!.nutrition.known
      ? recipe!.nutrition.perServing.kcal
      : null;

  const save = useMutation({
    mutationFn: () =>
      foodApi.ate({
        items: item
          ? [
              {
                ...(item.productId ? { productId: item.productId } : {}),
                name: item.name,
                ...(amount ? { amount, unit } : {}),
                ...(variant ? { variant } : {}),
              },
            ]
          : [{ name: recipe!.title }],
        ...(recipe ? { recipeId: recipe.id } : {}),
        date: localDate(),
        time: when === 'now' ? hhmm(new Date()) : time,
        eaters,
        fromKitchen,
      }),
    onSuccess: ({ meal, shortfalls }) => {
      haptic('success');
      const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });
      void refresh();
      const kcal = meal.nutrition.known ? meal.nutrition.perServing.kcal : null;
      toast.success(
        kcal !== null
          ? `${meal.title}: ${formatKcal(kcal)} kcal${eaters.length > 1 ? ' each' : ''}`
          : `${meal.title}: logged`,
        {
          description: shortfalls.length
            ? `Not enough in the kitchen: ${shortfalls.map((s) => s.name).join(', ')}.`
            : kcal === null
              ? 'Its values are unknown, so it adds no kcal.'
              : undefined,
          action: {
            label: 'Undo',
            // Reopening puts what it took back in the kitchen; then the meal goes.
            onClick: () =>
              void foodApi
                .reopenMeal(meal.id)
                .then(() => foodApi.deleteMeal(meal.id))
                .then(refresh)
                .catch((error: unknown) => toast.error(errorMessage(error))),
          },
        },
      );
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const household = people.data?.people ?? [];
  const title = item ? item.name : recipe!.title;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2">
        <FoodIconTile
          name={item?.icon ?? recipe!.icon}
          tone="bg-white"
          className="size-11 rounded-xl [&>svg]:size-8"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{title}</span>
          <span className="block truncate text-xs text-ink-600">
            {item
              ? item.nutrition
                ? `${formatKcal(item.nutrition.entry.base.kcal)} kcal ${PER_LABEL[item.nutrition.entry.per]}`
                : 'Values unknown'
              : 'One serving each'}
          </span>
        </span>
        <Button size="sm" variant="soft" onClick={onBack}>
          Change
        </Button>
      </div>

      {item ? (
        <QuantityInput
          label={eaters.length > 1 ? 'How much, each' : 'How much'}
          value={amount}
          unit={unit}
          units={unitsFor(item)}
          onChange={(value, next) => {
            setAmount(value);
            setUnit(next);
          }}
        />
      ) : null}

      {item?.variants.length ? (
        <VariantChips
          variants={item.variants}
          icons={item.variantIcons}
          value={variant}
          onChange={setVariant}
        />
      ) : null}

      {household.length > 1 ? (
        <WhoEats
          label="Who ate"
          people={household}
          value={eaters}
          onChange={(next) => {
            if (next.length) setEaters(next);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink-700">When</span>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="When" className="flex gap-1.5">
            {(
              [
                ['now', 'Now'],
                ['earlier', 'Earlier today'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={when === value}
                onClick={() => setWhen(value)}
                className={cx(
                  'press h-9 rounded-pill px-3.5 text-sm font-semibold',
                  when === value
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {when === 'earlier' ? (
            <input
              type="time"
              aria-label="At"
              value={time}
              max={hhmm(new Date())}
              onChange={(event) => event.target.value && setTime(event.target.value)}
              className="h-9 rounded-xl bg-ink-50 px-2 text-sm font-semibold outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            />
          ) : null}
        </div>
      </div>

      <Switch
        checked={fromKitchen}
        onChange={setFromKitchen}
        label="From the kitchen"
        hint={fromKitchen ? 'It comes out of what’s in stock.' : 'Bought or given elsewhere.'}
      />

      <Button
        fullWidth
        onClick={() => save.mutate()}
        loading={save.isPending}
        disabled={Boolean(item) && !amount}
      >
        {each !== null
          ? `Save · ${formatKcal(each)} kcal${eaters.length > 1 ? ' each' : ''}`
          : 'Save'}
      </Button>
    </div>
  );
}
