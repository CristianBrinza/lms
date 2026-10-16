import { getLocale, intlLocale, type Locale } from '@/i18n';

/** Dates and names, in the app's language (English, Romanian or Russian). */

/** One formatter per language and options, made on first use. */
function cached<T>(make: (tag: string) => T): () => T {
  const made = new Map<Locale, T>();
  return () => {
    const locale = getLocale();
    let value = made.get(locale);
    if (!value) {
      value = make(intlLocale(locale));
      made.set(locale, value);
    }
    return value;
  };
}

const dayFormat = cached(
  (tag) => new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }),
);
const shortDateFormat = cached(
  (tag) => new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short', year: 'numeric' }),
);
const timeFormat = cached(
  (tag) => new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }),
);
const relativeFormat = cached((tag) => new Intl.RelativeTimeFormat(tag, { numeric: 'auto' }));
const shortDate = { format: (date: Date) => shortDateFormat().format(date) };
const relative = {
  format: (value: number, unit: Intl.RelativeTimeFormatUnit) => relativeFormat().format(value, unit),
};

export const formatDay = (date: Date) => dayFormat().format(date);
export const formatDate = (iso: string) => shortDate.format(new Date(iso));

/** "just now", "5 minutes ago", "yesterday", then a date. */
export function formatAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Never';
  const then = new Date(iso);
  const seconds = Math.round((then.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return 'Just now';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day');
  return shortDate.format(then);
}

export const formatTime = (iso: string) => timeFormat().format(new Date(iso));

/** Morning, afternoon or evening, by the device clock. */
export function partOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function fullName(person: { name: string; surname: string }): string {
  return `${person.name} ${person.surname}`.trim();
}

export function initials(person: { name: string; surname: string }): string {
  const letters = [person.name, person.surname]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean);
  return (letters.join('') || '?').toUpperCase();
}

/** "iPhone · Safari", "Mac · Chrome" from a user agent, for the devices list. */
export function describeDevice(userAgent: string): string {
  const ua = userAgent || '';
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh|Mac OS X/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows PC'
            : /Linux/.test(ua)
              ? 'Linux'
              : 'Device';
  const browser = /EdgiOS|EdgA|Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /FxiOS|Firefox\//.test(ua)
        ? 'Firefox'
        : /CriOS|Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : '';
  return browser ? `${device} · ${browser}` : device;
}
