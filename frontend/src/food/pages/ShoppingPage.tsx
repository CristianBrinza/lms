import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  CalendarIcon,
  CheckIcon,
  ReceiptIcon,
  StorefrontIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { useWide } from '@/lib/useMediaQuery';
import { foodApi, foodKeys } from '../api';
import { useCatalog, useProductSearch } from '../catalog';
import { DockBar } from '../components/DockBar';
import {
  addDays,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  formatAmount,
  formatQty,
  localDate,
  money,
  packageUnits,
  parseAmount,
  relativeDay,
} from '../format';
import { FoodIcon, FoodIconTile, SceneArt } from '../icons/FoodIcon';
import { BoughtSheet } from '../shopping/BoughtSheet';
import { CheckoutSheet } from '../shopping/CheckoutSheet';
import { LineSheet } from '../shopping/LineSheet';
import { parseLine } from '../shopping/parseLine';
import { StoresSheet } from '../shopping/StoresSheet';
import { STORE_TONE } from '../shopping/tones';
import { TripsSheet } from '../shopping/TripsSheet';
import type { ShoppingItem, Store } from '../types';

type Tab = 'all' | 'any' | string;

/**
 * Shopping lists, one per store. Type "2 tomatoes" to add a line; what is needed by tomorrow (or
 * marked important) comes first. In the shop, tick lines into the cart — for things in packages,
 * say what you really got (two 300 g cans instead of one 500 g) — and type what they cost;
 * "Finish" saves the shop and puts it all in the kitchen. The list refreshes by itself, so two
 * people can shop from it at once. On a tablet the cart stands beside the lists.
 */
