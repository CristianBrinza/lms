import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, CheckCircleIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { EquipmentIcon } from '../icons/TrainingIcon';
import type { Equipment, EquipmentPreset } from '../types';
import { IconGrid } from './EquipmentSheet';

type EquipmentList = Awaited<ReturnType<typeof trainingApi.equipment>>;

/**
 * Adding equipment: one tap on a common thing (what's already at home is marked and opens it
 * instead), or "Something else" with a name and a picture. Things that come in weights open
 * straight away to say which weights; the rest keep the sheet open for the next one.
 */
export function AddEquipmentSheet({
  open,
  onClose,
  owned,
  presets,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  owned: Equipment[];
  presets: EquipmentPreset[];
  /** Opens one piece for editing (just added with weights to choose, or already at home). */
  onOpen: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('mat');

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName('');
      setIcon('mat');
    }
  }

  const add = useMutation({
    mutationFn: (body: { kind: string; name?: string; icon?: string }) =>
      trainingApi.addEquipment(body),
    onSuccess: (item) => {
      haptic('success');
      // Into the list at once, so the editor can open on it before the refetch lands.
      queryClient.setQueryData<EquipmentList>(trainingKeys.equipment, (old) =>
        old ? { ...old, equipment: [...old.equipment, item] } : old,
      );
      void queryClient.invalidateQueries({ queryKey: trainingKeys.all });
      const preset = presets.find((p) => p.kind === item.kind);
      if (preset?.weighted) {
        toast.success(`${item.name} added`, { description: 'Which weights are there?' });
        onClose();
        onOpen(item.id);
      } else if (item.kind === 'other') {
        toast.success(`${item.name} added`);
        setName('');
      } else toast.success(`${item.name} added`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = add.variables?.kind === 'other' ? fieldErrors(add.error) : {};
  const byKind = new Map(owned.map((item) => [item.kind, item]));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add equipment"
      description="Tap what’s at home."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {presets.map((preset) => {
            const have = byKind.get(preset.kind);
            const pending = add.isPending && add.variables?.kind === preset.kind;
            return (
              <li key={preset.kind}>
                <button
                  type="button"
                  disabled={add.isPending}
                  onClick={() => {
                    if (have) {
                      onClose();
                      onOpen(have.id);
                    } else add.mutate({ kind: preset.kind });
                  }}
                  aria-label={have ? `${preset.name}: at home. Open` : `Add ${preset.name}`}
                  className={cx(
                    'press relative flex min-h-[4.25rem] w-full items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-2.5 text-left text-sm font-semibold text-ink-900 disabled:opacity-60',
                    have ? 'bg-mint-100 hover:bg-mint-200' : 'bg-butter-100 hover:bg-butter-200',
                  )}
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-white">
                    <EquipmentIcon name={preset.icon} className="size-11" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 leading-tight">{preset.name}</span>
                    {have ? (
                      <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-mint-800">
                        <CheckCircleIcon fontSize="inherit" />
                        At home
                      </span>
                    ) : null}
                  </span>
                  {have || pending ? null : (
                    <AddIcon fontSize="inherit" className="shrink-0 text-base text-ink-500" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <form
          className="flex flex-col gap-3 rounded-[1.5rem] p-3.5 ring-1 ring-inset ring-ink-100"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) add.mutate({ kind: 'other', name: name.trim(), icon });
          }}
        >
          <p className="text-[0.9375rem] font-bold">Something else</p>
          <TextField
            label="What is it"
            placeholder="Sandbag, balance board…"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fields.name}
            maxLength={80}
          />
          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Picture</p>
            <IconGrid icons={presets.map((p) => p.icon)} value={icon} onChange={setIcon} />
          </div>
          <Button
            type="submit"
            icon={AddIcon}
            size="md"
            className="self-start"
            disabled={!name.trim()}
            loading={add.isPending && add.variables?.kind === 'other'}
          >
            {name.trim() ? `Add ${name.trim()}` : 'Add'}
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
