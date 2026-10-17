import { describe, expect, it } from 'vitest';
import { PRESET_NAMES, TOOL_NAMES, VARIANT_NAMES } from '../src/modules/food/catalog-i18n';
import { TOOL_PRESETS } from '../src/modules/food/kitchenware';
import { findPreset, PRESETS } from '../src/modules/food/presets';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function cook() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('food in English, Romanian and Russian: the catalog', () => {
  it('names every catalog item and kitchenware preset in Romanian and Russian', () => {
    expect(PRESETS.filter((p) => !PRESET_NAMES[p.name]).map((p) => p.name)).toEqual([]);
    expect(TOOL_PRESETS.filter((p) => !TOOL_NAMES[p.name]).map((p) => p.name)).toEqual([]);
    // Only real items and kinds are translated (no typos in the keys).
    const names = new Set(PRESETS.map((p) => p.name));
    expect(Object.keys(PRESET_NAMES).filter((name) => !names.has(name))).toEqual([]);
    for (const [item, kinds] of Object.entries(VARIANT_NAMES)) {
      const preset = PRESETS.find((p) => p.name === item);
      expect(preset, item).toBeDefined();
      expect(Object.keys(kinds).filter((kind) => !preset!.variants?.includes(kind))).toEqual([]);
    }
    // Romanian with comma-below diacritics, never the cedilla ones.
    const all = JSON.stringify([PRESET_NAMES, VARIANT_NAMES, TOOL_NAMES]);
    expect(all).not.toMatch(/[şţŞŢ]/);
  });

  it('finds catalog items by their Romanian and Russian names', () => {
    expect(findPreset('roșii')?.name).toBe('Tomatoes');
    expect(findPreset('помидоры')?.name).toBe('Tomatoes');
    expect(findPreset('Brânză de vaci')?.name).toBe('Cottage cheese');
    expect(findPreset('Кухонные весы')).toBeNull();
    expect(findPreset('Сливочное масло')?.name).toBe('Butter');
  });

  it('serves the catalog with its names and kinds in every language', async () => {
    const b = await cook();
    const { presets } = (await b.get('/api/food/presets')).body;
    const tomatoes = presets.find((p: any) => p.name === 'Tomatoes');
    expect(tomatoes.translations).toEqual({
      en: { name: 'Tomatoes' },
      ro: { name: 'Roșii' },
      ru: { name: 'Помидоры' },
    });
    const bread = presets.find((p: any) => p.name === 'Bread');
    const black = bread.variants.indexOf('Black');
    expect(bread.translations.ro.variants[black]).toBe('Neagră');
    expect(bread.translations.ru.variants[black]).toBe('Чёрный');

    const kitchenware = (await b.get('/api/food/kitchenware')).body;
    const pan = kitchenware.presets.find((p: any) => p.name === 'Frying pan');
    expect(pan.translations).toMatchObject({ ro: { name: 'Tigaie' }, ru: { name: 'Сковорода' } });
  });
});

