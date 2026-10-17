import { useId, useState } from 'react';
import { AddIcon, CloseIcon, RemoveIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import {
  capitalized,
  formatQty,
  fromBase,
  packageRowText,
  packagesTotal,
  packageSizes,
  packageWord,
  parseAmount,
  toBase,
  unitWord,
  type Measured,
} from '../format';
import type { CustomUnit } from '../types';
import { foodUiT } from './components.i18n';

export interface PackageRow {
  count: number;
  /** What one holds, in the item's base unit. */
  size: number;
}

/** The units a size is typed in: litres or millilitres, grams or kilos, pieces. */
const SIZE_UNITS: Record<Measured['unit'], string[]> = {
  ml: ['l', 'ml'],
  g: ['g', 'kg'],
  pcs: ['pcs'],
};

/**
 * What was bought, package by package: "1 bottle of 1.25 l and 2 of 0.5 l", "a jar of 14
 * pickles", "a loaf of 16 slices". Each row is a count and a size (tap a usual size, or type
 * another); each size becomes its own piece in the kitchen.
 */
export function PackagesInput({
  product,
  packages,
  packageName,
  onPackageName,
  rows,
  onChange,
  label,
}: {
  product: Measured;
  packages: CustomUnit[];
  packageName: string;
  onPackageName: (name: string) => void;
  rows: PackageRow[];
  onChange: (rows: PackageRow[]) => void;
  label?: string;
}) {
  const t = foodUiT().packages;
  const unit = packages.find((p) => p.name === packageName) ?? packages[0]!;
  const sizes = packageSizes(unit);
  const total = rows.reduce((sum, row) => sum + row.count * row.size, 0);
  const count = rows.reduce((sum, row) => sum + row.count, 0);
  const set = (index: number, next: PackageRow | null) =>
    onChange(
      next ? rows.map((row, i) => (i === index ? next : row)) : rows.filter((_, i) => i !== index),
    );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.8125rem] font-semibold text-ink-700">{label ?? t.label}</span>
        {packages.length > 1 ? (
          <div
            className="flex flex-wrap justify-end gap-1"
            role="radiogroup"
            aria-label={t.package}
          >
            {packages.map((p) => (
              <button
                key={p.name}
                type="button"
                role="radio"
                aria-checked={p.name === unit.name}
                onClick={() => {
                  onPackageName(p.name);
                  // Another kind of package: its usual size.
                  onChange(rows.map((row) => ({ ...row, size: p.size })));
                }}
                className={cx(
                  'press h-8 rounded-pill px-3 text-sm font-semibold',
                  p.name === unit.name
                    ? 'bg-ink-900 text-white'
                    : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                )}
              >
                {capitalized(packageWord(p.name, 1, p))}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <li key={index} className="rounded-[1.25rem] bg-ink-50 p-1.5">
            <div className="flex items-center gap-2">
              <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-white p-1 shadow-xs">
                <button
                  type="button"
                  aria-label={t.oneFewer}
                  onClick={() => {
                    haptic('tap');
                    if (row.count > 1) set(index, { ...row, count: row.count - 1 });
                    else if (rows.length > 1) set(index, null);
                  }}
                  disabled={row.count <= 1 && rows.length === 1}
                  className="press grid size-9 place-items-center rounded-xl text-[1.2rem] disabled:opacity-40"
                >
                  <RemoveIcon fontSize="inherit" />
                </button>
                <span className="tabular min-w-6 text-center text-lg font-bold">{row.count}</span>
                <button
                  type="button"
                  aria-label={t.oneMore}
                  onClick={() => {
                    haptic('tap');
                    set(index, { ...row, count: row.count + 1 });
                  }}
                  className="press grid size-9 place-items-center rounded-xl bg-ink-900 text-[1.2rem] text-white"
                >
                  <AddIcon fontSize="inherit" />
                </button>
              </div>
              <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
                {packageRowText(unit, row.count, row.size, product)}
              </span>
              {rows.length > 1 ? (
                <button
                  type="button"
                  aria-label={t.removeSize}
                  onClick={() => set(index, null)}
                  className="press grid size-9 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-white"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              ) : null}
            </div>
            <SizePicker
              product={product}
              sizes={sizes}
              value={row.size}
              onChange={(size) => set(index, { ...row, size })}
            />
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            onChange([...rows, { count: 1, size: rows[rows.length - 1]?.size ?? unit.size }])
          }
          className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-butter-100 px-3.5 text-sm font-semibold hover:bg-butter-200"
        >
          <AddIcon fontSize="inherit" className="text-base" />
          {t.anotherSize}
        </button>
        <span className="tabular min-w-0 truncate text-sm font-semibold text-ink-600">
          {count > 1 || rows.length > 1 ? packagesTotal(unit, count, total, product) : null}
        </span>
      </div>
    </div>
  );
}

/** The usual sizes as pills, and "Other" to type one (0.75 l, 380 g, 16). */
function SizePicker({
  product,
  sizes,
  value,
  onChange,
}: {
  product: Measured;
  sizes: number[];
  value: number;
  onChange: (size: number) => void;
}) {
  const t = foodUiT().packages;
  const id = useId();
  const units = SIZE_UNITS[product.unit];
  const known = sizes.includes(value);
  const [typing, setTyping] = useState(!known);
  const [sizeUnit, setSizeUnit] = useState(units[0]!);
  const [text, setText] = useState(known ? '' : String(fromBase(value, units[0]!, product)));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 px-0.5 pb-0.5">
      {sizes.map((size) => (
        <button
          key={size}
          type="button"
          aria-pressed={!typing && size === value}
          onClick={() => {
            setTyping(false);
            onChange(size);
          }}
          className={cx(
            'press h-8 rounded-pill px-2.5 text-[0.8125rem] font-semibold transition-colors',
            !typing && size === value
              ? 'bg-ink-900 text-white'
              : 'bg-white text-ink-700 hover:bg-butter-100',
          )}
        >
          {formatQty(size, product)}
        </button>
      ))}
      {typing ? (
        <span className="inline-flex h-8 items-center gap-1 rounded-pill bg-white pl-2.5 pr-1 ring-2 ring-ink-900">
          <label htmlFor={id} className="sr-only">
            {t.size}
          </label>
          <input
            id={id}
            autoFocus
            inputMode="decimal"
            value={text}
            placeholder={t.size}
            onChange={(event) => {
              setText(event.target.value);
              const amount = parseAmount(event.target.value);
              if (amount) onChange(toBase(amount, sizeUnit, product));
            }}
            className="tabular w-14 bg-transparent text-[0.8125rem] font-semibold outline-none"
          />
          {units.length > 1 ? (
            <button
              type="button"
              onClick={() => {
                const next = units[(units.indexOf(sizeUnit) + 1) % units.length]!;
                setSizeUnit(next);
                const amount = parseAmount(text);
                if (amount) onChange(toBase(amount, next, product));
              }}
              className="press h-6 rounded-pill bg-ink-100 px-2 text-xs font-bold"
              aria-label={t.sizeUnit(unitWord(sizeUnit, 2))}
            >
              {unitWord(sizeUnit, 2)}
            </button>
          ) : null}
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setTyping(true)}
          className="press h-8 rounded-pill bg-white px-2.5 text-[0.8125rem] font-semibold text-lav-700 hover:bg-butter-100"
        >
          {t.other}
        </button>
      )}
    </div>
  );
}
