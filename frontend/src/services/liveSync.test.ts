import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { foodKeys } from '@/food/api';
import { paydaysQueryKey } from '@/pages/home/paydays';
import { trainingKeys } from '@/training/api';
import { travelKeys } from '@/travel/api';
import { watchingKeys } from '@/watching/api';
import { wishlistKeys } from '@/wishlist/api';
import { drinksKeys } from '@/drinks/api';
import { invalidateAreas, liveTargets } from './liveSync';
import { queryKeys } from './queries';

const keysOf = (area: string) => liveTargets(area)?.map((target) => target.queryKey);

/** True when `prefix` starts `key`, the way TanStack matches a query filter. */
const covers = (prefix: readonly unknown[], key: readonly unknown[]) =>
  prefix.every((part, index) => key[index] === part);

describe('live sync: which queries an area’s change refetches', () => {
  it('maps every area to the prefixes of the app’s query keys', () => {
    expect(keysOf('food')).toEqual([
      foodKeys.all,
      ['training', 'energy'],
      ['training', 'overview'],
    ]);
    expect(keysOf('house')).toEqual(keysOf('food'));
    expect(keysOf('training')).toEqual([trainingKeys.all]);
    expect(keysOf('travel')).toEqual([travelKeys.all, foodKeys.shopping, foodKeys.overview]);
    expect(keysOf('watching')).toEqual([watchingKeys.all]);
    expect(keysOf('wishlist')).toEqual([wishlistKeys.all]);
    expect(keysOf('drinks')).toEqual([drinksKeys.all]);
    expect(keysOf('reminders')).toEqual([foodKeys.reminders]);
    expect(keysOf('paydays')).toEqual([paydaysQueryKey]);
    expect(keysOf('people')).toEqual([
      queryKeys.me,
      paydaysQueryKey,
      ['admin'],
      foodKeys.people,
      trainingKeys.people,
    ]);
  });

  it('reaches the real queries of each area', () => {
    const food = keysOf('food')!;
    for (const key of [
      foodKeys.kitchen,
      foodKeys.shopping,
      foodKeys.recipe('r1', 2),
      foodKeys.meals('2026-10-01', '2026-10-07'),
      foodKeys.product('p1'),
      trainingKeys.energy('u1', '2026-10-01', '2026-10-07'),
      trainingKeys.overview('u1', '2026-10-17'),
    ])
      expect(food.some((prefix) => covers(prefix, key))).toBe(true);
    // Food never refetches someone's workouts, keys or devices.
    for (const key of [
      trainingKeys.workouts('u1', '2026-10-01', '2026-10-07'),
      foodKeys.keys,
      queryKeys.sessions,
    ])
      expect(food.some((prefix) => covers(prefix, key))).toBe(false);

    const training = keysOf('training')!;
    expect(training.some((prefix) => covers(prefix, trainingKeys.workout('w1')))).toBe(true);
    expect(training.some((prefix) => covers(prefix, foodKeys.kitchen))).toBe(false);

    const people = liveTargets('people')!;
    expect(people[0]).toEqual({ queryKey: queryKeys.me, exact: true });
    expect(people.some((t) => covers(t.queryKey, queryKeys.users('')))).toBe(true);
  });

  it('refetches everything for an area it doesn’t know', () => {
    expect(liveTargets('other')).toBeNull();
    expect(liveTargets('something-new')).toBeNull();
    expect(liveTargets('toString')).toBeNull();

    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    invalidateAreas(client, ['food', 'other']);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith();
  });

  it('refetches each query once when changes come together', () => {
    const client = new QueryClient();
    const spy = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    // Food already covers the shopping list and overview a trip touches.
    invalidateAreas(client, ['food', 'house', 'travel']);
    const calls = spy.mock.calls.map(([filters]) => filters?.queryKey);
    expect(calls).toEqual([['food'], ['training', 'energy'], ['training', 'overview'], ['travel']]);

    // Training covers food's energy and overview; ['me'] exactly stays apart from ['me', …].
    spy.mockClear();
    invalidateAreas(client, ['training', 'food', 'people', 'reminders']);
    expect(spy.mock.calls.map(([filters]) => [filters?.queryKey, filters?.exact])).toEqual([
      [['training'], undefined],
      [['food'], undefined],
      [['me'], true],
      [['paydays'], undefined],
      [['admin'], undefined],
      [['me', 'reminders'], undefined],
    ]);
  });
});
