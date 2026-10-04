import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, TextField, toast } from '@/components/ui';
import { AddIcon, EditIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { foodApi, foodKeys } from '../api';
import {
  EXTRA_KEYS,
  formatGrams,
  formatKcal,
  formFrom,
  kindValues,
  MAIN_KEYS,
  NUTRIENT_LABEL,
  PER_LABEL,
  readForm,
  type NutrientForm,
} from '../nutrition';
import type { Nutrients, NutritionEntry, Product } from '../types';

/**
 * What an item holds: kcal, then protein, fat and carbs (sugar, fibre and salt when known), per
 * 100 g, 100 ml or piece. The catalog's typical values until the household enters its own (from
 * the label); a kind can have its own (Cola Zero). Edit opens the values sheet.
 */
export function NutritionCard({ product }: { product: Product }) {
  const nutrition = product.nutrition ?? null;
  const kinds = Object.keys(nutrition?.entry.kinds ?? {});
  const [kind, setKind] = useState('');
  const [editing, setEditing] = useState(false);
  const values = nutrition ? kindValues(nutrition.entry, kind) : null;

  return (
    <section className="rounded-[1.375rem] bg-ink-50 p-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-h3 font-bold">Nutrition</h3>
        <Button
          size="sm"
          variant="soft"
          icon={nutrition ? EditIcon : AddIcon}
          onClick={() => setEditing(true)}
        >
          {nutrition ? 'Edit' : 'Add'}
        </Button>
      </div>
      {nutrition && values ? (
        <>
          <p className="mt-1 text-xs font-medium text-ink-600">
            {PER_LABEL[nutrition.entry.per].replace(/^./, (c) => c.toUpperCase())} ·{' '}
            {nutrition.source === 'own' ? 'Your values' : 'Typical values'}
          </p>
          {kinds.length ? (
            <div
              role="radiogroup"
              aria-label="Kind"
              className="-mx-1 mt-2.5 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]"
            >
              {['', ...kinds].map((name) => (
                <button
                  key={name || 'base'}
                  type="button"
                  role="radio"
                  aria-checked={kind === name}
                  onClick={() => setKind(name)}
                  className={cx(
                    'press h-8 shrink-0 rounded-pill px-3 text-sm font-semibold',
                    kind === name ? 'bg-ink-900 text-white' : 'bg-white text-ink-700',
                  )}
                >
                  {name || product.name}
                </button>
              ))}
            </div>
          ) : null}
          <Values values={values} />
        </>
      ) : (
        <p className="mt-1 text-sm text-ink-600">No values yet.</p>
      )}
      <NutritionSheet open={editing} product={product} onClose={() => setEditing(false)} />
    </section>
  );
}

function Values({ values }: { values: Nutrients }) {
  const extras = EXTRA_KEYS.filter((key) => values[key] !== undefined);
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <p className="flex items-baseline gap-1.5">
        <span className="tabular text-[1.75rem] font-bold leading-none tracking-[-0.03em]">
          {formatKcal(values.kcal)}
        </span>
        <span className="text-sm font-semibold text-ink-600">kcal</span>
      </p>
      <dl className="grid grid-cols-3 gap-1.5">
        {(['protein', 'fat', 'carbs'] as const).map((key) => (
          <div key={key} className="rounded-xl bg-white px-2.5 py-2">
            <dt className="text-xs font-medium text-ink-600">{NUTRIENT_LABEL[key]}</dt>
            <dd className="tabular text-[0.9375rem] font-bold">{formatGrams(values[key])}</dd>
          </div>
        ))}
      </dl>
      {extras.length ? (
        <p className="tabular text-xs text-ink-600">
          {extras
            .map((key) => `${NUTRIENT_LABEL[key]} ${formatGrams(values[key] ?? 0)}`)
            .join(' · ')}
        </p>
      ) : null}
    </div>
  );
}

const PERS: Array<NutritionEntry['per']> = ['100g', '100ml', 'piece'];

/**
 * The values from the label: per 100 g, 100 ml or piece; the four that count (energy, protein,
 * fat, carbs) and the three that may be there. A kind can have its own; leaving a kind's fields
 * empty keeps the item's. "Use typical values" drops the household's own.
 */
