import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Switch, toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { useCatalog } from '../catalog';
import { formatAmount, fromBase, localDate, naturalUnit, unitsFor } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { IngredientLine } from '../types';
import { QuantityInput } from './QuantityInput';

/**
 * "Missing" tapped on a recipe or a planned meal: put it on a list, with how much is missing, at
 * which store, and by when (the day before the meal, so it's in the kitchen in time).
 */
export function AddToListSheet({ line, needBy, onClose }: { line: IngredientLine | null; needBy?: string | null; onClose: () => void }) {
  return (
    <Sheet open={Boolean(line)} onClose={onClose} title="Add to the list">
      {line ? <Form key={line.id} line={line} needBy={needBy ?? null} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Form({ line, needBy, onClose }: { line: IngredientLine; needBy: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const stores = useQuery({ queryKey: [...foodKeys.all, 'stores'], queryFn: foodApi.stores });
  const product = catalog.data?.find((p) => p.id === line.productId);
  const measured = product ?? (line.baseUnit ? { unit: line.baseUnit, pieceSize: null, pieceUnit: null } : null);
  const startUnit = measured ? naturalUnit(line.missing, measured) : (line.unit ?? 'pcs');
  const [amount, setAmount] = useState<number | null>(line.missing && measured ? fromBase(line.missing, startUnit, measured) : (line.amount ?? null));
  const [unit, setUnit] = useState<string>(startUnit);
  const [storeId, setStoreId] = useState<string>(product?.storeId ?? 'any');
  // Bought the day before it's eaten.
  const [by, setBy] = useState(needBy ?? '');
  const [priority, setPriority] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      foodApi.addLines(
        [
          {
            productId: line.productId!,
            amount,
            unit: amount ? unit : null,
            storeId: storeId === 'any' ? null : storeId,
            ...(line.variant ? { variant: line.variant } : {}),
            needBy: by || null,
            priority,
          },
        ],
        'recipe',
      ),
    onSuccess: () => {
      haptic('success');
      toast.success(`${line.name} is on the list`, { description: amount ? `at least ${formatAmount(amount, unit)}` : undefined });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-peach-100 p-2.5">
        <FoodIconTile name={line.icon} tone="bg-white" />
        <span className="min-w-0">
          <span className="block truncate text-[1.0625rem] font-bold">
            {line.name}
            {line.variant ? ` · ${line.variant}` : ''}
          </span>
          <span className="block text-sm text-peach-800">{line.reservedFor ? `What there is is kept for ${line.reservedFor.title}` : 'Not enough in the kitchen'}</span>
        </span>
      </div>
      <QuantityInput
        label="At least"
        value={amount}
        unit={unit}
        units={measured ? unitsFor(measured) : [unit]}
        onChange={(value, next) => {
          setAmount(value);
          setUnit(next);
        }}
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">Store</span>
          <select
            value={storeId}
            onChange={(event) => setStoreId(event.target.value)}
            className="h-12 w-full rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          >
            <option value="any">Any store</option>
            {(stores.data ?? []).map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">Needed by</span>
          <input
            type="date"
            value={by}
            min={localDate()}
            onChange={(event) => setBy(event.target.value)}
            className="h-12 w-full rounded-[1.125rem] bg-ink-50 px-3 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          />
        </label>
      </div>
      <Switch checked={priority} onChange={setPriority} label="Important" hint="Shown first on the list" />
      <Button fullWidth onClick={() => add.mutate()} loading={add.isPending}>
        Add to the list
      </Button>
    </div>
  );
}
