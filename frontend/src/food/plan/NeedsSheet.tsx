import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Skeleton, toast } from '@/components/ui';
import { CheckIcon } from '@/components/ui/icons';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { addDays, formatAmount, formatQty, weekStart } from '../format';
import { FoodIconTile } from '../icons/FoodIcon';
import type { NeedLine, Store } from '../types';
import { relativeDayInline, usePlanT } from './i18n';

type Range = 'next3' | 'week' | 'next7';

/**
 * What the planned meals need from the shops: per item, how much, what's already home or listed,
 * and the store it usually comes from. Lines with something to buy are ticked; covered ones stay
 * visible (unticked) so they can be checked at home.
 */
export function NeedsSheet({
  open,
  onClose,
  today,
}: {
  open: boolean;
  onClose: () => void;
  today: string;
}) {
  const t = usePlanT();
  return (
    <Sheet open={open} onClose={onClose} title={t.needsTitle} description={t.needsText} size="lg">
      {open ? <Needs today={today} onClose={onClose} /> : null}
    </Sheet>
  );
}

function Needs({ today, onClose }: { today: string; onClose: () => void }) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<Range>('next3');
  const to =
    range === 'next3'
      ? addDays(today, 2)
      : range === 'week'
        ? addDays(weekStart(today), 6)
        : addDays(today, 6);
  const needs = useQuery({
    queryKey: foodKeys.needs(today, to),
    queryFn: () => foodApi.needs(today, to),
  });
  const stores = useQuery({ queryKey: [...foodKeys.all, 'stores'], queryFn: foodApi.stores });
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [storeFor, setStoreFor] = useState<Record<string, string>>({});
  const lines = needs.data?.lines ?? [];
  const chosen = lines.filter((l) =>
    l.toBuy > 0 ? !unticked.has(l.productId) : unticked.has(l.productId),
  );

  const add = useMutation({
    mutationFn: () =>
      foodApi.addLines(
        chosen.map((l) => {
          const store = storeFor[l.productId] ?? l.storeId ?? 'any';
          return {
            productId: l.productId,
            ...(l.level
              ? {}
              : {
                  amount: l.toBuyAmount || undefined,
                  unit: l.toBuyAmount ? l.toBuyUnit : undefined,
                }),
            storeId: store === 'any' ? null : store,
          };
        }),
        'plan',
      ),
    onSuccess: (added) => {
      haptic('success');
      toast.success(t.itemsOnLists(added.length));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (id: string) =>
    setUnticked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap gap-1.5">
        {(['next3', 'week', 'next7'] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={range === value}
            onClick={() => setRange(value)}
            className={cx(
              'press h-9 rounded-pill px-3.5 text-sm font-semibold',
              range === value ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {t.range[value]}
          </button>
        ))}
      </div>
      {needs.isPending ? (
        <Skeleton className="h-40" />
      ) : !lines.length ? (
        <p className="rounded-2xl bg-mint-100 px-4 py-6 text-center text-sm font-semibold text-mint-800">
          {needs.data?.toCheck.length
            ? t.nothingToBuyCheck
            : t.nothingUntil(relativeDayInline(to, today))}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-ink-100 rounded-[1.25rem] ring-1 ring-inset ring-ink-100">
          {lines.map((line) => (
            <NeedRow
              key={line.productId}
              line={line}
              ticked={chosen.includes(line)}
              onToggle={() => toggle(line.productId)}
              stores={stores.data ?? []}
              store={storeFor[line.productId] ?? line.storeId ?? 'any'}
              onStore={(value) =>
                setStoreFor((current) => ({ ...current, [line.productId]: value }))
              }
            />
          ))}
        </ul>
      )}
      {needs.data?.toCheck.length ? (
        <p className="rounded-2xl bg-butter-100 px-4 py-3 text-sm text-butter-800">
          <span className="font-semibold">{t.checkYouHave}</span>{' '}
          {needs.data.toCheck.map((c) => `${tr(c, 'name')} (${tr(c, 'meal')})`).join(', ')}
        </p>
      ) : null}
      <Button
        fullWidth
        onClick={() => add.mutate()}
        loading={add.isPending}
        disabled={!chosen.length}
      >
        {t.addItems(chosen.length)}
      </Button>
    </div>
  );
}

function NeedRow({
  line,
  ticked,
  onToggle,
  stores,
  store,
  onStore,
}: {
  line: NeedLine;
  ticked: boolean;
  onToggle: () => void;
  stores: Store[];
  store: string;
  onStore: (value: string) => void;
}) {
  const t = usePlanT();
  const measured = { unit: line.unit };
  const detail = line.level
    ? line.level === 'out'
      ? t.levelOut
      : t.runningLow
    : line.toBuy > 0
      ? t.buy(
          formatAmount(line.toBuyAmount, line.toBuyUnit),
          formatQty(line.needed, measured),
          formatQty(line.inStock, measured),
          line.onList ? formatQty(line.onList, measured) : null,
        )
      : t.covered(formatQty(line.needed, measured));
  return (
    <li className="flex items-center gap-2.5 px-2.5 py-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={ticked}
        aria-label={t.toggleLine(ticked, tr(line, 'name'))}
        onClick={onToggle}
        className={cx(
          'press grid size-7 shrink-0 place-items-center rounded-full text-base',
          ticked
            ? 'bg-ink-900 text-white'
            : 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
        )}
      >
        {ticked ? <CheckIcon fontSize="inherit" /> : null}
      </button>
      <FoodIconTile name={line.icon} className="size-9 rounded-xl [&>svg]:size-6" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{tr(line, 'name')}</span>
        <span
          className={cx('block truncate text-xs', line.toBuy > 0 ? 'text-ink-700' : 'text-ink-500')}
        >
          {detail}
        </span>
        <span className="block truncate text-[0.6875rem] text-ink-500">
          {t.forMeals(line.meals.map((m) => tr(m, 'title')).join(', '))}
        </span>
      </span>
      <select
        aria-label={t.storeFor(tr(line, 'name'))}
        value={store}
        onChange={(event) => onStore(event.target.value)}
        className="h-8 w-[6.5rem] shrink-0 rounded-lg bg-ink-50 px-1.5 text-xs font-semibold outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
      >
        <option value="any">{t.anyStore}</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>
            {tr(s, 'name')}
          </option>
        ))}
      </select>
    </li>
  );
}