function NutritionSheet({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`${product.name}: nutrition`}
      description="From the label. A comma or a point both work."
    >
      {open ? <NutritionForm product={product} onClose={onClose} /> : null}
    </Sheet>
  );
}

function NutritionForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const entry = product.nutrition?.entry;
  const own = product.nutrition?.source === 'own';
  const [per, setPer] = useState<NutritionEntry['per']>(
    entry?.per ??
      (product.unit === 'ml'
        ? '100ml'
        : product.unit === 'pcs' && !product.pieceSize
          ? 'piece'
          : '100g'),
  );
  // '' is the item itself; the rest are its kinds (those it has, and those with values).
  const kinds = [...new Set([...product.variants, ...Object.keys(entry?.kinds ?? {})])];
  const [kind, setKind] = useState('');
  const [forms, setForms] = useState<Record<string, NutrientForm>>(() => ({
    '': formFrom(entry?.base),
    ...Object.fromEntries(Object.entries(entry?.kinds ?? {}).map(([k, n]) => [k, formFrom(n)])),
  }));
  const [error, setError] = useState<string | null>(null);
  const form = forms[kind] ?? {};
  const set = (key: keyof Nutrients, text: string) => {
    setError(null);
    setForms((current) => ({ ...current, [kind]: { ...current[kind], [key]: text } }));
  };

  const save = useMutation({
    mutationFn: (nutrition: NutritionEntry | null) =>
      foodApi.updateProduct(product.id, { nutrition }),
    onSuccess: (_product, nutrition) => {
      haptic('success');
      toast.success(nutrition ? 'Values saved' : 'Back to the typical values');
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const submit = () => {
    const base = readForm(forms[''] ?? {});
    if (typeof base === 'string') {
      setKind('');
      setError('Fill in energy, protein, fat and carbs.');
      return;
    }
    const byKind: Record<string, Nutrients> = {};
    for (const name of kinds) {
      const values = readForm(forms[name] ?? {});
      if (values === 'empty') continue;
      if (values === 'missing') {
        setKind(name);
        setError(`${name}: fill in energy, protein, fat and carbs, or leave all empty.`);
        return;
      }
      byKind[name] = values;
    }
    save.mutate({ per, base, ...(Object.keys(byKind).length ? { kinds: byKind } : {}) });
  };

  const pill = (on: boolean) =>
    cx(
      'press h-9 shrink-0 rounded-pill px-3.5 text-sm font-semibold',
      on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
    );

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="The values are" className="flex flex-wrap gap-1.5">
        {PERS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={per === value}
            onClick={() => setPer(value)}
            className={pill(per === value)}
          >
            {PER_LABEL[value].replace(/^./, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {kinds.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[0.8125rem] font-semibold text-ink-700">Values for</span>
          <div
            role="radiogroup"
            aria-label="Values for"
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] md:flex-wrap"
          >
            {['', ...kinds].map((name) => (
              <button
                key={name || 'base'}
                type="button"
                role="radio"
                aria-checked={kind === name}
                onClick={() => setKind(name)}
                className={pill(kind === name)}
              >
                {name || `${product.name} (all kinds)`}
              </button>
            ))}
          </div>
          {kind ? (
            <p className="text-sm text-ink-600">
              Only where {kind} differs. Empty: the values above count for it.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {MAIN_KEYS.map((key) => (
          <TextField
            key={key}
            dense
            label={key === 'kcal' ? 'Energy (kcal)' : `${NUTRIENT_LABEL[key]} (g)`}
            inputMode="decimal"
            value={form[key] ?? ''}
            onChange={(event) => set(key, event.target.value)}
          />
        ))}
        {EXTRA_KEYS.map((key) => (
          <TextField
            key={key}
            dense
            label={`${NUTRIENT_LABEL[key]} (g)`}
            inputMode="decimal"
            placeholder="Optional"
            value={form[key] ?? ''}
            onChange={(event) => set(key, event.target.value)}
          />
        ))}
      </div>

      {error ? <p className="text-sm font-semibold text-danger-600">{error}</p> : null}

      <Button fullWidth onClick={submit} loading={save.isPending && save.variables !== null}>
        Save
      </Button>
      {own ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => save.mutate(null)}
          loading={save.isPending && save.variables === null}
        >
          Use typical values
        </Button>
      ) : null}
    </div>
  );
}
