import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Skeleton, Switch, TextField, toast } from '@/components/ui';
import { AddIcon, CheckIcon, StarBorderIcon, StarHalfIcon, StarIcon } from '@/components/ui/icons';
import { getLocale, intlLocale } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys } from '../api';
import { useWatchingT } from '../i18n';

/**
 * A rating as five stars in half steps (stored 1–10: one half star each). The left half of a star
 * gives the half, the right half the whole star; tapping the current value again clears it.
 */
export function RatingPicker({
  value,
  onChange,
  label,
  size = 'md',
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
  size?: 'md' | 'lg';
}) {
  const t = useWatchingT();
  const choose = (n: number) => {
    haptic('tap');
    onChange(value === n ? null : n);
  };
  return (
    <div className="flex flex-col items-start gap-1.5">
      <div role="radiogroup" aria-label={label} className="flex items-center gap-2">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((star) => {
            const full = value !== null && value >= star * 2;
            const half = value !== null && value === star * 2 - 1;
            const Icon = full ? StarIcon : half ? StarHalfIcon : StarBorderIcon;
            return (
              <span
                key={star}
                className={cx(
                  'relative grid place-items-center',
                  size === 'lg' ? 'size-12 text-[2.5rem]' : 'size-10 text-[2rem]',
                  full || half ? 'text-butter-400' : 'text-ink-300',
                )}
              >
                <Icon fontSize="inherit" />
                {[star * 2 - 1, star * 2].map((n, i) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={value === n}
                    aria-label={t.title.ratingLabel(n)}
                    onClick={() => choose(n)}
                    className={cx(
                      'press absolute inset-y-0 w-1/2 focus-visible:outline-2 focus-visible:outline-ink-900',
                      i === 0 ? 'left-0 rounded-l-full' : 'right-0 rounded-r-full',
                    )}
                  />
                ))}
              </span>
            );
          })}
        </div>
        {value !== null ? (
          <span className="tabular text-[1.0625rem] font-bold text-ink-900">{stars(value)}</span>
        ) : null}
      </div>
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-sm font-semibold text-ink-600 underline-offset-2 hover:underline"
        >
          {t.title.clearRating}
        </button>
      ) : null}
    </div>
  );
}

/** 1–10 as stars: 9 → "4.5" (in the reader's own decimal mark). */
export function stars(value: number): string {
  return (value / 2).toLocaleString(intlLocale(getLocale()), { maximumFractionDigits: 1 });
}

/** "Add to a list": the household's lists (mine and shared), a tap adds; a new one in place. */
export function ListPickerSheet({
  open,
  onClose,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
}) {
  const t = useWatchingT();
  const client = useQueryClient();
  const lists = useQuery({
    queryKey: watchingKeys.lists,
    queryFn: watchingApi.lists,
    enabled: open,
  });
  const [name, setName] = useState('');
  const [shared, setShared] = useState(false);
  const add = useMutation({
    mutationFn: async ({ listId }: { listId: string; listName: string }) =>
      watchingApi.addToList(listId, titleId),
    onSuccess: (_, { listName }) => {
      haptic('success');
      toast.success(t.lists.added(listName));
      onClose();
    },
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });
  const create = useMutation({
    mutationFn: async () => {
      const { list } = await watchingApi.createList({ name: name.trim(), shared });
      await watchingApi.addToList(list.id, titleId);
      return list;
    },
    onSuccess: (list) => {
      haptic('success');
      toast.success(t.lists.added(list.name));
      setName('');
      onClose();
    },
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });

  return (
    <Sheet open={open} onClose={onClose} title={t.lists.pick}>
      <div className="flex flex-col gap-4">
        {lists.isPending ? (
          <Skeleton className="h-24 rounded-2xl" />
        ) : lists.data?.lists.length ? (
          <ul className="flex flex-col gap-1.5">
            {lists.data.lists.map((list) => (
              <li key={list.id}>
                <button
                  type="button"
                  disabled={add.isPending}
                  onClick={() => add.mutate({ listId: list.id, listName: list.name })}
                  className="press flex w-full items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-left hover:bg-pink-100"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{list.name}</span>
                    <span className="block text-sm text-ink-600">
                      {t.common.titles(list.count)}
                      {list.shared ? ` · ${t.lists.familyBadge}` : ''}
                    </span>
                  </span>
                  <AddIcon fontSize="inherit" className="text-[1.3rem] text-ink-500" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <form
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-ink-200 p-3.5"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate();
          }}
        >
          <TextField
            label={t.lists.create}
            placeholder={t.lists.namePlaceholder}
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            dense
          />
          <Switch
            checked={shared}
            onChange={setShared}
            label={t.lists.shared}
            hint={t.lists.sharedHint}
          />
          <Button
            type="submit"
            size="md"
            icon={CheckIcon}
            disabled={!name.trim()}
            loading={create.isPending}
          >
            {t.lists.create}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
