import { describe, expect, it } from 'vitest';
import {
  calendarDaysUntil,
  countdown,
  cycleProgress,
  isToday,
  MINUTE,
  nextPayday,
  occurrence,
  paydaysOf,
  previousPayday,
  SECOND,
  tickDelay,
} from './paydays';

/** A local date (months 1–12 here, to read like a calendar). */
const at = (year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) =>
  new Date(year, month - 1, day, hours, minutes, seconds);

describe('occurrence (a day of the month in a given month)', () => {
  it('falls on that day when the month has it', () => {
    expect(occurrence(2026, 9, 15)).toEqual(at(2026, 10, 15));
  });
  it('falls on the last day of a shorter month', () => {
    expect(occurrence(2026, 10, 31)).toEqual(at(2026, 11, 30));
    expect(occurrence(2027, 1, 30)).toEqual(at(2027, 2, 28));
    expect(occurrence(2028, 1, 30)).toEqual(at(2028, 2, 29)); // leap year
    expect(occurrence(2027, 1, 29)).toEqual(at(2027, 2, 28));
  });
  it('rolls months past December into the next year', () => {
    expect(occurrence(2026, 12, 5)).toEqual(at(2027, 1, 5));
    expect(occurrence(2027, -1, 31)).toEqual(at(2026, 12, 31));
  });
});

describe('nextPayday', () => {
  it('is later this month when the day is still ahead', () => {
    expect(nextPayday(25, at(2026, 10, 16, 20))).toEqual(at(2026, 10, 25));
  });
  it('is next month when the day has passed', () => {
    expect(nextPayday(10, at(2026, 10, 16, 20))).toEqual(at(2026, 11, 10));
  });
  it('is today, all day long, on the day itself', () => {
    expect(nextPayday(16, at(2026, 10, 16, 0, 0))).toEqual(at(2026, 10, 16));
    expect(nextPayday(16, at(2026, 10, 16, 23, 59, 59))).toEqual(at(2026, 10, 16));
  });
  it('moves on to next month at midnight after payday', () => {
    expect(nextPayday(16, at(2026, 10, 17, 0, 0))).toEqual(at(2026, 11, 16));
  });
  it('takes the last day of a short month, and that counts as today', () => {
    expect(nextPayday(31, at(2026, 11, 5))).toEqual(at(2026, 11, 30));
    expect(nextPayday(31, at(2026, 11, 30, 9))).toEqual(at(2026, 11, 30));
    expect(nextPayday(31, at(2026, 12, 1))).toEqual(at(2026, 12, 31));
  });
  it('reads 31 as the last day of every month (how "end of month" is stored)', () => {
    // A 30-day month: the 30th, and on the 30th itself it is today.
    expect(nextPayday(31, at(2026, 9, 10))).toEqual(at(2026, 9, 30));
    expect(nextPayday(31, at(2026, 9, 30, 7))).toEqual(at(2026, 9, 30));
    // February in a common year: the 28th.
    expect(nextPayday(31, at(2027, 2, 3))).toEqual(at(2027, 2, 28));
    expect(nextPayday(31, at(2027, 2, 28, 23, 59))).toEqual(at(2027, 2, 28));
    expect(nextPayday(31, at(2027, 3, 1))).toEqual(at(2027, 3, 31));
    // February in a leap year: the 29th, not the 28th.
    expect(nextPayday(31, at(2028, 2, 28, 12))).toEqual(at(2028, 2, 29));
    expect(nextPayday(31, at(2028, 2, 29, 9))).toEqual(at(2028, 2, 29));
    // A 31-day month keeps the 31st, and the cycle starts on the last day before it.
    expect(nextPayday(31, at(2028, 3, 1))).toEqual(at(2028, 3, 31));
    expect(previousPayday(31, at(2028, 3, 1))).toEqual(at(2028, 2, 29));
    expect(previousPayday(31, at(2026, 10, 16))).toEqual(at(2026, 9, 30));
  });
  it('handles February', () => {
    expect(nextPayday(30, at(2027, 2, 1))).toEqual(at(2027, 2, 28));
    expect(nextPayday(30, at(2027, 2, 28, 12))).toEqual(at(2027, 2, 28));
    expect(nextPayday(30, at(2027, 3, 1))).toEqual(at(2027, 3, 30));
    expect(nextPayday(29, at(2028, 2, 10))).toEqual(at(2028, 2, 29));
  });
  it('rolls over the year', () => {
    expect(nextPayday(15, at(2026, 12, 20))).toEqual(at(2027, 1, 15));
    expect(nextPayday(31, at(2026, 12, 31, 18))).toEqual(at(2026, 12, 31));
    expect(nextPayday(1, at(2026, 12, 31, 18))).toEqual(at(2027, 1, 1));
  });
});

describe('previousPayday (where the cycle started)', () => {
  it('is the month before the next payday', () => {
    expect(previousPayday(25, at(2026, 10, 16))).toEqual(at(2026, 9, 25));
    expect(previousPayday(10, at(2026, 10, 16))).toEqual(at(2026, 10, 10));
  });
  it('clamps to short months and crosses the year', () => {
    expect(previousPayday(31, at(2027, 3, 10))).toEqual(at(2027, 2, 28));
    expect(previousPayday(20, at(2027, 1, 5))).toEqual(at(2026, 12, 20));
  });
  it('is last month on payday itself', () => {
    expect(previousPayday(16, at(2026, 10, 16, 9))).toEqual(at(2026, 9, 16));
  });
});