export default function ShoppingPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('store') ?? 'all';
  const setTab = (next: Tab) =>
    setParams((current) => new URLSearchParams({ ...Object.fromEntries(current), store: next }), {
      replace: true,
    });
  const shopping = useQuery({
    queryKey: foodKeys.shopping,
    queryFn: foodApi.shopping,
    refetchInterval: 15_000,
  });
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [storesOpen, setStoresOpen] = useState(false);
  const [tripsOpen, setTripsOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [bought, setBought] = useState<ShoppingItem | null>(null);
  const wide = useWide();
  const today = localDate();
  const urgent = (line: ShoppingItem) =>
    line.priority || (line.needBy !== null && line.needBy <= addDays(today, 1));

  const stores = useMemo(() => shopping.data?.stores ?? [], [shopping.data]);
  const items = useMemo(() => shopping.data?.items ?? [], [shopping.data]);
  const store = stores.find((s) => s.id === tab) ?? null;
  const inTab = items.filter((line) =>
    tab === 'all' ? true : tab === 'any' ? !line.storeId : line.storeId === tab,
  );
  const open = inTab.filter((line) => !line.checked);
  const now = open.filter(urgent);
  const later = open.filter((line) => !urgent(line));
  const cart = inTab.filter((line) => line.checked);
  const estimate = open.reduce((sum, line) => sum + (line.estimate ?? 0), 0);
  const cartStores = [...new Set(cart.map((line) => line.storeId))];
  const checkoutStore =
    tab === 'all'
      ? cartStores.length === 1
        ? (stores.find((s) => s.id === cartStores[0]) ?? null)
        : undefined
      : store;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/food"
        title="Shopping"
        subtitle={
          shopping.data
            ? `${open.length} to buy${estimate > 0 ? ` · about ${money(Math.round(estimate))}` : ''}`
            : ' '
        }
        actions={
          <>
            <IconButton
              icon={ReceiptIcon}
              label="Past shops"
              size="sm"
              onClick={() => setTripsOpen(true)}
            />
            <IconButton
              icon={StorefrontIcon}
              label="Stores"
              variant="ink"
              size="sm"
              onClick={() => setStoresOpen(true)}
            />
          </>
        }
      />

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_17rem] lg:grid-cols-[minmax(0,1fr)_21rem] md:items-start md:gap-4 md:px-5 lg:gap-6 lg:px-8">
        <div className="min-w-0">
          <div className="gutter-x mt-2.5 flex flex-col gap-2 md:px-0">
            <StoreTabs
              stores={stores}
              items={items}
              tab={tab}
              onTab={setTab}
              onAddStore={() => setStoresOpen(true)}
            />
            <AddBar tab={tab} storeName={store?.name ?? (tab === 'any' ? 'Any store' : null)} />
            <RunningLow items={items} />
          </div>

          <div className="gutter-x mt-3 pb-16 md:px-0 md:pb-4">
            {shopping.isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 rounded-3xl" />
                <Skeleton className="h-16 rounded-3xl" />
              </div>
            ) : shopping.error ? (
              <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
                <p className="font-semibold text-danger-700">Couldn’t load the lists</p>
                <p className="mt-1 text-sm text-ink-600">{errorMessage(shopping.error)}</p>
                <Button
                  size="sm"
                  variant="tint"
                  className="mt-3"
                  onClick={() => void shopping.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : !inTab.length ? (
              <Empty
                hasStores={stores.length > 0}
                storeName={store?.name}
                onStores={() => setStoresOpen(true)}
              />
            ) : (
              <>
                <Lines
                  title="Buy today"
                  tone="peach"
                  lines={now}
                  onEdit={setEditing}
                  onBought={setBought}
                  today={today}
                  showStore={tab === 'all'}
                  stores={stores}
                />
                {tab === 'all' ? (
                  <>
                    {stores.map((s) => (
                      <Lines
                        key={s.id}
                        title={s.name}
                        dot={STORE_TONE[s.tone].dot}
                        lines={later.filter((l) => l.storeId === s.id)}
                        onEdit={setEditing}
                        onBought={setBought}
                        today={today}
                      />
                    ))}
                    <Lines
                      title="Any store"
                      lines={later.filter((l) => !l.storeId)}
                      onEdit={setEditing}
                      onBought={setBought}
                      today={today}
                    />
                  </>
                ) : (
                  CATEGORY_ORDER.map((category) => (
                    <Lines
                      key={category}
                      title={CATEGORY_LABEL[category]}
                      lines={later.filter((l) => l.category === category)}
                      onEdit={setEditing}
                      onBought={setBought}
                      today={today}
                    />
                  ))
                )}
                {!open.length && cart.length ? (
                  <p className="mb-6 rounded-3xl bg-mint-100 p-4 text-center text-[0.9375rem] font-semibold text-mint-800">
                    Everything’s in the cart. Finish the shop {wide ? 'on the right' : 'below'}.
                  </p>
                ) : null}
                {wide ? null : (
                  <Lines
                    title="In the cart"
                    lines={cart}
                    onEdit={setEditing}
                    onBought={setBought}
                    today={today}
                    cart
                  />
                )}
              </>
            )}
          </div>
        </div>
        {wide ? (
          <CartPanel
            cart={cart}
            onEdit={setEditing}
            onBought={setBought}
            today={today}
            label={
              checkoutStore === undefined
                ? 'Pick a store to finish'
                : checkoutStore
                  ? `Finish at ${checkoutStore.name}`
                  : 'Finish the shop'
            }
            onFinish={() =>
              checkoutStore === undefined ? setTab(cartStores[0] ?? 'any') : setCheckoutOpen(true)
            }
          />
        ) : null}
      </div>

      {cart.length && !wide ? (
        <CartBar
          count={cart.length}
          total={cart.reduce((sum, line) => sum + (line.price ?? 0), 0)}
          label={
            checkoutStore === undefined
              ? 'Pick a store to finish'
              : checkoutStore
                ? `Finish at ${checkoutStore.name}`
                : 'Finish the shop'
          }
          onFinish={() =>
            checkoutStore === undefined ? setTab(cartStores[0] ?? 'any') : setCheckoutOpen(true)
          }
        />
      ) : null}

      <LineSheet line={editing} stores={stores} onClose={() => setEditing(null)} />
      <BoughtSheet line={bought} onClose={() => setBought(null)} />
      <StoresSheet
        open={storesOpen}
        onClose={() => setStoresOpen(false)}
        stores={stores}
        onCreated={(created) => setTab(created.id)}
      />
      <TripsSheet open={tripsOpen} onClose={() => setTripsOpen(false)} />
      <CheckoutSheet
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        store={checkoutStore ?? null}
        cart={cart}
      />
    </Screen>
  );
}

