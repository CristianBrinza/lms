import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { useCatalog } from '../catalog';
import { QuantityInput } from '../components/QuantityInput';
import { VariantChips } from '../components/VariantChips';
import { StoreChips } from './MoveSheet';
import { formatAmount, money, parseAmount, storeText, unitsFor } from '../format';
import type { ShoppingItem, Store } from '../types';
import { lineTitle } from './names';
import { shoppingT } from './shopping.i18n';

/** One line on a list: at least how much, which kind, by when, which store, a note, what it cost; or take it off. */
export function LineSheet({
  line,
  stores,
  onClose,
}: {
  line: ShoppingItem | null;
  stores: Store[];
  onClose: () => void;
}) {
  const t = shoppingT().line;
  const catalog = useCatalog();
  const product = line ? catalog.data?.find((p) => p.id === line.productId) : undefined;
  return (
    <Sheet
      open={Boolean(line)}
      onClose={onClose}
      title={line ? lineTitle(line, product) : t.fallback}
    >
      {line ? <LineForm key={line.id} line={line} stores={stores} onClose={onClose} /> : null}
    </Sheet>
  );
}

function LineForm({
  line,
  stores,
  onClose,
}: {
  line: ShoppingItem;
  stores: Store[];
  onClose: () => void;
}) {
  const s = shoppingT();
  const t = s.line;
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const product = catalog.data?.find((p) => p.id === line.productId);
  const measured = product ?? { unit: 'pcs' as const, pieceSize: null, pieceUnit: null };
  const [amount, setAmount] = useState<number | null>(line.amount);
  const [unit, setUnit] = useState<string>(line.unit ?? measured.unit);
  const [storeId, setStoreId] = useState<string | null>(line.storeId);
  const [note, setNote] = useState(line.note);
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const [variant, setVariant] = useState(line.variant);
  const [priority, setPriority] = useState(line.priority);
  const [needBy, setNeedBy] = useState(line.needBy ?? '');

  const save = useMutation({
    mutationFn: () =>
      foodApi.updateLine(line.id, {
        amount,
        unit: amount ? unit : null,
        storeId,
        note: note.trim(),
        price: parseAmount(price),
        variant,
        priority,
        needBy: needBy || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => foodApi.removeLine(line.id),
    onSuccess: () => {
      toast.success(t.offList(lineTitle(line, product)));
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);

  return (
    <div className="flex flex-col gap-5">
      <QuantityInput
        label={t.atLeast}
        value={amount}
        unit={unit}
        units={unitsFor(measured)}
        onChange={(value, next) => {
          setAmount(value);
          setUnit(next);
        }}
        error={fields.amount ?? fields.unit}
      />
      {line.lastPrice ? (
        <p className="-mt-2 text-sm text-ink-600">
          {t.lastTime(
            money(line.lastPrice.price),
            storeText(line.lastPrice.storeName, line.lastPrice.storeTranslations) || null,
          )}
          {line.estimate !== null && amount
            ? ` · ${t.aboutFor(money(line.estimate), formatAmount(amount, unit))}`
            : ''}
        </p>
      ) : null}
      <StoreChips stores={stores} value={storeId} onChange={setStoreId} />
      {product?.variants.length || line.variant ? (
        <VariantChips
          variants={product?.variants ?? []}
          icons={product?.variantIcons}
          translations={product?.translations}
          value={variant}
          onChange={setVariant}
        />
      ) : null}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.neededBy}</span>
          <input
            type="date"
            value={needBy}
            onChange={(event) => setNeedBy(event.target.value)}
            className="h-12 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
          />
        </label>
        <Switch checked={priority} onChange={setPriority} label={s.important} />
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <TextField
          label={t.note}
          placeholder={t.notePlaceholder}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
        />
        <TextField
          label={t.price}
          inputMode="decimal"
          placeholder="—"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </div>
      {save.error && !fields.amount && !fields.unit ? (
        <p className="text-sm text-danger-600">{errorMessage(save.error)}</p>
      ) : null}
      <div className="flex gap-2.5">
        <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
          {t.save}
        </Button>
        <Button
          variant="tint"
          icon={DeleteIcon}
          onClick={() => remove.mutate()}
          loading={remove.isPending}
        >
          {t.remove}
        </Button>
      </div>
    </div>
  );
}
