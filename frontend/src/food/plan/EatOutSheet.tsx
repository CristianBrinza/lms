import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import { parseAmount } from '../format';
import type { Meal, OutKind } from '../types';
import { OUT_KINDS, OUT_LABEL } from './out';

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
  return (
    <Sheet
      open={Boolean(meal)}
      onClose={onClose}
      title="Ate elsewhere"
      description="Nothing leaves the kitchen; what this meal kept aside is free again."
    >
      {meal ? <Form key={meal.id} meal={meal} onClose={onClose} onDone={onDone} /> : null}
    </Sheet>
  );
}

function Form({ meal, onClose, onDone }: { meal: Meal; onClose: () => void; onDone?: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<OutKind>(meal.eatenOut?.kind ?? 'restaurant');
  const [place, setPlace] = useState(meal.eatenOut?.place ?? '');
  const [cost, setCost] = useState(
    meal.eatenOut?.cost === null || meal.eatenOut?.cost === undefined
      ? ''
      : String(meal.eatenOut.cost),
  );
  const save = useMutation({
    mutationFn: () =>
      foodApi.eatOut(meal.id, { kind, place: place.trim(), cost: parseAmount(cost) }),
    onSuccess: () => {
      haptic('success');
      toast.success(`${meal.title}: ${OUT_LABEL[kind].toLowerCase()}`, {
        description: 'The food it kept aside is back in the kitchen.',
        action: {
          label: 'Undo',
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
      <div role="radiogroup" aria-label="Where" className="flex flex-wrap gap-1.5">
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
            {OUT_LABEL[value]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3">
        <TextField
          label="Where, or what"
          placeholder="Andy’s Pizza, Ana’s birthday…"
          value={place}
          maxLength={120}
          onChange={(event) => setPlace(event.target.value)}
        />
        <TextField
          label="Cost (lei)"
          inputMode="decimal"
          placeholder="Optional"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
        />
      </div>
      <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
        Save
      </Button>
    </div>
  );
}
