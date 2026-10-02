import { useId, useState } from 'react';
import { AddIcon, RemoveIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { parseAmount } from '../format';
import type { Unit } from '../types';

const STEP: Record<Unit, number> = { pcs: 1, g: 50, kg: 0.1, ml: 50, l: 0.25, tsp: 1, tbsp: 1, cup: 0.5 };
const UNIT_LABEL: Record<Unit, string> = { pcs: 'pcs', g: 'g', kg: 'kg', ml: 'ml', l: 'l', tsp: 'tsp', tbsp: 'tbsp', cup: 'cup' };

const clean = (value: number) => Math.round(value * 1000) / 1000;

interface QuantityInputProps {
  label: string;
  value: number | null;
  unit: Unit;
  units: Unit[];
  onChange: (value: number | null, unit: Unit) => void;
  /** One-tap amounts under the field ("¼", "½", "All"). */
  quick?: Array<{ label: string; value: number; unit?: Unit }>;
  error?: string;
  autoFocus?: boolean;
}

/**
 * How much: a big number between − and + (steps that suit the unit: 1 piece, 50 g, 0.1 kg),
 * typed freely with a comma or a point, and the units the item can be counted in as pills.
 */
export function QuantityInput({ label, value, unit, units, onChange, quick, error, autoFocus }: QuantityInputProps) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  // A value set from outside (a step, a quick pick, a unit change) shows in the field; what is being
  // typed ("1," on the way to "1,5") is left alone.
  const [shown, setShown] = useState(value);
  if (value !== shown) {
    setShown(value);
    if (parseAmount(text) !== value) setText(value === null ? '' : String(value));
  }

  const step = (direction: 1 | -1) => {
    const size = STEP[unit];
    const base = value ?? 0;
    const next = clean(direction === 1 ? Math.floor(base / size + 1e-9) * size + size : Math.ceil(base / size - 1e-9) * size - size);
    haptic('tap');
    onChange(next > 0 ? next : null, unit);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink-700">
        {label}
      </label>
      <div className={cx('flex items-center gap-2 rounded-[1.25rem] p-1.5', error ? 'bg-danger-50 ring-2 ring-inset ring-danger-600' : 'bg-ink-50')}>
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!value}
          aria-label={`Less (${STEP[unit]} ${UNIT_LABEL[unit]})`}
          className="press grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[1.4rem] shadow-xs transition-opacity disabled:opacity-40"
        >
          <RemoveIcon fontSize="inherit" />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1.5">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            value={text}
            placeholder="0"
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setText(event.target.value);
              onChange(parseAmount(event.target.value), unit);
            }}
            onFocus={(event) => event.target.select()}
            className="tabular w-full min-w-0 bg-transparent text-right text-[1.75rem] font-bold tracking-[-0.03em] text-ink-900 outline-none placeholder:text-ink-300"
            style={{ maxWidth: `${Math.max(2, text.length + 1)}ch` }}
          />
          <span className="shrink-0 text-base font-semibold text-ink-500">{UNIT_LABEL[unit]}</span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={`More (${STEP[unit]} ${UNIT_LABEL[unit]})`}
          className="press grid size-12 shrink-0 place-items-center rounded-2xl bg-ink-900 text-[1.4rem] text-white"
        >
          <AddIcon fontSize="inherit" />
        </button>
      </div>
      {error ? <p className="animate-rise text-sm font-medium text-danger-600">{error}</p> : null}
      {units.length > 1 || quick?.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {units.length > 1
            ? units.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={option === unit}
                  onClick={() => onChange(value, option)}
                  className={cx(
                    'press h-9 min-w-11 rounded-pill px-3 text-sm font-semibold transition-colors',
                    option === unit ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  )}
                >
                  {UNIT_LABEL[option]}
                </button>
              ))
            : null}
          {quick?.length ? <span aria-hidden="true" className={cx('mx-1 h-5 w-px bg-ink-200', units.length < 2 && 'hidden')} /> : null}
          {quick?.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                haptic('tap');
                onChange(option.value, option.unit ?? unit);
              }}
              className="press h-9 rounded-pill bg-butter-100 px-3.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-butter-200"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
