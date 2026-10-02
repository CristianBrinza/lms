import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Skeleton, toast } from '@/components/ui';
import { AddIcon, CalendarIcon, CheckIcon, ReceiptIcon, StorefrontIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { useProductSearch } from '../catalog';
import { CATEGORY_LABEL, CATEGORY_ORDER, formatAmount, money, parseAmount } from '../format';
import { FoodIcon, FoodIconTile, SceneArt } from '../icons/FoodIcon';
import { CheckoutSheet } from '../shopping/CheckoutSheet';
import { LineSheet } from '../shopping/LineSheet';
import { parseLine } from '../shopping/parseLine';
import { StoresSheet } from '../shopping/StoresSheet';
import { STORE_TONE } from '../shopping/tones';
import { TripsSheet } from '../shopping/TripsSheet';
import type { ShoppingItem, Store } from '../types';

type Tab = 'all' | 'any' | string;

/**
 * Shopping lists, one per store. Type "2 tomatoes" to add a line; in the shop, tick lines into
 * the cart and type what they cost; "Finish" saves the shop and puts it all in the kitchen. The
 * list refreshes by itself, so two people can shop from it at once.
 */
export default function ShoppingPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('store') ?? 'all';
  const setTab = (next: Tab) => setParams((current) => new URLSearchParams({ ...Object.fromEntries(current), store: next }), { replace: true });
  const shopping = useQuery({ queryKey: foodKeys.shopping, queryFn: foodApi.shopping, refetchInterval: 15_000 });
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [storesOpen, setStoresOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const stores = useMemo(() => shopping.data?.stores ?? [], [shopping.data]);
  const items = useMemo(() => shopping.data?.items ?? [], [shopping.data]);
  const store = stores.find((s) => s.id === tab) ?? null;
  const inTab = items.filter((line) => (tab === 'all' ? true : tab === 'any' ? !line.storeId : line.storeId === tab));
  const open = inTab.filter((line) => !line.checked);
  const cart = inTab.filter((line) => line.checked);
  const estimate = open.reduce((sum, line) => sum + (line.estimate ?? 0), 0);
  const cartStores = [...new Set(cart.map((line) => line.storeId))];
  const checkoutStore = tab === 'all' ? (cartStores.length === 1 ? (stores.find((s) => s.id === cartStores[0]) ?? null) : undefined) : store;

  return (
    <Screen tone="white">
      <PageHeader
        back="/food"
        title="Shopping"
        subtitle={shopping.data ? `${open.length} to buy${estimate > 0 ? ` · about ${money(Math.round(estimate))}` : ''}` : ' '}
        actions={
          <>
            <IconButton icon={ReceiptIcon} label="Past shops" onClick={() => setTripsOpen(true)} />
            <IconButton icon={StorefrontIcon} label="Stores" variant="ink" onClick={() => setStoresOpen(true)} />
          </>
        }
      />

      <div className="gutter-x mt-5 flex flex-col gap-3 lg:mx-auto lg:max-w-3xl lg:px-8">
        <StoreTabs stores={stores} items={items} tab={tab} onTab={setTab} onAddStore={() => setStoresOpen(true)} />
        <AddBar tab={tab} storeName={store?.name ?? (tab === 'any' ? 'Any store' : null)} />
        <RunningLow items={items} />
      </div>

      <div className="gutter-x mt-5 pb-28 lg:mx-auto lg:max-w-3xl lg:px-8 lg:pb-10">
        {shopping.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-16 rounded-3xl" />
            <Skeleton className="h-16 rounded-3xl" />
          </div>
        ) : shopping.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load the lists</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(shopping.error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={() => void shopping.refetch()}>
              Try again
            </Button>
          </div>
        ) : !inTab.length ? (
          <Empty hasStores={stores.length > 0} storeName={store?.name} onStores={() => setStoresOpen(true)} />
        ) : (
          <>
            {tab === 'all' ? (
              <>
                {stores.map((s) => (
                  <Lines key={s.id} title={s.name} dot={STORE_TONE[s.tone].dot} lines={open.filter((l) => l.storeId === s.id)} onEdit={setEditing} />
                ))}
                <Lines title="Any store" lines={open.filter((l) => !l.storeId)} onEdit={setEditing} />
              </>
            ) : (
              CATEGORY_ORDER.map((category) => (
                <Lines key={category} title={CATEGORY_LABEL[category]} lines={open.filter((l) => l.category === category)} onEdit={setEditing} />
              ))
            )}
            {!open.length && cart.length ? (
              <p className="mb-6 rounded-3xl bg-mint-100 p-4 text-center text-[0.9375rem] font-semibold text-mint-800">Everything’s in the cart. Finish the shop below.</p>
            ) : null}
            <Lines title="In the cart" lines={cart} onEdit={setEditing} cart />
          </>
        )}
      </div>

      {cart.length
        ? createPortal(
            <CartBar
              count={cart.length}
              total={cart.reduce((sum, line) => sum + (line.price ?? 0), 0)}
              label={checkoutStore === undefined ? 'Pick a store to finish' : checkoutStore ? `Finish at ${checkoutStore.name}` : 'Finish the shop'}
              onFinish={() => (checkoutStore === undefined ? setTab(cartStores[0] ?? 'any') : setCheckoutOpen(true))}
            />,
            document.body,
          )
        : null}

      <LineSheet line={editing} stores={stores} onClose={() => setEditing(null)} />
      <StoresSheet open={storesOpen} onClose={() => setStoresOpen(false)} stores={stores} onCreated={(created) => setTab(created.id)} />
      <TripsSheet open={tripsOpen} onClose={() => setTripsOpen(false)} />
      <CheckoutSheet open={checkoutOpen} onClose={() => setCheckoutOpen(false)} store={checkoutStore ?? null} cart={cart} />
    </Screen>
  );
}

