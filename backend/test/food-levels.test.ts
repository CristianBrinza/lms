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

describe('food: kept by level, frozen, guessed', () => {
  it('keeps spices by level: bought is full, then low or out, never weighed', async () => {
    const b = await cook();
    const added = await b.post('/api/food/stock', { name: 'oregano', quantity: 1 });
    expect(added.status).toBe(201);
    expect(added.body.product).toMatchObject({
      name: 'Oregano',
      trackMode: 'level',
      level: 'full',
      category: 'spices',
    });
    expect(added.body.lot).toBeNull();
    const id = added.body.product.id;

    // Using some leaves it as it is.
    expect(
      (await b.post('/api/food/stock/use', { productId: id, quantity: 5, unit: 'g' })).body.result,
    ).toMatchObject({ used: 0, shortfall: 0 });

    const low = await b.put(`/api/food/products/${id}/level`, { level: 'low' });
    expect(low.body.product.level).toBe('low');
    const kitchen = (await b.get('/api/food/kitchen')).body.products;
    expect(kitchen.find((p: any) => p.id === id)).toMatchObject({
      level: 'low',
      low: true,
      lots: [],
    });
    expect((await b.get('/api/food/overview?today=2026-10-02')).body.stock.low).toEqual([
      expect.objectContaining({ name: 'Oregano', level: 'low' }),
    ]);

    // A finished shop makes it full again.
    const line = (await b.post('/api/food/shopping/items', { items: [{ productId: id }] })).body
      .items[0];
    await b.patch(`/api/food/shopping/items/${line.id}`, { checked: true, price: 15 });
    const done = await b.post('/api/food/shopping/checkout', { storeId: null });
    expect(done.body.stocked).toBe(1);
    expect((await b.get(`/api/food/products/${id}`)).body.product.level).toBe('full');

    const exact = await b.post('/api/food/stock', { name: 'Eggs', quantity: 6 });
    expect(
      (await b.put(`/api/food/products/${exact.body.product.id}/level`, { level: 'low' })).status,
    ).toBe(409);
  });

  it('puts level items on the plan’s needs when low or out, and counts them in recipes', async () => {
    const b = await cook();
    const curry = (await b.post('/api/food/stock', { name: 'Curry powder', quantity: 1 })).body
      .product;
    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Curry',
        ingredients: [{ name: 'Curry powder', amount: 2, unit: 'tsp' }],
      })
    ).body.recipe;
    expect(recipe.availability).toMatchObject({ have: 1, total: 1, ready: true });
    await b.put(`/api/food/products/${curry.id}/level`, { level: 'out' });
    expect((await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe.availability).toMatchObject({
      ready: false,
    });

    await b.post('/api/food/meals', { date: '2026-10-05', recipeId: recipe.id });
    const needs = (await b.get('/api/food/plan/needs?from=2026-10-05&to=2026-10-05')).body;
    expect(needs.lines).toEqual([
      expect.objectContaining({ name: 'Curry powder', level: 'out', toBuy: 1 }),
    ]);
    // A shopping line for something new starts out (you're buying it because you have none).
    const line = (await b.post('/api/food/shopping/items', { items: [{ name: 'Smoked paprika' }] }))
      .body.items[0];
    expect((await b.get(`/api/food/products/${line.productId}`)).body.product).toMatchObject({
      trackMode: 'level',
      level: 'out',
    });
  });

  it('keeps half (medium) between full and low: still in stock, not a reason to shop', async () => {
    const b = await cook();
    const sauce = (await b.post('/api/food/stock', { name: 'Jam', quantity: 1 })).body
      .product;
    const id = sauce.id;
    expect(sauce).toMatchObject({ trackMode: 'level', level: 'full' });
    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Toast with jam',
        ingredients: [{ name: 'Jam', amount: 2, unit: 'tbsp' }],
      })
    ).body.recipe;

    const half = await b.put(`/api/food/products/${id}/level`, { level: 'half' });
    expect(half.status).toBe(200);
    expect(half.body.product.level).toBe('half');
    const kitchen = (await b.get('/api/food/kitchen')).body.products;
    expect(kitchen.find((p: any) => p.id === id)).toMatchObject({ level: 'half', low: false });
    const overview = (await b.get('/api/food/overview?today=2026-10-02')).body;
    expect(overview.stock.low).toEqual([]);
    expect(overview.stock.products).toBe(1);
    expect((await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe.availability).toMatchObject({
      ready: true,
    });
    await b.post('/api/food/meals', { date: '2026-10-05', recipeId: recipe.id });
    expect((await b.get('/api/food/plan/needs?from=2026-10-05&to=2026-10-05')).body.lines).toEqual(
      [],
    );

    const bad = await b.put(`/api/food/products/${id}/level`, { level: 'medium' });
    expect(bad.status).toBe(400);
  });

  it('freezing restarts the date, thawing shortens it', async () => {
    t.setNow(NOW);
    const b = await cook();
    const steak = (await b.post('/api/food/stock', { name: 'Beef steak', quantity: 1, unit: 'kg' }))
      .body;
    expect(steak.lot.expiresOn).toBe('2026-10-05');
    const frozen = await b.patch(`/api/food/lots/${steak.lot.id}`, { location: 'freezer' });
    expect(frozen.body.lot).toMatchObject({ location: 'freezer', expiresOn: '2027-01-30' });
    const thawed = await b.patch(`/api/food/lots/${steak.lot.id}`, { location: 'fridge' });
    expect(thawed.body.lot).toMatchObject({ location: 'fridge', expiresOn: '2026-10-04' });

    const fish = (
      await b.post('/api/food/stock', {
        name: 'Salmon',
        quantity: 500,
        unit: 'g',
        location: 'freezer',
      })
    ).body;
    expect(fish.lot.expiresOn).toBe('2026-12-31');
    const mix = (
      await b.post('/api/food/stock', { name: 'amestec mexican', quantity: 400, unit: 'g' })
    ).body;
    expect(mix.product).toMatchObject({ name: 'Mexican mix', location: 'freezer' });
    expect(mix.lot.expiresOn).toBe('2027-05-30');
  });

  it('guesses what an unknown name is', async () => {
    const b = await cook();
    expect(
      (await b.get('/api/food/guess?name=Smoked%20salt%20seasoning')).body.guess,
    ).toMatchObject({ icon: 'spice', category: 'spices', track: 'level' });
    expect((await b.get('/api/food/guess?name=Oat%20cookies')).body.guess).toMatchObject({
      icon: 'cookie',
      category: 'snacks',
    });
    expect((await b.get('/api/food/guess?name=zzz')).body.guess).toBeNull();
    // A new type of a known item: the item, not a new one.
    expect((await b.get('/api/food/guess?name=guava%20juice')).body.match).toEqual({
      item: 'Juice',
      variant: 'Guava',
    });
    expect((await b.get('/api/food/guess?name=Absolut')).body.match).toEqual({
      item: 'Vodka',
      variant: 'Absolut',
    });
    expect((await b.get('/api/food/guess?name=Tomatoes')).body.match).toBeNull();
    // A bottle is counted in ml, so recipes take off what they use.
    const created = (
      await b.post('/api/food/stock', { name: 'Pumpkin seed oil', quantity: 500, unit: 'ml' })
    ).body.product;
    expect(created).toMatchObject({ icon: 'oil', unit: 'ml', trackMode: 'exact' });
  });
});
