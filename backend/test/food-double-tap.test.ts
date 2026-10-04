import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

/** A double tap on a phone sends the same request twice at once; the kitchen changes once. */
describe('food: double taps', () => {
  it('eats a meal once, checks out a store once, and reopens once', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const ana = t.browser();
    await ana.login('ana@example.com');
    await ana.post('/api/food/stock', { name: 'Eggs', quantity: 10, unit: 'pcs' });
    const meal = (
      await ana.post('/api/food/meals', {
        date: '2026-10-05',
        title: 'Omelette',
        ingredients: [{ name: 'Eggs', amount: 3, unit: 'pcs' }],
      })
    ).body.meal;

    const eggs = async () =>
      (await ana.get('/api/food/kitchen')).body.products.find((p: any) => p.name === 'Eggs').total;

    const done = await Promise.all([
      ana.post(`/api/food/meals/${meal.id}/done`, {}),
      ana.post(`/api/food/meals/${meal.id}/done`, {}),
    ]);
    expect(done.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await eggs()).toBe(7);

    const reopened = await Promise.all([
      ana.post(`/api/food/meals/${meal.id}/reopen`, {}),
      ana.post(`/api/food/meals/${meal.id}/reopen`, {}),
    ]);
    expect(reopened.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await eggs()).toBe(10);

    const [line] = (
      await ana.post('/api/food/shopping/items', {
        items: [{ name: 'Milk', quantity: 1000, unit: 'ml' }],
      })
    ).body.items;
    await ana.patch(`/api/food/shopping/items/${line.id}`, { checked: true });
    const checkouts = await Promise.all([
      ana.post('/api/food/shopping/checkout', { storeId: null }),
      ana.post('/api/food/shopping/checkout', { storeId: null }),
    ]);
    expect(checkouts.map((r) => r.status).sort()).toEqual([201, 409]);
    const milk = (await ana.get('/api/food/kitchen')).body.products.find(
      (p: any) => p.name === 'Milk',
    );
    expect(milk.total).toBe(1000);
    expect((await ana.get('/api/food/shopping/trips')).body.trips).toHaveLength(1);
  });
});
