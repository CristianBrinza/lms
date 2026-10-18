import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { fieldClass } from '@/drinks/components/DrinkSheet';
import {
  PACKAGE_KINDS,
  medicationApi,
  medicationKeys,
  type Medicine,
  type Package,
} from '../api';
import { useMedicationT } from '../i18n';
import { draftFields, draftOf, emptyDraft, type PackageDraft } from '../draft';

/** The shared fields of a package: used by its own sheet and as "First package" of a new medicine. */
export function PackageFormFields({
  draft,
  onChange,
  unit,
  places,
  autoFocus,
}: {
  draft: PackageDraft;
  onChange: (change: Partial<PackageDraft>) => void;
  unit: string;
  places: string[];
  autoFocus?: boolean;
}) {
  const t = useMedicationT();
  const { invalidExpiry } = draftFields(draft);
  const hints = [...new Set([...places, t.placePlaceholder])].filter((p) => p !== draft.place).slice(0, 6);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.kindLabel}</p>
        <div role="radiogroup" aria-label={t.kindLabel} className="flex flex-wrap gap-1.5">
          {PACKAGE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={draft.kind === kind}
              onClick={() => onChange({ kind })}
              className={cx(
                'press h-9 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                draft.kind === kind ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {t.packageKind[kind]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label={t.quantityLeft(unit)}
          inputMode="decimal"
          value={draft.quantity}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ quantity: e.target.value })}
        />
        <TextField
          label={t.originalQuantity(unit)}
          inputMode="decimal"
          value={draft.original}
          onChange={(e) => onChange({ original: e.target.value })}
        />
      </div>
      <TextField
        label={t.expires}
        inputMode="numeric"
        placeholder="03/2027"
        value={draft.expires}
        maxLength={10}
        hint={t.expiresHint}
        error={invalidExpiry ? t.invalidExpiry : undefined}
        onChange={(e) => onChange({ expires: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2.5">
        <TextField
          label={t.batchLabel}
          value={draft.batch}
          maxLength={60}
          onChange={(e) => onChange({ batch: e.target.value })}
        />
        <label className="flex min-w-0 flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">{t.openedOn}</span>
          <input
            type="date"
            value={draft.openedOn}
            onChange={(e) => onChange({ openedOn: e.target.value })}
            className={cx(fieldClass, 'h-14 py-0')}
          />
        </label>
      </div>
      {draft.openedOn ? (
        <TextField
          label={t.useWithin}
          inputMode="numeric"
          value={draft.useWithin}
          onChange={(e) => onChange({ useWithin: e.target.value.replace(/\D/g, '') })}
        />
      ) : null}
      <div>
        <TextField
          label={t.place}
          placeholder={t.placePlaceholder}
          value={draft.place}
          maxLength={80}
          onChange={(e) => onChange({ place: e.target.value })}
        />
        {hints.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => onChange({ place: hint })}
                className="press h-8 rounded-pill bg-white px-3 text-[0.8125rem] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
              >
                {hint}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Adds a package to a medicine, or edits one. */
export function PackageSheet({
  open,
  onClose,
  medicine,
  pkg,
  places,
}: {
  open: boolean;
  onClose: () => void;
  medicine: Medicine;
  pkg?: Package | null;
  places: string[];
}) {
  const t = useMedicationT();
  return (
    <Sheet open={open} onClose={onClose} title={pkg ? t.editPackage : t.newPackage} size="lg">
      {open ? <Form key={pkg?.id ?? 'new'} medicine={medicine} pkg={pkg ?? null} places={places} onDone={onClose} /> : null}
    </Sheet>
  );
}

function Form({
  medicine,
  pkg,
  places,
  onDone,
}: {
  medicine: Medicine;
  pkg: Package | null;
  places: string[];
  onDone: () => void;
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const [draft, setDraft] = useState<PackageDraft>(pkg ? draftOf(pkg) : emptyDraft(places[0] ?? ''));
  const { fields } = draftFields(draft);
  const save = useMutation({
    mutationFn: () => {
      if (!fields) throw new Error('incomplete');
      return pkg ? medicationApi.updatePackage(pkg.id, fields) : medicationApi.addPackage(medicine.id, fields);
    },
    onSuccess: () => {
      haptic('success');
      toast.success(t.saved);
      onDone();
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (fields && !save.isPending) save.mutate();
      }}
    >
      <PackageFormFields
        draft={draft}
        onChange={(change) => setDraft((d) => ({ ...d, ...change }))}
        unit={t.unitName[medicine.unit]}
        places={places}
        autoFocus={!pkg}
      />
      <Button type="submit" size="lg" fullWidth loading={save.isPending} disabled={!fields}>
        {t.save}
      </Button>
    </form>
  );
}
