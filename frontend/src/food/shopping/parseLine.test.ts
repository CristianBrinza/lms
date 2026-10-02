import { describe, expect, it } from 'vitest';
import { parseLine } from './parseLine';

describe('shopping line parsing', () => {
  it('reads amounts before or after the name', () => {
    expect(parseLine('2 tomatoes')).toEqual({ name: 'tomatoes', amount: 2, unit: null });
    expect(parseLine('1,5 kg potatoes')).toEqual({ name: 'potatoes', amount: 1.5, unit: 'kg' });
    expect(parseLine('milk 2 l')).toEqual({ name: 'milk', amount: 2, unit: 'l' });
    expect(parseLine('eggs x10')).toEqual({ name: 'eggs', amount: 10, unit: null });
    expect(parseLine('300g cheese')).toEqual({ name: 'cheese', amount: 300, unit: 'g' });
    expect(parseLine('  bread  ')).toEqual({ name: 'bread', amount: null, unit: null });
    expect(parseLine('7 up')).toEqual({ name: 'up', amount: 7, unit: null });
  });
});
