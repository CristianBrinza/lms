import { describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('food: drinks, jars and types', () => {
  it('reads the type from the name: apple juice, Coca-Cola Zero, Borjomi', async () => {
    const b = await cook();
    const res = await b.post('/api/food/stock', { name: 'apple juice', quantity: 1, unit: 'box' });
    const apple = res.body;
    expect(apple.product).toMatchObject({ name: 'Juice', icon: 'juice-box' });
    expect(apple.lot).toMatchObject({ variant: 'Apple', quantity: 1000 });

    const mango = (await b.post('/api/food/stock', { name: 'Mango peach juice', quantity: 1, unit: 'box' })).body;
    expect(mango.product.id).toBe(apple.product.id);
    expect(mango.lot.variant).toBe('Mango-peach');

    const zero = (await b.post('/api/food/stock', { name: 'coca cola zero', quantity: 6, unit: 'cans' })).body;
    expect(zero.product.name).toBe('Coca-Cola');
    expect(zero.lot).toMatchObject({ variant: 'Zero', quantity: 1980 });

    const borjomi = (await b.post('/api/food/stock', { name: 'Borjomi', quantity: 2, unit: 'bottles' })).body;
    expect(borjomi.product.name).toBe('Mineral water');
    expect(borjomi.lot.variant).toBe('Borjomi');

    // Items with no types, and catalog names of their own, stay whole.
    expect((await b.post('/api/food/stock', { name: 'Cherry tomatoes', quantity: 250, unit: 'g' })).body.product.name).toBe('Cherry tomatoes');
    expect((await b.post('/api/food/stock', { name: 'Olive oil', quantity: 1 })).body.product.name).toBe('Olive oil');
  });

  it('remembers a new type the first time, here and on the shopping list', async () => {
    const b = await cook();
    const guava = (await b.post('/api/food/stock', { name: 'guava juice', quantity: 1, unit: 'box' })).body;
    expect(guava.lot.variant).toBe('Guava');
    expect(guava.product.variants).toContain('Guava');

    const lines = (await b.post('/api/food/shopping/items', { items: [{ name: 'fanta lemon' }, { name: 'Sprite', variant: 'Cucumber' }] })).body.items;
    expect(lines[0]).toMatchObject({ name: 'Fanta', variant: 'Lemon' });
    expect(lines[1]).toMatchObject({ name: 'Sprite', variant: 'Cucumber' });
    const sprite = (await b.get('/api/food/products')).body.products.find((p: any) => p.name === 'Sprite');
    expect(sprite.variants).toEqual(['Classic', 'Zero', 'Cucumber']);
  });

  it('counts a jar of pickles and a cake by what is inside', async () => {
    const b = await cook();
    const jar = (await b.post('/api/food/stock', { name: 'Pickles', quantity: 1, unit: 'jar' })).body;
    expect(jar.product).toMatchObject({ unit: 'pcs' });
    expect(jar.product.units[0]).toMatchObject({ name: 'jar', size: 12 });
    expect(jar.lot.quantity).toBe(12);

    // This jar holds 14.
    const big = (await b.post('/api/food/stock', { productId: jar.product.id, quantity: 1, unit: 'jar', each: 14 })).body;
    expect(big.lot).toMatchObject({ quantity: 14, initialQuantity: 14 });
    await b.post('/api/food/stock/use', { productId: jar.product.id, lotId: big.lot.id, quantity: 5 });
    const kitchen = (await b.get('/api/food/kitchen')).body;
    const lots = kitchen.products.find((p: any) => p.id === jar.product.id).lots;
    expect(lots.find((l: any) => l.id === big.lot.id)).toMatchObject({ quantity: 9, initialQuantity: 14 });

    const cake = (await b.post('/api/food/stock', { name: 'honey cake', quantity: 1, unit: 'cake', each: 10 })).body;
    expect(cake.product.name).toBe('Cake');
    expect(cake.lot).toMatchObject({ quantity: 10, variant: 'Honey cake' });
  });

  it('knows the canned shelf, each with its own drawing', async () => {
    const b = await cook();
    const names = ['Tuna', 'Chopped tomatoes', 'passata', 'Canned corn', 'șprot', 'tushonka', 'Zacuscă', 'pateu'];
    const icons: Record<string, string> = {};
    for (const name of names) {
      const { product } = (await b.post('/api/food/stock', { name, quantity: 1 })).body;
      icons[product.name] = product.icon;
    }
    expect(icons).toMatchObject({
      'Tuna (canned)': 'can-fish',
      'Chopped tomatoes': 'can-tomato',
      'Tomato sauce (canned)': 'can-tomato',
      'Canned corn': 'can-corn',
      Sprats: 'can-fish',
      Zacuscă: 'jar-spread',
      'Liver pâté': 'pate',
    });
  });

  it('adds packages of different sizes, each its own lot, sharing the price', async () => {
    const b = await cook();
    const honey = (await b.post('/api/food/stock', { name: 'Honey', packages: [{ count: 1, size: 500, sizeUnit: 'g' }], price: 120 })).body;
    expect(honey.product).toMatchObject({ unit: 'g', trackMode: 'exact' });
    expect(honey.lot).toMatchObject({ quantity: 500, package: 'jar', packageSize: 500, price: 120 });

    // One 1 l bottle and two of 0.5 l, 40 lei for all.
    const cola = (await b.post('/api/food/stock', { name: 'Coca-Cola', package: 'bottle', packages: [{ count: 1, size: 1, sizeUnit: 'l' }, { count: 2, size: 500 }], price: 40 })).body;
    expect(cola.lots).toHaveLength(2);
    expect(cola.lots[0]).toMatchObject({ quantity: 1000, package: 'bottle', packageSize: 1000, price: 20 });
    expect(cola.lots[1]).toMatchObject({ quantity: 1000, package: 'bottle', packageSize: 500, price: 20 });

    // A recipe's spoon of honey is weighed.
    const recipe = (await b.post('/api/food/recipes', { title: 'Tea with honey', ingredients: [{ name: 'Honey', amount: 2, unit: 'tbsp' }] })).body.recipe;
    expect(recipe.availability.ready).toBe(true);
  });

  it('buys what the shop has: more in two small cans, more in one big one, or less', async () => {
    const b = await cook();
    const store = (await b.post('/api/food/stores', { name: 'Linella' })).body.store;
    const [corn, beans, peas] = (
      await b.post('/api/food/shopping/items', {
        items: [
          { name: 'Canned corn', amount: 500, unit: 'g', storeId: store.id },
          { name: 'Canned beans', amount: 0.5, unit: 'kg', storeId: store.id },
          { name: 'Canned peas', amount: 800, unit: 'g', storeId: store.id },
        ],
      })
    ).body.items;
    expect(corn).toMatchObject({ need: 500, bought: null, baseUnit: 'g' });

    // No half-kilo can: two of 300 g instead.
    const ticked = (await b.patch(`/api/food/shopping/items/${corn.id}`, { checked: true, package: 'can', bought: [{ count: 2, size: 300, sizeUnit: 'g' }], price: 36 })).body.item;
    expect(ticked).toMatchObject({ checked: true, bought: [{ count: 2, size: 300 }], boughtTotal: 600, need: 500 });
    // One kilo can.
    await b.patch(`/api/food/shopping/items/${beans.id}`, { checked: true, bought: [{ count: 1, size: 1, sizeUnit: 'kg' }] });
    // Only one 400 g can of peas: 400 g more still needed.
    await b.patch(`/api/food/shopping/items/${peas.id}`, { checked: true, bought: [{ count: 1, size: 400 }] });

    const done = (await b.post('/api/food/shopping/checkout', { storeId: store.id, lines: [] })).body;
    expect(done).toMatchObject({ stocked: 3, leftOver: ['Canned peas'] });
    const kitchen = (await b.get('/api/food/kitchen')).body.products;
    expect(kitchen.find((p: any) => p.name === 'Canned corn')).toMatchObject({ total: 600 });
    expect(kitchen.find((p: any) => p.name === 'Canned corn').lots[0]).toMatchObject({ package: 'can', packageSize: 300, price: 36 });
    expect(kitchen.find((p: any) => p.name === 'Canned beans')).toMatchObject({ total: 1000 });

    const left = (await b.get('/api/food/shopping')).body.items;
    expect(left).toHaveLength(1);
    expect(left[0]).toMatchObject({ name: 'Canned peas', amount: 400, unit: 'g', checked: false, storeId: store.id });
  });

  it('can leave the rest off the list, and record another type than the one asked for', async () => {
    const b = await cook();
    const added = await b.post('/api/food/shopping/items', { items: [{ name: 'Bread', amount: 10, unit: 'slices', storeId: null, variant: 'Rye' }] });
    const [line] = added.body.items;
    await b.patch(`/api/food/shopping/items/${line.id}`, { checked: true });
    const done = (
      await b.post('/api/food/shopping/checkout', { storeId: null, lines: [{ id: line.id, package: 'loaf', bought: [{ count: 1, size: 8 }], variant: 'White', keepRest: false }] })
    ).body;
    expect(done.leftOver).toEqual([]);
    const bread = (await b.get('/api/food/kitchen')).body.products.find((p: any) => p.name === 'Bread');
    expect(bread.lots[0]).toMatchObject({ quantity: 8, variant: 'White', package: 'loaf', packageSize: 8 });
    expect((await b.get('/api/food/shopping')).body.items).toHaveLength(0);
  });

  it('brings the catalog’s newer units and types to items already in the kitchen', async () => {
    const b = await cook();
    const corn = (await b.post('/api/food/products', { name: 'Canned corn', units: [], variants: ['Organic'] })).body.product;
    expect(corn.units).toEqual([]);
    expect((await b.post('/api/food/products/refresh')).body.changed).toBeGreaterThan(0);
    const after = (await b.get('/api/food/products')).body.products.find((p: any) => p.id === corn.id);
    expect(after.units[0]).toMatchObject({ name: 'can', size: 340 });
    expect(after.variants).toEqual(['Organic', 'Sweet', 'Baby corn']);
    expect(after.openedLocation).toBe('fridge');
    expect((await b.post('/api/food/products/refresh')).body.changed).toBe(0);
  });
});
