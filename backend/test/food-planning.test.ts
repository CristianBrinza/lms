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
    await b.post('/api/food/stock', {
      name: 'Beef steak',
      quantity: 600,
      unit: 'g',
      expiresOn: '2026-10-10',
    });
    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Steak',
        servings: 2,
        ingredients: [{ name: 'Beef steak', amount: 500, unit: 'g' }],
      })
    ).body.recipe;
    expect(recipe.availability.ready).toBe(true);
    const thursday = (
      await b.post('/api/food/meals', { date: '2026-10-08', time: '19:00', recipeId: recipe.id })
    ).body.meal;
    expect(thursday.availability.ready).toBe(true);

    const now = (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe;
    expect(now.availability.ready).toBe(false);
    expect(now.ingredients[0]).toMatchObject({
      enough: false,
      missing: 400,
      reservedFor: { id: thursday.id, date: '2026-10-08' },
    });

    // A second dinner before Thursday takes the steak first; Thursday then goes short.
    const tuesday = (
      await b.post('/api/food/meals', { date: '2026-10-06', time: '19:00', recipeId: recipe.id })
    ).body.meal;
    expect(tuesday.availability.ready).toBe(true);
    const week = (await b.get('/api/food/meals?from=2026-10-05&to=2026-10-11')).body.meals;
    const later = week.find((m: any) => m.id === thursday.id);
    expect(later.ingredients[0]).toMatchObject({
      enough: false,
      missing: 400,
      reservedFor: { id: tuesday.id },
    });
  });

  it('says when food would be there but goes off before the meal', async () => {
    t.setNow(NOW);
    const b = await cook();
    await b.post('/api/food/stock', {
      name: 'Cake',
      quantity: 1,
      unit: 'cake',
      each: 10,
      expiresOn: '2026-10-05',
    });
    const snack = (
      await b.post('/api/food/meals', {
        date: '2026-10-07',
        time: '16:30',
        title: 'Cake',
        ingredients: [{ name: 'Cake', amount: 2 }],
      })
    ).body.meal;
    expect(snack.ingredients[0]).toMatchObject({
      enough: false,
      missing: 2,
      spoilsBefore: true,
      reservedFor: null,
    });
    const today = (
      await b.post('/api/food/meals', {
        date: '2026-10-03',
        time: '16:30',
        title: 'Cake today',
        ingredients: [{ name: 'Cake', amount: 2 }],
      })
    ).body.meal;
    expect(today.ingredients[0]).toMatchObject({ enough: true, spoilsBefore: false });
  });

  it('counts bread by the slice and keeps the kind of cheese on each piece', async () => {
    const b = await cook();
    // Bread is counted in slices; a loaf is its package, 20 slices unless this one says otherwise.
    const bread = (await b.post('/api/food/stock', { name: 'Bread', quantity: 1, unit: 'loaf' }))
      .body;
    expect(bread.product.units[0]).toMatchObject({ name: 'loaf', size: 20 });
    expect(bread.lot).toMatchObject({ quantity: 20, package: 'loaf', packageSize: 20 });
    const used = await b.post('/api/food/stock/use', { productId: bread.product.id, quantity: 4 });
    expect(used.body.result.used).toBe(4);

    const cheddar = (
      await b.post('/api/food/stock', {
        name: 'Cheese',
        quantity: 300,
        unit: 'g',
        variant: 'Cheddar',
      })
    ).body;
    expect(cheddar.lot.variant).toBe('Cheddar');
    expect(cheddar.product.variants).toContain('Cheddar');
    const squares = (
      await b.post('/api/food/stock', {
        productId: cheddar.product.id,
        quantity: 8,
        unit: 'square',
        variant: 'Processed',
      })
    ).body;
    expect(squares.lot).toMatchObject({ quantity: 144, variant: 'Processed' });

    const custom = await b.patch(`/api/food/products/${cheddar.product.id}`, {
      units: [{ name: 'wedge', size: 150 }],
      variants: ['Brie'],
    });
    expect(custom.body.product).toMatchObject({
      units: [{ name: 'wedge', size: 150 }],
      variants: ['Brie'],
    });
  });

  it('puts what is needed soonest, and what matters, first on the list', async () => {
    const b = await cook();
    const lines = (
      await b.post('/api/food/shopping/items', {
        items: [
          { name: 'Bread' },
          { name: 'Milk', needBy: '2026-10-09' },
          { name: 'Eggs', priority: true },
          { name: 'Cheese', needBy: '2026-10-04', variant: 'Parmesan' },
        ],
      })
    ).body.items;
    expect(lines.find((l: any) => l.name === 'Cheese')).toMatchObject({
      variant: 'Parmesan',
      needBy: '2026-10-04',
    });
    const list = (await b.get('/api/food/shopping')).body.items.map((l: any) => l.name);
    expect(list).toEqual(['Cheese', 'Milk', 'Eggs', 'Bread']);
    const eggs = lines.find((l: any) => l.name === 'Eggs');
    expect(
      (
        await b.patch(`/api/food/shopping/items/${eggs.id}`, {
          priority: false,
          needBy: '2026-10-03',
        })
      ).body.item,
    ).toMatchObject({ priority: false, needBy: '2026-10-03' });
  });

  it('packs meals tagged “to go”', async () => {
    const b = await cook();
    const box = (
      await b.post('/api/food/recipes', { title: 'Chicken box', tags: ['to go'], ingredients: [] })
    ).body.recipe;
    const lunch = (
      await b.post('/api/food/meals', { date: '2026-10-05', slot: 'lunch', recipeId: box.id })
    ).body.meal;
    expect(lunch.toGo).toBe(true);
    const plain = (
      await b.post('/api/food/meals', { date: '2026-10-05', slot: 'dinner', title: 'Soup' })
    ).body.meal;
    expect(plain.toGo).toBe(false);
    expect((await b.patch(`/api/food/meals/${plain.id}`, { toGo: true })).body.meal.toGo).toBe(
      true,
    );
  });
});

