import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { TranslationFields } from '@/components/common/TranslationFields';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { DeleteIcon } from '@/components/ui/icons';
import { getLocale, LOCALES, tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { foodKeys, kitchenwareApi } from '../api';
import { isCustomIcon, useCustomIcons } from '../icons/custom';
import { FoodIcon } from '../icons/FoodIcon';
import { IconGroupLabel } from '../icons/IconGroupLabel';
import { useIconsT } from '../icons/icons.i18n';
import type { Tool, ToolKind } from '../types';
import { useKitchenwareT } from './i18n';
import { KIND_ORDER, kindLabel } from './status';
import { Stepper } from './Stepper';

/**
 * The name in every language, as the API takes it: an empty field clears that translation, and a
 * name changed above replaces the old translation in the language it was written in.
 */
function nameTranslations(value: Translations, nameChanged: boolean): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const name = String(value[locale]?.name ?? '').trim();
    out[locale] = { name: nameChanged && locale === getLocale() ? '' : name };
  }
  return out;
}

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
  const t = useKitchenwareT();
  const groups = useIconsT();
  const customIcons = useCustomIcons();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [translations, setTranslations] = useState<Translations>({});
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
      setTranslations(tool.translations ?? {});
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
        translations: nameTranslations(translations, name.trim() !== tool!.name),
      }),
    onSuccess: (saved) => {
      toast.success(t.savedName(tr(saved, 'name')));
      void refresh();
      onClose();
    },
  });
  const remove = useMutation({
    mutationFn: () => kitchenwareApi.remove(tool!.id),
    onSuccess: () => {
      toast.success(t.removedName(tool ? tr(tool, 'name') : null));
      void refresh();
      setConfirmRemove(false);
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const shownIcons = icons.includes(icon) || isCustomIcon(icon) ? icons : [icon, ...icons];

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={tool ? tr(tool, 'name') : t.title}
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
            <TextField
              label={t.name}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fields.name}
              maxLength={60}
            />
            <TranslationFields
              fields={[{ key: 'name', label: t.name, maxLength: 60 }]}
              value={translations}
              onChange={setTranslations}
            />
            <Stepper label={t.howMany} value={count} onChange={setCount} min={0} max={500} />
            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                {t.kindLabel}
              </legend>
              <div role="radiogroup" aria-label={t.kindLabel} className="flex flex-wrap gap-1.5">
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
                    {kindLabel(value)}
                  </button>
                ))}
              </div>
            </fieldset>
            {kind === 'disposable' ? (
              <TextField
                label={t.lowAt}
                inputMode="numeric"
                placeholder="2"
                hint={t.lowAtHint}
                value={minCount}
                onChange={(event) => setMinCount(event.target.value)}
              />
            ) : (
              <>
                <Switch
                  checked={washable}
                  onChange={setWashable}
                  label={t.washable}
                  hint={washable ? t.washableOn : t.washableOff}
                />
                {washable ? (
                  <Switch
                    checked={dishwasherSafe}
                    onChange={setDishwasherSafe}
                    label={t.dishwasherSafe}
                    hint={dishwasherSafe ? t.dishwasherSafeOn : t.dishwasherSafeOff}
                  />
                ) : null}
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <TextField
              label={t.keptIn}
              placeholder={t.keptInPlaceholder}
              value={place}
              onChange={(event) => setPlace(event.target.value)}
              error={fields.place}
              maxLength={60}
            />
            <TextField
              label={t.note}
              placeholder={t.optional}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              error={fields.note}
              maxLength={200}
            />
            <fieldset>
              <legend className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">
                {t.drawing}
              </legend>
              <div
                role="radiogroup"
                aria-label={t.drawing}
                className="grid max-h-[9.5rem] grid-cols-6 gap-1 overflow-y-auto rounded-2xl bg-ink-50 p-1.5 sm:grid-cols-8 md:grid-cols-6"
              >
                {customIcons.length > 0 && <IconGroupLabel>{groups.yours}</IconGroupLabel>}
                {[
                  ...customIcons.map((custom) => ({ key: custom.key, label: tr(custom, 'name') })),
                  ...(customIcons.length ? [null] : []),
                  ...shownIcons.map((key) => ({ key, label: key.replace(/-/g, ' ') })),
                ].map((choice) =>
                  choice === null ? (
                    <IconGroupLabel key="built-in">{groups.builtIn}</IconGroupLabel>
                  ) : (
                    <button
                      key={choice.key}
                      type="button"
                      role="radio"
                      aria-checked={choice.key === icon}
                      aria-label={choice.label}
                      title={choice.label}
                      onClick={() => setIcon(choice.key)}
                      className={cx(
                        'press grid aspect-square min-h-11 place-items-center rounded-xl transition-colors',
                        choice.key === icon
                          ? 'bg-butter-300 shadow-[var(--shadow-xs)]'
                          : 'hover:bg-white',
                      )}
                    >
                      <FoodIcon name={choice.key} className="size-7" />
                    </button>
                  ),
                )}
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
            {t.removeFromList}
          </Button>
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={t.removeTitle(tool ? tr(tool, 'name') : null)}
        description={t.removeText}
        confirmLabel={t.remove}
        tone="danger"
      />
    </>
  );
}
