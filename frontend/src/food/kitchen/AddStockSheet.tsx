import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, Chips, Sheet, TextField, toast } from '@/components/ui';
import { tr, type Translations } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { ExpiryPicker } from '../components/ExpiryPicker';
import { LocationPicker } from '../components/LocationPicker';
import type { PickedProduct } from '../catalog';
import { PackagesInput, type PackageRow } from '../components/PackagesInput';
import { ProductPicker } from '../components/ProductPicker';
import { QuantityInput } from '../components/QuantityInput';
import { VariantChips } from '../components/VariantChips';
import {
  addDays,
  formatAmount,
  formatQty,
  kindText,
  LOCATION_LABEL,
  localDate,
  packageUnits,
  parseAmount,
  unitsFor,
} from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { BaseUnit, Location, TrackMode, Area } from '../types';
import { kitchenT } from './kitchen.i18n';

const COUNTED: BaseUnit[] = ['pcs', 'g', 'ml'];
const TRACKING: Array<'exact' | 'level'> = ['exact', 'level'];

/**
 * Putting food in the kitchen, in two quick steps: what (search, or tap a common food), then how
 * much — as packages when it comes in them (a jar of 400 g, two bottles of 0.5 l and one of 1.25
 * l), else an amount — of which kind, where and until when, all pre-filled from what the item
 * usually is. Basics kept by level are simply marked full. "Add & next" keeps the sheet open for
 * unpacking a whole bag. A name nobody knows yet can be given in the other languages too.
 */