describe('food: allergies and dislikes', () => {
  it('flags what someone is allergic to or avoids, by item or by kind', async () => {
    const ana = await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const b = t.browser();
    await b.login('ana@example.com');
    const ion = await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    await b.get('/api/food/kitchen');
    await t.db.query(
      'UPDATE users SET household_id = (SELECT household_id FROM users WHERE id = $1) WHERE id = $2',
      [ana.id, ion.id],
    );

    const people = (await b.get('/api/food/people')).body.people.map((p: any) => p.name);
    expect(people).toEqual(['Ana', 'Ion']);
    await b.post('/api/food/restrictions', { userId: ion.id, kind: 'allergy', name: 'Honey' });
    await b.post('/api/food/restrictions', { userId: ana.id, kind: 'avoid', category: 'fish' });
    expect((await b.post('/api/food/restrictions', { userId: ion.id, kind: 'avoid' })).status).toBe(
      400,
    );

    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Salmon with honey',
        ingredients: [
          { name: 'Salmon', amount: 300, unit: 'g' },
          { name: 'Honey', amount: 1, unit: 'tbsp' },
          { name: 'Salt' },
        ],
      })
    ).body.recipe;
    expect(recipe.ingredients[0].warnings).toEqual([{ person: 'Ana', kind: 'avoid' }]);
    expect(recipe.ingredients[1].warnings).toEqual([{ person: 'Ion', kind: 'allergy' }]);
    expect(recipe.ingredients[2].warnings).toEqual([]);
    expect(recipe.availability.warnings).toEqual([
      { person: 'Ana', kind: 'avoid', item: 'Salmon' },
      { person: 'Ion', kind: 'allergy', item: 'Honey' },
    ]);

    const [allergy] = (await b.get('/api/food/people')).body.restrictions.filter(
      (r: any) => r.kind === 'allergy',
    );
    expect((await b.delete(`/api/food/restrictions/${allergy.id}`)).status).toBe(204);
    expect(
      (await b.get(`/api/food/recipes/${recipe.id}`)).body.recipe.ingredients[1].warnings,
    ).toEqual([]);
  });
});
