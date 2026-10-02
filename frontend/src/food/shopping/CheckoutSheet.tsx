import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { formatAmount, money, parseAmount } from '../format';
import { FoodIcon } from '../icons/FoodIcon';
import type { ShoppingItem, Store } from '../types';

/**
 * Finishing a shop: the cart's lines with what each cost (filled from what was typed in the shop)
 * and whether it goes into the kitchen. Saving records the shop with its total and stocks the
 * kitchen; anything not ticked stays on the list for next time.
 */
export function CheckoutSheet({ store, cart, open, onClose }: { store: Store | null; cart: ShoppingItem[]; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={store ? `Finish at ${store.name}` : 'Finish the shop'} description="Check prices, then everything ticked goes into the kitchen." size="lg">
      {open ? <CheckoutForm key={cart.map((l) => l.id).join()} store={store} cart={cart} onClose={onClose} /> : null}
    </Sheet>
  );
}

function CheckoutForm({ store, cart, onClose }: { store: Store | null; cart: ShoppingItem[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(cart.map((line) => [line.id, line.price !== null ? String(line.price) : line.estimate !== null ? '' : ''])),
  );
  const [stock, setStock] = useState<Record<string, boolean>>(() => Object.fromEntries(cart.map((line) => [line.id, line.category !== 'household'])));
  const total = cart.reduce((sum, line) => sum + (parseAmount(prices[line.id] ?? '') ?? 0), 0);
  const estimated = cart.reduce((sum, line) => sum + (parseAmount(prices[line.id] ?? '') === null ? (line.estimate ?? 0) : 0), 0);

  const finish = useMutation({
    mutationFn: () =>
      foodApi.checkout({
        storeId: store?.id ?? null,
        lines: cart.map((line) => ({ id: line.id, price: parseAmount(prices[line.id] ?? ''), addToKitchen: stock[line.id] ?? true })),
      }),
    onSuccess: ({ trip, stocked }) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(`Shop saved${trip.total !== null ? ` · ${money(trip.total)}` : ''}`, {
        description: stocked ? `${stocked} ${stocked === 1 ? 'item is' : 'items are'} in your kitchen` : undefined,
        action: stocked ? { label: 'Kitchen', onClick: () => navigate('/food/kitchen') } : undefined,
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {cart.map((line) => (
          <li key={line.id} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
              <FoodIcon name={line.icon} className="size-8" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-semibold">{line.name}</span>
              <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-600">
                <input
                  type="checkbox"
                  checked={stock[line.id] ?? true}
                  onChange={(event) => setStock((current) => ({ ...current, [line.id]: event.target.checked }))}
                  className="size-4 accent-ink-900"
                />
                {line.amount && line.unit ? `${formatAmount(line.amount, line.unit)} · ` : ''}into the kitchen
              </label>
            </span>
            <label className="flex w-28 shrink-0 items-center rounded-xl bg-white px-3 shadow-xs focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
              <span className="sr-only">Price of {line.name} in lei</span>
              <input
                inputMode="decimal"
                value={prices[line.id] ?? ''}
                placeholder={line.estimate !== null ? `~${Math.round(line.estimate)}` : '—'}
                onChange={(event) => setPrices((current) => ({ ...current, [line.id]: event.target.value }))}
                className="tabular h-11 w-full min-w-0 bg-transparent text-right text-base font-semibold outline-none placeholder:font-medium placeholder:text-ink-400"
              />
              <span className="ml-1 text-sm text-ink-500">lei</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between rounded-2xl bg-butter-100 px-4 py-3">
        <span className="text-[0.9375rem] font-semibold">Total</span>
        <span className="tabular text-h2 font-bold">
          {money(Math.round(total * 100) / 100)}
          {estimated > 0 ? <span className={cx('ml-2 text-sm font-medium text-butter-800')}>+ ~{money(Math.round(estimated))}</span> : null}
        </span>
      </div>
      <Button fullWidth onClick={() => finish.mutate()} loading={finish.isPending}>
        Save the shop
      </Button>
    </div>
  );
}
