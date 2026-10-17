import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Badge,
  Button,
  IconButton,
  Sheet,
  Skeleton,
  Switch,
  TextField,
  toast,
} from '@/components/ui';
import {
  AddIcon,
  AddShoppingCartIcon,
  CloseIcon,
  DeleteIcon,
  EditIcon,
  ExpandMoreIcon,
  HistoryIcon,
  SparkleIcon,
  SwapIcon,
} from '@/components/ui/icons';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatAgo } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { ExpiryChip } from '../components/ExpiryChip';
import { ExpiryPicker } from '../components/ExpiryPicker';
import { fromProduct, type PickedProduct } from '../catalog';
import { LocationPicker } from '../components/LocationPicker';
import { QuantityInput } from '../components/QuantityInput';
import {
  CATEGORY_LABEL,
  capitalized,
  noteText,
  storeText,
  formatAmount,
  formatQty,
  fromBase,
  kindOf,
  LOCATION_LABEL,
  locationTo,
  packageLabel,
  packageWord,
  toBase,
  localDate,
  money,
  naturalUnit,
  parseAmount,
  pieceName,
  unitsFor,
  unitWord,
} from '../format';
import { LOCATION_ICON } from '../places';
import { FoodIcon, FoodIconTile } from '../icons/FoodIcon';
import type { Lot, StockedProduct, StockEvent } from '../types';
import { EditItemSheet } from './EditItemSheet';
import { kitchenT } from './kitchen.i18n';
import { NutritionCard } from './NutritionCard';

type LotMode = 'use' | 'pour' | 'move' | 'edit';

/**
 * One item: every piece of it (each steak, each jar), what is left and until when, and quick ways
 * to use some, pour it into another container, move it, correct it or throw it away — every
 * change with an Undo. Basics kept by level are just full, low or out. History and the last
 * prices paid sit underneath. A sheet on phones; on tablets the same body stands in a panel
 * beside the kitchen list (ProductPanel).
 */
export function ProductSheet({
  productId,
  onClose,
  onAddMore,
}: {
  productId: string | null;
  onClose: () => void;
  onAddMore: (pick: PickedProduct) => void;
}) {
  const t = kitchenT().item;
  const detail = useQuery({
    queryKey: foodKeys.product(productId ?? ''),
    queryFn: () => foodApi.product(productId!),
    enabled: Boolean(productId),
  });
  const product = detail.data?.product;
  return (
    <Sheet
      open={Boolean(productId)}
      onClose={onClose}
      title={product ? tr(product, 'name') : t.fallback}
      size="lg"
      description={product ? <Summary product={product} /> : undefined}
    >
      {productId ? (
        <ProductBody productId={productId} onClose={onClose} onAddMore={onAddMore} />
      ) : null}
    </Sheet>
  );
}

/** The same item, as a panel beside the list (tablets and wider). */
export function ProductPanel({
  productId,
  onClose,
  onAddMore,
}: {
  productId: string;
  onClose: () => void;
  onAddMore: (pick: PickedProduct) => void;
}) {
  const t = kitchenT().item;
  const detail = useQuery({
    queryKey: foodKeys.product(productId),
    queryFn: () => foodApi.product(productId),
  });
  const product = detail.data?.product;
  return (
    <section
      aria-label={product ? tr(product, 'name') : t.fallback}
      className="animate-fade-in rounded-[1.75rem] bg-white p-5 shadow-[var(--shadow-card)]"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-h2 font-bold">{product ? tr(product, 'name') : ' '}</h2>
          <div className="mt-1.5 text-[0.9375rem] text-ink-600">
            {product ? <Summary product={product} /> : null}
          </div>
        </div>
        <IconButton
          icon={CloseIcon}
          label={t.close}
          size="sm"
          variant="outline"
          onClick={onClose}
        />
      </header>
      <ProductBody productId={productId} onClose={onClose} onAddMore={onAddMore} />
    </section>
  );
}

function Summary({ product }: { product: StockedProduct }) {
  const k = kitchenT();
  const t = k.item;
  const amount =
    product.trackMode === 'level'
      ? t.keptByLevel(k.level[product.level])
      : product.trackMode === 'none'
        ? k.alwaysThere
        : product.total > 0
          ? t.inPieces(formatQty(product.total, product), product.lots.length)
          : k.noneLeft;
  return (
    <span className="flex items-center gap-2.5">
      <FoodIconTile
        name={product.icon}
        tone="bg-butter-100"
        className="size-10 rounded-xl [&>svg]:size-7"
      />
      <span>
        {amount} · {CATEGORY_LABEL[product.category]}
      </span>
    </span>
  );
}

