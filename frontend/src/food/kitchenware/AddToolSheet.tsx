import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon } from '@/components/ui/icons';
import { tr, type Translations } from '@/i18n';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodKeys, kitchenwareApi } from '../api';
import { normalize } from '../catalog';
import { FoodIcon } from '../icons/FoodIcon';
import type { Tool, ToolKind } from '../types';
import { useKitchenwareT } from './i18n';
import { Stepper } from './Stepper';

export interface ToolPreset {
  name: string;
  icon: string;
  kind: ToolKind;
  washable?: boolean;
  /** The catalog's own names in the other languages. */
  translations?: Translations;
}

/**
 * Adding kitchenware: a name, or one tap on a common thing the kitchen doesn't have yet (pot,
 * frying pan, colander, glasses, pens…), with how many. Taps keep the sheet open for the next one.
 */
export function AddToolSheet({
  open,
  onClose,
  tools,
  presets,
}: {
  open: boolean;
  onClose: () => void;
  tools: Tool[];
  presets: ToolPreset[];
}) {
  const t = useKitchenwareT();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setName('');
      setCount(1);
    }
  }

  const have = new Set(tools.map((tool) => normalize(tool.name)));
  const typed = normalize(name);
  // Typed in any language: the catalog's name as written, or as it reads here.
  const suggestions = presets.filter(
    (preset) =>
      !have.has(normalize(preset.name)) &&
      (!typed ||
        normalize(preset.name).includes(typed) ||
        normalize(tr(preset, 'name')).includes(typed)),
  );

  const add = useMutation({
    mutationFn: (body: {
      name: string;
      icon?: string;
      kind?: ToolKind;
      washable?: boolean;
      translations?: Translations;
      close: boolean;
    }) =>
      kitchenwareApi.create({
        name: body.name,
        count,
        ...(body.icon ? { icon: body.icon } : {}),
        ...(body.kind ? { kind: body.kind } : {}),
        ...(body.washable !== undefined ? { washable: body.washable } : {}),
        ...(body.translations ? { translations: body.translations } : {}),
      }),
    onSuccess: (tool, body) => {
      haptic('success');
      toast.success(t.added(tr(tool, 'name')), {
        description: count === 1 ? undefined : t.ofThem(count),
      });
      void queryClient.invalidateQueries({ queryKey: foodKeys.kitchenware });
      if (body.close) onClose();
      else setCount(1);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = add.variables?.close ? fieldErrors(add.error) : {};

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.addKitchenware}
      size="lg"
      footer={
        <Button
          fullWidth
          icon={AddIcon}
          onClick={() => add.mutate({ name: name.trim(), close: true })}
          loading={add.isPending && add.variables?.close}
          disabled={!name.trim()}
        >
          {name.trim() ? t.addName(name.trim()) : t.add}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim()) add.mutate({ name: name.trim(), close: true });
        }}
      >
        <TextField
          label={t.whatIsIt}
          placeholder={t.whatPlaceholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={fields.name}
          maxLength={60}
          autoFocus
        />
        <Stepper label={t.howMany} value={count} onChange={setCount} min={1} max={500} />
        {suggestions.length ? (
          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
              {typed ? t.matches : t.oneTap}
            </p>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {suggestions.map((preset) => {
                const pending = add.isPending && add.variables?.name === preset.name;
                return (
                  <li key={preset.name}>
                    <button
                      type="button"
                      disabled={add.isPending}
                      onClick={() =>
                        add.mutate({
                          name: preset.name,
                          icon: preset.icon,
                          kind: preset.kind,
                          washable: preset.washable,
                          translations: preset.translations,
                          close: false,
                        })
                      }
                      className="press flex min-h-12 w-full items-center gap-2 rounded-2xl bg-butter-100 py-1.5 pl-1.5 pr-3 text-left text-sm font-semibold text-ink-900 hover:bg-butter-200 disabled:opacity-60"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white">
                        <FoodIcon name={preset.icon} className="size-6" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{tr(preset, 'name')}</span>
                      {pending ? null : (
                        <AddIcon fontSize="inherit" className="shrink-0 text-base text-ink-500" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </form>
    </Sheet>
  );
}
