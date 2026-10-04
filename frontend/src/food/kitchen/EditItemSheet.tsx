import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, Chips, Sheet, Switch, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { LocationPicker } from '../components/LocationPicker';
import { CATEGORY_LABEL, CATEGORY_ORDER, parseAmount } from '../format';
import { FOOD_ICON_KEYS } from '../icons/art';
import { FoodIcon } from '../icons/FoodIcon';
import type { BaseUnit, Category, Location, StockedProduct } from '../types';

const COUNTED = [
  { value: 'pcs' as const, label: 'Pieces' },
  { value: 'g' as const, label: 'Weight' },
  { value: 'ml' as const, label: 'Volume' },
];

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
  const queryClient = useQueryClient();
  const stores = useQuery({
    queryKey: [...foodKeys.all, 'stores'],
    queryFn: foodApi.stores,
    enabled: open,
  });
  const [name, setName] = useState(product.name);
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
      toast.success('Item saved');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => foodApi.archiveProduct(product.id),
    onSuccess: () => {
      toast.success(`${product.name} removed`);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      setConfirmRemove(false);
      onClose();
      onRemoved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const hasStock = product.lots.length > 0;
  const base = unit === 'pcs' ? 'pcs' : unit;

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Edit item"
        size="lg"
        footer={
          <Button
            fullWidth
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={!name.trim()}
          >
            Save
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fields.name}
            maxLength={80}
          />

          <fieldset>
            <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">Icon</legend>
            <div
              role="radiogroup"
              aria-label="Icon"
              className="grid max-h-56 grid-cols-6 gap-1.5 overflow-y-auto rounded-2xl bg-ink-50 p-2 sm:grid-cols-8"
            >
              {FOOD_ICON_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={icon === key}
                  aria-label={key.replace('-', ' ')}
                  onClick={() => setIcon(key)}
                  className={cx(
                    'press grid aspect-square place-items-center rounded-xl transition-colors',
                    icon === key
                      ? 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-900)]'
                      : 'hover:bg-white',
                  )}
                >
                  <FoodIcon name={key} className="size-8" />
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">Category</span>
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
            <span className="text-[0.8125rem] font-semibold text-ink-700">Counted in</span>
            <Chips
              label="Counted in"
              tone="sheet"
              value={unit}
              options={COUNTED}
              onChange={(value) => !hasStock && setUnit(value)}
            />
            {hasStock ? (
              <p className="text-sm text-ink-500">Use up or remove its stock to change this.</p>
            ) : fields.unit ? (
              <p className="text-sm text-danger-600">{fields.unit}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={
                unit === 'pcs'
                  ? 'One piece weighs (g)'
                  : unit === 'g'
                    ? 'One piece (g)'
                    : 'One bottle/pack (ml)'
              }
              inputMode="decimal"
              placeholder="Optional"
              value={pieceSize}
              onChange={(event) => setPieceSize(event.target.value)}
              hint={unit === 'pcs' ? 'Lets recipes in grams use it' : 'Lets you count it in pieces'}
            />
            <TextField
              label={`Running low under (${base})`}
              inputMode="decimal"
              placeholder="Optional"
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
              hint="It shows on Food home"
            />
          </div>

          <LocationPicker label="Usually kept in" value={location} onChange={setLocation} />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Keeps (days)"
              inputMode="numeric"
              placeholder="Optional"
              value={shelfLife}
              onChange={(event) => setShelfLife(event.target.value)}
            />
            <TextField
              label="Once opened (days)"
              inputMode="numeric"
              placeholder="Optional"
              value={openedDays}
              onChange={(event) => setOpenedDays(event.target.value)}
            />
          </div>

          {stores.data?.length ? (
            <label className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">Usually bought at</span>
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="h-14 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
              >
                <option value="none">Any store</option>
                {stores.data.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <Switch
            checked={alwaysThere}
            onChange={setAlwaysThere}
            label="Always there"
            hint="Like salt: never counted, never put on a list"
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
            Remove this item
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        tone="danger"
        title={`Remove ${product.name}?`}
        description="It leaves the kitchen and its stock is cleared. Recipes and past shops keep their copy."
        confirmLabel="Remove"
      />
    </>
  );
}