function StoreTabs({
  stores,
  items,
  tab,
  onTab,
  onAddStore,
}: {
  stores: Store[];
  items: ShoppingItem[];
  tab: Tab;
  onTab: (tab: Tab) => void;
  onAddStore: () => void;
}) {
  const count = (filter: (line: ShoppingItem) => boolean) =>
    items.filter((line) => !line.checked && filter(line)).length;
  const tabs = [
    {
      id: 'all',
      label: 'All',
      count: count(() => true),
      dot: null as string | null,
      soft: 'bg-ink-900 text-white',
    },
    ...stores.map((s) => ({
      id: s.id,
      label: s.name,
      count: count((l) => l.storeId === s.id),
      dot: STORE_TONE[s.tone].dot,
      soft: cx(STORE_TONE[s.tone].soft, 'text-ink-900 ring-2 ring-inset ring-ink-900'),
    })),
    {
      id: 'any',
      label: 'Any store',
      count: count((l) => !l.storeId),
      dot: 'bg-ink-300',
      soft: 'bg-ink-100 text-ink-900 ring-2 ring-inset ring-ink-900',
    },
  ];
  return (
    <div
      role="tablist"
      aria-label="Stores"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]"
    >
      {tabs.map((t) => {
        const active = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onTab(t.id)}
            className={cx(
              'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-semibold transition-colors',
              active ? t.soft : 'bg-white text-ink-800 shadow-xs hover:bg-ink-50',
            )}
          >
            {t.dot ? (
              <span aria-hidden="true" className={cx('size-2.5 rounded-full', t.dot)} />
            ) : null}
            {t.label}
            <span
              className={cx(
                'tabular rounded-pill px-1.5 text-xs',
                active && t.id === 'all' ? 'bg-white/15' : 'bg-ink-900/6',
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAddStore}
        className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-lav-100 px-3.5 text-sm font-semibold text-lav-800 hover:bg-lav-200"
      >
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
      if (line)
        toast.success(
          `${line.name}${line.amount && line.unit ? ` · ${formatAmount(line.amount, line.unit)}` : ''}`,
          { description: 'On the list', duration: 1800 },
        );
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!parsed.name) return;
    const match =
      results.find(
        (r) => exact && r.name.toLowerCase().startsWith(parsed.name.toLowerCase().slice(0, 3)),
      ) ?? (exact ? results[0] : undefined);
    add.mutate(
      match?.productId ? { productId: match.productId } : { name: match?.name ?? parsed.name },
    );
  };

  const showSuggestions = focused && parsed.name.length > 0 && results.length > 0;
  return (
    <form onSubmit={submit} className="relative">
      <div className="flex items-center gap-2 rounded-[1rem] bg-white p-1 pl-3.5 shadow-[var(--shadow-xs),inset_0_0_0_1px_var(--color-ink-100)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
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
          placeholder={
            storeName ? `Add to ${storeName}: “2 tomatoes”` : 'Add “2 tomatoes”, “1 kg rice”…'
          }
          autoComplete="off"
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-500"
        />
        <Button
          type="submit"
          size="sm"
          icon={AddIcon}
          loading={add.isPending}
          disabled={!parsed.name}
        >
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
                onClick={() =>
                  add.mutate(pick.productId ? { productId: pick.productId } : { name: pick.name })
                }
                className="press flex w-full items-center gap-3 rounded-xl p-1.5 text-left hover:bg-ink-50"
              >
                <FoodIcon name={pick.icon} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
                  {pick.name}
                </span>
                {parsed.amount ? (
                  <span className="text-sm text-ink-600">
                    {formatAmount(parsed.amount, parsed.unit ?? pick.unit)}
                  </span>
                ) : null}
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
  const low = (kitchen.data ?? []).filter(
    (p) => p.low && !items.some((line) => line.productId === p.id),
  );
  const add = useMutation({
    mutationFn: (productId: string) => foodApi.addLines([{ productId }], 'low_stock'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.all }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
      {low.map((product) => (
        <button
          key={product.id}
          type="button"
          onClick={() => add.mutate(product.id)}
          className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-peach-100 pl-1 pr-2.5 text-sm font-semibold hover:bg-peach-200"
        >
          <FoodIcon name={product.icon} className="size-6" />
          {product.name}
          <AddIcon fontSize="inherit" className="text-base text-peach-800" />
        </button>
      ))}
      <Link
        to="/food/plan?needs=1"
        className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill bg-lav-100 px-3 text-sm font-semibold text-lav-800 hover:bg-lav-200"
      >
        <CalendarIcon fontSize="inherit" className="text-base" />
        What the plan needs
      </Link>
    </div>
  );
}

function Lines({
  title,
  lines,
  onEdit,
  onBought,
  today,
  cart,
  dot,
  tone,
  showStore,
  stores,
}: {
  title: string;
  lines: ShoppingItem[];
  onEdit: (line: ShoppingItem) => void;
  onBought: (line: ShoppingItem) => void;
  today: string;
  cart?: boolean;
  dot?: string;
  tone?: 'peach';
  showStore?: boolean;
  stores?: Store[];
}) {
  if (!lines.length) return null;
  return (
    <section className="mb-3.5">
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
        {dot ? <span aria-hidden="true" className={cx('size-2.5 rounded-full', dot)} /> : null}
        {tone ? (
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-peach-200 ring-2 ring-peach-100"
          />
        ) : null}
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{lines.length}</span>
      </h2>
      <ul
        className={cx(
          'divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] ring-1 ring-inset',
          cart
            ? 'bg-mint-100/50 ring-mint-200'
            : 'bg-white shadow-[var(--shadow-card)] ring-ink-100/70',
        )}
      >
        {lines.map((line) => (
          <LineRow
            key={line.id}
            line={line}
            onEdit={() => onEdit(line)}
            onBought={() => onBought(line)}
            today={today}
            store={
              showStore ? (stores?.find((s) => s.id === line.storeId)?.name ?? 'Any store') : null
            }
          />
        ))}
      </ul>
    </section>
  );
}

function LineRow({
  line,
  onEdit,
  onBought,
  today,
  store,
}: {
  line: ShoppingItem;
  onEdit: () => void;
  onBought: () => void;
  today: string;
  store?: string | null;
}) {
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const product = catalog.data?.find((p) => p.id === line.productId);
  const inPackages = Boolean(
    product && product.trackMode === 'exact' && packageUnits(product).length,
  );
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const toggle = useMutation({
    mutationFn: (checked: boolean) => foodApi.updateLine(line.id, { checked }),
    onMutate: async (checked) => {
      haptic('tap');
      await queryClient.cancelQueries({ queryKey: foodKeys.shopping });
      const before = queryClient.getQueryData<{ items: ShoppingItem[] }>(foodKeys.shopping);
      queryClient.setQueryData<{ items: ShoppingItem[]; stores: Store[] }>(
        foodKeys.shopping,
        (data) =>
          data
            ? {
                ...data,
                items: data.items.map((item) =>
                  item.id === line.id ? { ...item, checked } : item,
                ),
              }
            : data,
      );
      return { before };
    },
    onError: (error, _checked, context) => {
      if (context?.before) queryClient.setQueryData(foodKeys.shopping, context.before);
      toast.error(errorMessage(error));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: foodKeys.shopping }),
    onSuccess: (_item, checked) => {
      // Into the cart: for things in packages, a nudge to say what was really taken.
      if (checked && inPackages && !line.bought)
        toast('What did you get?', { action: { label: 'Say', onClick: onBought }, duration: 2500 });
    },
  });
  const savePrice = useMutation({
    mutationFn: () => foodApi.updateLine(line.id, { price: parseAmount(price) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: foodKeys.shopping }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <li className="flex items-center gap-0.5 pr-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={line.checked}
        aria-label={
          line.checked ? `Take ${line.name} out of the cart` : `Put ${line.name} in the cart`
        }
        onClick={() => toggle.mutate(!line.checked)}
        className="press grid size-12 shrink-0 place-items-center"
      >
        <span
          className={cx(
            'grid size-7 place-items-center rounded-full text-[1.1rem] transition-[background-color,box-shadow] duration-200',
            line.checked
              ? 'bg-ink-900 text-white'
              : 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
          )}
        >
          {line.checked ? <CheckIcon fontSize="inherit" className="animate-pop" /> : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        className="press flex min-w-0 flex-1 items-center gap-2.5 py-1.5 text-left"
      >
        <FoodIconTile
          name={line.icon}
          className="size-9 rounded-xl [&>svg]:size-6"
          tone={line.checked ? 'bg-white' : 'bg-ink-50'}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate text-[0.9375rem] font-semibold',
              line.checked && 'text-ink-600 line-through decoration-ink-400',
            )}
          >
            {line.name}
          </span>
          <span className="block truncate text-[0.8125rem] text-ink-600">
            {line.checked && line.boughtTotal !== null && product ? (
              <Got line={line} product={product} />
            ) : (
              [
                line.priority ? 'Important' : null,
                line.needBy
                  ? `for ${relativeDay(line.needBy, today).replace(/^(Today|Tomorrow)$/, (word) => word.toLowerCase())}`
                  : null,
                store ?? null,
                line.amount && line.unit
                  ? `at least ${formatAmount(line.amount, line.unit)}`
                  : null,
                line.variant || null,
                line.note || null,
                line.source === 'plan' && !line.needBy
                  ? 'for the plan'
                  : line.source === 'ai'
                    ? 'by Claude'
                    : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Tap to set how much'
            )}
          </span>
        </span>
      </button>
      {line.checked && inPackages ? (
        <button
          type="button"
          onClick={onBought}
          className="press mr-1 h-8 shrink-0 rounded-pill bg-white px-2.5 text-xs font-semibold text-lav-800 shadow-xs"
        >
          {line.bought ? 'Change' : 'What I got'}
        </button>
      ) : null}
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
        <span className="tabular shrink-0 text-sm font-medium text-ink-500">
          ~{money(Math.round(line.estimate))}
        </span>
      ) : null}
    </li>
  );
}

/** "Got 600 g · 100 g extra", "Got 300 g · 200 g short". */
function Got({
  line,
  product,
}: {
  line: ShoppingItem;
  product: NonNullable<ReturnType<typeof useCatalog>['data']>[number];
}) {
  const got = line.boughtTotal ?? 0;
  const diff = line.need === null ? null : got - line.need;
  return (
    <>
      Got {formatQty(got, product)}
      {line.variant ? ` · ${line.variant}` : ''}
      {diff === null || Math.abs(diff) < 1e-6 ? null : diff > 0 ? (
        <span className="text-mint-800"> · {formatQty(diff, product)} extra</span>
      ) : (
        <span className="font-semibold text-peach-800"> · {formatQty(-diff, product)} short</span>
      )}
    </>
  );
}

/** Tablets: the cart beside the lists, with its total and the way to finish. */
function CartPanel({
  cart,
  onEdit,
  onBought,
  today,
  label,
  onFinish,
}: {
  cart: ShoppingItem[];
  onEdit: (line: ShoppingItem) => void;
  onBought: (line: ShoppingItem) => void;
  today: string;
  label: string;
  onFinish: () => void;
}) {
  const total = cart.reduce((sum, line) => sum + (line.price ?? 0), 0);
  return (
    <aside
      aria-label="Cart"
      className="sticky top-3 mt-2.5 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[var(--shadow-card)]"
    >
      <header className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-h3 font-bold">In the cart</h2>
        <span className="tabular text-sm font-semibold text-ink-600">{cart.length}</span>
      </header>
      {cart.length ? (
        <ul className="min-h-0 flex-1 divide-y divide-ink-100 overflow-y-auto overscroll-contain">
          {cart.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              onEdit={() => onEdit(line)}
              onBought={() => onBought(line)}
              today={today}
            />
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-sm text-ink-600">
          Tick things as they go in the cart; what they cost can be typed here.
        </p>
      )}
      <footer className="flex flex-col gap-2 border-t border-ink-100 p-4">
        <span className="flex items-baseline justify-between text-[0.9375rem] font-semibold">
          Total{' '}
          <span className="tabular text-h3 font-bold">{money(Math.round(total * 100) / 100)}</span>
        </span>
        <Button fullWidth onClick={onFinish} disabled={!cart.length}>
          {label}
        </Button>
      </footer>
    </aside>
  );
}

function CartBar({
  count,
  total,
  label,
  onFinish,
}: {
  count: number;
  total: number;
  label: string;
  onFinish: () => void;
}) {
  return (
    <DockBar>
      <span className="min-w-0 flex-1 text-[0.9375rem] font-semibold">
        {count} in the cart{total > 0 ? ` · ${money(Math.round(total * 100) / 100)}` : ''}
      </span>
      <Button size="md" variant="soft" onClick={onFinish}>
        {label}
      </Button>
    </DockBar>
  );
}

function Empty({
  hasStores,
  storeName,
  onStores,
}: {
  hasStores: boolean;
  storeName?: string;
  onStores: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-10 text-center shadow-[var(--shadow-card)]">
      <SceneArt scene="shopping" className="size-24" />
      <h2 className="mt-4 text-h2 font-bold">
        {storeName ? `Nothing for ${storeName}` : 'Nothing to buy'}
      </h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        Type what you need above.{' '}
        {hasStores
          ? 'Each item can go to the store you buy it at.'
          : 'Add your stores — Linella, Metro — to keep a list for each.'}
      </p>
      {!hasStores ? (
        <Button icon={StorefrontIcon} className="mt-6" onClick={onStores}>
          Add your stores
        </Button>
      ) : null}
    </div>
  );
}
