/**
 * The medicine cabinet's rules, without a database: when a package expires, which package a dose
 * comes out of (first to expire first), the doses a treatment has on a day, how long the stock
 * lasts. Dates are plain `YYYY-MM-DD` strings and times `HH:MM` in the household's local time.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` date as a UTC day number, so day arithmetic never meets a clock change. */
const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);

export function addDays(date: string, days: number): string {
  const d = new Date((dayNumber(date) + days) * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export const daysBetween = (a: string, b: string) => dayNumber(b) - dayNumber(a);

/** 1 = Monday … 7 = Sunday. */
export function weekdayOf(date: string): number {
  const day = new Date(dayNumber(date) * DAY_MS).getUTCDay();
  return day === 0 ? 7 : day;
}

/** The last day of a `YYYY-MM` month. */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}

export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const clockOf = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// ---------------------------------------------------------------- expiry

export interface ExpiryFields {
  expiresOn: string | null;
  openedOn: string | null;
  useWithinDays: number | null;
}

/** When a package stops being good: its printed date, or sooner when opened with "use within N days". */
export function effectiveExpiry(p: ExpiryFields): string | null {
  const printed = p.expiresOn;
  const afterOpening = p.openedOn && p.useWithinDays ? addDays(p.openedOn, p.useWithinDays) : null;
  if (printed && afterOpening) return printed < afterOpening ? printed : afterOpening;
  return printed ?? afterOpening;
}

export type ExpiryState = 'none' | 'ok' | 'soon' | 'expired';

/** green ok, amber expiring within 30 days, red expired. The expiry day itself still counts as good. */
export function expiryStatus(
  effective: string | null,
  today: string,
  soonDays = 30,
): { state: ExpiryState; days: number | null } {
  if (!effective) return { state: 'none', days: null };
  const days = daysBetween(today, effective);
  if (days < 0) return { state: 'expired', days };
  return { state: days <= soonDays ? 'soon' : 'ok', days };
}

export type AlertLevel = 90 | 30 | 7 | 0;
export const ALERT_LEVELS: AlertLevel[] = [90, 30, 7, 0];

/** The alert a package is at: 90, 30, 7 days before, or 0 (the day itself, and after). */
export function alertLevel(days: number | null): AlertLevel | null {
  if (days === null) return null;
  if (days <= 0) return 0;
  if (days <= 7) return 7;
  if (days <= 30) return 30;
  if (days <= 90) return 90;
  return null;
}

/** Whether a package has crossed into a more urgent level than the last one it was told about. */
export const needsAlert = (level: AlertLevel | null, alerted: number | null) =>
  level !== null && (alerted === null || level < alerted);

// ---------------------------------------------------------------- first to expire, first out

export interface StockPackage {
  id: string;
  quantity: number;
  effectiveExpiry: string | null;
  openedOn: string | null;
  createdAt: string;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

/** Packages a dose may come out of: something left, not expired. */
export const usablePackages = <T extends StockPackage>(packages: T[], today: string): T[] =>
  packages.filter((p) => p.quantity > 0 && (p.effectiveExpiry === null || p.effectiveExpiry >= today));

/**
 * Takes `amount` from the package that expires first (an opened one before a sealed one on the
 * same date; one without a date last). `shortfall` is what the stock could not cover.
 */
export function pickFefo(
  packages: StockPackage[],
  amount: number,
  today: string,
): { deductions: Array<{ id: string; amount: number }>; shortfall: number } {
  const usable = usablePackages(packages, today).sort((a, b) => {
    if (a.effectiveExpiry !== b.effectiveExpiry) {
      if (a.effectiveExpiry === null) return 1;
      if (b.effectiveExpiry === null) return -1;
      return a.effectiveExpiry < b.effectiveExpiry ? -1 : 1;
    }
    if (!!a.openedOn !== !!b.openedOn) return a.openedOn ? -1 : 1;
    return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
  });
  let left = round(amount);
  const deductions: Array<{ id: string; amount: number }> = [];
  for (const p of usable) {
    if (left <= 0) break;
    const take = round(Math.min(p.quantity, left));
    deductions.push({ id: p.id, amount: take });
    left = round(left - take);
  }
  return { deductions, shortfall: Math.max(0, left) };
}

// ---------------------------------------------------------------- schedules

export type ScheduleKind = 'times' | 'interval' | 'prn';
export type EndKind = 'none' | 'date' | 'days' | 'doses';

export interface Schedule {
  kind: ScheduleKind;
  /** Explicit times of day ("08:00"); for an interval schedule, the first time of the day. */
  times: string[];
  /** 1 = Monday … 7 = Sunday; empty: every day. */
  weekdays: number[];
  intervalHours: number | null;
  startOn: string;
  endKind: EndKind;
  endOn: string | null;
  endDays: number | null;
  endDoses: number | null;
  /** The day someone stopped the treatment: no doses from that day on. */
  stoppedOn: string | null;
}

/** Doses a schedule has on a day before any end applies. */
function rawTimes(s: Schedule, date: string): string[] {
  if (s.kind === 'prn') return [];
  if (s.kind === 'times') {
    if (s.weekdays.length && !s.weekdays.includes(weekdayOf(date))) return [];
    return [...new Set(s.times)].sort();
  }
  // Every N hours, counted from the first time on the start day, around the clock.
  const step = (s.intervalHours ?? 0) * 60;
  if (step <= 0) return [];
  const anchor = minutesOf(s.times[0] ?? '08:00');
  const dayStart = daysBetween(s.startOn, date) * 1440;
  if (dayStart + 1440 <= anchor) return [];
  const first = Math.max(0, Math.ceil((dayStart - anchor) / step));
  const out: string[] = [];
  for (let at = anchor + first * step; at < dayStart + 1440; at += step) {
    out.push(clockOf(at - dayStart));
  }
  return out;
}

const COURSE_CAP_DAYS = 800;

/** The last day with doses: null for a course without an end (or one that never ends by dose count). */
export function courseEnd(s: Schedule): string | null {
  let end: string | null = null;
  if (s.endKind === 'date') end = s.endOn;
  else if (s.endKind === 'days' && s.endDays) end = addDays(s.startOn, s.endDays - 1);
  else if (s.endKind === 'doses' && s.endDoses && s.kind !== 'prn') {
    let count = 0;
    for (let i = 0; i < COURSE_CAP_DAYS; i += 1) {
      const date = addDays(s.startOn, i);
      count += rawTimes(s, date).length;
      if (count >= s.endDoses) {
        end = date;
        break;
      }
    }
  }
  // Stopped on a day: that day and after have no new doses (what was taken stays in the history).
  if (s.stoppedOn) {
    const last = addDays(s.stoppedOn, -1);
    if (!end || last < end) end = last;
  }
  return end;
}

/** The times of day a treatment has doses on `date` (empty for as-needed treatments). */
export function doseTimes(s: Schedule, date: string): string[] {
  if (date < s.startOn) return [];
  const end = courseEnd(s);
  if (end && date > end) return [];
  const times = rawTimes(s, date);
  if (s.endKind === 'doses' && s.endDoses && s.kind !== 'prn') {
    let before = 0;
    const span = daysBetween(s.startOn, date);
    if (span > COURSE_CAP_DAYS) return [];
    for (let i = 0; i < span; i += 1) before += rawTimes(s, addDays(s.startOn, i)).length;
    return times.slice(0, Math.max(0, s.endDoses - before));
  }
  return times;
}

/** Active on `today`: started, not past its end, not stopped. */
export function isActive(s: Schedule, today: string): boolean {
  const end = courseEnd(s);
  if (s.stoppedOn && s.stoppedOn <= today) return false;
  return !end || end >= today;
}

/** How many doses are left from `from` to the end of the course (null: no end). */
export function remainingDoses(s: Schedule, from: string): number | null {
  const end = courseEnd(s);
  if (!end || s.kind === 'prn') return null;
  let count = 0;
  for (let date = from < s.startOn ? s.startOn : from; date <= end; date = addDays(date, 1)) {
    count += doseTimes(s, date).length;
    if (daysBetween(from, date) > COURSE_CAP_DAYS) break;
  }
  return count;
}

/** What a treatment uses on an average day, in the medicine's unit (null: as needed, unknown). */
export function dailyUse(s: Schedule, dose: number): number | null {
  if (s.kind === 'times') {
    const days = s.weekdays.length ? s.weekdays.length / 7 : 1;
    return round(dose * new Set(s.times).size * days);
  }
  if (s.kind === 'interval' && s.intervalHours) return round((dose * 24) / s.intervalHours);
  return null;
}

/**
 * Whether the stock runs short: it covers fewer than `lowDays` days of use and, for a course with
 * an end, less than what is left of the course.
 */
export function lowStock(input: {
  available: number;
  daily: number | null;
  lowDays: number;
  need?: number | null;
}): { daysLeft: number | null; low: boolean } {
  if (!input.daily || input.daily <= 0) return { daysLeft: null, low: false };
  const daysLeft = Math.floor(input.available / input.daily);
  const covers = input.need !== null && input.need !== undefined && input.available >= input.need;
  return { daysLeft, low: daysLeft < input.lowDays && !covers };
}

// ---------------------------------------------------------------- dose states

export type DoseState = 'due' | 'taken' | 'skipped' | 'snoozed' | 'missed';
export const MISSED_AFTER_MINUTES = 120;

/** A scheduled dose's local moment. */
export function dueAt(dueOn: string, dueTime: string): Date {
  const [y, m, d] = dueOn.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d, Number(dueTime.slice(0, 2)), Number(dueTime.slice(3, 5)));
}

export function doseState(
  dose: { status: 'due' | 'taken' | 'skipped'; dueOn: string; dueTime: string | null; snoozedUntil: Date | null },
  now: Date,
): DoseState {
  if (dose.status !== 'due') return dose.status;
  if (dose.snoozedUntil && dose.snoozedUntil.getTime() > now.getTime()) return 'snoozed';
  if (dose.dueTime && now.getTime() > dueAt(dose.dueOn, dose.dueTime).getTime() + MISSED_AFTER_MINUTES * 60_000)
    return 'missed';
  return 'due';
}

/** Share of the doses that were due (taken, skipped or missed) that were taken, 0–100. */
export function adherence(states: DoseState[]): number | null {
  const counted = states.filter((s) => s === 'taken' || s === 'skipped' || s === 'missed');
  if (!counted.length) return null;
  return Math.round((counted.filter((s) => s === 'taken').length / counted.length) * 100);
}
