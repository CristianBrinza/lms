import { describe, expect, it } from 'vitest';
import type { Tool } from '../types';
import { duration, minutesLeft, statusLine, toolChips, washState } from './status';

const tool = (over: Partial<Tool>): Tool => ({
  id: 'x',
  name: 'Pot',
  icon: 'pot',
  kind: 'cookware',
  count: 1,
  clean: 1,
  dirty: 0,
  washing: 0,
  washingUntil: null,
  washable: true,
  place: '',
  note: '',
  ...over,
});

describe('kitchenware status', () => {
  it('adds up dirty, washable dirty and the latest dishwasher end', () => {
    const state = washState([
      tool({ dirty: 2, clean: 1, count: 3 }),
      tool({ washable: false, dirty: 0 }),
      tool({ washing: 1, clean: 0, washingUntil: '2026-10-02T18:00:00.000Z' }),
      tool({ washing: 2, count: 2, clean: 0, washingUntil: '2026-10-02T19:30:00.000Z' }),
    ]);
    expect(state).toMatchObject({ kinds: 4, dirty: 2, dirtyWashable: 2, washing: 3, cleanAt: '2026-10-02T19:30:00.000Z' });
  });

  it('reads as one line', () => {
    expect(statusLine(washState([]))).toBe('Count your pots, pans and glasses');
    expect(statusLine(washState([tool({})]))).toBe('All clean');
    expect(statusLine(washState([tool({ dirty: 3, clean: 0, count: 3 })]))).toBe('3 dirty');
  });

  it('labels one thing with short chips', () => {
    expect(toolChips(tool({ count: 3, clean: 2, dirty: 1 })).map((c) => c.label)).toEqual(['2 of 3 clean', '1 dirty']);
    expect(toolChips(tool({ count: 3, clean: 3 })).map((c) => c.label)).toEqual(['All 3 clean']);
    expect(toolChips(tool({ count: 1, clean: 0, washing: 1 })).map((c) => c.label)).toEqual(['Washing']);
    expect(toolChips(tool({ count: 5, washable: false })).map((c) => c.label)).toEqual(['×5']);
  });

  it('formats run times and countdowns', () => {
    expect(duration(180)).toBe('3 h');
    expect(duration(135)).toBe('2 h 15 min');
    expect(duration(45)).toBe('45 min');
    const now = Date.parse('2026-10-02T18:00:00.000Z');
    expect(minutesLeft('2026-10-02T18:00:30.000Z', now)).toBe(1);
    expect(minutesLeft('2026-10-02T17:00:00.000Z', now)).toBe(0);
  });
});
