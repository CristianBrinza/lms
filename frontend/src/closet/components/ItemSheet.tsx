import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, IconButton, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon } from '@/components/ui/icons';
import { errorMessage } from '@/lib/errors';
import { closetApi, closetKeys, type Care, type Item, type ItemFields, type MaterialPart } from '../api';
import {
  CATEGORIES,
  CATEGORY_IDS,
  CONDITIONS,
  FITS,
  ISSUES,
  MATERIALS,
  OCCASIONS,
  SEASONS,
  SIZE_SYSTEMS,
  type Category,
  type Material,
} from '../catalog';
import { useClosetT } from '../i18n';
import { ChipSet, ColorPicker, Field, PickOne } from './parts';

/** Every detail of a piece, in one sheet: kind, colours, fabric, size, care, condition, notes. */

interface Draft extends Omit<ItemFields, 'price'> {
  price: string;
  tagsText: string;
}

const fromItem = (item: Item): Draft => ({
  name: item.name,
  category: item.category,
  subcategory: item.subcategory,
  colors: item.colors,
  materials: item.materials,
  size: item.size,
  sizeSystem: item.sizeSystem,
  brand: item.brand,
  price: item.price === null ? '' : String(item.price),
  currency: item.currency,
  boughtOn: item.boughtOn,
  store: item.store,
  seasons: item.seasons,
  occasions: item.occasions,
  fit: item.fit,
  condition: item.condition,
  issues: item.issues,
  conditionNotes: item.conditionNotes,
  tagsText: item.tags.join(', '),
  notes: item.notes,
  url: item.url,
  care: item.care,
  storageAdvice: item.storageAdvice,
  madeIn: item.madeIn,
  labelText: item.labelText,
});

