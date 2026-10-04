import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodKeys, kitchenwareApi } from '../api';
import { FoodIcon } from '../icons/FoodIcon';
import type { Tool, ToolKind } from '../types';
import { KIND_LABEL, KIND_ORDER } from './status';
import { Stepper } from './Stepper';

/** One thing's details: name, how many, kind, drawing, dishwasher-safe, where it's kept, a note. */
export function ToolSheet({
  open,
  tool,
  icons,
  onClose,
}: {
  open: boolean;
  tool: Tool | null;
  icons: string[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [kind, setKind] = useState<ToolKind>('other');
  const [icon, setIcon] = useState('box');
  const [washable, setWashable] = useState(true);
  const [dishwasherSafe, setDishwasherSafe] = useState(true);
  const [minCount, setMinCount] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Opening the sheet (or opening it on another thing) starts from it as saved.
  const target = open && tool ? tool.id : null;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  if (loadedFor !== target) {
    setLoadedFor(target);
    if (tool && target) {
      setName(tool.name);
      setCount(tool.count);
      setKind(tool.kind);
      setIcon(tool.icon);
      setWashable(tool.washable);
      setDishwasherSafe(tool.dishwasherSafe);
      setMinCount(tool.minCount === null ? '' : String(tool.minCount));
      setPlace(tool.place);
      setNote(tool.note);
    }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
  const save = useMutation({
    mutationFn: () =>
      kitchenwareApi.update(tool!.id, {
        name: name.trim(),
        count,
        kind,
        icon,
        washable,
        dishwasherSafe,
        ...(kind === 'disposable'
          ? {
              minCount:
                minCount.trim() === '' ? null : Math.max(0, Math.round(Number(minCount)) || 0),
            }
          : {}),
        place: place.trim(),
        note: note.trim(),
      }),
    onSuccess: (saved) => {
      toast.success(`${saved.name} saved`);
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => kitchenwareApi.remove(tool!.id),
    onSuccess: () => {
      toast.success(`${tool?.name ?? 'It'} removed`);
      void refresh();
      setConfirmRemove(false);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const shownIcons = icons.includes(icon) ? icons : [icon, ...icons];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={tool?.name ?? 'Kitchenware'}
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
            <TextField
              label="Name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fields.name}
              maxLength={60}
            />
            <Stepper label="How many" value={count} onChange={setCount} min={0} max={500} />
            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Kind</legend>
              <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-1.5">
                {KIND_ORDER.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={kind === value}
                    onClick={() => setKind(value)}
                    className={cx(
                      'press h-11 rounded-pill px-3.5 text-sm font-semibold',
                      kind === value
                        ? 'bg-butter-300 text-ink-900'
                        : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
                    )}
                  >
                    {KIND_LABEL[value]}
                  </button>
                ))}
              </div>
            </fieldset>
            {kind === 'disposable' ? (
              <TextField
                label="Running low at"
                inputMode="numeric"
                placeholder="2"
                hint="Used up when cooking; at this many or fewer, it’s running low"
                value={minCount}
                onChange={(event) => setMinCount(event.target.value)}
              />
            ) : (
              <>
                <Switch
                  checked={washable}
                  onChange={setWashable}
                  label="Gets washed"
                  hint={
                    washable
                      ? 'Using it makes it dirty'
                      : 'Never dirty, like an electric kettle or the oven'
                  }
                />
                {washable ? (
                  <Switch
                    checked={dishwasherSafe}
                    onChange={setDishwasherSafe}
                    label="In the dishwasher"
                    hint={
                      dishwasherSafe
                        ? 'The dishwasher takes it'
                        : 'By hand only, like knives or the grill'
                    }
                  />
                ) : null}
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <TextField
              label="Kept in"
              placeholder="Desk drawer"
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              error={fields.place}
              maxLength={60}
            />
            <TextField
              label="Note"
              placeholder="Optional"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={fields.note}
              maxLength={200}
            />
            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                Drawing
              </legend>
              <div
                role="radiogroup"
                aria-label="Drawing"
                className="grid max-h-[9.5rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
              >
                {shownIcons.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={key === icon}
                    aria-label={key.replace(/-/g, ' ')}
                    title={key.replace(/-/g, ' ')}
                    onClick={() => setIcon(key)}
                    className={cx(
                      'press grid aspect-square min-h-11 place-items-center rounded-xl transition-colors',
                      key === icon ? 'bg-butter-300 shadow-[var(--shadow-xs)]' : 'hover:bg-white',
                    )}
                  >
                    <FoodIcon name={key} className="size-7" />
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon={DeleteIcon}
            className="self-start justify-self-start text-danger-700 hover:bg-danger-50 md:col-span-2"
            onClick={() => setConfirmRemove(true)}
          >
            Remove from kitchenware
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Remove ${tool?.name ?? 'this'}?`}
        description="It leaves the list. Adding it again brings it back."
        confirmLabel="Remove"
        tone="danger"
      />
    </>
  );
}
