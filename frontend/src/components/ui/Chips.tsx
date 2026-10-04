import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import type { IconComponent } from './icons';

interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
  /** A leading icon, like the learning app's "Logic / Visual / Focus" chips. */
  icon?: IconComponent;
}

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: ChipOption<T>[];
  onChange: (value: T) => void;
  /** On the lavender field: white idle, ink chosen (the task app). On white: cream idle, butter chosen (the yellow app). */
  tone?: 'field' | 'sheet';
  /** Shorter pills (36px) for filter rows on working screens. */
  dense?: boolean;
  className?: string;
}

/**
 * One choice out of a few, as a row of pills (the reference's "All Tasks / In Progress /
 * Completed"): the chosen one is ink, the rest wait in white. A radio group to assistive tech,
 * with arrow keys moving the choice. Scrolls sideways when the row is wider than the screen.
 */
export function Chips<T extends string>({
  label,
  value,
  options,
  onChange,
  tone = 'field',
  dense,
  className,
}: ChipsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx('-mx-1 flex gap-2 overflow-x-auto px-1 py-1 [scrollbar-width:none]', className)}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              'press inline-flex shrink-0 items-center rounded-pill font-medium',
              dense ? 'h-9 gap-1.5 px-3.5 text-sm' : 'h-11 gap-2 px-5 text-[0.9375rem]',
              tone === 'field'
                ? active
                  ? 'bg-ink-900 text-white'
                  : 'bg-white text-ink-800 hover:bg-lav-50'
                : active
                  ? 'bg-butter-300 text-ink-900'
                  : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
            )}
          >
            {option.icon ? (
              <option.icon fontSize="inherit" className="-ml-1 text-[1.2rem]" />
            ) : null}
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cx(
                  'tabular rounded-pill px-1.5 text-xs font-semibold',
                  active && tone === 'field'
                    ? 'bg-white/15 text-white'
                    : 'bg-ink-900/6 text-ink-700',
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
