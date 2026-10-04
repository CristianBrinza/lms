import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, IconButton, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, RemoveIcon, SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useWide } from '@/lib/useMediaQuery';
import { foodApi, foodKeys } from '../api';
import { ExpiryChip } from '../components/ExpiryChip';
import { normalize, type PickedProduct } from '../catalog';
import { LOCATION_OPTIONS } from '../places';
import {
  addDays,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  formatQty,
  LOCATION_LABEL,
  localDate,
  packageLabel,
  pieceName,
  plural,
  areaOf,
  kindName,
  stockKind,
} from '../format';
import { FoodIconTile, SceneArt } from '../icons/FoodIcon';
import { AddStockSheet } from '../kitchen/AddStockSheet';
import { ProductPanel, ProductSheet } from '../kitchen/ProductSheet';
import type { Area, Location, StockedProduct } from '../types';

type Place = 'all' | Location;

/**
 * Everything in the kitchen, grouped like a shop's aisles, with what to use soon on top and the
 * basics kept by level (oil, salt, sauces) at the end with one-tap full / low / out. A row opens
 * the item (each piece, its dates, quick actions); counted items have a one-tap "use 1". On a
 * tablet the item opens in a panel beside the list instead of over it.
 */
export default function KitchenPage() {
  return <InventoryScreen area="food" />;
}

const AREA_TEXT = {
  food: {
    title: 'Kitchen',
    back: '/food',
    add: 'Add food',
    search: 'Search the kitchen',
    everywhere: 'kitchen',
    basics: 'Basics · full, low, out',
  },
  house: {
    title: 'House',
    back: '/home',
    add: 'Add something',
    search: 'Search the house',
    everywhere: 'house',
    basics: 'Bottles and tubes · full, low, out',
  },
} as const;

const AREA_PLACES: Record<Area, readonly Location[]> = {
  food: ['fridge', 'freezer', 'pantry', 'garden', 'other'],
  house: ['bathroom', 'storage', 'other'],
};

