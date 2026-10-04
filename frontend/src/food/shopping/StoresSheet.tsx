import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, CheckIcon, DeleteIcon, EditIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import type { Store, StoreTone } from '../types';
import { STORE_TONE, STORE_TONES, SUGGESTED_STORES } from './tones';

/** The kitchen's stores: add one (Moldovan shops suggested), rename it, recolour it, remove it. */
export function StoresSheet({
  open,
  onClose,
  stores,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  stores: Store[];
  onCreated?: (store: Store) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [tone, setTone] = useState<StoreTone>('butter');
  const [editing, setEditing] = useState<Store | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });

  const create = useMutation({
    mutationFn: (body: { name: string; tone: StoreTone }) => foodApi.createStore(body),
    onSuccess: (store) => {
      toast.success(`${store.name} added`);
      setName('');
      void refresh();
      onCreated?.(store);
    },
  });
  const update = useMutation({
    mutationFn: (store: Store) =>
      foodApi.updateStore(store.id, { name: store.name, tone: store.tone }),
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (store: Store) => foodApi.deleteStore(store.id),
    onSuccess: (_void, store) => {
      toast.success(`${store.name} removed`, { description: 'Its list moved to “Any store”.' });
      setEditing(null);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const suggestions = SUGGESTED_STORES.filter(
    (s) => !stores.some((mine) => mine.name.toLowerCase() === s.name.toLowerCase()),
  );
  const fields = fieldErrors(create.error);

  return (
    <Sheet open={open} onClose={onClose} title="Stores" description="Each store has its own list.">
      <div className="flex flex-col gap-5">
        {stores.length ? (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-3xl ring-1 ring-inset ring-ink-100">
            {stores.map((store) =>
              editing?.id === store.id ? (
                <li key={store.id} className="flex flex-col gap-3 bg-ink-50 p-3.5">
                  <TextField
                    label="Name"
                    hideLabel
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    autoFocus
                    surface="raised"
                  />
                  <ToneRow
                    value={editing.tone}
                    onChange={(value) => setEditing({ ...editing, tone: value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      icon={CheckIcon}
                      onClick={() => update.mutate(editing)}
                      loading={update.isPending}
                      disabled={!editing.name.trim()}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={DeleteIcon}
                      className="ml-auto text-danger-600"
                      onClick={() => remove.mutate(store)}
                      loading={remove.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={store.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    aria-hidden="true"
                    className={cx(
                      'size-3.5 rounded-full ring-2 ring-white',
                      STORE_TONE[store.tone].dot,
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.9375rem] font-semibold">
                      {store.name}
                    </span>
                    <span className="block text-sm text-ink-600">
                      {store.open ? `${store.open} to buy` : 'List is empty'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(store)}
                    aria-label={`Edit ${store.name}`}
                    className="press grid size-10 place-items-center rounded-full text-[1.2rem] text-ink-600 hover:bg-ink-50"
                  >
                    <EditIcon fontSize="inherit" />
                  </button>
                </li>
              ),
            )}
          </ul>
        ) : null}

        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) create.mutate({ name: name.trim(), tone });
          }}
        >
          <TextField
            label="Add a store"
            placeholder="Linella, Metro…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fields.name}
            maxLength={40}
          />
          <ToneRow value={tone} onChange={setTone} />
          <Button
            type="submit"
            icon={AddIcon}
            variant="primary"
            size="md"
            loading={create.isPending}
            disabled={!name.trim()}
          >
            Add store
          </Button>
        </form>

        {suggestions.length ? (
          <div>
            <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">Quick add</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => create.mutate(s)}
                  className="press inline-flex h-10 items-center gap-2 rounded-pill bg-ink-50 px-3.5 text-sm font-semibold hover:bg-ink-100"
                >
                  <span
                    aria-hidden="true"
                    className={cx('size-2.5 rounded-full', STORE_TONE[s.tone].dot)}
                  />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function ToneRow({ value, onChange }: { value: StoreTone; onChange: (tone: StoreTone) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex gap-2">
      {STORE_TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          role="radio"
          aria-checked={value === tone}
          aria-label={STORE_TONE[tone].label}
          onClick={() => onChange(tone)}
          className={cx(
            'press size-9 rounded-full ring-offset-2 transition-shadow',
            STORE_TONE[tone].dot,
            value === tone ? 'ring-2 ring-ink-900' : 'ring-1 ring-ink-200',
          )}
        />
      ))}
    </div>
  );
}
