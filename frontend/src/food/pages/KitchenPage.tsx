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
  plural,
} from '../format';
import { FoodIconTile, SceneArt } from '../icons/FoodIcon';
import { AddStockSheet } from '../kitchen/AddStockSheet';
import { ProductSheet } from '../kitchen/ProductSheet';
import type { Location, StockedProduct } from '../types';

type Place = 'all' | Location;

/**
 * Everything in the kitchen, grouped like a shop's aisles, with what to use soon on top. A row
 * opens the item (each piece, its dates, quick actions); counted items have a one-tap "use 1".
 */
export default function KitchenPage() {
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

  const products = useMemo(() => kitchen.data ?? [], [kitchen.data]);
  const counts = useMemo(() => {
    const out: Record<Place, number> = { all: 0, fridge: 0, freezer: 0, pantry: 0, other: 0 };
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
  const useSoon = shown.filter((p) => p.lots.some((lot) => lot.expiresOn && lot.expiresOn <= soon));
  const rest = shown.filter((p) => !useSoon.includes(p));
  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: rest.filter((p) => p.category === category),
  })).filter((g) => g.items.length);
  const stocked = products.filter((p) => p.total > 0).length;

  return (
    <Screen tone="white">
      <PageHeader
        back="/food"
        title="Kitchen"
        subtitle={
          kitchen.data
            ? `${plural(stocked, 'item')}${useSoon.length ? ` · ${useSoon.length} to use soon` : ''}`
            : ' '
        }
        actions={
          <IconButton
            icon={AddIcon}
            label="Add food"
            variant="ink"
            onClick={() => setAdding({ open: true, initial: null })}
          />
        }
      />

      <div className="gutter-x mt-5 flex flex-col gap-3 lg:px-8">
        <TextField
          label="Search the kitchen"
          hideLabel
          icon={SearchIcon}
          surface="raised"
          placeholder="Search the kitchen"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Chips
          label="Where"
          tone="sheet"
          value={place}
          onChange={setPlace}
          options={[
            { value: 'all' as const, label: 'All', count: counts.all },
            ...LOCATION_OPTIONS.map((o) => ({ ...o, count: counts[o.value] })),
          ]}
        />
      </div>

      <div className="gutter-x mt-5 lg:px-8">
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
          <Empty onAdd={() => setAdding({ open: true, initial: null })} />
        ) : !shown.length ? (
          <p className="rounded-3xl bg-white p-6 text-center text-[0.9375rem] text-ink-600 shadow-[var(--shadow-card)]">
            {query
              ? `Nothing called “${query}”`
              : `Nothing in the ${place === 'all' ? 'kitchen' : LOCATION_LABEL[place as Location].toLowerCase()}`}
          </p>
        ) : (
          <div className="lg:columns-2 lg:gap-6 2xl:columns-3">
            {useSoon.length ? (
              <Group title="Use soon" tone="peach" items={useSoon} onOpen={setItem} today={today} />
            ) : null}
            {groups.map((group) => (
              <Group
                key={group.category}
                title={CATEGORY_LABEL[group.category]}
                items={group.items}
                onOpen={setItem}
                today={today}
              />
            ))}
          </div>
        )}
      </div>

      {/* In <body>: the page's entrance animation transforms its box, which would re-anchor `fixed`. */}
      {products.length
        ? createPortal(
            <div className="fixed bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.875rem)] right-4 z-30 animate-rise lg:hidden">
              <Button icon={AddIcon} variant="accent" size="md" onClick={() => setAdding({ open: true, initial: null })}>
                Add food
              </Button>
            </div>,
            document.body,
          )
        : null}

      <ProductSheet
        productId={openItem}
        onClose={() => setItem(null)}
        onAddMore={(initial) => setAdding({ open: true, initial })}
      />
      <AddStockSheet
        open={adding.open}
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
}: {
  title: string;
  items: StockedProduct[];
  onOpen: (id: string) => void;
  today: string;
  tone?: 'peach';
}) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-h3 font-bold">
        {tone ? (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-peach-200 ring-2 ring-peach-100"
          />
        ) : null}
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{items.length}</span>
      </h2>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {items.map((product) => (
          <ItemRow
            key={product.id}
            product={product}
            onOpen={() => onOpen(product.id)}
            today={today}
          />
        ))}
      </ul>
    </section>
  );
}

function ItemRow({
  product,
  onOpen,
  today,
}: {
  product: StockedProduct;
  onOpen: () => void;
  today: string;
}) {
  const queryClient = useQueryClient();
  const useOne = useMutation({
    mutationFn: () => foodApi.useStock({ productId: product.id, quantity: 1, unit: 'pcs' }),
    onSuccess: (result) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(`Used 1 · ${product.name}`, {
        description: `${formatQty(Math.max(0, product.total - result.used), product)} left`,
        action: {
          label: 'Undo',
          onClick: () =>
            void foodApi
              .restore(result.lots.map((l) => ({ lotId: l.lotId, quantity: l.taken })))
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
        },
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const total = product.lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const places = [...new Set(product.lots.map((lot) => LOCATION_LABEL[lot.location]))].join(', ');
  const pieces =
    product.lots.length > 1 && product.unit !== 'pcs'
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
    <li className="flex items-center">
      <button
        type="button"
        onClick={onOpen}
        className="press flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 pr-2 text-left transition-colors hover:bg-ink-50"
      >
        <FoodIconTile name={product.icon} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-semibold">{product.name}</span>
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
          aria-label={`Use 1 ${product.name}`}
          title="Use 1"
          className="press mr-3 grid size-10 shrink-0 place-items-center rounded-full bg-ink-50 text-[1.25rem] text-ink-800 transition-colors hover:bg-butter-200 disabled:opacity-50"
        >
          <RemoveIcon fontSize="inherit" />
        </button>
      ) : (
        <span aria-hidden="true" className="mr-3 w-10 shrink-0" />
      )}
    </li>
  );
}

function Empty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <SceneArt scene="kitchen" className="size-24" />
      <h2 className="mt-4 text-h2 font-bold">Your kitchen is empty</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        Add what’s in the fridge, freezer and cupboards. Finishing a shop in Shopping puts it here
        too.
      </p>
      <Button icon={AddIcon} className="mt-6" onClick={onAdd}>
        Add what you have
      </Button>
    </div>
  );
}