/** The kitchen's food or the house's things: one screen, the same engine, each its own items. */
export function InventoryScreen({ area }: { area: Area }) {
  const text = AREA_TEXT[area];
  const [params, setParams] = useSearchParams();
  const kitchen = useQuery({ queryKey: foodKeys.kitchen, queryFn: foodApi.kitchen });
  const [place, setPlace] = useState<Place>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState<{ open: boolean; initial: PickedProduct | null }>({
    open: params.get('add') === '1',
    initial: null,
  });
  const openItem = params.get('item');
  const today = localDate();
  const soon = addDays(today, 3);
  const wide = useWide();

  const setItem = (id: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (id) next.set('item', id);
        else next.delete('item');
        next.delete('add');
        return next;
      },
      { replace: Boolean(!id) },
    );

  // ?kind=bathroom: one kind of thing (from the House's front page).
  const kind = params.get('kind');
  const products = useMemo(
    () =>
      (kitchen.data ?? []).filter(
        (p) => areaOf(p.category) === area && (!kind || p.category === kind),
      ),
    [kitchen.data, area, kind],
  );
  const counts = useMemo(() => {
    const out: Record<Place, number> = {
      all: 0,
      fridge: 0,
      freezer: 0,
      pantry: 0,
      garden: 0,
      bathroom: 0,
      storage: 0,
      other: 0,
    };
    for (const product of products) {
      if (product.total > 0) out.all += 1;
      for (const location of new Set(product.lots.map((lot) => lot.location))) out[location] += 1;
    }
    return out;
  }, [products]);

  const shown = products
    .map((product) =>
      place === 'all'
        ? product
        : { ...product, lots: product.lots.filter((lot) => lot.location === place) },
    )
    .filter((product) => (place === 'all' ? true : product.lots.length > 0))
    .filter((product) => !query.trim() || normalize(product.name).includes(normalize(query)));
  const basics = shown.filter((p) => p.trackMode !== 'exact');
  const measured = shown.filter((p) => p.trackMode === 'exact');
  const useSoon = measured.filter((p) =>
    p.lots.some((lot) => lot.expiresOn && lot.expiresOn <= soon),
  );
  const rest = measured.filter((p) => !useSoon.includes(p));
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: rest.filter((p) => p.category === category),
  })).filter((g) => g.items.length);
  const stocked = products.filter(
    (p) => p.total > 0 || (p.trackMode === 'level' && p.level !== 'out'),
  ).length;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back={area === 'house' ? '/house' : text.back}
        title={
          kind && kind in CATEGORY_LABEL
            ? CATEGORY_LABEL[kind as keyof typeof CATEGORY_LABEL]
            : text.title
        }
        subtitle={
          kitchen.data
            ? `${plural(stocked, 'item')}${useSoon.length ? ` · ${useSoon.length} to use soon` : ''}`
            : ' '
        }
        actions={
          <IconButton
            icon={AddIcon}
            label={text.add}
            variant="ink"
            size="sm"
            onClick={() => setAdding({ open: true, initial: null })}
          />
        }
      />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(21rem,0.95fr)] md:items-start md:gap-4 md:px-5 lg:gap-6 lg:px-8">
        <div className="min-w-0">
          <div className="gutter-x mt-2.5 flex flex-col gap-2 md:px-0">
            <TextField
              label="Search the kitchen"
              hideLabel
              dense
              icon={SearchIcon}
              surface="raised"
              placeholder={text.search}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Chips
              label="Where"
              tone="sheet"
              dense
              value={place}
              onChange={setPlace}
              options={[
                { value: 'all' as const, label: 'All', count: counts.all },
                ...LOCATION_OPTIONS.filter((o) => AREA_PLACES[area].includes(o.value)).map((o) => ({
                  ...o,
                  count: counts[o.value],
                })),
              ]}
            />
          </div>

          <div className="gutter-x mt-3 md:px-0">
            {kitchen.isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-20 rounded-3xl" />
                <Skeleton className="h-20 rounded-3xl" />
                <Skeleton className="h-20 rounded-3xl" />
              </div>
            ) : kitchen.error ? (
              <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
                <p className="font-semibold text-danger-700">Couldn’t load the kitchen</p>
                <p className="mt-1 text-sm text-ink-600">{errorMessage(kitchen.error)}</p>
                <Button
                  size="sm"
                  variant="tint"
                  className="mt-3"
                  onClick={() => void kitchen.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !products.length ? (
              <Empty area={area} onAdd={() => setAdding({ open: true, initial: null })} />
            ) : !shown.length ? (
              <p className="rounded-3xl bg-white p-6 text-center text-[0.9375rem] text-ink-600 shadow-[var(--shadow-card)]">
                {query
                  ? `Nothing called “${query}”`
                  : `Nothing in the ${place === 'all' ? text.everywhere : LOCATION_LABEL[place as Location].toLowerCase()}`}
              </p>
            ) : (
              <div className="2xl:columns-2 2xl:gap-6">
                {useSoon.length ? (
                  <Group
                    title="Use soon"
                    tone="peach"
                    items={useSoon}
                    onOpen={setItem}
                    today={today}
                    selected={wide ? openItem : null}
                  />
                ) : null}
                {groups.map((group) => (
                  <Group
                    key={group.category}
                    title={CATEGORY_LABEL[group.category]}
                    items={group.items}
                    onOpen={setItem}
                    today={today}
                    selected={wide ? openItem : null}
                  />
                ))}
                {basics.length ? (
                  <Group
                    title={text.basics}
                    items={basics}
                    onOpen={setItem}
                    today={today}
                    selected={wide ? openItem : null}
                  />
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Tablets: the item stands beside the list. */}
        {wide ? (
          <aside className="sticky top-3 mt-2.5 max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] [scrollbar-width:thin]">
            {openItem ? (
              <ProductPanel
                key={openItem}
                productId={openItem}
                onClose={() => setItem(null)}
                onAddMore={(initial) => setAdding({ open: true, initial })}
              />
            ) : (
              <div className="flex flex-col items-center rounded-[1.75rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
                <SceneArt scene="kitchen" className="size-20" />
                <p className="mt-3 text-[1.0625rem] font-bold">Tap an item</p>
                <p className="mt-1 max-w-xs text-sm text-ink-600">
                  Each piece, how much is left and until when, and quick ways to use, pour or move
                  it.
                </p>
              </div>
            )}
          </aside>
        ) : null}
      </div>

      {/* In <body>: the page's entrance animation transforms its box, which would re-anchor `fixed`. */}
      {products.length
        ? createPortal(
            <div className="fixed bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.875rem)] right-4 z-30 animate-rise md:hidden">
              <Button
                icon={AddIcon}
                variant="accent"
                size="md"
                onClick={() => setAdding({ open: true, initial: null })}
              >
                Add food
              </Button>
            </div>,
            document.body,
          )
        : null}

      <ProductSheet
        productId={wide ? null : openItem}
        onClose={() => setItem(null)}
        onAddMore={(initial) => setAdding({ open: true, initial })}
      />
      <AddStockSheet
        open={adding.open}
        area={area}
        initial={adding.initial}
        onClose={() => setAdding({ open: false, initial: null })}
      />
    </Screen>
  );
}

function Group({
  title,
  items,
  onOpen,
  today,
  tone,
  selected,
}: {
  title: string;
  items: StockedProduct[];
  onOpen: (id: string) => void;
  today: string;
  tone?: 'peach';
  selected?: string | null;
}) {
  return (
    <section className="mb-3.5 break-inside-avoid">
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
        {tone ? (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-peach-200 ring-2 ring-peach-100"
          />
        ) : null}
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{items.length}</span>
      </h2>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {items.map((product) =>
          product.trackMode === 'exact' ? (
            <ItemRow
              key={product.id}
              product={product}
              onOpen={() => onOpen(product.id)}
              today={today}
              selected={selected === product.id}
            />
          ) : (
            <BasicRow
              key={product.id}
              product={product}
              onOpen={() => onOpen(product.id)}
              selected={selected === product.id}
            />
          ),
        )}
      </ul>
    </section>
  );
}

function ItemRow({
  product,
  onOpen,
  today,
  selected,
}: {
  product: StockedProduct;
  onOpen: () => void;
  today: string;
  selected?: boolean;
}) {
  const queryClient = useQueryClient();
  const useOne = useMutation({
    mutationFn: () => foodApi.useStock({ productId: product.id, quantity: 1, unit: 'pcs' }),
    onSuccess: (result) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(`Used ${piece ? `1 ${piece.name}` : '1'} · ${product.name}`, {
        description: `${formatQty(Math.max(0, product.total - result.used), product)} left`,
        action: {
          label: 'Undo',
          onClick: () =>
            void foodApi
              .undo(result.events)
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
        },
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const piece = pieceName(product);
  const total = product.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const places = [...new Set(product.lots.map((lot) => LOCATION_LABEL[lot.location]))].join(', ');
  const only = product.lots.length === 1 ? product.lots[0]! : null;
  // "Jar of 14, opened", "1.25 l + 1 l", else where it is.
  const pieces = only?.package
    ? `${packageLabel(only, product)}${only.openedAt ? ', opened' : ''} · ${LOCATION_LABEL[only.location]}`
    : product.lots.length > 1 && (product.unit !== 'pcs' || product.lots.some((lot) => lot.package))
      ? product.lots
          .slice(0, 3)
          .map((lot) => formatQty(lot.quantity, product))
          .join(' + ') + (product.lots.length > 3 ? ' …' : '')
      : null;
  const nextExpiry =
    product.lots
      .map((lot) => lot.expiresOn)
      .filter(Boolean)
      .sort()[0] ?? null;
  const canUseOne = product.unit === 'pcs' && total >= 1;

  return (
    <li className={cx('flex items-center', selected && 'bg-butter-100')}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className="press flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5 pr-2 text-left transition-colors hover:bg-ink-50"
      >
        <FoodIconTile name={kindIconOf(product)} className="size-10 rounded-xl [&>svg]:size-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">
            {kindName(product.name, stockKind(product.lots), product.kindInName)}
          </span>
          <span className="block truncate text-sm text-ink-600">
            {total > 0 ? (pieces ?? places) : product.low ? 'None left · running low' : 'None left'}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cx(
              'tabular text-[0.9375rem] font-bold',
              total > 0 ? 'text-ink-900' : 'text-peach-800',
            )}
          >
            {formatQty(total, product)}
          </span>
          {nextExpiry ? <ExpiryChip expiresOn={nextExpiry} today={today} compact /> : null}
        </span>
      </button>
      {canUseOne ? (
        <button
          type="button"
          onClick={() => useOne.mutate()}
          disabled={useOne.isPending}
          aria-label={`Use 1 ${piece?.name ?? ''} ${product.name}`.replace(/\s+/g, ' ')}
          title={piece ? `Use 1 ${piece.name}` : 'Use 1'}
          className="press mr-2 grid size-10 shrink-0 place-items-center rounded-full bg-ink-50 text-[1.25rem] text-ink-800 transition-colors hover:bg-butter-200 disabled:opacity-50"
        >
          <RemoveIcon fontSize="inherit" />
        </button>
      ) : (
        <span aria-hidden="true" className="mr-2 w-10 shrink-0" />
      )}
    </li>
  );
}

const LEVELS = [
  ['full', 'Full'],
  ['low', 'Low'],
  ['out', 'Out'],
] as const;

/** A basic kept by level: full, low or out, one tap on the row. */
function BasicRow({
  product,
  onOpen,
  selected,
}: {
  product: StockedProduct;
  onOpen: () => void;
  selected?: boolean;
}) {
  const queryClient = useQueryClient();
  const set = useMutation({
    mutationFn: (level: 'full' | 'low' | 'out') => foodApi.setLevel(product.id, level),
    onMutate: () => haptic('tap'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const level = set.isPending && set.variables ? set.variables : product.level;
  return (
    <li className={cx('flex items-center gap-2 pr-2', selected && 'bg-butter-100')}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? 'true' : undefined}
        className="press flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5 text-left transition-colors hover:bg-ink-50"
      >
        <FoodIconTile name={kindIconOf(product)} className="size-10 rounded-xl [&>svg]:size-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">
            {kindName(product.name, stockKind(product.lots), product.kindInName)}
          </span>
          <span className="block truncate text-sm text-ink-600">
            {product.trackMode === 'none' ? 'Always there' : LOCATION_LABEL[product.location]}
          </span>
        </span>
      </button>
      {product.trackMode === 'level' ? (
        <span
          role="radiogroup"
          aria-label={`${product.name}: how much is left`}
          className="flex shrink-0 gap-0.5 rounded-pill bg-ink-50 p-0.5"
        >
          {LEVELS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={level === value}
              onClick={() => level !== value && set.mutate(value)}
              className={cx(
                'press h-8 min-w-11 rounded-pill px-2 text-xs font-semibold transition-colors',
                level === value
                  ? value === 'out'
                    ? 'bg-peach-200 text-ink-900'
                    : value === 'low'
                      ? 'bg-butter-300 text-ink-900'
                      : 'bg-mint-200 text-ink-900'
                  : 'text-ink-600',
              )}
            >
              {label}
            </button>
          ))}
        </span>
      ) : null}
    </li>
  );
}

function Empty({ area, onAdd }: { area: Area; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      {area === 'food' ? (
        <SceneArt scene="kitchen" className="size-24" />
      ) : (
        <span className="flex gap-1">
          <FoodIconTile name="shampoo" />
          <FoodIconTile name="toilet-paper" />
          <FoodIconTile name="cleaner-spray" />
        </span>
      )}
      <h2 className="mt-4 text-h2 font-bold">
        {area === 'food' ? 'Your kitchen is empty' : 'Nothing counted in the house yet'}
      </h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        {area === 'food'
          ? 'Add what’s in the fridge, freezer and cupboards. Finishing a shop in Shopping puts it here too.'
          : 'Add what’s in the bathroom and the storage: shampoo, paper towels, cleaners, the cat’s litter. Finishing a shop puts it here too.'}
      </p>
      <Button icon={AddIcon} className="mt-6" onClick={onAdd}>
        Add what you have
      </Button>
    </div>
  );
}

/** The picture of the one kind in stock (a black can when it's all Zero), else the item's. */
function kindIconOf(product: StockedProduct): string {
  const kind = stockKind(product.lots);
  return (kind && product.variantIcons?.[kind.toLowerCase()]) || product.icon;
}