export function ItemSheet({ item, open, onClose }: { item: Item; open: boolean; onClose: () => void }) {
  const t = useClosetT();
  const [draft, setDraft] = useState<Draft>(() => fromItem(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (change: Partial<Draft>) => setDraft((d) => ({ ...d, ...change }));
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: () => {
      const { tagsText, price, ...rest } = draft;
      const number = price.trim() === '' ? null : Number(price.replace(',', '.'));
      return closetApi.update(item.id, {
        ...rest,
        price: number !== null && Number.isFinite(number) ? number : null,
        tags: tagsText
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        materials: (rest.materials ?? []).filter((m) => m.material),
      });
    },
    onSuccess: () => {
      toast.success(t.saved);
      void queryClient.invalidateQueries({ queryKey: closetKeys.all });
      onClose();
    },
    onError: (error) => {
      const fields = (error as { fields?: Record<string, string> }).fields ?? {};
      setErrors(fields);
      toast.error(errorMessage(error));
    },
  });

  const subs = draft.category ? (CATEGORIES[draft.category as Category] as readonly string[]) : [];
  const materials = draft.materials ?? [];
  const setMaterial = (index: number, change: Partial<MaterialPart>) =>
    set({ materials: materials.map((m, i) => (i === index ? { ...m, ...change } : m)) });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.editTitle}
      size="lg"
      footer={
        <Button fullWidth loading={save.isPending} onClick={() => save.mutate()}>
          {t.save}
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        <TextField
          label={t.name}
          value={draft.name ?? ''}
          placeholder={t.namePlaceholder}
          maxLength={120}
          error={errors.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <Field label={t.category_}>
          <PickOne
            label={t.category_}
            options={CATEGORY_IDS}
            value={draft.category ?? ''}
            word={(c) => t.category[c]}
            onChange={(category) => set({ category, subcategory: '' })}
          />
        </Field>
        {subs.length ? (
          <Field label={t.subcategory}>
            <PickOne
              label={t.subcategory}
              options={subs}
              value={draft.subcategory ?? ''}
              word={(s) => t.sub[s] ?? s}
              onChange={(subcategory) => set({ subcategory })}
            />
          </Field>
        ) : null}
        <Field label={t.colour}>
          <ColorPicker label={t.colour} value={draft.colors ?? []} onChange={(colors) => set({ colors })} />
        </Field>

        <Field label={t.materials}>
          <div className="flex flex-col gap-2">
            {materials.map((m, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  aria-label={t.materials}
                  value={m.material}
                  onChange={(e) => setMaterial(index, { material: e.target.value as Material })}
                  className="h-11 min-w-0 flex-1 rounded-2xl bg-ink-50 px-3 text-[0.9375rem] font-medium outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
                >
                  {MATERIALS.map((material) => (
                    <option key={material} value={material}>
                      {t.material[material]}
                    </option>
                  ))}
                </select>
                <label className="flex h-11 w-24 items-center gap-1 rounded-2xl bg-ink-50 px-3 focus-within:bg-white focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
                  <input
                    inputMode="numeric"
                    aria-label={t.percent}
                    value={m.percent ?? ''}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value, 10);
                      setMaterial(index, { percent: Number.isFinite(n) ? Math.max(1, Math.min(100, n)) : null });
                    }}
                    className="tabular w-full min-w-0 bg-transparent text-right text-[0.9375rem] font-semibold outline-none"
                  />
                  <span className="text-sm text-ink-500">%</span>
                </label>
                <IconButton
                  icon={CloseIcon}
                  label={t.delete}
                  variant="ghost"
                  size="sm"
                  onClick={() => set({ materials: materials.filter((_, i) => i !== index) })}
                />
              </div>
            ))}
            {errors.materials ? <p className="text-sm text-danger-700">{errors.materials}</p> : null}
            <Button
              size="sm"
              variant="tint"
              icon={AddIcon}
              className="self-start"
              onClick={() => set({ materials: [...materials, { material: 'cotton', percent: null }] })}
            >
              {t.addMaterial}
            </Button>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <TextField label={t.size} value={draft.size ?? ''} maxLength={20} onChange={(e) => set({ size: e.target.value })} />
          <TextField label={t.brand} value={draft.brand ?? ''} maxLength={80} onChange={(e) => set({ brand: e.target.value })} />
        </div>
        <Field label={t.size}>
          <PickOne
            label={t.size}
            options={SIZE_SYSTEMS}
            value={draft.sizeSystem ?? ''}
            word={(s) => t.sizeSystem[s] ?? s}
            onChange={(sizeSystem) => set({ sizeSystem })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={`${t.price} (${draft.currency})`}
            inputMode="decimal"
            value={draft.price}
            error={errors.price}
            onChange={(e) => set({ price: e.target.value })}
          />
          <TextField
            label={t.boughtOn}
            type="date"
            value={draft.boughtOn ?? ''}
            onChange={(e) => set({ boughtOn: e.target.value || null })}
          />
        </div>
        <TextField label={t.store} value={draft.store ?? ''} maxLength={120} onChange={(e) => set({ store: e.target.value })} />

        <Field label={t.seasons}>
          <ChipSet label={t.seasons} options={SEASONS} values={draft.seasons ?? []} word={(s) => t.season[s] ?? s} onChange={(seasons) => set({ seasons })} />
        </Field>
        <Field label={t.occasions}>
          <ChipSet label={t.occasions} options={OCCASIONS} values={draft.occasions ?? []} word={(s) => t.occasion[s] ?? s} onChange={(occasions) => set({ occasions })} />
        </Field>
        <Field label={t.fitLabel}>
          <PickOne label={t.fitLabel} options={FITS} value={draft.fit ?? ''} word={(s) => t.fit[s] ?? s} onChange={(fit) => set({ fit })} />
        </Field>
        <Field label={t.conditionLabel}>
          <PickOne label={t.conditionLabel} options={CONDITIONS} value={draft.condition ?? ''} word={(s) => t.condition[s] ?? s} onChange={(condition) => set({ condition })} />
        </Field>
        <Field label={t.issues}>
          <ChipSet label={t.issues} options={ISSUES} values={draft.issues ?? []} word={(s) => t.issue[s] ?? s} onChange={(issues) => set({ issues })} />
        </Field>
        <TextField label={t.conditionNotes} value={draft.conditionNotes ?? ''} maxLength={500} onChange={(e) => set({ conditionNotes: e.target.value })} />

        <CareEditor value={draft.care ?? null} onChange={(care) => set({ care })} />
        <div className="grid grid-cols-2 gap-3">
          <TextField
            label={t.madeIn}
            value={draft.madeIn ?? ''}
            maxLength={2}
            placeholder="IT"
            error={errors.madeIn}
            onChange={(e) => set({ madeIn: e.target.value.toUpperCase() })}
          />
        </div>
        <TextArea label={t.storageAdvice} value={draft.storageAdvice ?? ''} max={1000} onChange={(storageAdvice) => set({ storageAdvice })} />
        <TextArea label={t.labelText} value={draft.labelText ?? ''} max={4000} onChange={(labelText) => set({ labelText })} />

        <TextField label={t.tags} hint={t.tagsHint} value={draft.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
        <TextField label={t.link} type="url" value={draft.url ?? ''} error={errors.url} onChange={(e) => set({ url: e.target.value })} />
        <TextArea label={t.notes} value={draft.notes ?? ''} max={4000} onChange={(notes) => set({ notes })} />
      </div>
    </Sheet>
  );
}

