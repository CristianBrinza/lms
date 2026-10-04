import { describe, expect, it } from 'vitest';
import {
  heatWeeks,
  intensity,
  monthLabels,
  niceMax,
  scale,
  spread,
  weeklyTotals,
} from './chartData';

describe('chart scales', () => {
  it('rounds an axis top up to a friendly number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(140)).toBe(150);
    expect(niceMax(1000)).toBe(1000);
    expect(niceMax(0.3)).toBeCloseTo(0.5);
  });

  it('maps values onto a range, clamped', () => {
    const y = scale(100, 80, 0);
    expect(y(0)).toBe(80);
    expect(y(50)).toBe(40);
    expect(y(100)).toBe(0);
    expect(y(150)).toBe(0);
    expect(y(-5)).toBe(80);
    expect(scale(0, 10, 0)(0)).toBe(10);
  });

  it('spreads points evenly', () => {
    expect(spread(0, 0, 100)).toEqual([]);
    expect(spread(1, 0, 100)).toEqual([50]);
    expect(spread(3, 0, 100)).toEqual([0, 50, 100]);
  });
});

describe('heat-map', () => {
  it('buckets a day relative to the busiest', () => {
    expect(intensity(0, 10)).toBe(0);
    expect(intensity(1, 10)).toBe(1);
    expect(intensity(5, 10)).toBe(2);
    expect(intensity(8, 10)).toBe(4);
    expect(intensity(10, 10)).toBe(4);
    expect(intensity(3, 0)).toBe(0);
  });

  it('lays the days out in Monday-first weeks', () => {
    // 2026-10-01 is a Thursday; 2026-10-04 a Sunday; 2026-10-06 a Tuesday.
    const weeks = heatWeeks(
      '2026-10-01',
      '2026-10-06',
      new Map([
        ['2026-10-02', 4],
        ['2026-10-05', 8],
      ]),
    );
    expect(weeks).toHaveLength(2);
    expect(weeks.every((week) => week.length === 7)).toBe(true);
    expect(weeks[0]![0]!.day).toBe('2026-09-28');
    expect(weeks[0]![0]!.outside).toBe(true);
    expect(weeks[0]![4]).toMatchObject({ day: '2026-10-02', value: 4, level: 2, outside: false });
    expect(weeks[1]![0]).toMatchObject({ day: '2026-10-05', value: 8, level: 4 });
    expect(weeks[1]![2]!.outside).toBe(true);
  });

  it('ignores days outside the range for the scale', () => {
    const weeks = heatWeeks(
      '2026-10-05',
      '2026-10-11',
      new Map([
        ['2026-10-01', 100],
        ['2026-10-06', 2],
      ]),
    );
    expect(weeks).toHaveLength(1);
    expect(weeks[0]![1]!.level).toBe(4);
  });
});

describe('month labels', () => {
  it('names the weeks holding a 1st, with room to spare', () => {
    // 2026-08-20 (Thu) to 2026-10-04 (Sun): weeks from Aug 17 to Sep 28.
    const weeks = heatWeeks('2026-08-20', '2026-10-04', new Map());
    const labels = monthLabels(weeks);
    expect(labels).toHaveLength(7);
    // Aug in the first week; Sep 1 falls in the week of Aug 31, three columns on; Oct 1 in the last.
    expect(labels[0]).toBe('2026-08-20');
    expect(labels[2]).toBe('2026-09-01');
    expect(labels[6]).toBeNull();
    expect(labels.filter(Boolean)).toHaveLength(2);
  });

  it('drops a first label crowded by the next month', () => {
    // Starts on Thu 2026-09-24; Oct 1 is in the very next week.
    const labels = monthLabels(heatWeeks('2026-09-24', '2026-10-25', new Map()));
    expect(labels[0]).toBeNull();
    expect(labels[1]).toBe('2026-10-01');
  });
});

describe('weekly totals', () => {
  it('sums days into their weeks, empty weeks at zero', () => {
    const totals = weeklyTotals(
      [
        { day: '2026-09-14', value: 20 },
        { day: '2026-09-20', value: 10 },
        { day: '2026-10-01', value: 30 },
        { day: '2026-08-01', value: 99 },
      ],
      '2026-09-14',
      '2026-10-04',
    );
    expect(totals).toEqual([
      { week: '2026-09-14', value: 30 },
      { week: '2026-09-21', value: 0 },
      { week: '2026-09-28', value: 30 },
    ]);
  });
});