describe('paydaysOf', () => {
  const now = at(2026, 10, 16, 20);
  it('puts the sooner one first, whichever it is', () => {
    expect(paydaysOf({ salaryDay: 5, advanceDay: 25 }, now).map((p) => p.kind)).toEqual([
      'advance',
      'salary',
    ]);
    expect(paydaysOf({ salaryDay: 20, advanceDay: 5 }, now).map((p) => p.kind)).toEqual([
      'salary',
      'advance',
    ]);
  });
  it('leads with the salary on a tie', () => {
    expect(paydaysOf({ salaryDay: 20, advanceDay: 20 }, now).map((p) => p.kind)).toEqual([
      'salary',
      'advance',
    ]);
  });
  it('skips days that are missing or out of range', () => {
    expect(paydaysOf({ salaryDay: 10, advanceDay: null }, now)).toHaveLength(1);
    expect(paydaysOf({ salaryDay: 0, advanceDay: 32 }, now)).toHaveLength(0);
    expect(paydaysOf({ salaryDay: null, advanceDay: 25 }, now)[0]).toMatchObject({
      kind: 'advance',
      date: at(2026, 10, 25),
      previous: at(2026, 9, 25),
    });
  });
});

describe('countdown', () => {
  const payday = at(2026, 11, 20);
  it('counts whole days from two days out', () => {
    expect(countdown(payday, at(2026, 11, 8, 20))).toEqual({ unit: 'days', days: 11 });
    expect(countdown(payday, at(2026, 11, 18, 0))).toEqual({ unit: 'days', days: 2 });
  });
  it('shows hours and minutes under two days', () => {
    expect(countdown(payday, at(2026, 11, 18, 0, 0, 1))).toEqual({
      unit: 'hours',
      hours: 47,
      minutes: 59,
    });
    expect(countdown(payday, at(2026, 11, 19, 20, 30))).toEqual({
      unit: 'hours',
      hours: 3,
      minutes: 30,
    });
    expect(countdown(payday, at(2026, 11, 19, 23, 0))).toEqual({
      unit: 'hours',
      hours: 1,
      minutes: 0,
    });
  });
  it('shows minutes and seconds under an hour', () => {
    expect(countdown(payday, at(2026, 11, 19, 23, 0, 1))).toEqual({
      unit: 'minutes',
      minutes: 59,
      seconds: 59,
    });
    expect(countdown(payday, at(2026, 11, 19, 23, 59, 58))).toEqual({
      unit: 'minutes',
      minutes: 0,
      seconds: 2,
    });
  });
  it('says today from midnight on', () => {
    expect(countdown(payday, at(2026, 11, 20, 0, 0))).toEqual({ unit: 'today' });
    expect(countdown(payday, at(2026, 11, 20, 15, 0))).toEqual({ unit: 'today' });
  });
});

describe('isToday and calendarDaysUntil', () => {
  it('knows payday from the day before', () => {
    expect(isToday({ date: at(2026, 11, 20) }, at(2026, 11, 20, 8))).toBe(true);
    expect(isToday({ date: at(2026, 11, 20) }, at(2026, 11, 19, 23, 59))).toBe(false);
  });
  it('counts calendar days, across months and the year', () => {
    expect(calendarDaysUntil(at(2026, 10, 31), at(2026, 10, 16, 20))).toBe(15);
    expect(calendarDaysUntil(at(2026, 10, 17), at(2026, 10, 16, 23, 59))).toBe(1);
    expect(calendarDaysUntil(at(2026, 10, 16), at(2026, 10, 16, 8))).toBe(0);
    expect(calendarDaysUntil(at(2027, 1, 2), at(2026, 12, 30, 12))).toBe(3);
  });
});

describe('cycleProgress', () => {
  it('runs from the previous payday to the next', () => {
    const payday = { previous: at(2026, 10, 1), date: at(2026, 10, 11) };
    expect(cycleProgress(payday, at(2026, 10, 1))).toBe(0);
    expect(cycleProgress(payday, at(2026, 10, 6))).toBeCloseTo(0.5, 2);
    expect(cycleProgress(payday, at(2026, 10, 11, 9))).toBe(1);
  });
  it('is full on payday', () => {
    const [salary] = paydaysOf({ salaryDay: 16, advanceDay: null }, at(2026, 10, 16, 12));
    expect(cycleProgress(salary!, at(2026, 10, 16, 12))).toBe(1);
  });
});

describe('tickDelay (one timer for the whole block)', () => {
  it('ticks on the next whole second under an hour', () => {
    const delay = tickDelay([at(2026, 11, 20)], new Date(at(2026, 11, 19, 23, 30).getTime() + 400));
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(SECOND + 50);
    expect(delay).toBeGreaterThanOrEqual(600);
  });
  it('ticks on the next whole minute otherwise', () => {
    const now = new Date(at(2026, 11, 10, 9, 15).getTime() + 20 * SECOND);
    const delay = tickDelay([at(2026, 11, 20), at(2026, 11, 25)], now);
    expect(delay).toBeGreaterThanOrEqual(40 * SECOND);
    expect(delay).toBeLessThanOrEqual(40 * SECOND + 50);
  });
  it('still ticks each minute when every payday is today', () => {
    const delay = tickDelay([at(2026, 11, 20)], at(2026, 11, 20, 9));
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(MINUTE + 50);
  });
  it('picks the soonest payday', () => {
    const now = at(2026, 11, 19, 23, 30);
    expect(tickDelay([at(2026, 12, 1), at(2026, 11, 20)], now)).toBeLessThanOrEqual(SECOND + 50);
  });
});