function TextArea({ label, value, onChange, max }: { label: string; value: string; onChange: (value: string) => void; max: number }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <textarea
        value={value}
        maxLength={max}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-2xl bg-ink-50 px-4 py-3 text-[0.9375rem] outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
      />
    </label>
  );
}

/** The care label's groups as pickers; an untouched group stays off the label. */
function CareEditor({ value, onChange }: { value: Care | null; onChange: (care: Care | null) => void }) {
  const t = useClosetT();
  const care = value ?? {};
  const set = (change: Partial<Care>) => {
    const next: Care = { ...care, ...change };
    for (const key of Object.keys(next) as (keyof Care)[]) if (next[key] === undefined) delete next[key];
    onChange(Object.keys(next).length ? next : null);
  };
  const temps = ['30', '40', '50', '60', '70', '95'] as const;
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-ink-50/70 p-4">
      <h3 className="text-[0.9375rem] font-bold">{t.careEdit}</h3>
      <Field label={t.careGroup.wash}>
        <PickOne
          label={t.careGroup.wash}
          options={['machine', 'hand', 'none'] as const}
          value={care.wash?.method ?? ''}
          word={(m) => (m === 'machine' ? t.careWash.machine() : m === 'hand' ? t.careWash.hand : t.careWash.none)}
          onChange={(method) => set({ wash: method ? { ...care.wash, method } : undefined })}
        />
        {care.wash?.method === 'machine' ? (
          <div className="mt-2 flex flex-col gap-2">
            <PickOne
              label="°C"
              options={temps}
              value={care.wash.temp ? String(care.wash.temp) : ''}
              word={(temp) => `${temp} °C`}
              onChange={(temp) =>
                set({ wash: { ...care.wash!, temp: temp ? (Number(temp) as 30) : undefined } })
              }
            />
            <PickOne
              label={t.careWash.gentle1}
              options={['1', '2'] as const}
              value={care.wash.gentle ? String(care.wash.gentle) : ''}
              word={(g) => (g === '1' ? t.careWash.gentle1 : t.careWash.gentle2)}
              onChange={(g) => set({ wash: { ...care.wash!, gentle: g ? (Number(g) as 1 | 2) : 0 } })}
            />
          </div>
        ) : null}
      </Field>
      <Field label={t.careGroup.bleach}>
        <PickOne
          label={t.careGroup.bleach}
          options={['any', 'non_chlorine', 'none'] as const}
          value={care.bleach ?? ''}
          word={(v) => t.careBleach[v]}
          onChange={(bleach) => set({ bleach: bleach || undefined })}
        />
      </Field>
      <Field label={t.careGroup.tumble}>
        <PickOne
          label={t.careGroup.tumble}
          options={['low', 'normal', 'none'] as const}
          value={care.tumble ?? ''}
          word={(v) => t.careTumble[v]}
          onChange={(tumble) => set({ tumble: tumble || undefined })}
        />
      </Field>
      <Field label={t.careGroup.dry}>
        <ChipSet
          label={t.careGroup.dry}
          options={['line', 'drip', 'flat', 'shade'] as const}
          values={care.dry ?? []}
          word={(v) => t.careDry[v]}
          onChange={(dry) => set({ dry: dry.length ? dry : undefined })}
        />
      </Field>
      <Field label={t.careGroup.iron}>
        <PickOne
          label={t.careGroup.iron}
          options={['low', 'medium', 'high', 'none'] as const}
          value={care.iron ?? ''}
          word={(v) => t.careIron[v]}
          onChange={(iron) => set({ iron: iron || undefined })}
        />
        {care.iron && care.iron !== 'none' ? (
          <div className="mt-2">
            <ChipSet
              label={t.careNoSteam}
              options={['nosteam'] as const}
              values={care.steam === false ? ['nosteam'] : []}
              word={() => t.careNoSteam}
              onChange={(v) => set({ steam: v.length ? false : undefined })}
            />
          </div>
        ) : null}
      </Field>
      <Field label={t.careGroup.professional}>
        <PickOne
          label={t.careGroup.professional}
          options={['P', 'F', 'W', 'none'] as const}
          value={care.professional?.method ?? ''}
          word={(v) => t.careProfessional[v]}
          onChange={(method) => set({ professional: method ? { ...care.professional, method } : undefined })}
        />
      </Field>
    </section>
  );
}
