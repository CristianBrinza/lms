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
    expect(jar.product).toMatchObject({ unit: 'pcs', units: [{ name: 'jar', size: 12 }] });
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
});
