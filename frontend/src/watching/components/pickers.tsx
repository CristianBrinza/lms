import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Skeleton, Switch, TextField, toast } from '@/components/ui';
import { AddIcon, CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys } from '../api';
import { useWatchingT } from '../i18n';

/** A 1–10 rating as a row of round numbers; the chosen one and those under it fill. */
export function RatingPicker({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  label: string;
}) {
  const t = useWatchingT();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const on = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={t.title.ratingLabel(n)}
              onClick={() => {
                haptic('tap');
                onChange(value === n ? null : n);
              }}
              className={cx(
                'press tabular grid aspect-square min-w-0 place-items-center rounded-full text-sm font-bold transition-colors',
                on ? 'bg-butter-300 text-ink-900' : 'bg-ink-50 text-ink-500 hover:bg-butter-100',
                value === n && 'ring-2 ring-ink-900 ring-offset-1',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      {value !== null ? (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-sm font-semibold text-ink-600 underline-offset-2 hover:underline"
        >
          {t.title.clearRating}
        </button>
      ) : null}
    </div>
  );
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
