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

describe('food: meals of several parts', () => {
  it('makes breakfast of an omelette, a coffee and bread with salmon on the side', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Eggs', quantity: 10 });
    await b.post('/api/food/stock', { name: 'Cheese', quantity: 200, unit: 'g' });
    await b.post('/api/food/stock', { name: 'Bread', quantity: 1, unit: 'loaf' });
    const omelette = (await b.post('/api/food/recipes', { title: 'Cheese omelette', servings: 1, ingredients: [{ name: 'Eggs', amount: 2 }, { name: 'Cheese', amount: 30, unit: 'g' }] })).body.recipe;
    const sauce = (await b.post('/api/food/recipes', { title: 'Garlic sauce', servings: 4, tags: ['sauce'], ingredients: [{ name: 'Sour cream', amount: 200, unit: 'g' }, { name: 'Garlic', amount: 2 }] })).body.recipe;

    const meal = (
      await b.post('/api/food/meals', {
        date: '2026-10-03',
        time: '08:30',
        servings: 2,
        parts: [
          { recipeId: omelette.id },
          { title: 'Coffee', kind: 'drink', ingredients: [{ name: 'Coffee', amount: 20, unit: 'g' }] },
          { title: 'Bread with Philadelphia and salmon', kind: 'side', ingredients: [{ name: 'Bread', amount: 2, unit: 'slices' }, { name: 'Philadelphia', amount: 40, unit: 'g' }, { name: 'Salmon', amount: 60, unit: 'g' }] },
        ],
      })
    ).body.meal;
    expect(meal.title).toBe('Cheese omelette + Coffee + Bread with Philadelphia and salmon');
    expect(meal.recipeId).toBe(omelette.id);
    expect(meal.parts.map((p: any) => [p.title, p.kind, p.servings])).toEqual([
      ['Cheese omelette', 'dish', 2],
      ['Coffee', 'drink', 2],
      ['Bread with Philadelphia and salmon', 'side', 2],
    ]);
    // The omelette is scaled to two people; each line knows its part.
    const eggs = meal.ingredients.find((i: any) => i.name === 'Eggs');
    expect(eggs).toMatchObject({ amount: 4, partId: meal.parts[0].id });
    expect(meal.ingredients.find((i: any) => i.name === 'Salmon').partId).toBe(meal.parts[2].id);

    // A sauce made apart joins the meal; one serving of it each.
    const withSauce = (await b.post(`/api/food/meals/${meal.id}/parts`, { recipeId: sauce.id, kind: 'sauce' })).body.meal;
    expect(withSauce.parts[3]).toMatchObject({ title: 'Garlic sauce', kind: 'sauce', servings: 2 });
    expect(withSauce.ingredients.find((i: any) => i.name === 'Sour cream').amount).toBe(100);

    // Just the coffee for one person.
    const lighter = (await b.patch(`/api/food/meals/${meal.id}/parts/${meal.parts[1].id}`, { servings: 1 })).body.meal;
    expect(lighter.ingredients.find((i: any) => i.name === 'Coffee').amount).toBe(10);

    const noSide = (await b.delete(`/api/food/meals/${meal.id}/parts/${meal.parts[2].id}`)).body.meal;
    expect(noSide.parts).toHaveLength(3);
    expect(noSide.ingredients.some((i: any) => i.name === 'Salmon')).toBe(false);

    // Swapping the recipe swaps the main dish only.
    const pancakes = (await b.post('/api/food/recipes', { title: 'Pancakes', servings: 2, ingredients: [{ name: 'Flour', amount: 200, unit: 'g' }] })).body.recipe;
    const swapped = (await b.patch(`/api/food/meals/${meal.id}`, { recipeId: pancakes.id })).body.meal;
    expect(swapped.parts.map((p: any) => p.title)).toEqual(['Pancakes', 'Coffee', 'Garlic sauce']);
    expect(swapped.recipeId).toBe(pancakes.id);
    expect(swapped.ingredients.some((i: any) => i.name === 'Eggs')).toBe(false);
  });

  it('opens what cooking starts: the can keeps less long and goes to the fridge', async () => {
    t.setNow(NOW);
    const b = await cook();
    const corn = (await b.post('/api/food/stock', { name: 'Canned corn', quantity: 1, unit: 'can', expiresOn: '2027-06-01' })).body;
    expect(corn.lot).toMatchObject({ location: 'pantry', quantity: 340, package: 'can' });
    expect(corn.product.openedLocation).toBe('fridge');
    await b.post('/api/food/stock', { name: 'Yogurt', quantity: 300, unit: 'g', package: 'tub', expiresOn: '2026-10-20' });

    const salad = (await b.post('/api/food/recipes', { title: 'Corn salad', servings: 1, ingredients: [{ name: 'Canned corn', amount: 20, unit: 'g' }, { name: 'Yogurt', amount: 100, unit: 'g' }] })).body.recipe;
    const done = (await b.post(`/api/food/recipes/${salad.id}/cook`, {})).body;
    expect(done.opened).toEqual([
      expect.objectContaining({ name: 'Canned corn', left: 320, unit: 'g', location: 'fridge', expiresOn: '2026-10-05' }),
      expect.objectContaining({ name: 'Yogurt', location: 'fridge', expiresOn: '2026-10-04' }),
    ]);
    const lots = (await b.get('/api/food/kitchen')).body.products.find((p: any) => p.name === 'Canned corn').lots;
    expect(lots[0]).toMatchObject({ quantity: 320, location: 'fridge', expiresOn: '2026-10-05' });
    expect(lots[0].openedAt).not.toBeNull();
  });
});
