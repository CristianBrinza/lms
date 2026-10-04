import type { Reminder } from '@/food/types';

/** How reminders read: kinds, days (1 = Monday … 7 = Sunday, as the API keeps them), times. */

export const KIND_LABEL: Record<Reminder['kind'], string> = {
  shopping: 'Shopping before coming home',
  prep: 'Prepare tomorrow’s to-go food',
  expiring: 'Food about to expire',
  meal: 'Before each meal',
  custom: 'Custom',
};

export const DAYS = [
  { value: 1, short: 'M', abbr: 'Mon', long: 'Monday' },
  { value: 2, short: 'T', abbr: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'W', abbr: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'T', abbr: 'Thu', long: 'Thursday' },
  { value: 5, short: 'F', abbr: 'Fri', long: 'Friday' },
  { value: 6, short: 'S', abbr: 'Sat', long: 'Saturday' },
  { value: 7, short: 'S', abbr: 'Sun', long: 'Sunday' },
] as const;

export const MINUTES_BEFORE = [15, 30, 45, 60, 90, 120];

/** "Every day", "Weekdays", "Weekends", else "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'Every day';
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return 'Weekdays';
  if (set.size === 2 && set.has(6) && set.has(7)) return 'Weekends';
  return DAYS.filter((d) => set.has(d.value))
    .map((d) => d.abbr)
    .join(', ');
}

/** "18:30 · Every day", "45 min before · Weekdays". */
export function reminderWhen(
  reminder: Pick<Reminder, 'kind' | 'time' | 'minutesBefore' | 'days'>,
): string {
  const at =
    reminder.kind === 'meal'
      ? `${reminder.minutesBefore ?? 45} min before`
      : (reminder.time ?? '—');
  return `${at} · ${daysLabel(reminder.days)}`;
}
