import { localDate, relativeDay } from '@/food/format';
import { formatList, formatNumber, intlLocale } from '@/i18n';
import { watchingT } from './i18n';
import { splitMinutes } from './logic';
import type { DatePrecision, Summary } from './types';

/** Watching's numbers and dates in words, in the current language. */

/** 45 → "45 min", 130 → "2 h 10 min", 600 → "10 h", 725 → "12 h" (whole hours from 10 up). */
export function formatMinutes(total: number): string {
  const t = watchingT().time;
  const value = Math.max(0, Math.round(total));
  if (value < 60) return t.minutes(value);
  const h = Math.floor(value / 60);
  const m = value % 60;
  return h >= 10 || !m ? t.hours(h) : t.hoursMinutes(h, m);
}

/** Totals for "all time": "4 days 6 h", or hours and minutes under a day. */
export function formatLongMinutes(total: number): string {
  const t = watchingT().time;
  const { days, hours } = splitMinutes(total);
  if (!days) return formatMinutes(total);
  return hours ? `${t.days(days)} ${t.hours(hours)}` : t.days(days);
}

/**
 * The month's line, the reference's "7 episodes · 1 show · 2 movies · 9 plays": only what isn't
 * zero, plays last; empty when nothing was watched.
 */
export function monthLine(month: Summary): string {
  const c = watchingT().common;
  const parts: string[] = [];
  if (month.episodes) parts.push(c.episodes(month.episodes));
  if (month.shows) parts.push(c.shows(month.shows));
  if (month.movies) parts.push(c.movies(month.movies));
  if (month.plays) parts.push(c.plays(month.plays));
  return parts.join(' · ');
}

/** TMDB's 0–10 vote with one decimal ("7,8" in Romanian). */
export const formatVote = (vote: number | null | undefined) =>
  vote ? formatNumber(vote, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : null;

/** A month's name with its year: "October 2026", "octombrie 2026". */
export function monthName(month: string, withYear = true): string {
  const [y, m] = month.split('-').map(Number);
  const text = new Intl.DateTimeFormat(intlLocale(), {
    month: 'long',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(new Date(y!, m! - 1, 1, 12));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A short month for bars: "Oct". */
export const monthShortName = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(intlLocale(), { month: 'short' }).format(
    new Date(y!, m! - 1, 1, 12),
  );
};

/**
 * When something was watched: "Today", "Mon, 5 Oct", "5 Oct 2024"; "March 2025" when only the
 * month is known; "date unknown".
 */
export function watchedWhen(
  iso: string | null,
  precision?: DatePrecision,
  today = localDate(),
): string {
  if (!iso || precision === 'unknown') return watchingT().title.unknownDate;
  const day = localDate(new Date(iso));
  if (precision === 'month') return monthName(day.slice(0, 7));
  const date = new Date(iso);
  if (day.slice(0, 4) !== today.slice(0, 4))
    return new Intl.DateTimeFormat(intlLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  return relativeDay(day, today);
}

/** An air date ('2026-10-20') as "Tomorrow" / "Tue, 20 Oct" / "20 Oct 2027". */
export function airDay(day: string | null, today = localDate()): string {
  if (!day) return '';
  if (day.slice(0, 4) !== today.slice(0, 4))
    return new Intl.DateTimeFormat(intlLocale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(`${day.slice(0, 10)}T12:00:00`));
  return relativeDay(day.slice(0, 10), today);
}

/** "Ana and Ion together". */
export const togetherNames = (names: string[]) => watchingT().who.names(formatList(names));
