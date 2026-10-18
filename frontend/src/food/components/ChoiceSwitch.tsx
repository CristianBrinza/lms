import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import type { Translations } from '@/i18n';
import { foodUiT } from './components.i18n';

/**
 * A recipe's choice as a segmented control — "Drink: Creamy coffee | Tea" — the option in use
 * filled. An option that can't be made from the kitchen now carries a small peach dot.
 */
export function ChoiceSwitch({
  choice,
  value,
  onChange,
  ready,
  disabled,
  className,
}: {
  choice: {
    name: string;
    translations?: Translations;
    options: Array<{ id: string; name: string; translations?: Translations }>;
  };
  value: string | null;
  onChange: (optionId: string) => void;
  /** Per option id: whether all of it is in the kitchen (left out: not shown). */
  ready?: Record<string, boolean>;
  disabled?: boolean;
  className?: string;
}) {
  const t = foodUiT().choice;
  const name = tr(choice, 'name');
  return (
    <div className={cx('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}>
      <span className="text-sm font-bold">{name}</span>
      <div
        role="radiogroup"
        aria-label={t.pick(name)}
        className="-mx-1 flex min-w-0 max-w-full flex-1 overflow-x-auto px-1 [scrollbar-width:none]"
      >
        <div className="flex min-w-full gap-1 rounded-pill bg-ink-50 p-1">
          {choice.options.map((option) => {
            const on = option.id === value;
            const short = ready?.[option.id] === false;
            const label = tr(option, 'name');
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={short ? `${label}, ${t.missing}` : label}
                disabled={disabled}
                onClick={() => !on && onChange(option.id)}
                className={cx(
                  'press inline-flex h-8 flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-pill px-3 text-sm font-semibold transition-colors disabled:cursor-default',
                  on ? 'bg-ink-900 text-white shadow-xs' : 'text-ink-700 hover:bg-white/70',
                )}
              >
                {label}
                {short ? (
                  <span
                    aria-hidden="true"
                    className={cx('size-1.5 rounded-full', on ? 'bg-peach-200' : 'bg-peach-800')}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
