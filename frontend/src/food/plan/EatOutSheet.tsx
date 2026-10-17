import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { parseAmount } from '../format';
import type { Meal, OutKind } from '../types';
import { TranslationFields } from '@/components/common/TranslationFields';
import { LOCALES, tr, type Translations } from '@/i18n';
import { usePlanT } from './i18n';
import { OUT_KINDS } from './out';

/**
 * No cooking after all: ate at a restaurant, ordered in, went to a party. The meal stays in the
 * history as eaten, nothing leaves the kitchen, and what it had kept aside is free again.
 */
export function EatOutSheet({
  meal,
  onClose,
  onDone,
}: {
  meal: Meal | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const t = usePlanT();
  return (
    <Sheet
      open={Boolean(meal)}
      onClose={onClose}
      title={t.ateElsewhere}
      description={t.ateElsewhereText}
    >
      {meal ? <Form key={meal.id} meal={meal} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function Form({ meal, onClose, onDone }: { meal: Meal; onClose: () => void; onDone?: () => void }) {
  const t = usePlanT();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<OutKind>(meal.eatenOut?.kind ?? 'restaurant');
  const [place, setPlace] = useState(meal.eatenOut?.place ?? '');
  // Only the place's own translations: the meal's title and note keep theirs.
  const [placeTx, setPlaceTx] = useState<Translations>(() =>
    Object.fromEntries(
      LOCALES.flatMap((locale) => {
        const text = meal.translations?.[locale]?.place;
        return typeof text === 'string' && text ? [[locale, { place: text }]] : [];
      }),
    ),
  );
  const [cost, setCost] = useState(
    meal.eatenOut?.cost === null || meal.eatenOut?.cost === undefined
      ? ''
      : String(meal.eatenOut.cost),
  );
  const [kcal, setKcal] = useState(
    meal.eatenOut?.kcal === null || meal.eatenOut?.kcal === undefined
      ? ''
      : String(meal.eatenOut.kcal),
  );
  const kcalEach = parseAmount(kcal);
  const save = useMutation({
    mutationFn: () =>
      foodApi.eatOut(meal.id, {
        kind,
        place: place.trim(),
        ...(Object.keys(placeTx).length ? { translations: placeTx } : {}),
        cost: parseAmount(cost),
        kcal: kcalEach === null ? null : Math.round(kcalEach),
      }),
    onSuccess: () => {
      haptic('success');
      toast.success(t.outToast(tr(meal, 'title'), t.out[kind]), {
        description: t.outToastText,
        action: {
          label: t.undo,
          onClick: () =>
            void foodApi
              .reopenMeal(meal.id)
              .then(() => queryClient.invalidateQueries({ queryKey: foodKeys.all })),
        },
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
      onDone?.();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label={t.where} className="flex flex-wrap gap-1.5">
        {OUT_KINDS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cx(
              'press h-10 rounded-pill px-4 text-sm font-semibold',
              kind === value ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {t.out[value]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <TextField
          label={t.whereOrWhat}
          placeholder={t.placePlaceholder}
          value={place}
          maxLength={120}
          onChange={(event) => setPlace(event.target.value)}
        />
        <TextField
          label={t.costLabel}
          inputMode="decimal"
          placeholder={t.optional}
          value={cost}
          onChange={(event) => setCost(event.target.value)}
        />
      </div>
      {place.trim() ? (
        <TranslationFields
          fields={[{ key: 'place', label: t.whereOrWhat, maxLength: 120 }]}
          value={placeTx}
          onChange={setPlaceTx}
        />
      ) : null}
      <TextField
        label={t.kcalEachLabel}
        inputMode="numeric"
        placeholder={t.optional}
        hint={t.kcalEachHint}
        value={kcal}
        onChange={(event) => setKcal(event.target.value)}
      />
      <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
        {t.save}
      </Button>
    </div>
  );
}
