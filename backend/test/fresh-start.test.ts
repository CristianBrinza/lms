import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

/**
 * A new household starts empty: no kitchenware, stock, stores, recipes, plans, lists, home
 * equipment, routines or workouts are put in for it. Only the catalogs to pick from are there
 * (foods to name things by, the exercise library).
 */
describe('a fresh start', () => {
  it('has nothing in it until someone adds it', async () => {
    await t.createUser({ email: 'new@example.com', name: 'New' });
    const b = t.browser();
    await b.login('new@example.com');
    const range = 'from=2026-01-01&to=2027-12-31';

    expect((await b.get('/api/food/kitchen')).body.products).toEqual([]);
    expect((await b.get('/api/food/kitchenware')).body.tools).toEqual([]);
    expect((await b.get('/api/food/stores')).body.stores).toEqual([]);
    expect((await b.get('/api/food/recipes')).body.recipes).toEqual([]);
    expect((await b.get('/api/food/shopping')).body.items).toEqual([]);
    expect((await b.get('/api/food/shopping/trips')).body.trips).toEqual([]);
    expect((await b.get(`/api/food/meals?${range}`)).body.meals).toEqual([]);
    expect((await b.get('/api/food/people')).body.restrictions).toEqual([]);

    expect((await b.get('/api/training/equipment')).body.equipment).toEqual([]);
    expect((await b.get('/api/training/routines')).body.routines).toEqual([]);
    expect((await b.get(`/api/training/workouts?${range}`)).body.workouts).toEqual([]);
    const overview = (await b.get('/api/training/overview')).body;
    expect(overview).toMatchObject({
      todays: [],
      next: null,
      pins: [],
      loggedToday: [],
      equipment: 0,
    });
    // The library to choose from is there; nothing is pinned or planned with it.
    const exercises = (await b.get('/api/training/exercises')).body.exercises;
    expect(exercises.length).toBeGreaterThan(60);
    expect(exercises.some((e: any) => e.pinned)).toBe(false);
  });
});
