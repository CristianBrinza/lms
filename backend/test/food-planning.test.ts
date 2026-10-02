import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();
const NOW = new Date('2026-10-02T09:00:00');

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('food: planning ahead', () => {
  it('says when something in the kitchen is already promised to a planned meal', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Beef steak', quantity: 600, unit: 'g', expiresOn: '2026-10-10' });
    const recipe = (await b.post('/api/food/recipes', { title: 'Steak', servings: 2, ingredients: [{ name: 'Beef steak', amount: 500, unit: 'g' }] })).body.recipe;
    expect(recipe.availability.ready).toBe(true);
    const thursday = (await b.post('/api/food/meals', { date: '2026-10-08', time: '19:00', recipeId: recipe.id })).body.meal;
    expect(thursday.availability.ready).toBe(true);

    const now = (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe;
    expect(now.availability.ready).toBe(false);
    expect(now.ingredients[0]).toMatchObject({ enough: false, missing: 400, reservedFor: { id: thursday.id, date: '2026-10-08' } });

    // A second dinner before Thursday takes the steak first; Thursday then goes short.
    const tuesday = (await b.post('/api/food/meals', { date: '2026-10-06', time: '19:00', recipeId: recipe.id })).body.meal;
    expect(tuesday.availability.ready).toBe(true);
    const week = (await b.get('/api/food/meals?from=2026-10-05&to=2026-10-11')).body.meals;
    const later = week.find((m: any) => m.id === thursday.id);
    expect(later.ingredients[0]).toMatchObject({ enough: false, missing: 400, reservedFor: { id: tuesday.id } });
  });

  it('counts bread by the slice and keeps the kind of cheese on each piece', async () => {
    const b = await cook();
    const bread = (await b.post('/api/food/stock', { name: 'Bread', quantity: 1 })).body;
    expect(bread.product.units).toEqual([{ name: 'slice', size: 0.05 }]);
    const used = await b.post('/api/food/stock/use', { productId: bread.product.id, quantity: 4, unit: 'slices' });
    expect(used.body.result.used).toBe(0.2);

    const cheddar = (await b.post('/api/food/stock', { name: 'Cheese', quantity: 300, unit: 'g', variant: 'Cheddar' })).body;
    expect(cheddar.lot.variant).toBe('Cheddar');
    expect(cheddar.product.variants).toContain('Cheddar');
    const squares = (await b.post('/api/food/stock', { productId: cheddar.product.id, quantity: 8, unit: 'square', variant: 'Processed' })).body;
    expect(squares.lot).toMatchObject({ quantity: 144, variant: 'Processed' });

    const custom = await b.patch(`/api/food/products/${cheddar.product.id}`, { units: [{ name: 'wedge', size: 150 }], variants: ['Brie'] });
    expect(custom.body.product).toMatchObject({ units: [{ name: 'wedge', size: 150 }], variants: ['Brie'] });
  });

  it('puts what is needed soonest, and what matters, first on the list', async () => {
    const b = await cook();
    const lines = (
      await b.post('/api/food/shopping/items', {
        items: [{ name: 'Bread' }, { name: 'Milk', needBy: '2026-10-09' }, { name: 'Eggs', priority: true }, { name: 'Cheese', needBy: '2026-10-04', variant: 'Parmesan' }],
      })
    ).body.items;
    expect(lines.find((l: any) => l.name === 'Cheese')).toMatchObject({ variant: 'Parmesan', needBy: '2026-10-04' });
    const list = (await b.get('/api/food/shopping')).body.items.map((l: any) => l.name);
    expect(list).toEqual(['Cheese', 'Milk', 'Eggs', 'Bread']);
    const eggs = lines.find((l: any) => l.name === 'Eggs');
    expect((await b.patch(`/api/food/shopping/items/${eggs.id}`, { priority: false, needBy: '2026-10-03' })).body.item).toMatchObject({ priority: false, needBy: '2026-10-03' });
  });

  it('packs meals tagged “to go”', async () => {
    const b = await cook();
    const box = (await b.post('/api/food/recipes', { title: 'Chicken box', tags: ['to go'], ingredients: [] })).body.recipe;
    const lunch = (await b.post('/api/food/meals', { date: '2026-10-05', slot: 'lunch', recipeId: box.id })).body.meal;
    expect(lunch.toGo).toBe(true);
    const plain = (await b.post('/api/food/meals', { date: '2026-10-05', slot: 'dinner', title: 'Soup' })).body.meal;
    expect(plain.toGo).toBe(false);
    expect((await b.patch(`/api/food/meals/${plain.id}`, { toGo: true })).body.meal.toGo).toBe(true);
  });
});
