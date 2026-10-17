import { intlLocale } from '@/i18n';
import type { Reminder } from '@/food/types';
import { settingsT } from './i18n';

/** How reminders read: kinds, days (1 = Monday … 7 = Sunday, as the API keeps them), times. */

export const kindLabel = (kind: Reminder['kind']): string => settingsT().kind[kind];

export const DAY_VALUES = [1, 2, 3, 4, 5, 6, 7] as const;

/** A day's name from Intl, in the app's language: 1 = Monday (1 January 2024 was one). */
function dayName(value: number, weekday: 'narrow' | 'short' | 'long'): string {
  return new Intl.DateTimeFormat(intlLocale(), { weekday }).format(new Date(2024, 0, value));
}

/** The week, Monday first: "M" / "Mon" / "Monday" (or "L" / "lun." / "luni", "П" / "пн" / "понедельник"). */
export function weekDays() {
  return DAY_VALUES.map((value) => ({
    value,
    short: dayName(value, 'narrow'),
    abbr: dayName(value, 'short'),
    long: dayName(value, 'long'),
  }));
}

export const MINUTES_BEFORE = [15, 30, 45, 60, 90, 120];

/** "Every day", "Weekdays", "Weekends", else "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  const t = settingsT();
  const set = new Set(days);
  if (set.size === 7) return t.everyDay;
  if (set.size === 5 && [1, 2, 3, 4, 5].every((d) => set.has(d))) return t.weekdays;
  if (set.size === 2 && set.has(6) && set.has(7)) return t.weekends;
  return weekDays()
    .filter((d) => set.has(d.value))
    .map((d) => d.abbr)
    .join(', ');
}

/** "18:30 · Every day", "45 min before · Weekdays". */
export function reminderWhen(
  reminder: Pick<Reminder, 'kind' | 'time' | 'minutesBefore' | 'days'>,
): string {
  const at =
    reminder.kind === 'meal'
      ? settingsT().minBefore(reminder.minutesBefore ?? 45)
      : (reminder.time ?? '—');
  return `${at} · ${daysLabel(reminder.days)}`;
}
