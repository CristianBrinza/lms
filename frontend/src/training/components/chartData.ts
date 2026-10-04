import { addDays, daysBetween, weekStart } from '@/food/format';

/** The arithmetic behind Training's charts: scales, the calendar heat-map, weekly sums. */

/** A round top for an axis: 7 → 10, 23 → 25, 140 → 150, 0 → 1. */
export function niceMax(value: number): number {
  if (!(value > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 5, 10].find((s) => s * power >= value) ?? 10;
  return step * power;
}

/** Maps a value in [0, max] onto [from, to] (an SVG's y runs downwards: from > to). */
export function scale(max: number, from: number, to: number) {
  const top = max > 0 ? max : 1;
  return (value: number) => from + ((to - from) * Math.min(Math.max(value, 0), top)) / top;
}

/** Evenly spread x positions for n points across [left, right]; one point sits in the middle. */
export function spread(count: number, left: number, right: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [(left + right) / 2];
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, i) => left + i * step);
}

export interface HeatCell {
  day: string;
  value: number;
  /** 0 nothing, 1–4 more and more. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Before `from` or after `to`: drawn blank, not as "no training". */
  outside: boolean;
}

/** How strong a day's square is, relative to the busiest day shown. */
export function intensity(value: number, max: number): HeatCell['level'] {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((value / max) * 4))) as HeatCell['level'];
}

/**
 * The calendar from `from` to `to` as weeks (columns), each Monday to Sunday (rows). Days outside
 * the range fill the first and last weeks so every column has seven squares.
 */
export function heatWeeks(from: string, to: string, values: Map<string, number>): HeatCell[][] {
  if (from > to) return [];
  let max = 0;
  for (const [day, value] of values) if (day >= from && day <= to) max = Math.max(max, value);
  const weeks: HeatCell[][] = [];
  for (let monday = weekStart(from); monday <= to; monday = addDays(monday, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const day = addDays(monday, i);
        const outside = day < from || day > to;
        const value = outside ? 0 : (values.get(day) ?? 0);
        return { day, value, level: outside ? 0 : intensity(value, max), outside };
      }),
    );
  }
  return weeks;
}

/**
 * Which weeks carry a month's name above them: the one holding the 1st (the first week holds its
 * first day's month). A name needs two columns of room, so one crowded by the next, or sitting in
 * the last column, is left out. Returns a day in that month, or null.
 */
export function monthLabels(weeks: HeatCell[][]): Array<string | null> {
  const marks = weeks.map((week, w) => {
    const inRange = week.filter((cell) => !cell.outside);
    return (w === 0 ? inRange[0] : inRange.find((cell) => cell.day.endsWith('-01')))?.day ?? null;
  });
  return marks.map((day, w) => {
    if (!day || w >= weeks.length - 1) return null;
    const next = marks.findIndex((other, i) => i > w && other !== null);
    return next !== -1 && next - w < 2 ? null : day;
  });
}

/** One total per week (Mondays) from `from` to `to`, weeks without anything at 0. */
export function weeklyTotals(
  days: Array<{ day: string; value: number }>,
  from: string,
  to: string,
): Array<{ week: string; value: number }> {
  if (from > to) return [];
  const first = weekStart(from);
  const count = Math.floor(daysBetween(first, weekStart(to)) / 7) + 1;
  const totals = Array.from({ length: count }, (_, i) => ({
    week: addDays(first, i * 7),
    value: 0,
  }));
  for (const { day, value } of days) {
    if (day < from || day > to) continue;
    const index = Math.floor(daysBetween(first, day) / 7);
    totals[index]!.value += value;
  }
  return totals;
}
