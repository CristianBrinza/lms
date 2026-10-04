import { useId, useState } from 'react';
import { AddIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

/**
 * Which kind: the item's kinds as pills (Cheddar, Gouda; Finlandia, Absolut; Apple, Mango-peach),
 * "Any" first, and "Other…" to name a new one — it is remembered for next time.
 */
export function VariantChips({
  variants,
  value,
  onChange,
  label = 'Kind',
  anyLabel = 'Any',
}: {
  variants: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  anyLabel?: string;
}) {
  const id = useId();
  const custom = Boolean(value) && !variants.some((v) => v.toLowerCase() === value.toLowerCase());
  const [typing, setTyping] = useState(custom);
  const options = ['', ...variants];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:flex-wrap">
        {options.map((option) => {
          const on = !typing && option.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={option || 'any'}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setTyping(false);
                onChange(option);
              }}
              className={cx(
                'press h-9 shrink-0 rounded-pill px-3.5 text-sm font-semibold transition-colors',
                on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              {option || anyLabel}
            </button>
          );
        })}
        {typing ? (
          <span className="inline-flex h-9 shrink-0 items-center rounded-pill bg-white px-3 ring-2 ring-ink-900">
            <label htmlFor={id} className="sr-only">
              Another kind
            </label>
            <input
              id={id}
              autoFocus
              value={value}
              maxLength={40}
              placeholder="Another kind"
              onChange={(event) => onChange(event.target.value)}
              className="w-32 bg-transparent text-sm font-semibold outline-none"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setTyping(true);
              onChange('');
            }}
            className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-butter-100 px-3 text-sm font-semibold hover:bg-butter-200"
          >
            <AddIcon fontSize="inherit" className="text-base" />
            Other
          </button>
        )}
      </div>
    </div>
  );
}
