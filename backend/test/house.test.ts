import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

describe('the house: things that aren’t food', () => {
  it('keeps house things apart from the kitchen, on the same engine, and shops for both', async () => {
    await t.createUser({ email: 'ana@example.com', name: 'Ana' });
    const b = t.browser();
    await b.login('ana@example.com');

    const shampoo = (await b.post('/api/food/stock', { name: 'șampon', quantity: 400, unit: 'ml' }))
      .body.product;
    expect(shampoo).toMatchObject({
      name: 'Shampoo',
      area: 'house',
      category: 'bathroom',
      location: 'bathroom',
      trackMode: 'level',
    });
    const cartridges = (
      await b.post('/api/food/stock', {
        name: 'Litter box deodorizer',
        quantity: 3,
        variant: 'Petkit N60',
      })
    ).body;
    expect(cartridges.product).toMatchObject({
      area: 'house',
      category: 'pets',
      variants: ['Petkit N50', 'Petkit N60'],
    });
    await b.post('/api/food/stock', { name: 'Milk', quantity: 1000, unit: 'ml' });
    // Something the catalog doesn't know, added from the House, is a house thing.
    const filter = (
      await b.post('/api/food/stock', { name: 'Robot vacuum filter', quantity: 2, area: 'house' })
    ).body.product;
    expect(filter).toMatchObject({ area: 'house', category: 'household', location: 'storage' });

    const house = (await b.get('/api/food/kitchen?area=house')).body.products
      .map((p: any) => p.name)
      .sort();
    expect(house).toEqual(['Litter box deodorizer', 'Robot vacuum filter', 'Shampoo']);
    const food = (await b.get('/api/food/kitchen?area=food')).body.products.map((p: any) => p.name);
    expect(food).toEqual(['Milk']);

    // One list, two areas: Metro has paper towels and cheese.
    const metro = (await b.post('/api/food/stores', { name: 'Metro' })).body.store;
    const lines = (
      await b.post('/api/food/shopping/items', {
        items: [
          { name: 'Paper towels', storeId: metro.id },
          { name: 'Cheese', storeId: metro.id },
        ],
      })
    ).body.items;
    expect(lines.map((l: any) => [l.name, l.area])).toEqual([
      ['Paper towels', 'house'],
      ['Cheese', 'food'],
    ]);
    const foodOverview = (await b.get('/api/food/overview?today=2026-10-04')).body;
    const houseOverview = (await b.get('/api/food/overview?today=2026-10-04&area=house')).body;
    expect(foodOverview.shopping.open).toBe(1);
    expect(houseOverview.shopping.open).toBe(1);
    expect(houseOverview.stock.products).toBe(3);
  });

  it('moves old “household” items to their own kind and picture, once', async () => {
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const b = t.browser();
    await b.login('ion@example.com');
    await b.post('/api/food/stock', { name: 'Toilet paper', quantity: 8 });
    await t.db.query(
      `UPDATE products SET category = 'household', location = 'other', icon = 'roll' WHERE name = 'Toilet paper'`,
    );
    await t.db.query('UPDATE households SET catalog_version = 2');
    const tp = (await b.get('/api/food/kitchen?area=house')).body.products.find(
      (p: any) => p.name === 'Toilet paper',
    );
    expect(tp).toMatchObject({
      category: 'paper',
      location: 'storage',
      icon: 'toilet-paper',
      area: 'house',
    });
  });
});
