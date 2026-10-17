import { describe, expect, it } from 'vitest';
import { itemApplies, itemQuantity } from '../src/modules/travel/catalog';
import { setupTestApp } from './helpers';

const t = setupTestApp();

async function traveller(email = 'ana@example.com', name = 'Ana') {
  const user = await t.createUser({ email, name });
  const b = t.browser();
  await b.login(email);
  return { user, b };
}
const names = (checks: any[]) => checks.map((c) => c.name);

describe('travel: a packing list that fits the trip', () => {
  it('reads the rules: where, how, how long, how many', () => {
    const trip = { scope: 'national', kind: 'day', transport: 'car', days: 1, people: 2 } as const;
    expect(itemApplies({}, trip)).toBe(true);
    expect(itemApplies({ overnight: true }, trip)).toBe(false);
    expect(itemApplies({ transport: ['car'] }, trip)).toBe(true);
    expect(itemApplies({ scope: 'international' }, trip)).toBe(false);
    expect(itemApplies({ kinds: ['vacation'] }, trip)).toBe(false);
    expect(itemQuantity('person', trip)).toBe(2);
    expect(itemQuantity('person_day', { ...trip, days: 12 })).toBe(14); // a week, then laundry
  });

  it('a day trip by car and a week abroad by plane get different lists', async () => {
    const { user, b } = await traveller();
    const home = await b.get('/api/travel');
    expect(home.status).toBe(200);
    expect(home.body.items.length).toBeGreaterThan(40);
    expect(home.body.trips).toEqual([]);
    expect(home.body.bags).toEqual([]);

    const day = await b.post('/api/travel/trips', {
      name: 'Soroca fortress',
      destination: 'Soroca',
      scope: 'national',
      kind: 'day',
      transport: 'car',
      startDate: '2026-10-18',
      endDate: '2026-10-18',
      departTime: '08:00',
      people: [user.id],
      guests: 1,
    });
    expect(day.status).toBe(201);
    expect(day.body.trip).toMatchObject({ days: 1, travellers: 2, departTime: '08:00' });
    const dayList = names(day.body.checks);
    expect(dayList).toEqual(expect.arrayContaining(['Driving licence', 'Wet wipes', 'Full tank']));
    expect(dayList).not.toContain('Toothbrush');
    expect(dayList).not.toContain('Passport');

    const away = await b.post('/api/travel/trips', {
      name: 'Barcelona',
      scope: 'international',
      kind: 'vacation',
      transport: 'plane',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
    });
    const list = away.body.checks;
    expect(names(list)).toEqual(
      expect.arrayContaining([
        'Passport',
        'Toothbrush',
        'Swimsuit',
        'Liquids in 100 ml bottles, in a clear 1 L bag',
      ]),
    );
    expect(names(list)).not.toContain('Driving licence');
    expect(list.find((c: any) => c.name === 'Underwear').quantity).toBe(7);

    // Coming up first, soonest first.
    const trips = (await b.get('/api/travel?today=2026-10-10')).body.trips;
    expect(trips.map((x: any) => x.name)).toEqual(['Soroca fortress', 'Barcelona']);
  });

  it('switches items per trip, keeps ticks, and follows the trip when it changes', async () => {
    const { b } = await traveller();
    const { body } = await b.post('/api/travel/trips', {
      name: 'Grandparents',
      scope: 'national',
      kind: 'family',
      transport: 'bus',
      startDate: '2026-10-24',
      endDate: '2026-10-25',
    });
    const id = body.trip.id;
    const brush = body.checks.find((c: any) => c.name === 'Toothbrush');
    const gift = body.checks.find((c: any) => c.name === 'A gift for the hosts');
    expect(gift).toBeDefined();

    // Tick, then switch the toothbrush off for this trip in the config.
    await b.patch(`/api/travel/trips/${id}/checks/${gift.id}`, { checked: true });
    const off = await b.patch(`/api/travel/trips/${id}`, { overrides: { [brush.itemId]: false } });
    expect(names(off.body.checks)).not.toContain('Toothbrush');
    expect(off.body.checks.find((c: any) => c.name === 'A gift for the hosts').checked).toBe(true);
    expect(off.body.trip.packed.done).toBe(1);

    // Made a day trip by car: the night things go, the car things come; the tick stays.
    const changed = await b.patch(`/api/travel/trips/${id}`, {
      endDate: '2026-10-24',
      transport: 'car',
    });
    const list = names(changed.body.checks);
    expect(list).not.toContain('Pyjamas');
    expect(list).toContain('Full tank');
    expect(changed.body.checks.find((c: any) => c.name === 'A gift for the hosts').checked).toBe(
      true,
    );

    // Something for this trip only, and taking a list item off this trip.
    const own = await b.post(`/api/travel/trips/${id}/checks`, { name: 'Grandma’s jar back' });
    expect(own.status).toBe(201);
    const tank = changed.body.checks.find((c: any) => c.name === 'Full tank');
    expect((await b.delete(`/api/travel/trips/${id}/checks/${tank.id}`)).status).toBe(204);
    const after = (await b.get(`/api/travel/trips/${id}`)).body;
    expect(names(after.checks)).toContain('Grandma’s jar back');
    expect(names(after.checks)).not.toContain('Full tank');
    expect(after.trip.overrides[tank.itemId]).toBe(false);

    // A new item on the household's list reaches this upcoming trip.
    await b.post('/api/travel/items', {
      name: 'Car seat cushion',
      group: 'Car',
      rules: { transport: ['car'] },
    });
    expect(names((await b.get(`/api/travel/trips/${id}`)).body.checks)).toContain(
      'Car seat cushion',
    );
  });

  it('keeps bags, and only this household’s', async () => {
    const { b } = await traveller();
    const bag = await b.post('/api/travel/bags', {
      name: 'Tommy Hilfiger handbag',
      kind: 'handbag',
      lengthCm: 40,
      widthCm: 30,
      heightCm: 20,
    });
    expect(bag.status).toBe(201);
    expect(bag.body.bag).toMatchObject({ litres: 24 });

    const other = await traveller('bob@example.com', 'Bob');
    const trip = await other.b.post('/api/travel/trips', {
      name: 'X',
      scope: 'national',
      kind: 'other',
      transport: 'car',
      startDate: '2026-10-18',
      endDate: '2026-10-18',
      bagIds: [bag.body.bag.id],
    });
    expect(trip.status).toBe(400);
    expect((await other.b.get('/api/travel')).body.bags).toEqual([]);

    // Gear: two MagSafe power banks; a trip takes one.
    const bank = await b.post('/api/travel/gear', {
      name: 'MagSafe power bank',
      kind: 'power-bank',
      connectors: ['MagSafe', 'USB-C'],
      count: 2,
    });
    expect(bank.body.gear).toMatchObject({ count: 2, connectors: ['MagSafe', 'USB-C'] });
    const away = await b.post('/api/travel/trips', {
      name: 'Iasi',
      scope: 'international',
      kind: 'other',
      transport: 'bus',
      startDate: '2026-10-20',
      endDate: '2026-10-21',
      gear: [{ gearId: bank.body.gear.id, count: 1 }],
    });
    expect(away.body.trip.gear).toEqual([{ gearId: bank.body.gear.id, count: 1 }]);
    expect(
      (
        await other.b.post('/api/travel/trips', {
          name: 'Y',
          scope: 'national',
          kind: 'other',
          transport: 'car',
          startDate: '2026-10-18',
          endDate: '2026-10-18',
          gear: [{ gearId: bank.body.gear.id, count: 1 }],
        })
      ).status,
    ).toBe(400);
    await b.delete(`/api/travel/gear/${bank.body.gear.id}`);
    expect((await b.get(`/api/travel/trips/${away.body.trip.id}`)).body.trip.gear).toEqual([]);
    expect(
      (
        await b.post('/api/travel/trips', {
          name: 'Backwards',
          scope: 'national',
          kind: 'day',
          transport: 'car',
          startDate: '2026-10-18',
          endDate: '2026-10-17',
        })
      ).status,
    ).toBe(400);
  });
});

