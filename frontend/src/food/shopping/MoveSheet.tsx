import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, toast } from '@/components/ui';
import { ChevronRightIcon } from '@/components/ui/icons';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import type { ShoppingItem, Store } from '../types';
import { shoppingT } from './shopping.i18n';
import { STORE_TONE } from './tones';

/** A store to pick: one chip each, "Any store" first. The line sheet's store field. */
export function StoreChips({
  stores,
  value,
  onChange,
}: {
  stores: Store[];
  value: string | null;
  onChange: (storeId: string | null) => void;
}) {
  const t = shoppingT();
  const options: Array<{ id: string | null; name: string; dot?: string }> = [
    { id: null, name: t.anyStore },
    ...stores.map((s) => ({ id: s.id, name: tr(s, 'name'), dot: STORE_TONE[s.tone].dot })),
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{t.store}</span>
      <div className="-mx-1 flex flex-wrap gap-1.5 px-1">
        {options.map((option) => {
          const on = option.id === value;
          return (
            <button
              key={option.id ?? 'any'}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(option.id)}
              className={cx(
                'press inline-flex h-9 shrink-0 items-center gap-2 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {option.dot ? (
                <span
                  aria-hidden="true"
                  className={cx('size-2.5 rounded-full ring-2 ring-white/60', option.dot)}
                />
              ) : null}
              {option.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The rest of one store's list to another store (Metro didn't have them: off to Linella).
 * One tap moves them; the toast can move them back.
 */
export function MoveSheet({
  from,
  lines,
  stores,
  onClose,
}: {
  /** The store they're on now (null: "any store"); undefined while closed. */
  from: string | null | undefined;
  lines: ShoppingItem[];
  stores: Store[];
  onClose: () => void;
}) {
  const s = shoppingT();
  const t = s.moveSheet;
  const queryClient = useQueryClient();
  const open = from !== undefined;
  const nameOf = (id: string) => {
    const store = stores.find((candidate) => candidate.id === id);
    return store ? tr(store, 'name') : null;
  };
  const fromName = from ? (nameOf(from) ?? t.thisStore) : s.anyStore;
  const move = useMutation({
    mutationFn: (to: string | null) =>
      foodApi.moveLines(
        lines.map((l) => l.id),
        to,
      ),
    onSuccess: ({ moved }, to) => {
      haptic('tap');
      const toName = to ? (nameOf(to) ?? t.otherStore) : s.anyStore;
      const ids = lines.map((l) => l.id);
      toast.success(t.moved(moved, toName), {
        action: {
          label: t.undo,
          onClick: () =>
            void foodApi
              .moveLines(ids, from ?? null)
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.shopping }))
              .catch((error) => toast.error(errorMessage(error))),
        },
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.shopping });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const targets: Array<{ id: string | null; name: string; dot?: string }> = [
    ...stores.map((store) => ({
      id: store.id,
      name: tr(store, 'name'),
      dot: STORE_TONE[store.tone].dot,
    })),
    { id: null, name: s.anyStore },
  ].filter((target) => target.id !== (from ?? null));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.title(lines.length)}
      description={t.hint(fromName)}
    >
      <ul className="-mx-2 flex flex-col">
        {targets.map((target) => (
          <li key={target.id ?? 'any'}>
            <button
              type="button"
              disabled={move.isPending}
              onClick={() => move.mutate(target.id)}
              className="press flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-ink-50 disabled:opacity-60"
            >
              <span
                aria-hidden="true"
                className={cx(
                  'size-3 shrink-0 rounded-full',
                  target.dot ?? 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
                )}
              />
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
                {target.name}
              </span>
              <ChevronRightIcon fontSize="inherit" className="text-[1.3rem] text-ink-400" />
            </button>
          </li>
        ))}
      </ul>
      {targets.length ? null : <p className="text-sm text-ink-600">{t.addStoreFirst}</p>}
    </Sheet>
  );
}
