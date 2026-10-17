import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodKeys, kitchenwareApi } from '../api';
import { useKitchenwareT } from './i18n';
import { duration } from './status';
import { Stepper } from './Stepper';

const QUICK = [60, 120, 180, 240];

/** How long the kitchen's dishwasher runs: "Start dishwasher" makes things clean after this. */
export function DishwasherSheet({
  open,
  minutes,
  onClose,
}: {
  open: boolean;
  minutes: number;
  onClose: () => void;
}) {
  const t = useKitchenwareT();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(minutes);
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) setValue(minutes);
  }

  const save = useMutation({
    mutationFn: () => kitchenwareApi.setDishwasher(value),
    onSuccess: () => {
      toast.success(t.runs(duration(value)));
      void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.dishwasher}
      description={t.dishwasherText}
      footer={
        <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
          {t.save}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Stepper
          label={t.runTakes}
          value={value}
          onChange={setValue}
          min={10}
          max={600}
          step={15}
          format={duration}
        />
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK.map((quick) => (
            <button
              key={quick}
              type="button"
              aria-pressed={value === quick}
              onClick={() => setValue(quick)}
              className={cx(
                'press h-11 rounded-pill text-sm font-semibold',
                value === quick
                  ? 'bg-butter-300 text-ink-900'
                  : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
              )}
            >
              {duration(quick)}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
