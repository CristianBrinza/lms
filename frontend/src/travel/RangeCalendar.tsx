import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons';
import { localDate, parseDay } from '@/food/format';
import { cx } from '@/lib/cx';

const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Pick the days of a trip on a month: the first tap is the day you leave, the second the day you
 * come back (the same day again: a day trip). A third tap starts over.
 */
export function RangeCalendar({
  start,
  end,
  onChange,
}: {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = parseDay(start);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  // Waiting for the second tap (the day back).
  const [picking, setPicking] = useState(false);
  const today = localDate();

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const lead = (first.getDay() + 6) % 7; // Monday first
  const daysIn = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<string | null> = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysIn }, (_, i) =>
      ymd(new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ),
  ];

  const tap = (day: string) => {
    if (!picking || day < start) {
      onChange(day, day);
      setPicking(true);
    } else {
      onChange(start, day);
      setPicking(false);
    }
  };
  const shift = (by: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + by, 1));

  return (
    <div className="rounded-[1.25rem] bg-ink-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Previous month"
          className="press grid size-10 place-items-center rounded-full text-[1.3rem] text-ink-700 hover:bg-white"
        >
          <ChevronLeftIcon fontSize="inherit" />
        </button>
        <p className="text-[0.9375rem] font-bold" aria-live="polite">
          {monthName.format(month)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Next month"
          className="press grid size-10 place-items-center rounded-full text-[1.3rem] text-ink-700 hover:bg-white"
        >
          <ChevronRightIcon fontSize="inherit" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-ink-500">
        {WEEKDAYS.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <span key={`lead-${i}`} />;
          const inRange = day >= start && day <= end;
          const edge = day === start || day === end;
          const past = day < today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => tap(day)}
              aria-pressed={inRange}
              aria-label={`${parseDay(day).toDateString()}${day === start ? ', leaving' : ''}${day === end ? ', back' : ''}`}
              className={cx(
                'press relative h-10 text-[0.9375rem] font-semibold tabular',
                inRange && !edge && 'bg-cyan-100',
                day === start && end > start && 'rounded-l-full bg-cyan-100',
                day === end && end > start && 'rounded-r-full bg-cyan-100',
              )}
            >
              <span
                className={cx(
                  'mx-auto grid size-10 place-items-center rounded-full',
                  edge
                    ? 'bg-ink-900 text-white'
                    : past
                      ? 'text-ink-400'
                      : 'text-ink-900 hover:bg-white',
                  day === today && !edge && 'ring-2 ring-inset ring-cyan-400',
                )}
              >
                {parseDay(day).getDate()}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-xs font-medium text-ink-600">
        {picking ? 'Now tap the day you come back' : 'Tap the day you leave, then the day back'}
      </p>
    </div>
  );
}
