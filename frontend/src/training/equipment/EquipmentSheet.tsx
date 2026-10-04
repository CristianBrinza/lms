import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon, DeleteIcon } from '@/components/ui/icons';
import { Stepper } from '@/food/kitchenware/Stepper';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { kg } from '../format';
import { EquipmentIcon } from '../icons/TrainingIcon';
import type { Equipment, EquipmentPreset } from '../types';
import { addWeights, parseWeights, removeWeight } from './weights';

/**
 * One piece of equipment: its name, how many (0 while it's away: lent out, at the cottage), the
 * weights owned and whether they come in pairs, a note. Removing it takes it off the list.
 */
export function EquipmentSheet({
  open,
  item,
  presets,
  onClose,
}: {
  open: boolean;
  item: Equipment | null;
  presets: EquipmentPreset[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [pairs, setPairs] = useState(false);
  const [weights, setWeights] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [icon, setIcon] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Opening the sheet (or opening it on another thing) starts from it as saved.
  const target = open && item ? item.id : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== target) {
    setLoadedFor(target);
    if (item && target) {
      setName(item.name);
      setCount(item.count);
      setPairs(item.pairs);
      setWeights(item.weights);
      setTyped('');
      setNote(item.note);
      setIcon(item.icon);
    }
  }

  const preset = presets.find((p) => p.kind === item?.kind) ?? null;
  const weighted = preset ? preset.weighted : true;
  const suggested = (preset?.weights ?? []).filter((w) => !weights.includes(w));
  const pending = parseWeights(typed);

  const refresh = () => queryClient.invalidateQueries({ queryKey: trainingKeys.all });
  const save = useMutation({
    mutationFn: () => {
      // Weights typed but not yet added count too: "Save" shouldn't lose them.
      const all = addWeights(weights, pending);
      return trainingApi.updateEquipment(item!.id, {
        name: name.trim(),
        count,
        pairs,
        weights: all,
        note: note.trim(),
        ...(item!.kind === 'other' ? { icon } : {}),
      });
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(`${saved.name} saved`, {
        description: saved.count === 0 ? 'Not at home right now' : undefined,
      });
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => trainingApi.removeEquipment(item!.id),
    onSuccess: () => {
      toast.success(`${item?.name ?? 'It'} removed`);
      void refresh();
      setConfirmRemove(false);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);

  const addTyped = () => {
    if (!pending.length) return;
    haptic('tap');
    setWeights((w) => addWeights(w, pending));
    setTyped('');
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={item?.name ?? 'Equipment'}
        size="lg"
        footer={
          <div className="flex flex-col gap-2">
            {save.isError && !Object.keys(fields).length ? (
              <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
            ) : null}
            <Button
              fullWidth
              onClick={() => save.mutate()}
              loading={save.isPending}
              disabled={!name.trim()}
            >
              Save
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-x-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-butter-100">
                <EquipmentIcon name={icon || (item?.icon ?? 'mat')} className="size-12" />
              </span>
              <TextField
                label="Name"
                className="flex-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={fields.name}
                maxLength={80}
              />
            </div>
            <div>
              <Stepper
                label="How many"
                value={count}
                onChange={setCount}
                min={0}
                max={100}
                format={(v) => (v ? String(v) : 'None')}
              />
              <p
                className={cx(
                  'mt-1.5 px-1 text-[0.8125rem]',
                  count ? 'text-ink-500' : 'font-semibold text-peach-800',
                )}
              >
                {count
                  ? '0 when it’s away for a while: lent out, at the cottage.'
                  : 'Not at home right now: exercises that need it are left out.'}
              </p>
            </div>
            {weighted ? (
              <Switch
                checked={pairs}
                onChange={setPairs}
                label="Two of each weight"
                hint={pairs ? 'A pair of each, one per hand' : 'One of each weight'}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {weighted ? (
              <fieldset>
                <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                  Weights
                </legend>
                {weights.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Weights owned">
                    {weights.map((w) => (
                      <li key={w}>
                        <span className="tabular inline-flex h-10 items-center gap-0.5 rounded-pill bg-butter-300 pl-3.5 pr-1 text-sm font-semibold text-ink-900">
                          {kg(w)}
                          {pairs ? <span className="ml-0.5 text-butter-800">×2</span> : null}
                          <button
                            type="button"
                            aria-label={`Remove ${kg(w)}`}
                            onClick={() => setWeights((list) => removeWeight(list, w))}
                            className="press ml-0.5 grid size-8 place-items-center rounded-full text-base text-ink-700 hover:bg-butter-200"
                          >
                            <CloseIcon fontSize="inherit" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-600">No weights yet.</p>
                )}
                <form
                  className="mt-2.5 flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTyped();
                  }}
                >
                  <TextField
                    label="Add weights, kg"
                    hideLabel
                    dense
                    className="flex-1"
                    inputMode="decimal"
                    placeholder="Add kg: 6 or 2 4 8"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="tint"
                    icon={AddIcon}
                    disabled={!pending.length}
                    className="h-11"
                  >
                    Add
                  </Button>
                </form>
                {suggested.length ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold text-ink-600">Common weights</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggested.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            haptic('tap');
                            setWeights((list) => addWeights(list, [w]));
                          }}
                          aria-label={`Add ${kg(w)}`}
                          className="press tabular inline-flex h-9 items-center gap-1 rounded-pill bg-butter-100 px-3 text-sm font-semibold text-ink-800 hover:bg-butter-200"
                        >
                          <AddIcon fontSize="inherit" className="text-ink-500" />
                          {kg(w)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            <TextField
              label="Note"
              placeholder="Optional"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={fields.note}
              maxLength={500}
            />
            {item?.kind === 'other' ? (
              <fieldset>
                <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                  Picture
                </legend>
                <IconGrid icons={presets.map((p) => p.icon)} value={icon} onChange={setIcon} />
              </fieldset>
            ) : null}
          </div>

          <Button
            variant="ghost"
            size="sm"
            icon={DeleteIcon}
            className="self-start justify-self-start text-danger-700 hover:bg-danger-50 md:col-span-2"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from home
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Remove ${item?.name ?? 'this'}?`}
        description="Exercises that need it stop being suggested. Adding it again brings them back."
        confirmLabel="Remove"
        tone="danger"
      />
    </>
  );
}

/** Pictures to choose from, the chosen one in butter. */
export function IconGrid({
  icons,
  value,
  onChange,
}: {
  icons: string[];
  value: string;
  onChange: (icon: string) => void;
}) {
  const list = [...new Set(value && !icons.includes(value) ? [value, ...icons] : icons)];
  return (
    <div
      role="radiogroup"
      aria-label="Picture"
      className="grid max-h-[9.5rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
    >
      {list.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={key.replace(/-/g, ' ')}
          title={key.replace(/-/g, ' ')}
          onClick={() => onChange(key)}
          className={cx(
            'press grid aspect-square min-h-11 place-items-center rounded-xl transition-colors',
            key === value ? 'bg-butter-300 shadow-[var(--shadow-xs)]' : 'hover:bg-white',
          )}
        >
          <EquipmentIcon name={key} className="size-7" />
        </button>
      ))}
    </div>
  );
}
