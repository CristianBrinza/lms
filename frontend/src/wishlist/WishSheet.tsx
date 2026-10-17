import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Chips, Sheet, Switch, TextField, toast } from '@/components/ui';
import { CheckIcon, DeleteIcon, ReplayIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import {
  URGENCIES,
  wishlistApi,
  wishlistKeys,
  type Urgency,
  type Wish,
  type WishInput,
  type WishPatch,
} from './api';
import { useWishlistT } from './i18n';

const CURRENCIES = ['MDL', 'EUR', 'USD'] as const;

/** Adds something to the list, or edits it (and marks it bought, drops it, deletes it). */
export function WishSheet({
  open,
  onClose,
  wish,
  categories,
  currency,
  initialName,
}: {
  open: boolean;
  onClose: () => void;
  wish?: Wish | null;
  categories: string[];
  currency: string;
  initialName?: string;
}) {
  const t = useWishlistT();
  return (
    <Sheet open={open} onClose={onClose} title={wish ? t.editTitle : t.newTitle}>
      {open ? (
        <Form
          key={wish?.id ?? 'new'}
          wish={wish ?? null}
          categories={categories}
          currency={currency}
          initialName={initialName}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

const fieldClass =
  'w-full rounded-2xl bg-ink-50 px-4 py-3 text-[0.9375rem] outline-none focus:bg-white focus:ring-2 focus:ring-ink-900';

function Form({
  wish,
  categories,
  currency: kitchenCurrency,
  initialName,
  onDone,
}: {
  wish: Wish | null;
  categories: string[];
  currency: string;
  initialName?: string;
  onDone: () => void;
}) {
  const t = useWishlistT();
  const client = useQueryClient();
  const [name, setName] = useState(wish?.name ?? initialName ?? '');
  const [price, setPrice] = useState(wish && wish.price !== null ? String(wish.price) : '');
  const [currency, setCurrency] = useState(wish?.currency ?? kitchenCurrency);
  const [url, setUrl] = useState(wish?.url ?? '');
  const [category, setCategory] = useState(wish?.category ?? '');
  const [urgency, setUrgency] = useState<Urgency>(wish?.urgency ?? 'soon');
  const [note, setNote] = useState(wish?.note ?? '');
  const [shared, setShared] = useState(wish?.shared ?? true);
  const [top, setTop] = useState(false);
  const [paid, setPaid] = useState(wish && wish.price !== null ? String(wish.price) : '');
  const [buying, setBuying] = useState(false);

  const number = (value: string) => {
    const n = Number(value.replace(',', '.').replace(/\s/g, ''));
    return value.trim() && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const refresh = () => client.invalidateQueries({ queryKey: wishlistKeys.all });
  const failed = (error: unknown) => toast.error(t.failed, { description: errorMessage(error) });

  const save = useMutation({
    mutationFn: () => {
      const fields: WishInput = {
        name: name.trim(),
        note: note.trim(),
        url: url.trim(),
        price: number(price),
        currency,
        urgency,
        category: category.trim(),
        ...(wish && !wish.mine ? {} : { shared }),
      };
      return wish ? wishlistApi.update(wish.id, fields) : wishlistApi.add({ ...fields, top });
    },
    onSuccess: onDone,
    onError: failed,
    onSettled: refresh,
  });
  const change = useMutation({
    mutationFn: ({ patch }: { patch: WishPatch; message: string }) =>
      wishlistApi.update(wish!.id, patch),
    onSuccess: (_, { message }) => {
      toast.success(message);
      onDone();
    },
    onError: failed,
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: () => wishlistApi.remove(wish!.id),
    onSuccess: () => {
      toast.success(t.removed(wish!.name));
      onDone();
    },
    onError: failed,
    onSettled: refresh,
  });

  const urlOk = !url.trim() || /^https?:\/\/\S+$/i.test(url.trim());
  const ready = name.trim().length > 0 && urlOk && (price.trim() === '' || number(price) !== null);
  const suggestions = categories.filter((c) => c !== category).slice(0, 8);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) save.mutate();
      }}
    >
      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        value={name}
        maxLength={120}
        autoFocus={!wish}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
        <TextField
          label={t.price}
          inputMode="decimal"
          placeholder="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <div role="radiogroup" aria-label={t.currency} className="flex h-12 gap-1 rounded-2xl bg-ink-50 p-1">
          {CURRENCIES.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={currency === code}
              onClick={() => setCurrency(code)}
              className={cx(
                'press rounded-xl px-2.5 text-xs font-bold transition-colors',
                currency === code ? 'bg-ink-900 text-white' : 'text-ink-600',
              )}
            >
              {code === 'MDL' ? 'lei' : code}
            </button>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.howSoon}</h3>
        <Chips
          label={t.howSoon}
          tone="sheet"
          dense
          value={urgency}
          onChange={setUrgency}
          options={URGENCIES.map((value) => ({ value, label: t.urgencyLong[value] }))}
        />
      </section>

      <div className="flex flex-col gap-2">
        <TextField
          label={t.category}
          placeholder={t.categoryPlaceholder}
          value={category}
          maxLength={40}
          onChange={(e) => setCategory(e.target.value)}
        />
        {suggestions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="press h-8 rounded-pill bg-ink-50 px-3 text-xs font-semibold text-ink-700 hover:bg-ink-100"
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <TextField
        label={t.link}
        type="url"
        inputMode="url"
        placeholder={t.linkPlaceholder}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />

      <label className="flex flex-col gap-2">
        <span className="text-[0.8125rem] font-semibold text-ink-700">{t.note}</span>
        <textarea
          value={note}
          maxLength={2000}
          rows={3}
          placeholder={t.notePlaceholder}
          onChange={(e) => setNote(e.target.value)}
          className={cx(fieldClass, 'resize-y leading-relaxed')}
        />
      </label>

      {!wish ? <Switch checked={top} onChange={setTop} label={t.first} /> : null}
      {!wish || wish.mine ? (
        <Switch checked={shared} onChange={setShared} label={t.shared} hint={t.sharedHint} />
      ) : null}

      <Button type="submit" fullWidth disabled={!ready} loading={save.isPending}>
        {t.save}
      </Button>

      {wish ? (
        <div className="flex flex-col gap-3 border-t border-ink-100 pt-4">
          {wish.status === 'wanted' ? (
            buying ? (
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <TextField
                    label={t.pricePaid}
                    inputMode="decimal"
                    placeholder="0"
                    value={paid}
                    autoFocus
                    onChange={(e) => setPaid(e.target.value)}
                  />
                </div>
                <Button
                  icon={CheckIcon}
                  loading={change.isPending}
                  onClick={() =>
                    change.mutate({
                      patch: { status: 'bought', boughtPrice: number(paid) },
                      message: t.boughtToast(wish.name),
                    })
                  }
                >
                  {t.bought}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="tint" icon={CheckIcon} onClick={() => setBuying(true)}>
                  {t.markBought}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    change.mutate({ patch: { status: 'dropped' }, message: t.dropped_(wish.name) })
                  }
                >
                  {t.drop}
                </Button>
              </div>
            )
          ) : (
            <Button
              variant="tint"
              icon={ReplayIcon}
              className="self-start"
              onClick={() => change.mutate({ patch: { status: 'wanted' }, message: t.backOn })}
            >
              {t.restore}
            </Button>
          )}
          {wish.mine || wish.shared ? (
            <Button
              variant="ghost"
              icon={DeleteIcon}
              className="self-start text-danger-700"
              loading={remove.isPending}
              onClick={() => remove.mutate()}
            >
              {t.remove}
            </Button>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
