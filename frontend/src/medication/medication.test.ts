import { describe, expect, it } from 'vitest';
import type { CabinetMedicine, Package } from './api';
import { expiryText, formatAmount, groupByPlace, isoDate, parseExpiry, presetTimes } from './logic';

describe('reading an expiry as printed on a box', () => {
  it('reads months and days in the ways boxes print them', () => {
    expect(parseExpiry('03/2027')).toBe('2027-03');
    expect(parseExpiry('3/27')).toBe('2027-03');
    expect(parseExpiry('2027-03')).toBe('2027-03');
    expect(parseExpiry('03.2027')).toBe('2027-03');
    expect(parseExpiry('31.03.2027')).toBe('2027-03-31');
    expect(parseExpiry('31/03/2027')).toBe('2027-03-31');
    expect(parseExpiry(' 2027-03-31 ')).toBe('2027-03-31');
  });

  it('refuses what is not a date', () => {
    expect(parseExpiry('')).toBeNull();
    expect(parseExpiry('13/2027')).toBeNull();
    expect(parseExpiry('31.02.2027')).toBeNull();
    expect(parseExpiry('soon')).toBeNull();
    expect(parseExpiry('2027')).toBeNull();
  });

  it('writes it back the way it was printed', () => {
    expect(expiryText('2027-03-31', true)).toBe('03/2027');
    expect(expiryText('2027-03-15', false)).toBe('15.03.2027');
    expect(expiryText(null, false)).toBe('');
  });
});

describe('amounts and times', () => {
  it('trims amounts to two decimals', () => {
    expect(formatAmount(1)).toBe('1');
    expect(formatAmount(0.5)).toBe('0.5');
    expect(formatAmount(2.2500001)).toBe('2.25');
  });

  it('offers one to four times a day, and dates in local time', () => {
    expect(presetTimes(3)).toEqual(['08:00', '14:00', '20:00']);
    expect(presetTimes(9)).toEqual(['08:00']);
    expect(isoDate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
  });
});

const pkg = (id: string, place: string): Package =>
  ({ id, place, status: 'ok', quantity: 1 }) as unknown as Package;
const med = (name: string, packages: Package[]): CabinetMedicine =>
  ({ id: name, name, packages }) as unknown as CabinetMedicine;

describe('the cabinet by place', () => {
  it('groups by where packages are kept, named places A to Z, unplaced last', () => {
    const groups = groupByPlace([
      med('Aspirin', [pkg('1', 'Car kit'), pkg('2', 'Bathroom cabinet')]),
      med('Nurofen', [pkg('3', '')]),
      med('Paracetamol', [pkg('4', 'Bathroom cabinet')]),
      med('Empty', []),
    ]);
    expect(groups.map((g) => g.place)).toEqual(['Bathroom cabinet', 'Car kit', '']);
    expect(groups[0]!.entries.map((e) => e.medicine.name)).toEqual(['Aspirin', 'Paracetamol']);
    expect(groups[0]!.entries[0]!.packages.map((p) => p.id)).toEqual(['2']);
    expect(groups[2]!.entries.map((e) => e.medicine.name)).toEqual(['Nurofen', 'Empty']);
  });
});