export function AddStockSheet({
  open,
  onClose,
  initial,
  area = 'food',
}: {
  open: boolean;
  onClose: () => void;
  initial?: PickedProduct | null;
  /** From the House: the picker offers house things, and unknown names become house things. */
  area?: Area;
}) {
  const k = kitchenT();
  const t = k.add;
  const queryClient = useQueryClient();
  const today = localDate();
  const [pick, setPick] = useState<PickedProduct | null>(initial ?? null);
  const [amount, setAmount] = useState<number | null>(null);
  const [unit, setUnit] = useState<string>('pcs');
  const [byPackage, setByPackage] = useState(false);
  const [packageName, setPackageName] = useState('');
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [variant, setVariant] = useState('');
  const [location, setLocation] = useState<Location>('fridge');
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [storeId, setStoreId] = useState<string>('none');
  const [translations, setTranslations] = useState<Translations>({});
  const stores = useQuery({
    queryKey: [...foodKeys.all, 'stores'],
    queryFn: foodApi.stores,
    enabled: open,
  });

  const choose = (next: PickedProduct | null) => {
    setPick(next);
    setTranslations({});
    if (!next) return;
    const packages = packageUnits(next);
    setByPackage(packages.length > 0);
    setPackageName(packages[0]?.name ?? '');
    setRows(packages[0] ? [{ count: 1, size: packages[0].size }] : []);
    setUnit(unitsFor(next)[0] ?? next.unit);
    setAmount(next.unit === 'pcs' ? 1 : null);
    setVariant(next.variant ?? '');
    setLocation(next.location);
    setExpiresOn(next.shelfLifeDays ? addDays(today, next.shelfLifeDays) : null);
    setPrice('');
  };

  // Each opening starts afresh, from what it was opened with.
  const [opened, setOpened] = useState<{
    open: boolean;
    initial: PickedProduct | null | undefined;
  }>({ open, initial });
  if (opened.open !== open || opened.initial !== initial) {
    setOpened({ open, initial });
    if (open) choose(initial ?? null);
  }

  const level = pick?.trackMode === 'level';
  const packages = pick ? packageUnits(pick) : [];
  const ready = Boolean(pick && (level || (byPackage ? rows.length : amount)));

  const save = useMutation({
    mutationFn: async () => {
      let productId = pick!.productId;
      // A name nobody knows yet: made the way it was set up here (counted in…, kept by level).
      if (!productId && pick!.isNew) {
        const created = await foodApi.createProduct({
          name: pick!.name,
          unit: pick!.unit,
          trackMode: pick!.trackMode,
          icon: pick!.icon,
          category: pick!.category,
          location: pick!.location,
          ...(Object.keys(translations).length ? { translations } : {}),
        });
        productId = created.id;
      }
      return foodApi.addStock({
        ...(productId ? { productId } : { name: pick!.name, area }),
        ...(level
          ? { quantity: 1 }
          : byPackage
            ? {
                package: packageName,
                packages: rows.map((row) => ({ count: row.count, size: row.size })),
              }
            : { quantity: amount!, unit }),
        ...(variant ? { variant } : {}),
        location,
        expiresOn,
        price: parseAmount(price),
        storeId: storeId === 'none' ? null : storeId,
      });
    },
  });

  const [next, setNext] = useState(false);
  const submit = (another: boolean) => {
    if (!ready) return;
    setNext(another);
    save.mutate(undefined, {
      onSuccess: ({ product, lots }) => {
        haptic('success');
        void queryClient.invalidateQueries({ queryKey: foodKeys.all });
        const what = level
          ? t.markedFull
          : byPackage
            ? rows.map((row) => `${row.count} × ${formatQty(row.size, product)}`).join(' + ')
            : formatAmount(amount!, unit);
        const kind = variant ? ` · ${kindText(variant, product)}` : '';
        toast.success(t.added(`${tr(product, 'name')}${kind}`), {
          description: level ? what : `${what} · ${LOCATION_LABEL[location]}`,
          // A level item has no piece to take back; anything else can be undone.
          action: lots.length
            ? {
                label: k.undo,
                onClick: () =>
                  void Promise.all(lots.map((lot) => foodApi.removeLot(lot.id))).then(() =>
                    queryClient.invalidateQueries({ queryKey: foodKeys.all }),
                  ),
              }
            : undefined,
        });
        if (another) choose(null);
        else onClose();
      },
    });
  };

  const fields = fieldErrors(save.error);
  const name = pick ? tr(pick, 'name') : '';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      size="lg"
      title={pick ? (level ? t.boughtIt : t.howMuch) : k.area[area].addTitle}
      description={pick ? undefined : t.searchHint}
      footer={
        pick ? (
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button
              fullWidth
              onClick={() => submit(false)}
              loading={save.isPending && !next}
              disabled={!ready || (save.isPending && next)}
            >
              {level ? t.markFull : k.area[area].addTitle}
            </Button>
            <Button
              fullWidth
              variant="tint"
              onClick={() => submit(true)}
              loading={save.isPending && next}
              disabled={!ready || (save.isPending && !next)}
            >
              {t.addNext}
            </Button>
          </div>
        ) : null
      }
    >
      {!pick ? (
        <ProductPicker onPick={choose} autoFocus area={area} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-[1.25rem] bg-butter-100 p-2.5 pr-3">
            <FoodIconTile name={pick.icon} tone="bg-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.0625rem] font-bold">{name}</p>
              <p className="text-sm text-butter-800">
                {pick.productId ? t.inList : pick.isNew ? t.newItem : t.fromCatalog}
              </p>
            </div>
            {initial ? null : (
              <Button size="sm" variant="ghost" onClick={() => choose(null)}>
                {t.change}
              </Button>
            )}
          </div>

          {pick.isNew ? (
            <>
              <TranslationFields
                fields={[{ key: 'name', label: t.name, maxLength: 80 }]}
                value={translations}
                onChange={setTranslations}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <span className="text-[0.8125rem] font-semibold text-ink-700">
                    {t.keptTrackOf}
                  </span>
                  <Chips
                    label={t.keptTrackOf}
                    tone="sheet"
                    dense
                    value={pick.trackMode === 'level' ? 'level' : 'exact'}
                    options={TRACKING.map((value) => ({ value, label: t.tracking[value] }))}
                    onChange={(value: TrackMode) => setPick({ ...pick, trackMode: value })}
                  />
                </div>
                {pick.trackMode !== 'level' ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[0.8125rem] font-semibold text-ink-700">
                      {t.countedIn}
                    </span>
                    <Chips
                      label={t.countedIn}
                      tone="sheet"
                      dense
                      value={pick.unit}
                      options={COUNTED.map((value) => ({ value, label: k.edit.counted[value] }))}
                      onChange={(value: BaseUnit) => {
                        setPick({ ...pick, unit: value });
                        setUnit(value);
                        setAmount(value === 'pcs' ? 1 : null);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {level ? (
            <p className="rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-700">
              {t.levelBefore(name)}
              <span className="font-semibold">{t.levelWord}</span>
              {t.levelAfter}
            </p>
          ) : (
            <>
              <VariantChips
                variants={pick.variants}
                icons={pick.variantIcons}
                translations={pick.translations}
                value={variant}
                onChange={setVariant}
              />
              {packages.length ? (
                <div className="flex gap-1.5" role="radiogroup" aria-label={t.enteredAs}>
                  {(
                    [
                      [true, t.byPackage],
                      [false, t.byAmount],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={byPackage === value}
                      onClick={() => setByPackage(value)}
                      className={`press h-8 rounded-pill px-3.5 text-sm font-semibold ${byPackage === value ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : null}
              {byPackage && packages.length ? (
                <PackagesInput
                  product={pick}
                  packages={packages}
                  packageName={packageName}
                  onPackageName={setPackageName}
                  rows={rows}
                  onChange={setRows}
                  label={t.whatYouGot}
                />
              ) : (
                <QuantityInput
                  label={t.amount}
                  value={amount}
                  unit={unit}
                  units={unitsFor(pick)}
                  onChange={(value, nextUnit) => {
                    setAmount(value);
                    setUnit(nextUnit);
                  }}
                  error={fields.quantity ?? fields.unit}
                  autoFocus={pick.unit !== 'pcs'}
                />
              )}
              {fields.packages ? (
                <p className="-mt-3 text-sm font-medium text-danger-600">{fields.packages}</p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2">
                <LocationPicker value={location} onChange={setLocation} />
                <ExpiryPicker value={expiresOn} onChange={setExpiresOn} today={today} />
              </div>
            </>
          )}

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
            <TextField
              label={byPackage && rows.length > 1 ? t.paidAll : t.paid}
              inputMode="decimal"
              placeholder={t.optional}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            {stores.data?.length ? (
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.8125rem] font-semibold text-ink-700">{t.boughtAt}</span>
                <select
                  value={storeId}
                  onChange={(event) => setStoreId(event.target.value)}
                  className="h-14 w-full rounded-[1.125rem] bg-ink-50 px-4 text-base text-ink-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                >
                  <option value="none">{t.notSaying}</option>
                  {stores.data.map((store) => (
                    <option key={store.id} value={store.id}>
                      {tr(store, 'name')}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {save.error && !fields.quantity && !fields.unit && !fields.packages ? (
            <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
