import { CheckIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { altLabel, formatAmount, formatQty } from '../format';
import type { IngredientLine } from '../types';

/**
 * An ingredient that can be one thing or another (milk, or whipped cream): every option as a pill
 * with whether there is enough of it, the one that will be used marked. Tap one to use it.
 */
export function OptionChips({ line, value, onChange, disabled }: { line: IngredientLine; value: number; onChange: (choice: number) => void; disabled?: boolean }) {
  if (!line.alternatives.length) return null;
  const options = [
    {
      label: `${line.name.toLowerCase()}${line.variant ? ` (${line.variant.toLowerCase()})` : ''}`,
      enough: line.mainEnough,
      detail: line.amount && line.unit ? formatAmount(line.amount, line.unit) : null,
      short: line.mainEnough === false && line.baseUnit && line.mainMissing ? formatQty(line.mainMissing, { unit: line.baseUnit }) : null,
    },
    ...line.alternatives.map((alt) => ({
      label: altLabel(alt),
      enough: alt.enough,
      detail: alt.amount && alt.unit ? formatAmount(alt.amount, alt.unit) : null,
      short: alt.enough === false && alt.baseUnit && alt.missing ? formatQty(alt.missing, { unit: alt.baseUnit }) : null,
    })),
  ];
  return (
    <div role="radiogroup" aria-label={`${line.name}: use`} className="mt-1.5 flex flex-wrap gap-1.5">
      {options.map((option, index) => {
        const on = index === value;
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(index)}
            className={cx(
              'press inline-flex h-8 items-center gap-1 rounded-pill px-2.5 text-xs font-semibold transition-colors disabled:cursor-default',
              on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
            )}
          >
            {on ? <CheckIcon fontSize="inherit" className="text-sm" /> : null}
            <span>{option.label.charAt(0).toUpperCase() + option.label.slice(1)}</span>
            {option.detail && index > 0 ? <span className={on ? 'text-white/70' : 'text-ink-500'}>{option.detail}</span> : null}
            <span
              className={cx(
                'ml-0.5 rounded-pill px-1.5 py-px text-[0.6875rem]',
                option.enough === false ? (on ? 'bg-peach-200 text-ink-900' : 'bg-peach-100 text-peach-800') : on ? 'bg-white/15' : 'bg-mint-100 text-mint-800',
              )}
            >
              {option.enough === false ? (option.short ? `need ${option.short}` : 'none') : 'have'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
