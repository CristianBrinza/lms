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

type B = Awaited<ReturnType<typeof cook>>;

const STEAK_SALAD = {
  title: 'Steak with tomato salad',
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 15,
  tags: ['dinner', 'quick'],
  steps: ['Salt the steak.', 'Sear 3 minutes a side.', 'Slice the tomatoes and cucumber.'],
  icon: 'steak',
  ingredients: [
    { name: 'Beef steak', amount: 500, unit: 'g' },
    { name: 'Tomatoes', amount: 2 },
    { name: 'cucumber', amount: 1 },
    { name: 'Salt', note: 'to taste' },
    { name: 'Dill', optional: true },
  ],
};

async function stock(b: B) {
  const steakA = await b.post('/api/food/stock', { name: 'Beef steak', quantity: 1.3, unit: 'kg', expiresOn: '2026-10-04' });
  const steakB = await b.post('/api/food/stock', { name: 'Beef steak', quantity: 2, unit: 'kg', expiresOn: '2026-10-08' });
  await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 3 });
  await b.post('/api/food/stock', { name: 'Cucumbers', quantity: 1 });
  return { steakA: steakA.body, steakB: steakB.body };
}

const totals = async (b: B) =>
  Object.fromEntries(((await b.get('/api/food/kitchen')).body.products as any[]).map((p) => [p.name, p.total]));

describe('food: recipes', () => {
  it('links ingredients to kitchen items and says what is missing', async () => {
    t.setNow(NOW);
    const b = await cook();
    const res = await b.post('/api/food/recipes', STEAK_SALAD);
    expect(res.status).toBe(201);
    const recipe = res.body.recipe;
    expect(recipe.ingredients.map((i: any) => [i.name, i.icon, i.amount, i.unit])).toEqual([
      ['Beef steak', 'steak', 500, 'g'],
      ['Tomatoes', 'tomato', 2, 'pcs'],
      ['cucumber', 'cucumber', 1, 'pcs'],
      ['Salt', 'salt', null, null],
      ['Dill', 'herbs', null, null],
    ]);
    // Salt is a staple that is always there; dill is optional.
    expect(recipe.availability).toMatchObject({ have: 0, total: 3, ready: false });
    expect(recipe.availability.missing.map((m: any) => [m.name, m.missing])).toEqual([
      ['Beef steak', 500],
      ['Tomatoes', 2],
      ['cucumber', 1],
    ]);

    await stock(b);
    const ready = (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe;
    expect(ready.availability).toMatchObject({ have: 3, total: 3, ready: true, useSoon: 1 });
    expect(ready.ingredients[0]).toMatchObject({ inStock: 3300, enough: true, expiresSoon: true });

    const forFour = (await b.get(`/api/food/recipes/${recipe.id}?servings=4`)).body.recipe;
    expect(forFour.ingredients.slice(0, 3).map((i: any) => i.amount)).toEqual([1000, 4, 2]);
    expect(forFour.availability).toMatchObject({ have: 1, ready: false });
  });

  it('refuses an amount the item cannot be counted in', async () => {
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 6 });
    const res = await b.post('/api/food/recipes', { title: 'Omelette', ingredients: [{ name: 'Eggs', amount: 1, unit: 'l' }] });
    expect(res.status).toBe(400);
    expect(res.body.error.fields['ingredients.0.unit']).toMatch(/counted in pcs/);
  });

  it('edits, favourites and archives', async () => {
    const b = await cook();
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    const edited = await b.patch(`/api/food/recipes/${recipe.id}`, { favorite: true, ingredients: [{ name: 'Beef steak', amount: 300, unit: 'g' }] });
    expect(edited.body.recipe).toMatchObject({ favorite: true, title: STEAK_SALAD.title });
    expect(edited.body.recipe.ingredients).toHaveLength(1);
    expect((await b.delete(`/api/food/recipes/${recipe.id}`)).status).toBe(204);
    expect((await b.get('/api/food/recipes')).body.recipes).toEqual([]);
  });
});