function StoreTabs({ stores, items, tab, onTab, onAddStore }: { stores: Store[]; items: ShoppingItem[]; tab: Tab; onTab: (tab: Tab) => void; onAddStore: () => void }) {
  const count = (filter: (line: ShoppingItem) => boolean) => items.filter((line) => !line.checked && filter(line)).length;
  const tabs = [
    { id: 'all', label: 'All', count: count(() => true), dot: null as string | null, soft: 'bg-ink-900 text-white' },
    ...stores.map((s) => ({ id: s.id, label: s.name, count: count((l) => l.storeId === s.id), dot: STORE_TONE[s.tone].dot, soft: cx(STORE_TONE[s.tone].soft, 'text-ink-900 ring-2 ring-inset ring-ink-900') })),
    { id: 'any', label: 'Any store', count: count((l) => !l.storeId), dot: 'bg-ink-300', soft: 'bg-ink-100 text-ink-900 ring-2 ring-inset ring-ink-900' },
  ];
  return (
    <div role="tablist" aria-label="Stores" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]">
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTab(t.id)}
            className={cx('press inline-flex h-11 shrink-0 items-center gap-2 rounded-pill px-4 text-[0.9375rem] font-semibold transition-colors', active ? t.soft : 'bg-white text-ink-800 shadow-xs hover:bg-ink-50')}
          >
            {t.dot ? <span aria-hidden="true" className={cx('size-2.5 rounded-full', t.dot)} /> : null}
            {t.label}
            <span className={cx('tabular rounded-pill px-1.5 text-xs', active && t.id === 'all' ? 'bg-white/15' : 'bg-ink-900/6')}>{t.count}</span>
          </button>
        );
      })}
      <button type="button" onClick={onAddStore} className="press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-pill bg-lav-100 px-4 text-[0.9375rem] font-semibold text-lav-800 hover:bg-lav-200">
        <AddIcon fontSize="inherit" className="text-lg" />
        Store
      </button>
    </div>
  );
}

