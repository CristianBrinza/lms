import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button, Sheet, Switch, TextField, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { Area, PhotoSlot, fieldClass } from '@/drinks/components/DrinkSheet';
import { photoForUpload, PhotoTooLarge } from '@/drinks/images';
import {
  FORMS,
  medicationApi,
  medicationKeys,
  type Form,
  type Medicine,
  type Person,
  type PhotoKind,
} from '../api';
import { useMedicationT } from '../i18n';
import { draftFields, emptyDraft, type PackageDraft } from '../draft';
import { PackageFormFields } from './PackageSheet';

const UNIT_OF: Record<Form, 'pcs' | 'ml' | 'g' | 'doses'> = {
  tablet: 'pcs',
  capsule: 'pcs',
  syrup: 'ml',
  drops: 'ml',
  spray: 'doses',
  cream: 'g',
  injection: 'pcs',
  sachet: 'pcs',
  other: 'pcs',
};

interface Picked {
  kind: PhotoKind;
  file: File;
  preview: string;
}

/** Adds a medicine (photos and a first package with it), or edits one. */
export function MedicineSheet({
  open,
  onClose,
  medicine,
  people,
  places,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  medicine?: Medicine | null;
  people: Person[];
  places: string[];
  onCreated?: (medicine: Medicine) => void;
}) {
  const t = useMedicationT();
  return (
    <Sheet open={open} onClose={onClose} title={medicine ? t.editMedicine : t.newMedicine} size="lg">
      {open ? (
        <FormBody
          key={medicine?.id ?? 'new'}
          medicine={medicine ?? null}
          people={people}
          places={places}
          onDone={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </Sheet>
  );
}

function FormBody({
  medicine,
  people,
  places,
  onDone,
  onCreated,
}: {
  medicine: Medicine | null;
  people: Person[];
  places: string[];
  onDone: () => void;
  onCreated?: (medicine: Medicine) => void;
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const [name, setName] = useState(medicine?.name ?? '');
  const [substance, setSubstance] = useState(medicine?.substance ?? '');
  const [strength, setStrength] = useState(medicine?.strength ?? '');
  const [form, setForm] = useState<Form>(medicine?.form ?? 'tablet');
  const [rx, setRx] = useState(medicine?.rx ?? false);
  const [ownerId, setOwnerId] = useState(medicine?.ownerId ?? '');
  const [notes, setNotes] = useState(medicine?.notes ?? '');
  const [photos, setPhotos] = useState<Picked[]>([]);
  const [pack, setPack] = useState<PackageDraft>(emptyDraft(places[0] ?? ''));
  const [progress, setProgress] = useState<string | null>(null);

  // The previews are object URLs: let them go when the form closes.
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const unit = UNIT_OF[form];
  const packaged = Boolean(pack.quantity.trim());
  const { fields: packFields } = draftFields(pack);
  const ready = name.trim().length > 0 && (!packaged || packFields !== null);

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        name: name.trim(),
        substance: substance.trim(),
        strength: strength.trim(),
        form,
        unit,
        rx,
        notes: notes.trim(),
        ownerId: ownerId || null,
      };
      if (medicine) return (await medicationApi.updateMedicine(medicine.id, fields)).medicine;
      const created = (await medicationApi.addMedicine(fields)).medicine;
      if (packaged && packFields) await medicationApi.addPackage(created.id, packFields);
      for (const [index, photo] of photos.entries()) {
        setProgress(`${t.uploading} ${index + 1}/${photos.length}`);
        try {
          await medicationApi.addPhoto(created.id, await photoForUpload(photo.file), photo.kind);
        } catch (error) {
          toast.error(t.photoFailed, {
            description: error instanceof PhotoTooLarge ? undefined : errorMessage(error),
          });
        }
      }
      return created;
    },
    onSuccess: (saved) => {
      haptic('success');
      toast.success(medicine ? t.saved : t.added(saved.name));
      onDone();
      if (!medicine) onCreated?.(saved);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => {
      setProgress(null);
      void client.invalidateQueries({ queryKey: medicationKeys.all });
    },
  });

  const pickPhoto = (kind: PhotoKind, file: File | undefined) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    previews.current.push(preview);
    setPhotos((list) => [...list.filter((p) => p.kind !== kind), { kind, file, preview }]);
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready && !save.isPending) save.mutate();
      }}
    >
      {!medicine ? (
        <div>
          <div className="grid grid-cols-2 gap-2.5">
            {(['front', 'back'] as const).map((kind) => {
              const picked = photos.find((p) => p.kind === kind);
              return (
                <PhotoSlot
                  key={kind}
                  label={kind === 'front' ? t.addFront : t.addBack}
                  preview={picked?.preview}
                  onPick={(file) => pickPhoto(kind, file)}
                  onClear={() => setPhotos((list) => list.filter((p) => p.kind !== kind))}
                  clearLabel={t.removePhoto}
                />
              );
            })}
          </div>
          <p className="mt-2 px-1 text-xs text-ink-500">{t.photosHint}</p>
        </div>
      ) : null}

      <TextField
        label={t.name}
        placeholder={t.namePlaceholder}
        value={name}
        maxLength={120}
        autoFocus={!medicine}
        onChange={(e) => setName(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label={t.strength}
          placeholder={t.strengthPlaceholder}
          value={strength}
          maxLength={60}
          onChange={(e) => setStrength(e.target.value)}
        />
        <TextField
          label={t.substance}
          value={substance}
          maxLength={120}
          onChange={(e) => setSubstance(e.target.value)}
        />
      </div>

      <div>
        <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.formLabel}</p>
        <div role="radiogroup" aria-label={t.formLabel} className="flex flex-wrap gap-1.5">
          {FORMS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={form === f}
              onClick={() => setForm(f)}
              className={cx(
                'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                form === f ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {t.form[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-[1.125rem] bg-ink-50 px-4 py-2">
        <Switch checked={rx} onChange={setRx} label={t.rx} />
      </div>

      {people.length > 1 ? (
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.owner}</span>
          <select
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
            className={cx(fieldClass, 'h-14 appearance-none py-0')}
          >
            <option value="">{t.shared}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Area label={t.notes} value={notes} onChange={setNotes} rows={2} max={2000} />

      {!medicine ? (
        <fieldset className="flex flex-col gap-4 rounded-[1.5rem] bg-ink-50 p-4">
          <legend className="px-1 text-[0.9375rem] font-bold">{t.firstPackage}</legend>
          <PackageFormFields
            draft={pack}
            onChange={(change) => setPack((d) => ({ ...d, ...change }))}
            unit={t.unitName[unit]}
            places={places}
          />
        </fieldset>
      ) : null}

      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!ready}>
        {progress ?? t.save}
      </Button>
    </form>
  );
}
