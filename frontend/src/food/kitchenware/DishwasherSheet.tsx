import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { foodKeys, kitchenwareApi } from '../api';
import { duration } from './status';
import { Stepper } from './Stepper';

const QUICK = [60, 120, 180, 240];

/** How long the kitchen's dishwasher runs: "Start dishwasher" makes things clean after this. */
export function DishwasherSheet({ open, minutes, onClose }: { open: boolean; minutes: number; onClose: () => void }) {
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
      toast.success(`Dishwasher runs ${duration(value)}`);
      void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Dishwasher"
      description="How long a run takes, until things are clean and back."
      footer={
        <Button fullWidth onClick={() => save.mutate()} loading={save.isPending}>
          Save
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Stepper label="A run takes" value={value} onChange={setValue} min={10} max={600} step={15} format={duration} />
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK.map((quick) => (
            <button
              key={quick}
              type="button"
              aria-pressed={value === quick}
              onClick={() => setValue(quick)}
              className={cx(
                'press h-11 rounded-pill text-sm font-semibold',
                value === quick ? 'bg-butter-300 text-ink-900' : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
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
