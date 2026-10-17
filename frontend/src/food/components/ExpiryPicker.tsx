import { useId } from 'react';
import { CalendarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { addDays, dayLong, localDate } from '../format';
import { foodUiT } from './components.i18n';

const QUICK = [
  { days: 3, say: (t: Words) => t.days(3) },
  { days: 7, say: (t: Words) => t.weeks(1) },
  { days: 14, say: (t: Words) => t.weeks(2) },
  { days: 30, say: (t: Words) => t.months(1) },
  { days: 90, say: (t: Words) => t.months(3) },
];
type Words = ReturnType<typeof foodUiT>['expiry'];

/**
 * Best-before in one tap: no date, a few typical spans, or any day from the calendar. The line
 * underneath says the actual date, so a guess never stays vague.
 */
export function ExpiryPicker({
  value,
  onChange,
  label,
  today = localDate(),
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  today?: string;
}) {
  const t = foodUiT().expiry;
  const id = useId();
  const chip = (active: boolean) =>
    cx(
      'press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-semibold transition-colors',
      active ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
    );
  const matched = QUICK.find((q) => addDays(today, q.days) === value);
  return (
    <fieldset className="flex min-w-0 flex-col gap-2.5">
      <legend className="mb-2.5 text-[0.8125rem] font-semibold text-ink-700">
        {label ?? t.label}
      </legend>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={chip(value === null)}
        >
          {t.noDate}
        </button>
        {QUICK.map((q) => (
          <button
            key={q.days}
            type="button"
            aria-pressed={matched === q}
            onClick={() => onChange(addDays(today, q.days))}
            className={chip(matched === q)}
          >
            {q.say(t)}
          </button>
        ))}
        <label
          htmlFor={id}
          className={cx(chip(Boolean(value && !matched)), 'relative cursor-pointer')}
        >
          <CalendarIcon fontSize="inherit" className="text-base" />
          {t.pick}
          <input
            id={id}
            type="date"
            value={value ?? ''}
            min={addDays(today, -30)}
            onChange={(event) => onChange(event.target.value || null)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
      <p className="text-sm font-medium text-ink-600">
        {value ? t.keepsUntil(dayLong(value)) : t.noBestBefore}
      </p>
    </fieldset>
  );
}