describe('food: meal plan', () => {
  it('plans from a recipe, scales, swaps, and lets one day differ', async () => {
    const b = await cook();
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    const meal = (await b.post('/api/food/meals', { date: '2026-10-03', time: '19:30', recipeId: recipe.id, servings: 4 })).body.meal;
    expect(meal).toMatchObject({ title: STEAK_SALAD.title, slot: 'dinner', time: '19:30', servings: 4, status: 'planned', icon: 'steak' });
    expect(meal.ingredients.slice(0, 3).map((i: any) => i.amount)).toEqual([1000, 4, 2]);

    const halved = (await b.patch(`/api/food/meals/${meal.id}`, { servings: 2 })).body.meal;
    expect(halved.ingredients.slice(0, 3).map((i: any) => i.amount)).toEqual([500, 2, 1]);

    const omelette = (await b.post('/api/food/recipes', { title: 'Omelette', servings: 1, icon: 'omelette', ingredients: [{ name: 'Eggs', amount: 3 }] })).body.recipe;
    const swapped = (await b.patch(`/api/food/meals/${meal.id}`, { recipeId: omelette.id })).body.meal;
    expect(swapped).toMatchObject({ title: 'Omelette', recipeId: omelette.id });
    expect(swapped.ingredients.map((i: any) => [i.name, i.amount])).toEqual([['Eggs', 6]]);

    const custom = (
      await b.put(`/api/food/meals/${meal.id}/ingredients`, { ingredients: [{ name: 'Eggs', amount: 4 }, { name: 'Cheese', amount: 50, unit: 'g' }] })
    ).body.meal;
    expect(custom.ingredients.map((i: any) => i.name)).toEqual(['Eggs', 'Cheese']);
    // The recipe itself is untouched.
    expect((await b.get(`/api/food/recipes/${omelette.id}`)).body.recipe.ingredients).toHaveLength(1);

    const named = await b.post('/api/food/meals', { date: '2026-10-03', slot: 'lunch', title: 'Lunch out' });
    expect(named.body.meal).toMatchObject({ title: 'Lunch out', slot: 'lunch', ingredients: [] });
    const day = (await b.get('/api/food/meals?from=2026-10-03&to=2026-10-03')).body.meals;
    expect(day.map((m: any) => m.title)).toEqual(['Lunch out', 'Omelette']);
  });

  it('cooking takes the chosen piece, reports what was missing, keeps leftovers, and can be undone', async () => {
    t.setNow(NOW);
    const b = await cook();
    const { steakB } = await stock(b);
    const before = await totals(b);
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    const meal = (await b.post('/api/food/meals', { date: '2026-10-02', time: '19:00', recipeId: recipe.id, servings: 2 })).body.meal;

    // Tonight: the 2 kg steak instead of the first-expiring one, and two cucumbers.
    const ingredients = meal.ingredients.map((i: any) => ({
      productId: i.productId,
      name: i.name,
      amount: i.name === 'cucumber' ? 2 : i.amount,
      unit: i.unit,
      optional: i.optional,
      lotId: i.name === 'Beef steak' ? steakB.lot.id : null,
    }));
    await b.put(`/api/food/meals/${meal.id}/ingredients`, { ingredients });

    const done = await b.post(`/api/food/meals/${meal.id}/done`, { leftovers: { portions: 1 } });
    expect(done.status).toBe(200);
    expect(done.body.meal).toMatchObject({ status: 'done' });
    expect(done.body.shortfalls).toEqual([{ name: 'cucumber', missing: 1, unit: 'pcs' }]);

    const after = await totals(b);
    expect(after['Beef steak']).toBe(2800);
    expect(after['Tomatoes']).toBe(1);
    expect(after['Cucumbers']).toBeUndefined();
    expect(after['Steak with tomato salad (leftovers)']).toBe(1);
    const steak = (await b.get('/api/food/kitchen')).body.products.find((p: any) => p.name === 'Beef steak');
    expect(steak.lots.find((l: any) => l.id === steakB.lot.id).quantity).toBe(1500);

    expect((await b.patch(`/api/food/meals/${meal.id}`, { servings: 3 })).status).toBe(409);
    expect((await b.patch(`/api/food/meals/${meal.id}`, { note: 'Great' })).status).toBe(200);
    expect((await b.post(`/api/food/meals/${meal.id}/done`, {})).status).toBe(409);

    const reopened = await b.post(`/api/food/meals/${meal.id}/reopen`);
    expect(reopened.body.meal.status).toBe('planned');
    expect(await totals(b)).toEqual(before);
  });

  it('cooks a recipe right now', async () => {
    t.setNow(NOW);
    const b = await cook();
    await stock(b);
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    const res = await b.post(`/api/food/recipes/${recipe.id}/cook`, {});
    expect(res.status).toBe(201);
    expect(res.body.meal).toMatchObject({ date: '2026-10-02', time: '09:00', slot: 'breakfast', status: 'done' });
    expect((await totals(b))['Beef steak']).toBe(2800);
    expect((await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe).toMatchObject({ timesCooked: 1, lastCooked: '2026-10-02' });
  });

  it('works out what to buy for the plan', async () => {
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 2 });
    await b.post('/api/food/stock', { name: 'Beef steak', quantity: 2, unit: 'kg' });
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    await b.post('/api/food/shopping/items', { items: [{ name: 'Tomatoes', amount: 1, storeId: metro.id }] });
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    await b.post('/api/food/meals', { date: '2026-10-05', recipeId: recipe.id, servings: 2 });
    await b.post('/api/food/meals', { date: '2026-10-07', recipeId: recipe.id, servings: 4 });
    await b.post('/api/food/meals', { date: '2026-10-06', title: 'Pasta', ingredients: [{ name: 'Pasta', amount: 500, unit: 'g' }, { name: 'Basil' }, { name: 'Mushrooms' }] });
    // Outside the range: not counted.
    await b.post('/api/food/meals', { date: '2026-10-20', recipeId: recipe.id, servings: 10 });

    const needs = (await b.get('/api/food/plan/needs?from=2026-10-05&to=2026-10-11')).body;
    const byName = Object.fromEntries(needs.lines.map((l: any) => [l.name, l]));
    expect(byName['Tomatoes']).toMatchObject({ needed: 6, inStock: 2, onList: 1, toBuy: 3, toBuyAmount: 3, toBuyUnit: 'pcs', storeId: null });
    expect(byName['Tomatoes'].meals).toHaveLength(2);
    expect(byName['Beef steak']).toMatchObject({ needed: 1500, inStock: 2000, toBuy: 0 });
    expect(byName['Cucumbers']).toMatchObject({ needed: 3, toBuy: 3 });
    expect(byName['Pasta']).toMatchObject({ needed: 500, toBuy: 500, toBuyUnit: 'g' });
    expect(byName['Basil']).toMatchObject({ needed: 1, toBuy: 1 });
    expect(needs.toCheck).toEqual([{ name: 'Mushrooms', meal: 'Pasta' }]);
    expect(needs.lines.map((l: any) => l.category)).toEqual(['produce', 'produce', 'produce', 'meat', 'pantry']);

    const added = await b.post('/api/food/shopping/items', { source: 'plan', items: [{ productId: byName['Cucumbers'].productId, amount: 3, storeId: metro.id }] });
    expect(added.body.items[0]).toMatchObject({ source: 'plan', amount: 3 });
    expect((await b.get('/api/food/plan/needs?from=2026-10-05&to=2026-10-11')).body.lines.find((l: any) => l.name === 'Cucumbers').toBuy).toBe(0);

    expect((await b.get('/api/food/plan/needs?from=2026-10-11&to=2026-10-05')).status).toBe(400);
  });
});

