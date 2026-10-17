import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, CheckIcon, DeleteIcon, EditIcon } from '@/components/ui/icons';
import { tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import type { Store, StoreTone } from '../types';
import { shoppingT } from './shopping.i18n';
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
  const s = shoppingT();
  const t = s.storesSheet;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [translations, setTranslations] = useState<Translations>({});
  const [tone, setTone] = useState<StoreTone>('butter');
  const [editing, setEditing] = useState<Store | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });

  const create = useMutation({
    mutationFn: (body: { name: string; tone: StoreTone; translations?: Translations }) =>
      foodApi.createStore(body),
    onSuccess: (store) => {
      toast.success(t.added(tr(store, 'name')));
      setName('');
      setTranslations({});
      void refresh();
      onCreated?.(store);
    },
  });
  const update = useMutation({
    mutationFn: (store: Store) =>
      foodApi.updateStore(store.id, {
        name: store.name,
        tone: store.tone,
        translations: store.translations ?? {},
      }),
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (store: Store) => foodApi.deleteStore(store.id),
    onSuccess: (_void, store) => {
      toast.success(t.removed(tr(store, 'name')), { description: t.listMoved });
      setEditing(null);
      void refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const suggestions = SUGGESTED_STORES.filter(
    (suggested) => !stores.some((mine) => mine.name.toLowerCase() === suggested.name.toLowerCase()),
  );
  const fields = fieldErrors(create.error);

  return (
    <Sheet open={open} onClose={onClose} title={s.stores} description={t.hint}>
      <div className="flex flex-col gap-5">
        {stores.length ? (
          <ul className="divide-y divide-ink-100 overflow-hidden rounded-3xl ring-1 ring-inset ring-ink-100">
            {stores.map((store) =>
              editing?.id === store.id ? (
                <li key={store.id} className="flex flex-col gap-3 bg-ink-50 p-3.5">
                  <TextField
                    label={t.name}
                    hideLabel
                    value={editing.name}
                    onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                    autoFocus
                    surface="raised"
                  />
                  <TranslationFields
                    fields={[{ key: 'name', label: t.name, maxLength: 40 }]}
                    value={editing.translations}
                    onChange={(next) => setEditing({ ...editing, translations: next })}
                  />
                  <ToneRow
                    value={editing.tone}
                    onChange={(value) => setEditing({ ...editing, tone: value })}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      icon={CheckIcon}
                      onClick={() => update.mutate(editing)}
                      loading={update.isPending}
                      disabled={!editing.name.trim()}
                    >
                      {t.save}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                      {t.cancel}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={DeleteIcon}
                      className="ml-auto text-danger-600"
                      onClick={() => remove.mutate(store)}
                      loading={remove.isPending}
                    >
                      {t.remove}
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
                      {tr(store, 'name')}
                    </span>
                    <span className="block text-sm text-ink-600">
                      {store.open ? s.toBuy(store.open) : t.listEmpty}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing(store)}
                    aria-label={t.edit(tr(store, 'name'))}
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
            if (name.trim())
              create.mutate({
                name: name.trim(),
                tone,
                ...(Object.keys(translations).length ? { translations } : {}),
              });
          }}
        >
          <TextField
            label={t.addAStore}
            placeholder={t.placeholder}
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fields.name}
            maxLength={40}
          />
          <TranslationFields
            fields={[{ key: 'name', label: t.name, maxLength: 40 }]}
            value={translations}
            onChange={setTranslations}
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
            {t.addStore}
          </Button>
        </form>

        {suggestions.length ? (
          <div>
            <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.quickAdd}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggested) => (
                <button
                  key={suggested.name}
                  type="button"
                  onClick={() => create.mutate(suggested)}
                  className="press inline-flex h-10 items-center gap-2 rounded-pill bg-ink-50 px-3.5 text-sm font-semibold hover:bg-ink-100"
                >
                  <span
                    aria-hidden="true"
                    className={cx('size-2.5 rounded-full', STORE_TONE[suggested.tone].dot)}
                  />
                  {tr(suggested, 'name')}
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
  const t = shoppingT().storesSheet;
  return (
    <div role="radiogroup" aria-label={t.colour} className="flex gap-2">
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
