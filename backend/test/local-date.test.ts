import { describe, expect, it } from 'vitest';
import { localDate } from '../src/modules/food/stock';

describe('localDate', () => {
  it('counts calendar days across the clock changes', () => {
    process.env.TZ = 'Europe/Chisinau';
    // Saturday night before the clocks go forward (Sunday 29 March 2026 has 23 hours).
    const saturdayNight = new Date('2026-03-28T23:30:00+02:00');
    expect(localDate(saturdayNight)).toBe('2026-03-28');
    expect(localDate(saturdayNight, 1)).toBe('2026-03-29');
    expect(localDate(saturdayNight, 2)).toBe('2026-03-30');
    // And back (Sunday 25 October 2026 has 25 hours).
    const earlySunday = new Date('2026-10-25T00:30:00+03:00');
    expect(localDate(earlySunday, 1)).toBe('2026-10-26');
    expect(localDate(earlySunday, -1)).toBe('2026-10-24');
    expect(localDate(new Date('2026-12-31T22:00:00+02:00'), 1)).toBe('2027-01-01');
  });
});
