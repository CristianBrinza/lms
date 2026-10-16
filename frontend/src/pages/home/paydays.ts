import { api } from '@/services/api/client';

/**
 * Paydays on Home: when each person's salary (and, for some, the advance paid earlier in the
 * month) next arrives. Days are days of the month; amounts never leave the profile. Everything
 * here is local time, pure, and takes `now` so it can be tested at any moment.
 */

export type PaydayKind = 'salary' | 'advance';

export interface PaydayPerson {
  id: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
  /** Day of the month, 1–31. */
  salaryDay: number | null;
  /** Day of the month, 1–31. */
  advanceDay: number | null;
}

export interface PaydaysResponse {
  people: PaydayPerson[];
}

/** Local key: this block's data has no entry in the shared query keys. */
export const paydaysQueryKey = ['paydays'] as const;

/** Active people with at least one day set, the signed-in person first. */
export const fetchPaydays = (signal?: AbortSignal) =>
  api.get<PaydaysResponse>('/me/paydays', { signal });

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

const isDay = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 31;

/** 00:00 local time on the date's day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The day of the month in a given month, at 00:00. A day the month doesn't have (31 in a 30-day
 * month, 30 in February) falls on its last day. `month` may run past 0–11 (it rolls the year).
 */
export function occurrence(year: number, month: number, day: number): Date {
  const first = new Date(year, month, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  return new Date(y, m, Math.min(day, last));
}

/** The next time the day comes round: today counts (it's payday), otherwise later this month or next. */
export function nextPayday(day: number, now: Date): Date {
  const today = startOfDay(now);
  const thisMonth = occurrence(now.getFullYear(), now.getMonth(), day);
  if (thisMonth.getTime() >= today.getTime()) return thisMonth;
  return occurrence(now.getFullYear(), now.getMonth() + 1, day);
}

/** The payday before the next one: where the current cycle started. */
export function previousPayday(day: number, now: Date): Date {
  const next = nextPayday(day, now);
  return occurrence(next.getFullYear(), next.getMonth() - 1, day);
}

export interface Payday {
  kind: PaydayKind;
  day: number;
  /** 00:00 on the next payday (today, on the day itself). */
  date: Date;
  /** 00:00 on the payday before it. */
  previous: Date;
}

/** A person's paydays, soonest first (the salary first when both fall on one day). */
export function paydaysOf(
  person: Pick<PaydayPerson, 'salaryDay' | 'advanceDay'>,
  now: Date,
): Payday[] {
  const list: Payday[] = [];
  const add = (kind: PaydayKind, day: number | null) => {
    if (!isDay(day)) return;
    list.push({ kind, day, date: nextPayday(day, now), previous: previousPayday(day, now) });
  };
  add('salary', person.salaryDay);
  add('advance', person.advanceDay);
  // Stable sort: salary was added first, so it leads on a tie.
  return list.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Whether the payday is today (its 00:00 has passed). */
export function isToday(payday: Pick<Payday, 'date'>, now: Date): boolean {
  return payday.date.getTime() <= now.getTime();
}

/** How far through the cycle, previous payday to next, from 0 to 1 (1 on the day itself). */
export function cycleProgress(payday: Pick<Payday, 'date' | 'previous'>, now: Date): number {
  const span = payday.date.getTime() - payday.previous.getTime();
  if (span <= 0) return 1;
  const done = (now.getTime() - payday.previous.getTime()) / span;
  return Math.min(1, Math.max(0, done));
}

/** Whole calendar days from today to the date (0 today, 1 tomorrow); daylight saving can't skew it. */
export function calendarDaysUntil(date: Date, now: Date): number {
  return Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY);
}

export type Countdown =
  | { unit: 'today' }
  | { unit: 'days'; days: number }
  | { unit: 'hours'; hours: number; minutes: number }
  | { unit: 'minutes'; minutes: number; seconds: number };

/**
 * What the card counts down to 00:00 on the date: whole days from two days out, hours and
 * minutes under two days, minutes and seconds under an hour, then "today".
 */
export function countdown(date: Date, now: Date): Countdown {
  const ms = date.getTime() - now.getTime();
  if (ms <= 0) return { unit: 'today' };
  if (ms >= 2 * DAY) return { unit: 'days', days: Math.floor(ms / DAY) };
  if (ms >= HOUR) {
    return {
      unit: 'hours',
      hours: Math.floor(ms / HOUR),
      minutes: Math.floor((ms % HOUR) / MINUTE),
    };
  }
  return {
    unit: 'minutes',
    minutes: Math.floor(ms / MINUTE),
    seconds: Math.floor((ms % MINUTE) / SECOND),
  };
}

/**
 * Milliseconds until the block should next re-render: the next whole second while any payday is
 * under an hour away, otherwise the next whole minute (paydays fall on local midnight, so their
 * countdowns change on those boundaries). A little slack lands the tick just past the boundary.
 */
export function tickDelay(dates: readonly Date[], now: Date): number {
  const ahead = dates.map((date) => date.getTime() - now.getTime()).filter((ms) => ms > 0);
  const soonest = ahead.length ? Math.min(...ahead) : Infinity;
  const slack = 25;
  if (soonest < HOUR) return (soonest % SECOND || SECOND) + slack;
  if (Number.isFinite(soonest)) return (soonest % MINUTE || MINUTE) + slack;
  return MINUTE - (now.getTime() % MINUTE) + slack;
}
