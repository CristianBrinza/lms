import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon, DeleteIcon } from '@/components/ui/icons';
import { Stepper } from '@/food/kitchenware/Stepper';
import { tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { trainingApi, trainingKeys } from '../api';
import { kg } from '../format';
import { EquipmentIcon } from '../icons/TrainingIcon';
import type { Equipment, EquipmentPreset, Piece } from '../types';
import { useEquipmentT } from './equipment.i18n';
import { PiecesEditor } from './PiecesEditor';
import { addWeights, countLabel, parseWeights, removeWeight } from './weights';

/**
 * One piece of equipment: its name, how many (0 while it's away: lent out, at the cottage), the
 * weights owned and whether they come in pairs, its pieces (each band with its kg, the bar's
 * grips), a note, and the name and note in the other languages. Removing it takes it off the list.
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
  const t = useEquipmentT();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [count, setCount] = useState(1);
  const [pairs, setPairs] = useState(false);
  const [weights, setWeights] = useState<number[]>([]);
  const [typed, setTyped] = useState('');
  const [note, setNote] = useState('');
  const [icon, setIcon] = useState('');
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [translations, setTranslations] = useState<Translations>({});
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
      setPieces(item.variants);
      setTranslations(item.translations ?? {});
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
        variants: pieces,
        translations,
        ...(item!.kind === 'other' ? { icon } : {}),
      });
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(t.saved(tr(saved, 'name')), {
        description: saved.count === 0 ? countLabel(0) : undefined,
      });
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => trainingApi.removeEquipment(item!.id),
    onSuccess: () => {
      toast.success(t.removed(item ? tr(item, 'name') : undefined));
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
        title={item ? tr(item, 'name') : t.equipment}
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
              {t.save}
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
                label={t.name}
                className="min-w-0 flex-1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={fields.name}
                maxLength={80}
              />
            </div>
            <div>
              <Stepper
                label={t.howMany}
                value={count}
                onChange={setCount}
                min={0}
                max={100}
                format={(v) => (v ? String(v) : t.none)}
              />
              <p
                className={cx(
                  'mt-1.5 px-1 text-[0.8125rem]',
                  count ? 'text-ink-500' : 'font-semibold text-peach-800',
                )}
              >
                {count ? t.countHint : t.awayHint}
              </p>
            </div>
            {weighted ? (
              <Switch
                checked={pairs}
                onChange={setPairs}
                label={t.twoOfEach}
                hint={pairs ? t.pairHint : t.oneHint}
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {weighted ? (
              <fieldset>
                <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                  {t.weights}
                </legend>
                {weights.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label={t.weightsOwned}>
                    {weights.map((w) => (
                      <li key={w}>
                        <span className="tabular inline-flex h-10 items-center gap-0.5 rounded-pill bg-butter-300 pl-3.5 pr-1 text-sm font-semibold text-ink-900">
                          {kg(w)}
                          {pairs ? <span className="ml-0.5 text-butter-800">×2</span> : null}
                          <button
                            type="button"
                            aria-label={t.removeWhat(kg(w))}
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
                  <p className="text-sm text-ink-600">{t.noWeights}</p>
                )}
                <form
                  className="mt-2.5 flex items-end gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    addTyped();
                  }}
                >
                  <TextField
                    label={t.addWeightsLabel}
                    hideLabel
                    dense
                    className="min-w-0 flex-1"
                    inputMode="decimal"
                    placeholder={t.addWeightsPlaceholder}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="tint"
                    icon={AddIcon}
                    disabled={!pending.length}
                    className="h-11 shrink-0"
                  >
                    {t.add}
                  </Button>
                </form>
                {suggested.length ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-semibold text-ink-600">{t.commonWeights}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggested.map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            haptic('tap');
                            setWeights((list) => addWeights(list, [w]));
                          }}
                          aria-label={t.addWhat(kg(w))}
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

            {item ? (
              <PiecesEditor
                kind={item.kind}
                value={pieces}
                onChange={setPieces}
                suggestions={preset?.pieces ?? []}
              />
            ) : null}

            <TextField
              label={t.note}
              placeholder={t.optional}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={fields.note}
              maxLength={500}
            />
            {item?.kind === 'other' ? (
              <fieldset>
                <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                  {t.picture}
                </legend>
                <IconGrid presets={presets} value={icon} onChange={setIcon} />
              </fieldset>
            ) : null}
          </div>

          <TranslationFields
            className="md:col-span-2"
            fields={[
              { key: 'name', label: t.name, maxLength: 80 },
              { key: 'note', label: t.note, multiline: true, maxLength: 500 },
            ]}
            value={translations}
            onChange={setTranslations}
          />

          <Button
            variant="ghost"
            size="sm"
            icon={DeleteIcon}
            className="self-start justify-self-start text-danger-700 hover:bg-danger-50 md:col-span-2"
            onClick={() => setConfirmRemove(true)}
          >
            {t.removeFromHome}
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={t.confirmTitle(item ? tr(item, 'name') : undefined)}
        description={t.confirmText}
        confirmLabel={t.remove}
        tone="danger"
      />
    </>
  );
}

/** Pictures to choose from, the chosen one in butter; each named after the thing it shows. */
export function IconGrid({
  presets,
  value,
  onChange,
}: {
  presets: EquipmentPreset[];
  value: string;
  onChange: (icon: string) => void;
}) {
  const t = useEquipmentT();
  const icons = presets.map((p) => p.icon);
  const list = [...new Set(value && !icons.includes(value) ? [value, ...icons] : icons)];
  const nameOf = (key: string) => {
    const preset = presets.find((p) => p.icon === key);
    return preset ? tr(preset, 'name') : key.replace(/-/g, ' ');
  };
  return (
    <div
      role="radiogroup"
      aria-label={t.picture}
      className="grid max-h-[9.5rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
    >
      {list.map((key) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={key === value}
          aria-label={nameOf(key)}
          title={nameOf(key)}
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
