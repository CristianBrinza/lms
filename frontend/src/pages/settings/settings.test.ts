import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './push';
import { daysLabel, reminderWhen } from './reminderText';

describe('reminder text', () => {
  it('names day sets (1 = Monday … 7 = Sunday)', () => {
    expect(daysLabel([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
    expect(daysLabel([5, 4, 3, 2, 1])).toBe('Weekdays');
    expect(daysLabel([6, 7])).toBe('Weekends');
    expect(daysLabel([1, 3, 5])).toBe('Mon, Wed, Fri');
  });

  it('says when', () => {
    expect(reminderWhen({ kind: 'shopping', time: '18:30', minutesBefore: null, days: [1, 2, 3, 4, 5, 6, 7] })).toBe('18:30 · Every day');
    expect(reminderWhen({ kind: 'meal', time: null, minutesBefore: 45, days: [6, 7] })).toBe('45 min before · Weekends');
  });
});

describe('VAPID key', () => {
  it('decodes base64url without padding', () => {
    expect(Array.from(urlBase64ToUint8Array('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
  });
});