function AddBar({ tab, storeName }: { tab: Tab; storeName: string | null }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const parsed = parseLine(text);
  const { results, exact } = useProductSearch(parsed.name, 5);

  const add = useMutation({
    mutationFn: (line: { productId?: string; name?: string }) =>
      foodApi.addLines([
        {
          ...line,
          amount: parsed.amount,
          unit: parsed.unit,
          ...(tab === 'all' ? {} : { storeId: tab === 'any' ? null : tab }),
        },
      ]),
    onSuccess: ([line]) => {
      haptic('tap');
      setText('');
      input.current?.focus();
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      if (line) toast.success(`${line.name}${line.amount && line.unit ? ` · ${formatAmount(line.amount, line.unit)}` : ''}`, { description: 'On the list', duration: 1800 });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.name) return;
    const match = results.find((r) => exact && r.name.toLowerCase().startsWith(parsed.name.toLowerCase().slice(0, 3))) ?? (exact ? results[0] : undefined);
    add.mutate(match?.productId ? { productId: match.productId } : { name: match?.name ?? parsed.name });
  };

  const showSuggestions = focused && parsed.name.length > 0 && results.length > 0;
  return (
    <form onSubmit={submit} className="relative">
      <div className="flex items-center gap-2 rounded-[1.25rem] bg-white p-1.5 pl-4 shadow-[var(--shadow-xs),inset_0_0_0_1px_var(--color-ink-100)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <label htmlFor="add-line" className="sr-only">
          Add to {storeName ?? 'the list'}
        </label>
        <input
          id="add-line"
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder={storeName ? `Add to ${storeName}: “2 tomatoes”` : 'Add “2 tomatoes”, “1 kg rice”…'}
          autoComplete="off"
          enterKeyHint="done"
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-500"
        />
        <Button type="submit" size="sm" icon={AddIcon} loading={add.isPending} disabled={!parsed.name}>
          Add
        </Button>
      </div>
      {showSuggestions ? (
        <ul className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-[1.25rem] bg-white p-1.5 shadow-[var(--shadow-float)] ring-1 ring-ink-100">
          {results.map((pick) => (
            <li key={pick.productId ?? pick.name}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add.mutate(pick.productId ? { productId: pick.productId } : { name: pick.name })}
                className="press flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-ink-50"
              >
                <FoodIcon name={pick.icon} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">{pick.name}</span>
                {parsed.amount ? <span className="text-sm text-ink-600">{formatAmount(parsed.amount, parsed.unit ?? pick.unit)}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

function RunningLow({ items }: { items: ShoppingItem[] }) {
  const queryClient = useQueryClient();
  const kitchen = useQuery({ queryKey: foodKeys.kitchen, queryFn: foodApi.kitchen });
  const low = (kitchen.data ?? []).filter((p) => p.low && !items.some((line) => line.productId === p.id));
  const add = useMutation({
    mutationFn: (productId: string) => foodApi.addLines([{ productId }], 'low_stock'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {low.map((product) => (
        <button
          key={product.id}
          type="button"
          onClick={() => add.mutate(product.id)}
          className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-peach-100 pl-1.5 pr-3 text-sm font-semibold hover:bg-peach-200"
        >
          <FoodIcon name={product.icon} className="size-7" />
          {product.name}
          <AddIcon fontSize="inherit" className="text-base text-peach-800" />
        </button>
      ))}
      <Link to="/food/plan?needs=1" className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-lav-100 px-3.5 text-sm font-semibold text-lav-800 hover:bg-lav-200">
        <CalendarIcon fontSize="inherit" className="text-base" />
        What the plan needs
      </Link>
    </div>
  );
}

function Lines({ title, lines, onEdit, cart, dot }: { title: string; lines: ShoppingItem[]; onEdit: (line: ShoppingItem) => void; cart?: boolean; dot?: string }) {
  if (!lines.length) return null;
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 flex items-center gap-2 px-1 text-h3 font-bold">
        {dot ? <span aria-hidden="true" className={cx('size-2.5 rounded-full', dot)} /> : null}
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{lines.length}</span>
      </h2>
      <ul className={cx('divide-y divide-ink-100 overflow-hidden rounded-3xl ring-1 ring-inset', cart ? 'bg-mint-100/50 ring-mint-200' : 'bg-white shadow-[var(--shadow-card)] ring-ink-100/70')}>
        {lines.map((line) => (
          <LineRow key={line.id} line={line} onEdit={() => onEdit(line)} />
        ))}
      </ul>
    </section>
  );
}

function LineRow({ line, onEdit }: { line: ShoppingItem; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const toggle = useMutation({
    mutationFn: (checked: boolean) => foodApi.updateLine(line.id, { checked }),
    onMutate: async (checked) => {
      haptic('tap');
      await queryClient.cancelQueries({ queryKey: foodKeys.shopping });
      const before = queryClient.getQueryData<{ items: ShoppingItem[] }>(foodKeys.shopping);
      queryClient.setQueryData<{ items: ShoppingItem[]; stores: Store[] }>(foodKeys.shopping, (data) =>
        data ? { ...data, items: data.items.map((item) => (item.id === line.id ? { ...item, checked } : item)) } : data,
      );
      return { before };
    },
    onError: (error, _checked, context) => {
      if (context?.before) queryClient.setQueryData(foodKeys.shopping, context.before);
      toast.error(errorMessage(error));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: foodKeys.shopping }),
  });
  const savePrice = useMutation({
    mutationFn: () => foodApi.updateLine(line.id, { price: parseAmount(price) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.shopping }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <li className="flex items-center gap-1 pr-3">
      <button
        type="button"
        role="checkbox"
        aria-checked={line.checked}
        aria-label={line.checked ? `Take ${line.name} out of the cart` : `Put ${line.name} in the cart`}
        onClick={() => toggle.mutate(!line.checked)}
        className="press grid size-14 shrink-0 place-items-center"
      >
        <span
          className={cx(
            'grid size-7 place-items-center rounded-full text-[1.1rem] transition-[background-color,box-shadow] duration-200',
            line.checked ? 'bg-ink-900 text-white' : 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
          )}
        >
          {line.checked ? <CheckIcon fontSize="inherit" className="animate-pop" /> : null}
        </span>
      </button>
      <button type="button" onClick={onEdit} className="press flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
        <FoodIconTile name={line.icon} className="size-11 rounded-xl" tone={line.checked ? 'bg-white' : 'bg-ink-50'} />
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-[0.9375rem] font-semibold', line.checked && 'text-ink-600 line-through decoration-ink-400')}>{line.name}</span>
          <span className="block truncate text-sm text-ink-600">
            {[line.amount && line.unit ? formatAmount(line.amount, line.unit) : null, line.note || null, line.source === 'plan' ? 'for the plan' : line.source === 'ai' ? 'by Claude' : null]
              .filter(Boolean)
              .join(' · ') || 'Tap to set how much'}
          </span>
        </span>
      </button>
      {line.checked ? (
        <label className="flex w-24 shrink-0 items-center rounded-xl bg-white px-2.5 shadow-xs focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
          <span className="sr-only">Price of {line.name} in lei</span>
          <input
            inputMode="decimal"
            value={price}
            placeholder={line.estimate !== null ? `~${Math.round(line.estimate)}` : 'Price'}
            onChange={(event) => setPrice(event.target.value)}
            onBlur={() => {
              if ((parseAmount(price) ?? null) !== line.price) savePrice.mutate();
            }}
            className="tabular h-10 w-full min-w-0 bg-transparent text-right text-[0.9375rem] font-semibold outline-none placeholder:font-medium placeholder:text-ink-400"
          />
          <span className="ml-1 text-xs text-ink-500">lei</span>
        </label>
      ) : line.estimate !== null ? (
        <span className="tabular shrink-0 text-sm font-medium text-ink-500">~{money(Math.round(line.estimate))}</span>
      ) : null}
    </li>
  );
}

function CartBar({ count, total, label, onFinish }: { count: number; total: number; label: string; onFinish: () => void }) {
  return (
    <div className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-30 animate-rise lg:inset-x-auto lg:bottom-6 lg:right-8 lg:w-[26rem]">
      <div className="flex items-center gap-3 rounded-[1.5rem] bg-ink-900 p-2 pl-4 text-white shadow-[0_18px_40px_-14px_rgb(29_29_36/0.7)]">
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-semibold">
            {count} in the cart{total > 0 ? ` · ${money(Math.round(total * 100) / 100)}` : ''}
          </span>
        </span>
        <Button size="md" variant="soft" onClick={onFinish}>
          {label}
        </Button>
      </div>
    </div>
  );
}

function Empty({ hasStores, storeName, onStores }: { hasStores: boolean; storeName?: string; onStores: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <SceneArt scene="shopping" className="size-24" />
      <h2 className="mt-4 text-h2 font-bold">{storeName ? `Nothing for ${storeName}` : 'Nothing to buy'}</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        Type what you need above. {hasStores ? 'Each item can go to the store you buy it at.' : 'Add your stores — Linella, Metro — to keep a list for each.'}
      </p>
      {!hasStores ? (
        <Button icon={StorefrontIcon} className="mt-6" onClick={onStores}>
          Add your stores
        </Button>
      ) : null}
    </div>
  );
}
