import { intlLocale } from '@/i18n';
import type { CabinetMedicine, ExpiryState, Package } from './api';

/** Medication's small pure helpers: reading an expiry as it is printed, grouping, amounts. */

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * An expiry as typed from a box: "03/2027", "3/27", "2027-03", "31.03.2027", "2027-03-31".
 * Returns `YYYY-MM` when only the month is printed, `YYYY-MM-DD` for a day, null when it isn't a date.
 */
export function parseExpiry(text: string): string | null {
  const value = text.trim().replace(/\s+/g, '');
  if (!value) return null;
  const year = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (match) return day(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{4})[-/.](\d{1,2})$/.exec(value);
  if (match) return month(Number(match[1]), Number(match[2]));
  match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(value);
  if (match) return day(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})[./-](\d{2}|\d{4})$/.exec(value);
  if (match) return month(year(match[2]!), Number(match[1]));
  return null;
}

function month(y: number, m: number): string | null {
  return m >= 1 && m <= 12 && y >= 2000 && y <= 2100 ? `${y}-${pad(m)}` : null;
}
function day(y: number, m: number, d: number): string | null {
  return month(y, m) && d >= 1 && d <= daysIn(y, m) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** An expiry back into the box's way of writing it: 03/2027, or 31.03.2027 when a day is known. */
export function expiryText(expiresOn: string | null, monthOnly: boolean): string {
  if (!expiresOn) return '';
  const [y, m, d] = expiresOn.split('-');
  return monthOnly ? `${m}/${y}` : `${d}.${m}.${y}`;
}

/** Up to two decimals, no trailing zeros: 1, 0.5, 2.25. */
export const formatAmount = (n: number) => String(Math.round(n * 100) / 100);

export const TONES: Record<ExpiryState, string> = {
  ok: 'bg-mint-200 text-mint-800',
  soon: 'bg-butter-300 text-ink-900',
  expired: 'bg-danger-100 text-danger-700',
  none: 'bg-ink-100 text-ink-700',
};

export interface PlaceGroup {
  place: string;
  entries: Array<{ medicine: CabinetMedicine; packages: Package[] }>;
}

/**
 * The cabinet grouped by where things are kept: a medicine appears under each place that holds one of
 * its packages. Named places first, A to Z; packages without a place last.
 */
export function groupByPlace(medicines: CabinetMedicine[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const medicine of medicines) {
    const places = medicine.packages.length ? [...new Set(medicine.packages.map((p) => p.place))] : [''];
    for (const place of places) {
      const group = groups.get(place) ?? { place, entries: [] };
      group.entries.push({ medicine, packages: medicine.packages.filter((p) => p.place === place) });
      groups.set(place, group);
    }
  }
  return [...groups.values()].sort((a, b) =>
    a.place === b.place ? 0 : !a.place ? 1 : !b.place ? -1 : a.place.localeCompare(b.place),
  );
}

/** Times of day for "1, 2, 3, 4 times a day". */
export function presetTimes(count: number): string[] {
  const presets: Record<number, string[]> = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '16:00', '20:00'],
  };
  return presets[count] ?? presets[1]!;
}

/** Local date as YYYY-MM-DD. */
export const isoDate = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Mon … Sun by number (1 = Monday), in the current language. */
export function weekdayShort(n: number): string {
  return new Intl.DateTimeFormat(intlLocale(), { weekday: 'short' }).format(new Date(2024, 0, n));
}
