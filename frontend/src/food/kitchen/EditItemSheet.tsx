import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, Chips, Sheet, Switch, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { LocationPicker } from '../components/LocationPicker';
import { CATEGORY_LABEL, CATEGORY_ORDER, parseAmount, unitWord } from '../format';
import { FOOD_ICON_KEYS } from '../icons/art';
import { useCustomIcons } from '../icons/custom';
import { FoodIcon } from '../icons/FoodIcon';
import { useIconsT } from '../icons/icons.i18n';
import { iconLabel } from '../icons/registry';
import { IconGroupLabel } from '../icons/IconGroupLabel';
import type { BaseUnit, Category, Location, StockedProduct } from '../types';
import { kitchenT } from './kitchen.i18n';

const COUNTED: BaseUnit[] = ['pcs', 'g', 'ml'];

const numberOrNull = (text: string) => {
  const value = parseAmount(text);
  return value === null ? null : value;
};

/** Everything about an item that isn't its stock: icon, name, how it is counted and kept. */
export function EditItemSheet({
  open,
  product,
  onClose,
  onRemoved,
}: {
  open: boolean;
  product: StockedProduct;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const t = kitchenT().edit;
  const groups = useIconsT();
  const customIcons = useCustomIcons();
  const queryClient = useQueryClient();
  const stores = useQuery({
    queryKey: [...foodKeys.all, 'stores'],
    queryFn: foodApi.stores,
    enabled: open,
  });
  const [name, setName] = useState(product.name);
  const [translations, setTranslations] = useState<Translations>(product.translations ?? {});
  const [icon, setIcon] = useState(product.icon);
  const [category, setCategory] = useState<Category>(product.category);
  const [unit, setUnit] = useState<BaseUnit>(product.unit);
  const [pieceSize, setPieceSize] = useState(product.pieceSize ? String(product.pieceSize) : '');
  const [location, setLocation] = useState<Location>(product.location);
  const [shelfLife, setShelfLife] = useState(
    product.shelfLifeDays ? String(product.shelfLifeDays) : '',
  );
  const [openedDays, setOpenedDays] = useState(
    product.openedDays ? String(product.openedDays) : '',
  );
  const [minStock, setMinStock] = useState(product.minStock ? String(product.minStock) : '');
  const [alwaysThere, setAlwaysThere] = useState(!product.trackStock);
  const [storeId, setStoreId] = useState(product.storeId ?? 'none');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Opening the editor (or opening it on another item) starts from the item as saved.
  const [loadedFor, setLoadedFor] = useState<string | null>(open ? product.id : null);
  const target = open ? product.id : null;
  if (loadedFor !== target) {
    setLoadedFor(target);
    if (target) reset();
  }
  function reset() {
    setName(product.name);
    setTranslations(product.translations ?? {});
    setIcon(product.icon);
    setCategory(product.category);
    setUnit(product.unit);
    setPieceSize(product.pieceSize ? String(product.pieceSize) : '');
    setLocation(product.location);
    setShelfLife(product.shelfLifeDays ? String(product.shelfLifeDays) : '');
    setOpenedDays(product.openedDays ? String(product.openedDays) : '');
    setMinStock(product.minStock ? String(product.minStock) : '');
    setAlwaysThere(!product.trackStock);
    setStoreId(product.storeId ?? 'none');
  }

  const pieceUnit = unit === 'ml' ? 'ml' : unit === 'g' ? 'g' : (product.pieceUnit ?? 'g');
  const save = useMutation({
    mutationFn: () =>
      foodApi.updateProduct(product.id, {
        name: name.trim(),
        translations,
        icon,
        category,
        ...(unit !== product.unit ? { unit } : {}),
        pieceSize: numberOrNull(pieceSize),
        pieceUnit: numberOrNull(pieceSize) ? pieceUnit : null,
        location,
        shelfLifeDays: numberOrNull(shelfLife) ? Math.round(numberOrNull(shelfLife)!) : null,
        openedDays: numberOrNull(openedDays) ? Math.round(numberOrNull(openedDays)!) : null,
        minStock: numberOrNull(minStock),
        trackStock: !alwaysThere,
        storeId: storeId === 'none' ? null : storeId,
      }),
    onSuccess: () => {
      toast.success(t.saved);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => foodApi.archiveProduct(product.id),
    onSuccess: () => {
      toast.success(t.removed(tr(product, 'name')));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      setConfirmRemove(false);
      onClose();
      onRemoved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const hasStock = product.lots.length > 0;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={t.title}
        size="lg"
        footer={
          <Button
            fullWidth
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!name.trim()}
          >
            {t.save}
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <TextField
            label={t.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fields.name}
            maxLength={80}
          />
          <TranslationFields
            fields={[
              { key: 'name', label: t.name, maxLength: 80 },
              ...(product.note ? [{ key: 'note', label: t.note, multiline: true }] : []),
            ]}
            value={translations}
            onChange={setTranslations}
          />

          <fieldset>
            <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">{t.icon}</legend>
            <div
              role="radiogroup"
              aria-label={t.icon}
              className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto rounded-2xl bg-ink-50 p-2 sm:grid-cols-8"
            >
              {customIcons.length > 0 && <IconGroupLabel>{groups.yours}</IconGroupLabel>}
              {[
                ...customIcons.map((custom) => ({ key: custom.key, label: tr(custom, 'name') })),
                ...(customIcons.length ? [null] : []),
                ...FOOD_ICON_KEYS.map((key) => ({ key, label: iconLabel(key) })),
              ].map((choice) =>
                choice === null ? (
                  <IconGroupLabel key="built-in">{groups.builtIn}</IconGroupLabel>
                ) : (
                  <button
                    key={choice.key}
                    type="button"
                    role="radio"
                    aria-checked={icon === choice.key}
                    aria-label={choice.label}
                    title={choice.label}
                    onClick={() => setIcon(choice.key)}
                    className={cx(
                      'press grid aspect-square place-items-center rounded-xl transition-colors',
                      icon === choice.key
                        ? 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-900)]'
                        : 'hover:bg-white',
                    )}
                  >
                    <FoodIcon name={choice.key} className="size-8" />
                  </button>
                ),
              )}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.category}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value as Category)}
              className="h-14 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
            >
              {CATEGORY_ORDER.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABEL[value]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.countedIn}</span>
            <Chips
              label={t.countedIn}
              tone="sheet"
              value={unit}
              options={COUNTED.map((value) => ({ value, label: t.counted[value] }))}
              onChange={(value) => !hasStock && setUnit(value)}
            />
            {hasStock ? (
              <p className="text-sm text-ink-500">{t.useUpFirst}</p>
            ) : fields.unit ? (
              <p className="text-sm text-danger-600">{fields.unit}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={unit === 'pcs' ? t.pieceWeighs : unit === 'g' ? t.onePiece : t.oneBottle}
              inputMode="decimal"
              placeholder={t.optional}
              value={pieceSize}
              onChange={(event) => setPieceSize(event.target.value)}
              hint={unit === 'pcs' ? t.pieceHintPcs : t.pieceHint}
            />
            <TextField
              label={t.lowUnder(unitWord(unit, 2))}
              inputMode="decimal"
              placeholder={t.optional}
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
              hint={t.lowHint}
            />
          </div>

          <LocationPicker label={t.usuallyKeptIn} value={location} onChange={setLocation} />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={t.keepsDays}
              inputMode="numeric"
              placeholder={t.optional}
              value={shelfLife}
              onChange={(event) => setShelfLife(event.target.value)}
            />
            <TextField
              label={t.openedDays}
              inputMode="numeric"
              placeholder={t.optional}
              value={openedDays}
              onChange={(event) => setOpenedDays(event.target.value)}
            />
          </div>

          {stores.data?.length ? (
            <label className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">
                {t.usuallyBoughtAt}
              </span>
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="h-14 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              >
                <option value="none">{t.anyStore}</option>
                {stores.data.map((store) => (
                  <option key={store.id} value={store.id}>
                    {tr(store, 'name')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <Switch
            checked={alwaysThere}
            onChange={setAlwaysThere}
            label={t.alwaysThere}
            hint={t.alwaysThereHint}
          />

          {save.error && !Object.keys(fields).length ? (
            <p className="text-sm text-danger-600">{errorMessage(save.error)}</p>
          ) : null}

          <Button
            variant="ghost"
            icon={DeleteIcon}
            className="self-start text-danger-600"
            onClick={() => setConfirmRemove(true)}
          >
            {t.remove}
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        tone="danger"
        title={t.confirmTitle(tr(product, 'name'))}
        description={t.confirmText}
        confirmLabel={t.confirm}
      />
    </>
  );
}