describe('food in English, Romanian and Russian: the kitchen', () => {
  it('gives catalog items their names in all three languages, however they are typed', async () => {
    const b = await cook();
    const ro = (await b.post('/api/food/stock', { name: 'roșii', quantity: 3 })).body.product;
    expect(ro.name).toBe('Tomatoes');
    expect(ro.translations).toMatchObject({
      en: { name: 'Tomatoes' },
      ro: { name: 'Roșii' },
      ru: { name: 'Помидоры' },
    });
    const ru = (await b.post('/api/food/stock', { name: 'помидоры', quantity: 2 })).body.product;
    expect(ru.id).toBe(ro.id);

    // Searching finds it in any language.
    for (const q of ['roș', 'помид', 'tomat'])
      expect((await b.get(`/api/food/products?q=${encodeURIComponent(q)}`)).body.products).toEqual([
        expect.objectContaining({ id: ro.id }),
      ]);

    // A kind in another language is the catalog's kind: "pâine neagră" is Bread, Black.
    const bread = (await b.post('/api/food/stock', { name: 'pâine neagră', quantity: 1 })).body;
    expect(bread.product.name).toBe('Bread');
    expect(bread.lot.variant).toBe('Black');
    expect(bread.lot.translations).toEqual({
      ro: { variant: 'Neagră' },
      ru: { variant: 'Чёрный' },
    });
    const juice = (
      await b.post('/api/food/stock', { name: 'яблочный сок', quantity: 1, unit: 'box' })
    ).body;
    expect(juice.product.name).toBe('Juice');
    expect(juice.lot.variant).toBe('Apple');

    // Kitchen rows carry the item's translations.
    const kitchen = (await b.get('/api/food/kitchen')).body.products;
    expect(kitchen.find((p: any) => p.id === ro.id).translations.ru.name).toBe('Помидоры');
  });

  it('keeps what people write in other languages, and drops a name that no longer fits', async () => {
    const b = await cook();
    const own = (
      await b.post('/api/food/products', {
        name: 'Homemade hummus',
        note: 'From the market',
        translations: { ro: { name: 'Humus de casă' }, ru: { name: 'Домашний хумус' } },
      })
    ).body.product;
    expect(own.translations).toEqual({
      ro: { name: 'Humus de casă' },
      ru: { name: 'Домашний хумус' },
    });
    const patched = (
      await b.patch(`/api/food/products/${own.id}`, {
        translations: { ro: { note: 'De la piață' } },
      })
    ).body.product;
    expect(patched.translations.ro).toEqual({ name: 'Humus de casă', note: 'De la piață' });
    // Its name in Romanian finds it.
    const found = (await b.post('/api/food/stock', { name: 'humus de casă', quantity: 200 })).body;
    expect(found.product.id).toBe(own.id);

    const renamed = (await b.patch(`/api/food/products/${own.id}`, { name: 'Spicy hummus' })).body
      .product;
    expect(renamed.translations.ro).toEqual({ note: 'De la piață' });
  });

  it('brings existing catalog items their names once (by the catalog name), keeping what was written', async () => {
    const b = await cook();
    const tomato = (await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 3 })).body
      .product;
    const pan = (await b.post('/api/food/kitchenware', { name: 'Frying pan' })).body.tool;
    const own = (await b.post('/api/food/products', { name: 'Mystery jam' })).body.product;
    await t.db.query(`UPDATE products SET translations = '{}'`);
    await t.db.query(
      `UPDATE products SET translations = '{"ru": {"note": "С дачи"}}' WHERE id = $1`,
      [tomato.id],
    );
    await t.db.query(`UPDATE tools SET translations = '{}'`);
    await t.db.query('UPDATE households SET catalog_version = 4');

    const products = (await b.get('/api/food/products')).body.products;
    expect(products.find((p: any) => p.id === tomato.id).translations).toEqual({
      en: { name: 'Tomatoes' },
      ro: { name: 'Roșii' },
      ru: { name: 'Помидоры', note: 'С дачи' },
    });
    expect(products.find((p: any) => p.id === own.id).translations).toEqual({});
    const tools = (await b.get('/api/food/kitchenware')).body.tools;
    expect(tools.find((x: any) => x.id === pan.id).translations.ro.name).toBe('Tigaie');
  });

  it('keeps the names people give kinds the catalog doesn’t know, each with its kind', async () => {
    const b = await cook();
    const bread = (
      await b.post('/api/food/products', {
        name: 'Bread',
        variants: ['White', 'Sourdough'],
        // As a list, in the order of variants ('' leaves the catalog's word).
        translations: { ro: { variants: ['', 'Cu maia'] }, ru: { variants: ['', 'На закваске'] } },
      })
    ).body.product;
    expect(bread.translations.ro.variants).toEqual(['Albă', 'Cu maia']);
    expect(bread.translations.ru.variants).toEqual(['Белый', 'На закваске']);

    // Adding and reordering kinds keeps each name with its kind; a new one comes by kind.
    const more = (
      await b.patch(`/api/food/products/${bread.id}`, {
        variants: ['Seeded', 'White', 'Sourdough', 'Spelt'],
        translations: {
          ro: { variants: { spelt: 'Din spelt' } },
          ru: { variants: { Spelt: 'Из полбы' } },
        },
      })
    ).body.product;
    expect(more.variants).toEqual(['Seeded', 'White', 'Sourdough', 'Spelt']);
    expect(more.translations.ro.variants).toEqual(['Cu semințe', 'Albă', 'Cu maia', 'Din spelt']);
    expect(more.translations.ru.variants).toEqual([
      'С семенами',
      'Белый',
      'На закваске',
      'Из полбы',
    ]);
    expect(more.translations.ro.name).toBe('Pâine');

    // A name of their own wins over the catalog's; the catalog's word again clears it.
    const fixed = (
      await b.patch(`/api/food/products/${bread.id}`, {
        translations: { ro: { variants: { White: 'Albă feliată' } } },
      })
    ).body.product;
    expect(fixed.translations.ro.variants[1]).toBe('Albă feliată');
    const back = (
      await b.patch(`/api/food/products/${bread.id}`, {
        translations: { ro: { variants: { White: 'Albă' } } },
      })
    ).body.product;
    expect(back.translations.ro.variants[1]).toBe('Albă');
    const { rows } = await t.db.query('SELECT variant_names FROM products WHERE id = $1', [
      bread.id,
    ]);
    expect(rows[0]?.variant_names).toEqual({
      ro: { Sourdough: 'Cu maia', Spelt: 'Din spelt' },
      ru: { Sourdough: 'На закваске', Spelt: 'Из полбы' },
    });

    // Its pieces carry the kind's names, and the kind is found by them.
    const lot = (await b.post('/api/food/stock', { name: 'pâine cu maia', quantity: 1 })).body.lot;
    expect(lot.variant).toBe('Sourdough');
    expect(lot.translations).toEqual({
      ro: { variant: 'Cu maia' },
      ru: { variant: 'На закваске' },
    });
    // Catalog kinds still translate.
    const white = (
      await b.post('/api/food/stock', { name: 'Bread', variant: 'White', quantity: 1 })
    ).body.lot;
    expect(white.translations).toEqual({ ro: { variant: 'Albă' }, ru: { variant: 'Белый' } });
  });

  it('takes kinds’ names with stock, by kind, and keeps them as kinds are added', async () => {
    const b = await cook();
    const greek = (
      await b.post('/api/food/stock', {
        name: 'Homemade yogurt',
        variant: 'Greek 2%',
        quantity: 1,
        translations: {
          ro: { name: 'Iaurt de casă', variants: { 'greek 2%': 'Grecesc 2%' } },
          ru: { name: 'Домашний йогурт', variants: { 'Greek 2%': 'Греческий 2%' } },
        },
      })
    ).body;
    // (Its other kinds, if any, are guessed from the catalog's yogurt.)
    const g = greek.product.variants.indexOf('Greek 2%');
    expect(g).toBeGreaterThanOrEqual(0);
    expect(greek.product.translations.ro.name).toBe('Iaurt de casă');
    expect(greek.product.translations.ro.variants[g]).toBe('Grecesc 2%');
    expect(greek.product.translations.ru.variants[g]).toBe('Греческий 2%');
    expect(greek.lot.translations).toEqual({
      ro: { variant: 'Grecesc 2%' },
      ru: { variant: 'Греческий 2%' },
    });
    // Another kind: the first keeps its names.
    const free = (
      await b.post('/api/food/stock', {
        name: 'Homemade yogurt',
        variant: 'Lactose-free',
        quantity: 1,
        translations: { ro: { variants: { 'Lactose-free': 'Fără lactoză' } } },
      })
    ).body.product;
    const f = free.variants.indexOf('Lactose-free');
    expect(f).toBe(free.variants.length - 1);
    expect(free.variants.indexOf('Greek 2%')).toBe(g);
    expect(free.translations.ro.variants[g]).toBe('Grecesc 2%');
    expect(free.translations.ro.variants[f]).toBe('Fără lactoză');
    expect(free.translations.ru.variants[g]).toBe('Греческий 2%');
    expect(free.translations.ru.variants[f]).toBe('Lactose-free');
    // A shopping line for a kind shows the kind's names.
    const [line] = (
      await b.post('/api/food/shopping/items', {
        items: [{ name: 'Homemade yogurt', variant: 'Greek 2%' }],
      })
    ).body.items;
    expect(line.translations.ro.variant).toBe('Grecesc 2%');
  });

  it('names kitchenware in every language and finds it by any of its names', async () => {
    const b = await cook();
    const pan = (await b.post('/api/food/kitchenware', { name: 'tigaie' })).body.tool;
    expect(pan).toMatchObject({
      name: 'Frying pan',
      translations: { ro: { name: 'Tigaie' }, ru: { name: 'Сковорода' } },
    });
    const again = (await b.post('/api/food/kitchenware', { name: 'сковорода', count: 2 })).body
      .tool;
    expect(again).toMatchObject({ id: pan.id, name: 'Frying pan', count: 2 });
  });
});