describe('travel: deadlines, things to buy, the way there and back', () => {
  it('dates deadlines from leaving home, and keeps both legs', async () => {
    const { b } = await traveller();
    const { body } = await b.post('/api/travel/trips', {
      name: 'Barcelona',
      scope: 'international',
      kind: 'vacation',
      transport: 'plane',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      departTime: '05:30',
      arriveDate: '2026-11-02',
      arriveTime: '09:40',
      backDate: '2026-11-08',
      backTime: '18:15',
      returnTime: '23:50',
    });
    expect(body.trip).toMatchObject({
      departTime: '05:30',
      arriveTime: '09:40',
      backDate: '2026-11-08',
      backTime: '18:15',
      returnTime: '23:50',
    });
    const checkIn = body.checks.find((c: any) => c.name === 'Online check-in done');
    expect(checkIn.dueAt).toBe('2026-11-01T05:30'); // a day before leaving home
    expect(body.checks.find((c: any) => c.name === 'Wet wipes').dueAt).toBeNull();

    // A deadline set on the list reaches the trip.
    const item = (await b.get('/api/travel')).body.items.find((i: any) => i.name === 'Sunscreen');
    await b.patch(`/api/travel/items/${item.id}`, { dueHours: 48 });
    const after = (await b.get(`/api/travel/trips/${body.trip.id}`)).body;
    expect(after.checks.find((c: any) => c.name === 'Sunscreen').dueAt).toBe('2026-10-31T05:30');
    const moved = await b.patch(`/api/travel/trips/${body.trip.id}`, { arriveTime: null });
    expect(moved.body.trip.arriveTime).toBeNull();
    expect(moved.body.trip.backTime).toBe('18:15');

    // Money: cash and a euro card, ticked once ready.
    const money = [
      { id: 'a', kind: 'cash', label: 'Cash', currency: 'MDL', amount: 2000, ready: false },
      { id: 'b', kind: 'card', label: 'Euro card', currency: 'EUR', amount: 300, ready: true },
    ];
    const withMoney = await b.patch(`/api/travel/trips/${body.trip.id}`, { money });
    expect(withMoney.body.trip.money).toEqual(money);
    expect(
      (
        await b.patch(`/api/travel/trips/${body.trip.id}`, {
          money: [{ ...money[0], currency: 'euro' }],
        })
      ).status,
    ).toBe(400);
  });

  it('puts what isn’t at home on the shopping list, once', async () => {
    const { b } = await traveller();
    const { body } = await b.post('/api/travel/trips', {
      name: 'Soroca',
      scope: 'national',
      kind: 'day',
      transport: 'car',
      startDate: '2026-10-18',
      endDate: '2026-10-18',
    });
    const id = body.trip.id;
    const wipes = body.checks.find((c: any) => c.name === 'Wet wipes');
    const water = body.checks.find((c: any) => c.name === 'Water bottle');
    for (const c of [wipes, water])
      expect(
        (await b.patch(`/api/travel/trips/${id}/checks/${c.id}`, { toBuy: true })).body.check.toBuy,
      ).toBe(true);

    expect((await b.post(`/api/travel/trips/${id}/shop`)).body).toEqual({ listed: 2 });
    expect((await b.post(`/api/travel/trips/${id}/shop`)).body).toEqual({ listed: 0 });
    const lines = (await b.get('/api/food/shopping')).body.items;
    const line = lines.find((l: any) => l.name === 'Wet wipes');
    expect(line).toMatchObject({ needBy: '2026-10-17', note: 'For Soroca' });
    expect(line.area).toBe('house');
    const listed = (await b.get(`/api/travel/trips/${id}`)).body.checks.find(
      (c: any) => c.id === wipes.id,
    );
    expect(listed.listedAt).not.toBeNull();
  });
});

