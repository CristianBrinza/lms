import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Chips, Sheet, TextField, toast } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { ExpiryPicker } from '../components/ExpiryPicker';
import { LocationPicker } from '../components/LocationPicker';
import type { PickedProduct } from '../catalog';
import { ProductPicker } from '../components/ProductPicker';
import { QuantityInput } from '../components/QuantityInput';
import { addDays, formatAmount, localDate, parseAmount, unitsFor } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { BaseUnit, Location, Unit } from '../types';

const COUNTED = [
  { value: 'pcs' as const, label: 'Pieces' },
  { value: 'g' as const, label: 'Weight' },
  { value: 'ml' as const, label: 'Volume' },
];

/**
 * Putting food in the kitchen, in two quick steps: what (search, or tap a common food), then how
 * much, where and until when — everything pre-filled from what the item usually is. "Add & next"
 * keeps the sheet open for unpacking a whole bag.
 */
export function AddStockSheet({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: PickedProduct | null }) {
  const queryClient = useQueryClient();
  const today = localDate();
  const [pick, setPick] = useState<PickedProduct | null>(initial ?? null);
  const [amount, setAmount] = useState<number | null>(null);
  const [unit, setUnit] = useState<Unit>('pcs');
  const [location, setLocation] = useState<Location>('fridge');
  const [expiresOn, setExpiresOn] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [storeId, setStoreId] = useState<string>('none');
  const stores = useQuery({ queryKey: [...foodKeys.all, 'stores'], queryFn: foodApi.stores, enabled: open });

  const choose = (next: PickedProduct | null) => {
    setPick(next);
    if (!next) return;
    setUnit(next.unit === 'pcs' ? 'pcs' : next.unit);
    setAmount(next.unit === 'pcs' ? 1 : null);
    setLocation(next.location);
    setExpiresOn(next.shelfLifeDays ? addDays(today, next.shelfLifeDays) : null);
    setPrice('');
  };

  // Each opening starts afresh, from what it was opened with.
  const [opened, setOpened] = useState<{ open: boolean; initial: PickedProduct | null | undefined }>({ open, initial });
  if (opened.open !== open || opened.initial !== initial) {
    setOpened({ open, initial });
    if (open) choose(initial ?? null);
  }

  const save = useMutation({
    mutationFn: () =>
      foodApi.addStock({
        ...(pick!.productId ? { productId: pick!.productId } : { name: pick!.name }),
        quantity: amount!,
        unit,
        location,
        expiresOn,
        price: parseAmount(price),
        storeId: storeId === 'none' ? null : storeId,
      }),
  });

  const [next, setNext] = useState(false);
  const submit = (another: boolean) => {
    if (!pick || !amount) return;
    setNext(another);
    save.mutate(undefined, {
      onSuccess: ({ product, lot }) => {
        haptic('success');
        void queryClient.invalidateQueries({ queryKey: foodKeys.all });
        toast.success(`${product.name} added`, {
          description: `${formatAmount(amount, unit)} · ${location === 'fridge' ? 'in the fridge' : location === 'freezer' ? 'in the freezer' : location === 'pantry' ? 'in the pantry' : 'put away'}`,
          action: {
            label: 'Undo',
            onClick: () =>
              void foodApi.removeLot(lot.id).then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
          },
        });
        if (another) choose(null);
        else onClose();
      },
    });
  };

  const fields = fieldErrors(save.error);
  const measured = pick ? { unit: pick.unit, pieceSize: pick.pieceSize, pieceUnit: pick.pieceUnit } : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pick ? 'How much?' : 'Add to kitchen'}
      description={pick ? undefined : 'Search, or tap something common.'}
      footer={
        pick ? (
          <div className="flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button fullWidth onClick={() => submit(false)} loading={save.isPending && !next} disabled={!amount || (save.isPending && next)}>
              Add to kitchen
            </Button>
            <Button fullWidth variant="tint" onClick={() => submit(true)} loading={save.isPending && next} disabled={!amount || (save.isPending && !next)}>
              Add & next
            </Button>
          </div>
        ) : null
      }
    >
      {!pick ? (
        <ProductPicker onPick={choose} autoFocus />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-[1.25rem] bg-butter-100 p-2.5 pr-3">
            <FoodIconTile name={pick.icon} tone="bg-white" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.0625rem] font-bold">{pick.name}</p>
              <p className="text-sm text-butter-800">{pick.productId ? 'In your kitchen’s list' : pick.isNew ? 'New item' : 'From the food list'}</p>
            </div>
            {initial ? null : (
              <Button size="sm" variant="ghost" onClick={() => choose(null)}>
                Change
              </Button>
            )}
          </div>

          {pick.isNew ? (
            <div className="flex flex-col gap-2">
              <span className="text-[0.8125rem] font-semibold text-ink-700">Counted in</span>
              <Chips
                label="Counted in"
                tone="sheet"
                value={pick.unit}
                options={COUNTED}
                onChange={(value: BaseUnit) => {
                  setPick({ ...pick, unit: value });
                  setUnit(value);
                  setAmount(value === 'pcs' ? 1 : null);
                }}
              />
            </div>
          ) : null}

          <QuantityInput
            label="Amount"
            value={amount}
            unit={unit}
            units={measured ? unitsFor(measured) : ['pcs']}
            onChange={(value, nextUnit) => {
              setAmount(value);
              setUnit(nextUnit);
            }}
            error={fields.quantity ?? fields.unit}
            autoFocus={pick.unit !== 'pcs'}
          />
          <LocationPicker value={location} onChange={setLocation} />
          <ExpiryPicker value={expiresOn} onChange={setExpiresOn} today={today} />

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3">
            <TextField label="Paid (lei)" inputMode="decimal" placeholder="Optional" value={price} onChange={(event) => setPrice(event.target.value)} />
            {stores.data?.length ? (
              <label className="flex min-w-0 flex-col gap-2">
                <span className="text-[0.8125rem] font-semibold text-ink-700">Bought at</span>
                <select
                  value={storeId}
                  onChange={(event) => setStoreId(event.target.value)}
                  className="h-14 w-full rounded-[1.125rem] bg-ink-50 px-4 text-base text-ink-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                >
                  <option value="none">Not saying</option>
                  {stores.data.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {save.error && !fields.quantity && !fields.unit ? <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p> : null}
        </div>
      )}
    </Sheet>
  );
}