describe('food: everyday details', () => {
  it('opening milk shortens its expiry; a use can be undone', async () => {
    t.setNow(NOW);
    const b = await cook();
    const milk = (await b.post('/api/food/stock', { name: 'Milk', quantity: 1, unit: 'l', expiresOn: '2026-10-20' })).body;
    expect(milk.product.openedDays).toBe(5);
    const used = (await b.post('/api/food/stock/use', { productId: milk.product.id, quantity: 200, unit: 'ml' })).body.result;
    let lot = (await b.get(`/api/food/products/${milk.product.id}`)).body.product.lots[0];
    expect(lot).toMatchObject({ quantity: 800, expiresOn: '2026-10-07' });
    expect(lot.openedAt).toBeTruthy();

    expect((await b.post('/api/food/stock/restore', { lots: used.lots.map((l: any) => ({ lotId: l.lotId, quantity: l.taken })) })).status).toBe(204);
    lot = (await b.get(`/api/food/products/${milk.product.id}`)).body.product.lots[0];
    expect(lot.quantity).toBe(1000);
  });

  it('sums up the Food home', async () => {
    t.setNow(NOW);
    const b = await cook();
    await stock(b);
    await b.post('/api/food/products', { name: 'Eggs', minStock: 6 });
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    await b.post('/api/food/meals', { date: '2026-10-02', time: '19:00', recipeId: recipe.id });
    await b.post('/api/food/meals', { date: '2026-10-04', slot: 'lunch', title: 'Soup' });
    const linella = (await b.post('/api/food/stores', { name: 'Linella' })).body.store;
    await b.post('/api/food/shopping/items', { items: [{ name: 'Bread', storeId: linella.id }, { name: 'Milk' }] });

    const res = await b.get('/api/food/overview?today=2026-10-02');
    expect(res.status).toBe(200);
    expect(res.body.kitchen).toEqual({ name: 'Ana’s kitchen', currency: 'MDL' });
    expect(res.body.stock).toMatchObject({ products: 3, expired: 0 });
    expect(res.body.stock.expiring.map((e: any) => e.name)).toEqual(['Beef steak']);
    expect(res.body.stock.low.map((l: any) => l.name)).toEqual(['Eggs']);
    expect(res.body.recipes).toEqual({ total: 1, ready: 1, favorites: 0 });
    expect(res.body.shopping).toMatchObject({ open: 2, inCart: 0, anyStore: 1, stores: [{ name: 'Linella', open: 1 }] });
    expect(res.body.meals.today.map((m: any) => m.title)).toEqual([STEAK_SALAD.title]);
    expect(res.body.meals.upcoming.map((m: any) => m.title)).toEqual(['Soup']);
    expect(res.body.meals.plannedThisWeek).toBe(2);
  });

  it('keeps recipes and meals inside the kitchen', async () => {
    const b = await cook();
    const recipe = (await b.post('/api/food/recipes', STEAK_SALAD)).body.recipe;
    const meal = (await b.post('/api/food/meals', { date: '2026-10-03', recipeId: recipe.id })).body.meal;
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const ion = t.browser();
    await ion.login('ion@example.com');
    expect((await ion.get(`/api/food/recipes/${recipe.id}`)).status).toBe(404);
    expect((await ion.post('/api/food/meals', { date: '2026-10-03', recipeId: recipe.id })).status).toBe(404);
    expect((await ion.post(`/api/food/meals/${meal.id}/done`, {})).status).toBe(404);
    expect((await ion.get('/api/food/meals?from=2026-10-01&to=2026-10-31')).body.meals).toEqual([]);
  });
});
