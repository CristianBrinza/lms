import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Sheet, toast } from '@/components/ui';
import { formatList, tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { useCatalog } from '../catalog';
import { formatAmount, formatQty, money, parseAmount } from '../format';
import { FoodIcon } from '../icons/FoodIcon';
import type { Product, ShoppingItem, Store } from '../types';
import { lineTitle } from './names';
import { shoppingT } from './shopping.i18n';

/** "2 × 300 g · " for a line whose packages were recorded in the shop. */
function gotText(line: ShoppingItem, products: Product[] | undefined): string | null {
  const product = products?.find((p) => p.id === line.productId);
  if (!line.bought?.length || !product) return null;
  return `${line.bought.map((pack) => `${pack.count} × ${formatQty(pack.size, product)}`).join(' + ')} · `;
}

/**
 * Finishing a shop: the cart's lines with what each cost (filled from what was typed in the shop)
 * and whether it goes into the kitchen. Saving records the shop with its total and stocks the
 * kitchen; anything not ticked stays on the list for next time.
 */
export function CheckoutSheet({
  store,
  cart,
  open,
  onClose,
}: {
  store: Store | null;
  cart: ShoppingItem[];
  open: boolean;
  onClose: () => void;
}) {
  const t = shoppingT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={store ? t.finishAt(tr(store, 'name')) : t.finish}
      description={t.checkout.hint}
      size="lg"
    >
      {open ? (
        <CheckoutForm
          key={cart.map((l) => l.id).join()}
          store={store}
          cart={cart}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function CheckoutForm({
  store,
  cart,
  onClose,
}: {
  store: Store | null;
  cart: ShoppingItem[];
  onClose: () => void;
}) {
  const s = shoppingT();
  const t = s.checkout;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      cart.map((line) => [
        line.id,
        line.price !== null ? String(line.price) : line.estimate !== null ? '' : '',
      ]),
    ),
  );
  const [stock, setStock] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cart.map((line) => [line.id, line.category !== 'household'])),
  );
  // Less than needed was bought: the rest stays on the list unless told otherwise.
  const short = (line: ShoppingItem) =>
    line.need !== null && line.boughtTotal !== null && line.boughtTotal + 1e-6 < line.need;
  const [keepRest, setKeepRest] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(cart.filter(short).map((line) => [line.id, true])),
  );
  const catalog = useCatalog();
  const total = cart.reduce((sum, line) => sum + (parseAmount(prices[line.id] ?? '') ?? 0), 0);
  const estimated = cart.reduce(
    (sum, line) => sum + (parseAmount(prices[line.id] ?? '') === null ? (line.estimate ?? 0) : 0),
    0,
  );

  const finish = useMutation({
    mutationFn: () =>
      foodApi.checkout({
        storeId: store?.id ?? null,
        lines: cart.map((line) => ({
          id: line.id,
          price: parseAmount(prices[line.id] ?? ''),
          addToKitchen: stock[line.id] ?? true,
          ...(short(line) ? { keepRest: keepRest[line.id] ?? true } : {}),
        })),
      }),
    onSuccess: ({ trip, stocked, leftOver, notStockedItems, leftOverItems }) => {
      haptic('success');
      const names = (lines: Array<{ name: string; translations?: Translations }>) =>
        formatList(lines.map((line) => tr(line, 'name')));
      const left = leftOverItems ? names(leftOverItems) : formatList(leftOver);
      // Lines kept out of the kitchen on purpose aren't news; the ones it couldn't count are.
      const skipped = new Set(cart.filter((line) => stock[line.id] === false).map((l) => l.name));
      const uncounted = (notStockedItems ?? []).filter((line) => !skipped.has(line.name));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(`${t.saved}${trip.total !== null ? ` · ${money(trip.total)}` : ''}`, {
        description:
          [
            stocked ? t.inKitchen(stocked) : null,
            left ? t.stillToBuy(left) : null,
            uncounted.length ? t.notCounted(names(uncounted)) : null,
          ]
            .filter(Boolean)
            .join('. ') || undefined,
        action: stocked
          ? { label: t.kitchen, onClick: () => navigate('/food/kitchen') }
          : undefined,
      });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {cart.map((line) => {
          const name = lineTitle(
            line,
            catalog.data?.find((p) => p.id === line.productId),
          );
          return (
            <li key={line.id} className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
                <FoodIcon name={line.icon} className="size-8" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">{name}</span>
                <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-600">
                  <input
                    type="checkbox"
                    checked={stock[line.id] ?? true}
                    onChange={(event) =>
                      setStock((current) => ({ ...current, [line.id]: event.target.checked }))
                    }
                    className="size-4 accent-ink-900"
                  />
                  {gotText(line, catalog.data) ??
                    (line.amount && line.unit ? `${formatAmount(line.amount, line.unit)} · ` : '')}
                  {t.intoKitchen}
                </label>
                {short(line) ? (
                  <label className="mt-0.5 flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-peach-800">
                    <input
                      type="checkbox"
                      checked={keepRest[line.id] ?? true}
                      onChange={(event) =>
                        setKeepRest((current) => ({ ...current, [line.id]: event.target.checked }))
                      }
                      className="size-4 accent-ink-900"
                    />
                    {t.keepRest}
                  </label>
                ) : null}
              </span>
              <label className="flex w-28 shrink-0 items-center rounded-xl bg-white px-3 shadow-xs focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
                <span className="sr-only">{s.priceOf(name)}</span>
                <input
                  inputMode="decimal"
                  value={prices[line.id] ?? ''}
                  placeholder={line.estimate !== null ? `~${Math.round(line.estimate)}` : '—'}
                  onChange={(event) =>
                    setPrices((current) => ({ ...current, [line.id]: event.target.value }))
                  }
                  className="tabular h-11 w-full min-w-0 bg-transparent text-right text-base font-semibold outline-none placeholder:font-medium placeholder:text-ink-400"
                />
                <span className="ml-1 text-sm text-ink-500">lei</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-baseline justify-between rounded-2xl bg-butter-100 px-4 py-3">
        <span className="text-[0.9375rem] font-semibold">{s.total}</span>
        <span className="tabular text-h2 font-bold">
          {money(Math.round(total * 100) / 100)}
          {estimated > 0 ? (
            <span className={cx('ml-2 text-sm font-medium text-butter-800')}>
              + ~{money(Math.round(estimated))}
            </span>
          ) : null}
        </span>
      </div>
      <Button fullWidth onClick={() => finish.mutate()} loading={finish.isPending}>
        {t.save}
      </Button>
    </div>
  );
}