function ProductBody({
  productId,
  onClose,
  onAddMore,
}: {
  productId: string;
  onClose: () => void;
  onAddMore: (pick: PickedProduct) => void;
}) {
  const t = kitchenT().item;
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: foodKeys.product(productId),
    queryFn: () => foodApi.product(productId),
  });
  const [openLot, setOpenLot] = useState<{ id: string; mode: LotMode } | null>(null);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const product = detail.data?.product;
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });

  const toList = useMutation({
    mutationFn: () => foodApi.addLines([{ productId: product!.id }]),
    onSuccess: () => {
      haptic('success');
      toast.success(t.onShoppingList(tr(product!, 'name')));
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (detail.error || !product)
    return <p className="text-sm text-danger-600">{errorMessage(detail.error)}</p>;

  // The price per kilo, litre or piece: "/kg", "/l", "/slice".
  const per =
    product.unit === 'pcs'
      ? unitWord(pieceName(product)?.name ?? 'pcs', 1, pieceName(product))
      : unitWord(product.unit === 'g' ? 'kg' : 'l');

  return (
    <>
      <div className="flex flex-col gap-5">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
          <Button size="sm" icon={AddIcon} onClick={() => onAddMore(fromProduct(product))}>
            {product.trackMode === 'level' ? t.boughtIt : t.addMore}
          </Button>
          <Button
            size="sm"
            variant="tint"
            icon={AddShoppingCartIcon}
            onClick={() => toList.mutate()}
            loading={toList.isPending}
          >
            {t.toList}
          </Button>
          <Button size="sm" variant="tint" icon={EditIcon} onClick={() => setEditing(true)}>
            {t.edit}
          </Button>
        </div>

        {product.trackMode === 'level' ? <LevelPicker product={product} /> : null}

        {product.low ? (
          <p className="rounded-2xl bg-peach-100 px-4 py-3 text-sm font-medium text-peach-800">
            {t.runningLow(formatQty(product.minStock!, product))}
          </p>
        ) : null}

        {product.note ? (
          <p className="rounded-2xl bg-lav-50 px-4 py-3 text-sm text-ink-700">
            {tr(product, 'note')}
          </p>
        ) : null}

        {product.trackMode !== 'exact' ? null : product.lots.length ? (
          <ul className="flex flex-col gap-2.5">
            {product.lots.map((lot, index) => (
              <LotCard
                key={lot.id}
                lot={lot}
                product={product}
                index={index}
                mode={openLot?.id === lot.id ? openLot.mode : null}
                onMode={(mode) => setOpenLot(mode ? { id: lot.id, mode } : null)}
                onDone={() => {
                  setOpenLot(null);
                  void refresh();
                }}
              />
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl bg-ink-50 p-4 text-center">
            <p className="text-[0.9375rem] font-semibold">{t.nothingHere}</p>
            <p className="mt-0.5 text-sm text-ink-600">{t.nothingHereHint}</p>
          </div>
        )}

        <NutritionCard product={product} />

        {detail.data.prices.length ? (
          <section>
            <h3 className="text-h3 font-bold">{t.lastPaid}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {detail.data.prices.map((p) => (
                <li
                  key={`${p.storeId}-${p.boughtAt}`}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm"
                >
                  <span className="min-w-0 truncate font-semibold">
                    {storeText(p.storeName, p.storeTranslations) || t.aShop}
                  </span>
                  <span className="tabular shrink-0 text-ink-600">
                    {t.priceFor(money(p.price), formatQty(p.quantity, product))}
                    <span className="ml-2 font-semibold text-ink-900">
                      {money(p.unitPrice)}/{per}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <button
            type="button"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((v) => !v)}
            className="press flex w-full items-center gap-2 rounded-2xl py-1 text-left"
          >
            <HistoryIcon fontSize="inherit" className="text-[1.25rem] text-ink-600" />
            <span className="flex-1 text-h3 font-bold">{t.history}</span>
            <ExpandMoreIcon
              fontSize="inherit"
              className={cx(
                'text-[1.4rem] text-ink-500 transition-transform duration-200',
                historyOpen && 'rotate-180',
              )}
            />
          </button>
          {historyOpen ? <History events={detail.data.events} product={product} /> : null}
        </section>
      </div>
      <EditItemSheet
        open={editing}
        product={product}
        onClose={() => setEditing(false)}
        onRemoved={onClose}
      />
    </>
  );
}

/** Full, low or out, one tap each (basics: oil, salt, soy sauce). */
function LevelPicker({ product }: { product: StockedProduct }) {
  const k = kitchenT();
  const t = k.item;
  const queryClient = useQueryClient();
  const set = useMutation({
    mutationFn: (level: 'full' | 'low' | 'out') => foodApi.setLevel(product.id, level),
    onSuccess: (_p, level) => {
      haptic('tap');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      if (level === 'out')
        toast.success(t.isOut(tr(product, 'name')), { description: t.isOutHint });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div
      role="radiogroup"
      aria-label={t.howMuchLeft}
      className="grid grid-cols-3 gap-1.5 rounded-[1.25rem] bg-ink-50 p-1.5"
    >
      {(['full', 'low', 'out'] as const).map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={product.level === level}
          onClick={() => product.level !== level && set.mutate(level)}
          className={cx(
            'press h-11 rounded-2xl text-[0.9375rem] font-semibold transition-colors',
            product.level === level
              ? level === 'out'
                ? 'bg-peach-200 text-ink-900'
                : level === 'low'
                  ? 'bg-butter-300 text-ink-900'
                  : 'bg-mint-200 text-ink-900'
              : 'text-ink-700 hover:bg-white',
          )}
        >
          {k.level[level]}
        </button>
      ))}
    </div>
  );
}

function LotCard({
  lot,
  product,
  index,
  mode,
  onMode,
  onDone,
}: {
  lot: Lot;
  product: StockedProduct;
  index: number;
  mode: LotMode | null;
  onMode: (mode: LotMode | null) => void;
  onDone: () => void;
}) {
  const t = kitchenT().item;
  const today = localDate();
  const LocationIcon = LOCATION_ICON[lot.location];
  const meta = [
    noteText(lot) || null,
    t.added(formatAgo(lot.addedAt)),
    storeText(lot.storeName, lot.storeTranslations) || null,
    lot.price !== null ? money(lot.price) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const holds = packageLabel(lot, product);
  const fill = lot.initialQuantity > 0 ? Math.min(1, lot.quantity / lot.initialQuantity) : 1;
  const canPour = product.unit !== 'pcs' && lot.quantity > 0;
  return (
    <li
      className={cx(
        'rounded-[1.375rem] ring-1 ring-inset transition-colors',
        mode ? 'bg-white ring-ink-900' : 'bg-ink-50 ring-transparent',
      )}
    >
      <button
        type="button"
        onClick={() => onMode(mode ? null : 'use')}
        aria-expanded={Boolean(mode)}
        className="press flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="tabular min-w-[4.5rem] text-[1.375rem] font-bold tracking-[-0.025em]">
          {formatQty(lot.quantity, product)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone="muted" className="gap-1">
              <LocationIcon fontSize="inherit" className="text-sm" />
              {LOCATION_LABEL[lot.location]}
            </Badge>
            {holds ? <Badge tone="butter">{holds}</Badge> : null}
            {lot.variant ? (
              <Badge tone="muted" className="gap-1">
                {product.variantIcons?.[lot.variant.toLowerCase()] ? (
                  <FoodIcon
                    name={product.variantIcons[lot.variant.toLowerCase()]!}
                    className="size-4"
                  />
                ) : null}
                {kindOf(lot, product)}
              </Badge>
            ) : null}
            {lot.openedAt ? <Badge tone="lav">{t.opened}</Badge> : null}
            {index === 0 && product.lots.length > 1 ? <Badge tone="mint">{t.nextUp}</Badge> : null}
          </span>
          <span className="mt-1 block truncate text-xs font-medium text-ink-600">{meta}</span>
          {/* How full the jar, bottle or loaf still is. */}
          {lot.openedAt && fill < 1 ? (
            <span
              className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100"
              aria-label={t.percentLeft(Math.round(fill * 100))}
            >
              <span
                className="block h-full rounded-full bg-mint-800"
                style={{ width: `${Math.max(4, fill * 100)}%` }}
              />
            </span>
          ) : null}
        </span>
        <ExpiryChip expiresOn={lot.expiresOn} today={today} />
      </button>
      {mode ? (
        <div className="animate-rise border-t border-ink-100 p-3.5 pt-3">
          <div role="tablist" aria-label={t.whatToDo} className="mb-4 flex flex-wrap gap-1.5">
            {(['use', 'pour', 'move', 'edit'] as const)
              .filter((value) => value !== 'pour' || canPour)
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => onMode(value)}
                  className={cx(
                    'press h-9 rounded-pill px-4 text-sm font-semibold',
                    mode === value
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  )}
                >
                  {t.tabs[value]}
                </button>
              ))}
          </div>
          {mode === 'use' ? <UsePanel lot={lot} product={product} onDone={onDone} /> : null}
          {mode === 'pour' ? <PourPanel lot={lot} product={product} onDone={onDone} /> : null}
          {mode === 'move' ? <MovePanel lot={lot} onDone={onDone} /> : null}
          {mode === 'edit' ? <CorrectPanel lot={lot} product={product} onDone={onDone} /> : null}
        </div>
      ) : null}
    </li>
  );
}

function UsePanel({
  lot,
  product,
  onDone,
}: {
  lot: Lot;
  product: StockedProduct;
  onDone: () => void;
}) {
  const k = kitchenT();
  const t = k.item;
  const queryClient = useQueryClient();
  const measured = product;
  const shown = naturalUnit(lot.quantity, product);
  const [amount, setAmount] = useState<number | null>(
    product.unit === 'pcs' ? Math.min(1, lot.quantity) : null,
  );
  const [unit, setUnit] = useState<string>(shown);
  const inShown = (fraction: number) => fromBase(lot.quantity * fraction, shown, measured);

  const use = useMutation({
    mutationFn: (wasted: boolean) =>
      foodApi.useStock({ productId: product.id, quantity: amount!, unit, lotId: lot.id, wasted }),
    onSuccess: (result, wasted) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(t.usedOf(wasted, formatQty(result.used, product), tr(product, 'name')), {
        description:
          result.shortfall > 0 ? t.wasntThere(formatQty(result.shortfall, product)) : undefined,
        action: {
          label: k.undo,
          onClick: () =>
            void foodApi
              .undo(result.events)
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
        },
      });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const quick =
    product.unit === 'pcs' && lot.quantity <= 12
      ? [
          { label: '½', value: 0.5, unit: 'pcs' },
          { label: t.allOf(formatQty(lot.quantity, product)), value: lot.quantity, unit: 'pcs' },
        ]
      : [
          { label: '¼', value: inShown(0.25), unit: shown },
          { label: '½', value: inShown(0.5), unit: shown },
          { label: '¾', value: inShown(0.75), unit: shown },
          { label: t.allPlain, value: inShown(1), unit: shown },
        ];

  return (
    <div className="flex flex-col gap-4">
      <QuantityInput
        label={t.howMuchUsed}
        value={amount}
        unit={unit}
        units={unitsFor(measured)}
        quick={quick}
        onChange={(value, next) => {
          setAmount(value);
          setUnit(next);
        }}
      />
      <div className="flex gap-2.5">
        <Button
          fullWidth
          size="md"
          onClick={() => use.mutate(false)}
          disabled={!amount}
          loading={use.isPending && use.variables === false}
        >
          {t.use(amount ? formatAmount(amount, unit) : '')}
        </Button>
        <Button
          size="md"
          variant="tint"
          icon={DeleteIcon}
          onClick={() => use.mutate(true)}
          disabled={!amount}
          loading={use.isPending && use.variables === true}
        >
          {t.threwAway}
        </Button>
      </div>
    </div>
  );
}

const CONTAINERS = ['dispenser', 'bottle', 'jar', 'container', 'jug'];

/**
 * Pouring from this piece into another: the big oil bottle into the small one on the desk, a jug
 * into a bottle. Into one already there (topping it up), or into a new container.
 */
function PourPanel({
  lot,
  product,
  onDone,
}: {
  lot: Lot;
  product: StockedProduct;
  onDone: () => void;
}) {
  const t = kitchenT().item;
  const queryClient = useQueryClient();
  const others = product.lots.filter((other) => other.id !== lot.id);
  const shown = naturalUnit(lot.quantity, product);
  const [amount, setAmount] = useState<number | null>(null);
  const [unit, setUnit] = useState<string>(shown === 'l' ? 'ml' : shown === 'kg' ? 'g' : shown);
  const [into, setInto] = useState<string>(others[0]?.id ?? 'new');
  const [container, setContainer] = useState('dispenser');
  const [holds, setHolds] = useState('');
  const [location, setLocation] = useState<Lot['location']>('other');
  const [note, setNote] = useState('');
  const names = [...new Set([...CONTAINERS, ...(product.units ?? []).map((u) => u.name)])].filter(
    (n) => !['tbsp', 'tsp', 'cup', 'shot', 'pump', 'glass'].includes(n),
  );
  const own = (name: string) => product.units?.find((u) => u.name === name);
  /** A container's name as a chip shows it: "Bottle", "Sticlă", "Бутылка". */
  const containerName = (name: string) => capitalized(packageWord(name, 1, own(name)));

  const pour = useMutation({
    mutationFn: () =>
      foodApi.pour(lot.id, {
        quantity: amount!,
        unit,
        ...(into === 'new'
          ? {
              package: container,
              packageSize: parseAmount(holds)
                ? toBase(parseAmount(holds)!, unit, product)
                : undefined,
              location,
              note: note.trim() || undefined,
            }
          : { intoLotId: into }),
      }),
    onSuccess: ({ into: target }) => {
      haptic('success');
      toast.success(t.poured(formatAmount(amount!, unit)), {
        description: t.nowHas(
          formatQty(target.quantity, product),
          target.package ? containerName(target.package) : null,
        ),
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <QuantityInput
        label={t.howMuchPour}
        value={amount}
        unit={unit}
        units={unitsFor(product)}
        onChange={(value, next) => {
          setAmount(value);
          setUnit(next);
        }}
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink-700">{t.into}</span>
        <div className="flex flex-wrap gap-1.5">
          {others.map((other) => (
            <button
              key={other.id}
              type="button"
              aria-pressed={into === other.id}
              onClick={() => setInto(other.id)}
              className={cx(
                'press h-9 max-w-full truncate rounded-pill px-3.5 text-sm font-semibold',
                into === other.id
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {other.package ? containerName(other.package) : t.piece}
              {other.note ? ` · ${noteText(other)}` : ` · ${LOCATION_LABEL[other.location]}`} (
              {formatQty(other.quantity, product)})
            </button>
          ))}
          <button
            type="button"
            aria-pressed={into === 'new'}
            onClick={() => setInto('new')}
            className={cx(
              'press h-9 rounded-pill px-3.5 text-sm font-semibold',
              into === 'new'
                ? 'bg-ink-900 text-white'
                : 'bg-butter-100 text-ink-900 hover:bg-butter-200',
            )}
          >
            {t.newContainer}
          </button>
        </div>
      </div>
      {into === 'new' ? (
        <div className="flex flex-col gap-4 rounded-[1.25rem] bg-ink-50 p-3">
          <div className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={container === name}
                onClick={() => setContainer(name)}
                className={cx(
                  'press h-8 rounded-pill px-3 text-sm font-semibold',
                  container === name ? 'bg-ink-900 text-white' : 'bg-white text-ink-700',
                )}
              >
                {containerName(name)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t.holds(unitWord(unit, 2))}
              dense
              inputMode="decimal"
              placeholder={t.optional}
              value={holds}
              onChange={(event) => setHolds(event.target.value)}
            />
            <TextField
              label={t.whereExactly}
              dense
              placeholder={t.onTheDesk}
              value={note}
              maxLength={60}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <LocationPicker label={t.keptIn} value={location} onChange={setLocation} />
        </div>
      ) : null}
      <Button
        fullWidth
        size="md"
        onClick={() => pour.mutate()}
        disabled={!amount}
        loading={pour.isPending}
      >
        {t.pour(amount ? formatAmount(amount, unit) : '')}
      </Button>
    </div>
  );
}

function MovePanel({ lot, onDone }: { lot: Lot; onDone: () => void }) {
  const t = kitchenT().item;
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: (location: Lot['location']) => foodApi.updateLot(lot.id, { location }),
    onSuccess: (updated) => {
      haptic('tap');
      toast.success(t.movedTo(locationTo(updated.location)), {
        description: updated.location === 'freezer' ? t.frozenHint : undefined,
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <LocationPicker
      label={t.moveTo}
      value={lot.location}
      onChange={(location) => location !== lot.location && move.mutate(location)}
    />
  );
}

function CorrectPanel({
  lot,
  product,
  onDone,
}: {
  lot: Lot;
  product: StockedProduct;
  onDone: () => void;
}) {
  const t = kitchenT().item;
  const queryClient = useQueryClient();
  const measured = product;
  const shown = naturalUnit(lot.quantity, product);
  const [left, setLeft] = useState<number | null>(fromBase(lot.quantity, shown, measured));
  const [unit, setUnit] = useState<string>(shown);
  const [expiresOn, setExpiresOn] = useState<string | null>(lot.expiresOn);
  const [opened, setOpened] = useState(Boolean(lot.openedAt));
  const [price, setPrice] = useState(lot.price === null ? '' : String(lot.price));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      foodApi.updateLot(lot.id, {
        quantity: left ?? 0,
        unit,
        expiresOn,
        opened,
        price: parseAmount(price),
      }),
    onSuccess: () => {
      haptic('success');
      toast.success(t.saved);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => foodApi.removeLot(lot.id),
    onSuccess: () => {
      toast.success(t.removed);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onDone();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <QuantityInput
        label={t.leftNow}
        value={left}
        unit={unit}
        units={unitsFor(measured)}
        onChange={(value, next) => {
          setLeft(value);
          setUnit(next);
        }}
      />
      <ExpiryPicker value={expiresOn} onChange={setExpiresOn} />
      <Switch
        checked={opened}
        onChange={setOpened}
        label={t.opened}
        hint={product.openedDays ? t.keepsOpen(product.openedDays) : undefined}
      />
      <label className="flex flex-col gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink-700">{t.paid}</span>
        <input
          inputMode="decimal"
          value={price}
          placeholder={t.optional}
          onChange={(event) => setPrice(event.target.value)}
          className="h-12 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        />
      </label>
      <div className="flex flex-wrap gap-2.5">
        <Button
          className="min-w-0 flex-1"
          size="md"
          onClick={() => save.mutate()}
          loading={save.isPending}
        >
          {t.save}
        </Button>
        {confirmRemove ? (
          <Button
            size="md"
            variant="danger"
            onClick={() => remove.mutate()}
            loading={remove.isPending}
          >
            {t.removeIt}
          </Button>
        ) : (
          <Button
            size="md"
            variant="ghost"
            icon={DeleteIcon}
            onClick={() => setConfirmRemove(true)}
          >
            {t.byMistake}
          </Button>
        )}
      </div>
    </div>
  );
}

function History({ events, product }: { events: StockEvent[]; product: StockedProduct }) {
  const t = kitchenT().item;
  if (!events.length) return <p className="mt-2 text-sm text-ink-600">{t.nothingYet}</p>;
  return (
    <ol className="mt-2 flex flex-col">
      {events.map((event) => (
        <li
          key={event.id}
          className="flex items-center gap-3 border-b border-ink-100 py-2.5 last:border-0"
        >
          <span
            className={cx(
              'grid size-8 shrink-0 place-items-center rounded-full text-sm',
              event.kind === 'added' || event.kind === 'restored'
                ? 'bg-mint-100 text-mint-800'
                : event.kind === 'wasted'
                  ? 'bg-danger-50 text-danger-700'
                  : 'bg-ink-100 text-ink-700',
            )}
          >
            {event.kind === 'moved' ? (
              <SwapIcon fontSize="inherit" />
            ) : event.delta > 0 ? (
              '+'
            ) : event.delta < 0 ? (
              '−'
            ) : (
              '·'
            )}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">
              {t.events[event.kind]}
              {event.delta ? ` ${formatQty(Math.abs(event.delta), product)}` : ''}
            </span>
            {event.note ? <span className="text-ink-600"> · {noteText(event)}</span> : null}
            <span className="block text-xs text-ink-500">
              {event.actor ?? t.someone} · {formatAgo(event.createdAt)}
            </span>
          </span>
          {event.via === 'ai' ? (
            <Badge tone="lav" className="gap-1">
              <SparkleIcon fontSize="inherit" className="text-sm" />
              {t.ai}
            </Badge>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
