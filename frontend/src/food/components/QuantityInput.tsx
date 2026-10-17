import { useId, useState } from 'react';
import { AddIcon, RemoveIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { formatAmount, parseAmount, unitWord } from '../format';
import type { Unit } from '../types';
import { foodUiT } from './components.i18n';

const STEPS: Record<Unit, number> = {
  pcs: 1,
  g: 50,
  kg: 0.1,
  ml: 50,
  l: 0.25,
  tsp: 1,
  tbsp: 1,
  cup: 0.5,
};
/** The item's own units (slice, pack) step one at a time. */
const stepOf = (unit: string) => STEPS[unit as Unit] ?? 1;
/** A unit as shown beside a number, in the current language ("buc.", "felii", "шт."). */
const labelOf = (unit: string, count: number) => unitWord(unit, count);

const clean = (value: number) => Math.round(value * 1000) / 1000;

interface QuantityInputProps {
  label: string;
  value: number | null;
  unit: string;
  units: string[];
  onChange: (value: number | null, unit: string) => void;
  /** One-tap amounts under the field ("¼", "½", "All"). */
  quick?: Array<{ label: string; value: number; unit?: string }>;
  error?: string;
  autoFocus?: boolean;
}

/**
 * How much: a big number between − and + (steps that suit the unit: 1 piece, 50 g, 0.1 kg),
 * typed freely with a comma or a point, and the units the item can be counted in as pills.
 */
export function QuantityInput({
  label,
  value,
  unit,
  units,
  onChange,
  quick,
  error,
  autoFocus,
}: QuantityInputProps) {
  const t = foodUiT().quantity;
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
    const size = stepOf(unit);
    const base = value ?? 0;
    const next = clean(
      direction === 1
        ? Math.floor(base / size + 1e-9) * size + size
        : Math.ceil(base / size - 1e-9) * size - size,
    );
    haptic('tap');
    onChange(next > 0 ? next : null, unit);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-[0.8125rem] font-semibold text-ink-700">
        {label}
      </label>
      <div
        className={cx(
          'flex items-center gap-2 rounded-[1.25rem] p-1.5',
          error ? 'bg-danger-50 ring-2 ring-inset ring-danger-600' : 'bg-ink-50',
        )}
      >
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={!value}
          aria-label={t.less(formatAmount(stepOf(unit), unit))}
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
          <span className="shrink-0 text-base font-semibold text-ink-500">
            {labelOf(unit, value ?? 0)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t.more(formatAmount(stepOf(unit), unit))}
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
                    option === unit
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  )}
                >
                  {labelOf(option, value || 1)}
                </button>
              ))
            : null}
          {quick?.length ? (
            <span
              aria-hidden="true"
              className={cx('mx-1 h-5 w-px bg-ink-200', units.length < 2 && 'hidden')}
            />
          ) : null}
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
