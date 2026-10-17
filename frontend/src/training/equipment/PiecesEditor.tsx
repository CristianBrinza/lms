import { useState } from 'react';
import { Button, TextField } from '@/components/ui';
import { AddIcon, CloseIcon } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';
import { kg } from '../format';
import { trainingT } from '../i18n';
import type { Piece } from '../types';
import { equipmentT, useEquipmentT } from './equipment.i18n';

/** What the pieces of a kind are called: a set of bands, the grips of a bar. */
function piecesLabel(kind: string): { title: string; hint: string; name: string; withKg: boolean } {
  const { pieces } = equipmentT();
  if (kind === 'bands') return { ...pieces.bands, withKg: true };
  if (
    kind === 'pullup_bar' ||
    kind === 'dip_bars' ||
    kind === 'rings' ||
    kind === 'suspension' ||
    kind === 'parallettes'
  )
    return { ...pieces.grips, withKg: false };
  return { ...pieces.parts, withKg: true };
}

/**
 * The pieces of one piece of equipment, each a chip (with its kg when it has one); a name and an
 * optional kg add one; the catalog's usual ones are a tap away.
 */
export function PiecesEditor({
  kind,
  value,
  onChange,
  suggestions = [],
}: {
  kind: string;
  value: Piece[];
  onChange: (value: Piece[]) => void;
  suggestions?: Piece[];
}) {
  const t = useEquipmentT();
  const unitKg = trainingT().unit.kg;
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const label = piecesLabel(kind);
  const has = (n: string) => value.some((p) => p.name.toLowerCase() === n.trim().toLowerCase());
  const add = (piece: Piece) => {
    if (!piece.name.trim() || has(piece.name) || value.length >= 30) return;
    haptic('tap');
    onChange([...value, { name: piece.name.trim(), kg: piece.kg }]);
  };
  const typedKg = Number(weight.replace(',', '.'));
  const left = suggestions.filter((s) => !has(s.name));
  return (
    <fieldset>
      <legend className="mb-0.5 text-[0.8125rem] font-semibold text-ink-700">{label.title}</legend>
      <p className="mb-2 text-xs text-ink-500">{label.hint}</p>
      {value.length ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" aria-label={label.title}>
          {value.map((p) => (
            <li
              key={p.name}
              className="inline-flex h-10 items-center gap-1 rounded-pill bg-lav-100 pr-1 pl-3.5 text-sm font-semibold text-ink-900"
            >
              {p.name}
              {p.kg !== null ? <span className="tabular text-lav-800">· {kg(p.kg)}</span> : null}
              <button
                type="button"
                aria-label={t.removeWhat(p.name)}
                onClick={() => onChange(value.filter((x) => x.name !== p.name))}
                className="press grid size-8 place-items-center rounded-full text-base text-ink-700 hover:bg-lav-200"
              >
                <CloseIcon fontSize="inherit" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add({
            name,
            kg:
              label.withKg && weight.trim() && Number.isFinite(typedKg) && typedKg >= 0
                ? typedKg
                : null,
          });
          setName('');
          setWeight('');
        }}
      >
        <TextField
          label={label.title}
          hideLabel
          dense
          className="min-w-0 flex-1"
          placeholder={label.name}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
        />
        {label.withKg ? (
          <TextField
            label={unitKg}
            hideLabel
            dense
            className="w-20 shrink-0"
            inputMode="decimal"
            placeholder={unitKg}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        ) : null}
        <Button
          type="submit"
          size="sm"
          variant="tint"
          icon={AddIcon}
          disabled={!name.trim()}
          className="h-11 shrink-0"
        >
          {t.add}
        </Button>
      </form>
      {left.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {left.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => add(s)}
              className="press inline-flex h-9 items-center gap-1 rounded-pill bg-white px-3 text-sm font-semibold text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-lav-50"
            >
              <AddIcon fontSize="inherit" className="text-ink-500" />
              {s.name}
              {s.kg !== null ? <span className="tabular text-ink-500">{kg(s.kg)}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