describe('food in English, Romanian and Russian: recipes, meals, stores', () => {
  it('stores a recipe in other languages and shows its lines by the item’s names', async () => {
    const b = await cook();
    await b.post('/api/food/stock', { name: 'Tomatoes', quantity: 2 });
    const recipe = (
      await b.post('/api/food/recipes', {
        title: 'Tomato salad',
        steps: ['Cut the tomatoes', 'Salt'],
        ingredients: [
          { name: 'Tomatoes', amount: 4 },
          { name: 'Finlandia vodka', amount: 10, unit: 'ml' },
        ],
        translations: {
          ro: { title: 'Salată de roșii', steps: ['Tăiați roșiile', 'Sare'] },
          ru: { title: 'Салат из помидоров' },
        },
      })
    ).body.recipe;
    expect(recipe.translations).toEqual({
      ro: { title: 'Salată de roșii', steps: ['Tăiați roșiile', 'Sare'] },
      ru: { title: 'Салат из помидоров' },
    });
    const [tomatoes, vodka] = recipe.ingredients;
    expect(tomatoes.translations.ro).toEqual({ name: 'Roșii' });
    // A line that says more than the item's name keeps its own words; its kind is the catalog's.
    expect(vodka.translations.ro?.name).toBeUndefined();
    expect(recipe.availability.missing[0]).toMatchObject({
      name: 'Tomatoes',
      translations: { ro: { name: 'Roșii' }, ru: { name: 'Помидоры' } },
    });

    // Rewriting the steps drops their old translations; the title's stay.
    const edited = (
      await b.patch(`/api/food/recipes/${recipe.id}`, { steps: ['Slice the tomatoes'] })
    ).body.recipe;
    expect(edited.translations.ro).toEqual({ title: 'Salată de roșii' });

    // A meal from it is called by the recipe's title in every language.
    const meal = (await b.post('/api/food/meals', { date: '2026-10-20', recipeId: recipe.id })).body
      .meal;
    expect(meal.translations.ro.title).toBe('Salată de roșii');
    expect(meal.parts[0].translations.ru.title).toBe('Салат из помидоров');
  });

  it('translates the server’s own meal titles, and keeps where people ate out', async () => {
    const b = await cook();
    const out = (
      await b.post('/api/food/meals', {
        date: '2026-10-20',
        out: {
          kind: 'work',
          place: 'Canteen',
          translations: { ro: { place: 'Cantina' }, ru: { place: 'Столовая' } },
        },
      })
    ).body.meal;
    expect(out.title).toBe('At work');
    expect(out.translations).toMatchObject({
      ro: { title: 'La serviciu', place: 'Cantina' },
      ru: { title: 'На работе', place: 'Столовая' },
    });
    const moved = (
      await b.post(`/api/food/meals/${out.id}/out`, { kind: 'restaurant', place: 'Andy’s' })
    ).body.meal;
    expect(moved.translations.ro?.place).toBeUndefined();
  });

  it('keeps a store’s name in other languages', async () => {
    const b = await cook();
    const store = (
      await b.post('/api/food/stores', {
        name: 'Market',
        translations: { ro: { name: 'Piața' }, ru: { name: 'Рынок' } },
      })
    ).body.store;
    expect(store.translations).toEqual({ ro: { name: 'Piața' }, ru: { name: 'Рынок' } });
    const patched = (
      await b.patch(`/api/food/stores/${store.id}`, { translations: { ru: { name: 'Базар' } } })
    ).body.store;
    expect(patched.translations).toEqual({ ro: { name: 'Piața' }, ru: { name: 'Базар' } });
    const lines = (
      await b.post('/api/food/shopping/items', { items: [{ name: 'lapte', storeId: store.id }] })
    ).body.items;
    expect(lines[0]).toMatchObject({
      name: 'Milk',
      translations: { ro: { name: 'Lapte' }, ru: { name: 'Молоко' } },
    });
  });
});