describe('travel: in English, Romanian and Russian', () => {
  it('gives the starting list its words in every language, and keeps the household’s', async () => {
    const { b } = await traveller();
    const items = (await b.get('/api/travel')).body.items;
    const passport = items.find((i: any) => i.preset === 'passport');
    expect(passport.translations).toEqual({ ro: { name: 'Pașaport' }, ru: { name: 'Паспорт' } });
    for (const item of items.filter((i: any) => i.preset))
      expect(item.translations.ro?.name && item.translations.ru?.name).toBeTruthy();

    // An edit merges per language and field; an empty one clears that field.
    const edited = await b.patch(`/api/travel/items/${passport.id}`, {
      translations: { ro: { name: 'Pașapoartele' }, ru: { name: '' } },
    });
    expect(edited.body.item.translations).toEqual({ ro: { name: 'Pașapoartele' } });

    // A trip's checklist carries the item's words, until the check is renamed.
    const { body } = await b.post('/api/travel/trips', {
      name: 'Iași',
      translations: { ru: { name: 'Яссы' } },
      scope: 'international',
      kind: 'other',
      transport: 'car',
      startDate: '2026-10-20',
      endDate: '2026-10-20',
    });
    expect(body.trip.translations).toEqual({ ru: { name: 'Яссы' } });
    const licence = body.checks.find((c: any) => c.name === 'Driving licence');
    expect(licence.translations.ro.name).toBe('Permis de conducere');
    const renamed = await b.patch(`/api/travel/trips/${body.trip.id}/checks/${licence.id}`, {
      name: 'Both licences',
    });
    expect(renamed.body.check.translations).toEqual({});

    // The shopping list gets the words of whoever puts things on it.
    const wipes = body.checks.find((c: any) => c.name === 'Wet wipes');
    await b.patch(`/api/travel/trips/${body.trip.id}/checks/${wipes.id}`, { toBuy: true });
    await b.post(`/api/travel/trips/${body.trip.id}/shop`, undefined, { 'accept-language': 'ru' });
    // (The name matches a known product, so the line is that product's.)
    const lines = (await b.get('/api/food/shopping')).body.items;
    expect(lines.find((l: any) => l.note === 'Для поездки «Яссы»')).toBeDefined();
  });

  it('fills in the words for a list made before, by key, once, without undoing the household’s', async () => {
    const { b } = await traveller();
    await b.get('/api/travel');
    // As a household's list was before the translations: none, and the old catalog version.
    await t.db.query(`UPDATE travel_items SET translations = '{}'`);
    await t.db.query(`UPDATE travel_items SET name = 'Our passports' WHERE preset = 'passport'`);
    await t.db.query(
      `UPDATE travel_items SET translations = '{"ro":{"name":"Cheile"}}' WHERE preset = 'keys'`,
    );
    await t.db.query('UPDATE households SET travel_catalog_version = 2');

    const items = (await b.get('/api/travel')).body.items;
    const by = (key: string) => items.find((i: any) => i.preset === key);
    expect(by('toothbrush').translations).toEqual({
      ro: { name: 'Periuță de dinți' },
      ru: { name: 'Зубная щётка' },
    });
    expect(by('passport').translations).toEqual({}); // renamed: the list's words don't fit
    expect(by('keys').translations).toEqual({
      ro: { name: 'Cheile' },
      ru: { name: 'Ключи от дома' },
    });
    // Once: later visits leave the words alone.
    await t.db.query(`UPDATE travel_items SET translations = '{}' WHERE preset = 'socks'`);
    expect((await b.get('/api/travel')).body.items.find((i: any) => i.preset === 'socks').translations).toEqual({});
  });

  it('keeps bags, gear and trips in other languages, merged on each change', async () => {
    const { b } = await traveller();
    const bag = await b.post('/api/travel/bags', {
      name: 'Blue backpack',
      kind: 'backpack',
      translations: { ro: { name: 'Rucsacul albastru' } },
    });
    expect(bag.body.bag.translations).toEqual({ ro: { name: 'Rucsacul albastru' } });
    const moved = await b.patch(`/api/travel/bags/${bag.body.bag.id}`, {
      translations: { ru: { name: 'Синий рюкзак', note: 'Для ноутбука' } },
    });
    expect(moved.body.bag.translations).toEqual({
      ro: { name: 'Rucsacul albastru' },
      ru: { name: 'Синий рюкзак', note: 'Для ноутбука' },
    });
    const gear = await b.post('/api/travel/gear', {
      name: 'Charger',
      kind: 'charger',
      translations: { ro: { name: 'Încărcător' } },
    });
    expect(gear.body.gear.translations).toEqual({ ro: { name: 'Încărcător' } });
    const patched = await b.patch(`/api/travel/gear/${gear.body.gear.id}`, { count: 2 });
    expect(patched.body.gear).toMatchObject({ count: 2, translations: { ro: { name: 'Încărcător' } } });
    const trip = await b.post('/api/travel/trips', {
      name: 'Soroca',
      scope: 'national',
      kind: 'day',
      transport: 'car',
      startDate: '2026-10-18',
      endDate: '2026-10-18',
    });
    const changed = await b.patch(`/api/travel/trips/${trip.body.trip.id}`, {
      translations: { ro: { note: 'Luăm termosul' } },
    });
    expect(changed.body.trip.translations).toEqual({ ro: { note: 'Luăm termosul' } });
  });
});
