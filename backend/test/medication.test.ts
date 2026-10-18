import { describe, expect, it } from 'vitest';
import { areaOf, toolArea } from '../src/modules/live/publish';
import {
  adherence,
  alertLevel,
  dailyUse,
  doseState,
  doseTimes,
  effectiveExpiry,
  expiryStatus,
  lastDayOfMonth,
  lowStock,
  needsAlert,
  pickFefo,
  remainingDoses,
  type Schedule,
} from '../src/modules/medication/logic';
import { tokenMayAccess } from '../src/modules/tokens';
import { setupTestApp } from './helpers';

const t = setupTestApp();

const schedule = (over: Partial<Schedule>): Schedule => ({
  kind: 'times',
  times: ['08:00'],
  weekdays: [],
  intervalHours: null,
  startOn: '2026-10-20',
  endKind: 'none',
  endOn: null,
  endDays: null,
  endDoses: null,
  stoppedOn: null,
  ...over,
});

describe('medication: expiry', () => {
  it('works out the effective expiry, with "use within N days after opening"', () => {
    expect(effectiveExpiry({ expiresOn: '2027-03-31', openedOn: null, useWithinDays: 30 })).toBe('2027-03-31');
    expect(effectiveExpiry({ expiresOn: '2027-03-31', openedOn: '2027-03-10', useWithinDays: 30 })).toBe('2027-03-31');
    expect(effectiveExpiry({ expiresOn: '2027-12-31', openedOn: '2027-03-10', useWithinDays: 30 })).toBe('2027-04-09');
    expect(effectiveExpiry({ expiresOn: null, openedOn: '2027-03-10', useWithinDays: 10 })).toBe('2027-03-20');
    expect(effectiveExpiry({ expiresOn: null, openedOn: null, useWithinDays: null })).toBeNull();
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
  });

  it('colours packages: ok, expiring within 30 days, expired (the last day still counts)', () => {
    const today = '2026-10-20';
    expect(expiryStatus(null, today)).toEqual({ state: 'none', days: null });
    expect(expiryStatus('2027-03-31', today).state).toBe('ok');
    expect(expiryStatus('2026-11-19', today)).toEqual({ state: 'soon', days: 30 });
    expect(expiryStatus('2026-11-20', today).state).toBe('ok');
    expect(expiryStatus('2026-10-20', today)).toEqual({ state: 'soon', days: 0 });
    expect(expiryStatus('2026-10-19', today)).toEqual({ state: 'expired', days: -1 });
  });

  it('alerts once per level: 90, 30, 7 days and the day itself', () => {
    expect([100, 90, 31, 30, 8, 7, 1, 0, -5].map(alertLevel)).toEqual([null, 90, 90, 30, 30, 7, 7, 0, 0].map((l) => l));
    expect(needsAlert(90, null)).toBe(true);
    expect(needsAlert(90, 90)).toBe(false);
    expect(needsAlert(30, 90)).toBe(true);
    expect(needsAlert(30, 7)).toBe(false);
    expect(needsAlert(null, null)).toBe(false);
  });
});

describe('medication: first to expire, first out', () => {
  const pkg = (id: string, quantity: number, effectiveExpiry: string | null, openedOn: string | null = null) => ({
    id,
    quantity,
    effectiveExpiry,
    openedOn,
    createdAt: `2026-01-0${id.length}T00:00:00Z`,
  });

  it('takes from the package that expires first and spans packages', () => {
    const packages = [pkg('b', 10, '2027-06-30'), pkg('a', 2, '2027-01-31'), pkg('c', 5, null)];
    expect(pickFefo(packages, 1, '2026-10-20')).toEqual({ deductions: [{ id: 'a', amount: 1 }], shortfall: 0 });
    expect(pickFefo(packages, 5, '2026-10-20')).toEqual({
      deductions: [
        { id: 'a', amount: 2 },
        { id: 'b', amount: 3 },
      ],
      shortfall: 0,
    });
    expect(pickFefo(packages, 20, '2026-10-20')).toMatchObject({ shortfall: 3 });
  });

  it('never takes from an expired or empty package; an opened one goes first on a tie', () => {
    const packages = [pkg('a', 4, '2026-10-19'), pkg('b', 0, '2026-11-01'), pkg('c', 3, '2026-12-01'), pkg('d', 3, '2026-12-01', '2026-10-01')];
    expect(pickFefo(packages, 2, '2026-10-20').deductions).toEqual([{ id: 'd', amount: 2 }]);
    expect(pickFefo([pkg('a', 4, '2026-10-19')], 1, '2026-10-20')).toEqual({ deductions: [], shortfall: 1 });
    // Expires today: still good today.
    expect(pickFefo([pkg('a', 4, '2026-10-20')], 1, '2026-10-20').deductions).toHaveLength(1);
  });
});

describe('medication: doses of a schedule', () => {
  it('2x and 3x a day at explicit times', () => {
    const twice = schedule({ times: ['20:00', '08:00'] });
    expect(doseTimes(twice, '2026-10-20')).toEqual(['08:00', '20:00']);
    const thrice = schedule({ times: ['08:00', '14:00', '20:00'] });
    expect(doseTimes(thrice, '2026-10-25')).toEqual(['08:00', '14:00', '20:00']);
    expect(doseTimes(thrice, '2026-10-19')).toEqual([]);
  });

  it('specific weekdays only', () => {
    const mwf = schedule({ weekdays: [1, 3, 5] });
    // 2026-10-20 is a Tuesday.
    expect(doseTimes(mwf, '2026-10-20')).toEqual([]);
    expect(doseTimes(mwf, '2026-10-21')).toEqual(['08:00']);
  });

  it('every N hours, around the clock, from the first time', () => {
    const every6 = schedule({ kind: 'interval', intervalHours: 6, times: ['08:00'] });
    expect(doseTimes(every6, '2026-10-20')).toEqual(['08:00', '14:00', '20:00']);
    expect(doseTimes(every6, '2026-10-21')).toEqual(['02:00', '08:00', '14:00', '20:00']);
    const every8 = schedule({ kind: 'interval', intervalHours: 8, times: ['06:00'] });
    expect(doseTimes(every8, '2026-10-22')).toEqual(['06:00', '14:00', '22:00']);
    const every5 = schedule({ kind: 'interval', intervalHours: 5, times: ['07:00'] });
    expect(doseTimes(every5, '2026-10-20')).toEqual(['07:00', '12:00', '17:00', '22:00']);
    expect(doseTimes(every5, '2026-10-21')).toEqual(['03:00', '08:00', '13:00', '18:00', '23:00']);
  });

  it('an N-day course ends on its last day; so does a date', () => {
    const week = schedule({ endKind: 'days', endDays: 7, times: ['08:00', '20:00'] });
    expect(doseTimes(week, '2026-10-26')).toHaveLength(2);
    expect(doseTimes(week, '2026-10-27')).toEqual([]);
    expect(remainingDoses(week, '2026-10-20')).toBe(14);
    expect(remainingDoses(week, '2026-10-25')).toBe(4);
    const until = schedule({ endKind: 'date', endOn: '2026-10-22' });
    expect(doseTimes(until, '2026-10-22')).toHaveLength(1);
    expect(doseTimes(until, '2026-10-23')).toEqual([]);
  });

  it('a course of N doses stops after the Nth, mid-day if need be', () => {
    const five = schedule({ endKind: 'doses', endDoses: 5, times: ['08:00', '14:00', '20:00'] });
    expect(doseTimes(five, '2026-10-20')).toHaveLength(3);
    expect(doseTimes(five, '2026-10-21')).toEqual(['08:00', '14:00']);
    expect(doseTimes(five, '2026-10-22')).toEqual([]);
    expect(remainingDoses(five, '2026-10-20')).toBe(5);
  });

  it('a stopped treatment has no doses from the day it was stopped; as needed has no schedule', () => {
    const stopped = schedule({ stoppedOn: '2026-10-22' });
    expect(doseTimes(stopped, '2026-10-21')).toHaveLength(1);
    expect(doseTimes(stopped, '2026-10-22')).toEqual([]);
    expect(doseTimes(schedule({ kind: 'prn' }), '2026-10-20')).toEqual([]);
  });

  it('dose states: missed two hours after the time, snoozed while asked to wait', () => {
    const at = (h: number, m = 0) => new Date(2026, 9, 20, h, m);
    const dose = { status: 'due' as const, dueOn: '2026-10-20', dueTime: '08:00', snoozedUntil: null };
    expect(doseState(dose, at(7, 59))).toBe('due');
    expect(doseState(dose, at(10, 0))).toBe('due');
    expect(doseState(dose, at(10, 1))).toBe('missed');
    expect(doseState({ ...dose, snoozedUntil: at(10, 30) }, at(10, 10))).toBe('snoozed');
    expect(doseState({ ...dose, status: 'taken' }, at(23))).toBe('taken');
    expect(adherence(['taken', 'taken', 'skipped', 'missed', 'due'])).toBe(50);
    expect(adherence([])).toBeNull();
  });
});

describe('medication: how long the stock lasts', () => {
  it('works out the daily use and the days left', () => {
    expect(dailyUse(schedule({ times: ['08:00', '14:00', '20:00'] }), 2)).toBe(6);
    expect(dailyUse(schedule({ kind: 'interval', intervalHours: 8 }), 1)).toBe(3);
    expect(dailyUse(schedule({ weekdays: [1, 4], times: ['08:00'] }), 7)).toBe(2);
    expect(dailyUse(schedule({ kind: 'prn' }), 1)).toBeNull();
    expect(lowStock({ available: 14, daily: 3, lowDays: 5 })).toEqual({ daysLeft: 4, low: true });
    expect(lowStock({ available: 15, daily: 3, lowDays: 5 })).toEqual({ daysLeft: 5, low: false });
    expect(lowStock({ available: 5, daily: null, lowDays: 5 })).toEqual({ daysLeft: null, low: false });
  });

  it('is not low when what is left covers what the course still needs', () => {
    // 3 days of stock, but the course ends in 3 days: nothing more to buy.
    expect(lowStock({ available: 9, daily: 3, lowDays: 5, need: 9 })).toEqual({ daysLeft: 3, low: false });
    expect(lowStock({ available: 9, daily: 3, lowDays: 5, need: 12 }).low).toBe(true);
  });
});

describe('medication: wiring', () => {
  it('belongs to the kitchen key, announces its changes and names its tools', () => {
    expect(tokenMayAccess('food', 'POST', '/api/medication/doses/x/take')).toBe(true);
    expect(tokenMayAccess('food:read', 'POST', '/api/medication/doses/x/take')).toBe(false);
    expect(tokenMayAccess('food:read', 'GET', '/api/medication')).toBe(true);
    expect(areaOf('/api/medication/treatments')).toBe('medication');
    expect(toolArea('medication_log_dose')).toBe('medication');
  });
});

// ---------------------------------------------------------------- through the API

const NOON = () => new Date(2026, 9, 20, 12, 0);

async function signedIn() {
  await t.createUser({ email: 'ana@example.com', name: 'Ana' });
  t.setNow(NOON());
  const b = t.browser();
  await b.login('ana@example.com');
  return b;
}

describe('medication: the cabinet', () => {
  it('keeps medicines with packages; expired ones are not stock and can be discarded', async () => {
    const b = await signedIn();
    const made = await b.post('/api/medication/medicines', {
      name: 'Paracetamol',
      substance: 'paracetamol',
      strength: '500 mg',
      form: 'tablet',
    });
    expect(made.status).toBe(201);
    expect(made.body.medicine).toMatchObject({ name: 'Paracetamol', unit: 'pcs', rx: false });
    const id = made.body.medicine.id;

    const fresh = await b.post(`/api/medication/medicines/${id}/packages`, {
      quantity: 20,
      expiresOn: '2027-03',
      batch: 'L123',
      place: 'Bathroom cabinet',
    });
    expect(fresh.status).toBe(201);
    // A printed month is its last day, and says so.
    expect(fresh.body.package).toMatchObject({
      expiresOn: '2027-03-31',
      monthOnly: true,
      original: 20,
      status: 'ok',
      expiry: { state: 'ok' },
    });
    const old = await b.post(`/api/medication/medicines/${id}/packages`, {
      quantity: 8,
      expiresOn: '2026-09-30',
      place: 'Car kit',
    });
    expect(old.body.package).toMatchObject({ status: 'expired', expiry: { state: 'expired' } });
    const soon = await b.post(`/api/medication/medicines/${id}/packages`, { quantity: 4, expiresOn: '2026-11-05' });
    expect(soon.body.package.expiry).toMatchObject({ state: 'soon', days: 16 });

    const view = (await b.get('/api/medication')).body;
    expect(view.medicines[0]).toMatchObject({ available: 24, state: 'expired', expiredPackages: 1, soonPackages: 1 });
    expect(view.counts).toMatchObject({ all: 1, expiring: 1, expired: 1, low: 0 });
    expect(view.places).toEqual(['Bathroom cabinet', 'Car kit']);
    expect(view.summary).toMatchObject({ expiring: 1, expired: 1, badge: 2 });
    expect((await b.get('/api/medication?filter=expired')).body.medicines).toHaveLength(1);
    expect((await b.get('/api/medication?q=zzz')).body.medicines).toHaveLength(0);
    expect((await b.get('/api/medication?place=Car%20kit')).body.medicines).toHaveLength(1);

    const thrown = await b.post(`/api/medication/packages/${old.body.package.id}/discard`);
    expect(thrown.body.package.status).toBe('discarded');
    const after = (await b.get('/api/medication')).body;
    expect(after.summary).toMatchObject({ expired: 0, badge: 1 });
    expect(after.medicines[0].available).toBe(24);

    // An opened bottle with "use within 10 days" expires sooner than its printed date.
    const bottle = await b.post(`/api/medication/medicines/${id}/packages`, {
      kind: 'bottle',
      quantity: 100,
      expiresOn: '2028-01-31',
      openedOn: '2026-10-01',
      useWithinDays: 10,
    });
    expect(bottle.body.package).toMatchObject({ effectiveExpiry: '2026-10-11', status: 'expired' });
  });
});

describe('medication: treatments and doses', () => {
  async function setup(b: Awaited<ReturnType<typeof signedIn>>) {
    const med = (await b.post('/api/medication/medicines', { name: 'Amoxicillin', strength: '500 mg', form: 'capsule' }))
      .body.medicine;
    const later = (await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 10, expiresOn: '2027-06-30' }))
      .body.package;
    const sooner = (await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 2, expiresOn: '2027-01-31' }))
      .body.package;
    return { med, later, sooner };
  }

  it('makes the day’s doses, takes them out of the soonest-expiring package, and undoes it', async () => {
    const b = await signedIn();
    const { med, later, sooner } = await setup(b);
    const made = await b.post('/api/medication/treatments', {
      medicineId: med.id,
      dose: 1,
      kind: 'times',
      times: ['08:00', '14:00', '20:00'],
      endKind: 'days',
      endDays: 5,
    });
    expect(made.status).toBe(201);
    expect(made.body.treatment).toMatchObject({ status: 'active', courseEnd: '2026-10-24', dailyUse: 3, available: 12 });

    const today = (await b.get('/api/medication/today')).body;
    expect(today.doses.map((d: { dueTime: string; state: string }) => [d.dueTime, d.state])).toEqual([
      ['08:00', 'missed'],
      ['14:00', 'due'],
      ['20:00', 'due'],
    ]);
    // Asking again does not make them twice.
    expect((await b.get('/api/medication/today')).body.doses).toHaveLength(3);

    const [first, second, third] = today.doses;
    const took = await b.post(`/api/medication/doses/${first.id}/take`, {});
    expect(took.body.dose).toMatchObject({ status: 'taken', state: 'taken', shortfall: 0 });
    await b.post(`/api/medication/doses/${second.id}/take`, {});
    await b.post(`/api/medication/doses/${third.id}/take`, {});
    let detail = (await b.get(`/api/medication/medicines/${med.id}`)).body;
    const left = (id: string) => detail.packages.find((p: { id: string }) => p.id === id);
    // Two from the one that expires first (now empty and finished), the third from the other.
    expect(left(sooner.id)).toMatchObject({ quantity: 0, status: 'finished' });
    expect(left(later.id)).toMatchObject({ quantity: 9, status: 'ok' });

    const undone = await b.post(`/api/medication/doses/${third.id}/undo`);
    expect(undone.body.dose).toMatchObject({ status: 'due' });
    await b.post(`/api/medication/doses/${second.id}/undo`);
    detail = (await b.get(`/api/medication/medicines/${med.id}`)).body;
    expect(left(sooner.id)).toMatchObject({ quantity: 1, status: 'ok' });
    expect(left(later.id)).toMatchObject({ quantity: 10 });

    // Taking twice does not count twice; skipping and snoozing change the state, not the stock.
    await b.post(`/api/medication/doses/${first.id}/take`, {});
    detail = (await b.get(`/api/medication/medicines/${med.id}`)).body;
    expect(left(sooner.id).quantity).toBe(1);
    const skipped = await b.post(`/api/medication/doses/${second.id}/skip`, { reason: 'felt better' });
    expect(skipped.body.dose).toMatchObject({ state: 'skipped', skipReason: 'felt better' });
    const snoozed = await b.post(`/api/medication/doses/${third.id}/snooze`, { minutes: 30 });
    expect(snoozed.body.dose.state).toBe('snoozed');
    expect((await b.get(`/api/medication/medicines/${med.id}`)).body.history.length).toBeGreaterThan(0);
  });

  it('marks a dose missed two hours late, and counts adherence', async () => {
    const b = await signedIn();
    const { med } = await setup(b);
    await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times', times: ['08:00', '10:00'] });
    t.setNow(new Date(2026, 9, 20, 11, 30));
    const today = (await b.get('/api/medication/today')).body;
    expect(today.doses.map((d: { state: string }) => d.state)).toEqual(['missed', 'due']);
    await b.post(`/api/medication/doses/${today.doses[0].id}/take`, {});
    const history = (await b.get('/api/medication/history?from=2026-10-20&to=2026-10-20')).body;
    expect(history.adherence).toBe(100);
    await b.post(`/api/medication/doses/${today.doses[0].id}/undo`);
    expect((await b.get('/api/medication/history?from=2026-10-20&to=2026-10-20')).body.adherence).toBe(0);
  });

  it('as needed: counts out of stock, stops at the daily maximum unless overridden, undo removes it', async () => {
    const b = await signedIn();
    const { med } = await setup(b);
    const prn = (
      await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'prn', maxPerDay: 2 })
    ).body.treatment;
    expect(prn).toMatchObject({ kind: 'prn', status: 'active', maxPerDay: 2 });
    const one = await b.post(`/api/medication/treatments/${prn.id}/take`, {});
    expect(one.status).toBe(201);
    expect(one.body.dose).toMatchObject({ asNeeded: true, state: 'taken' });
    await b.post(`/api/medication/treatments/${prn.id}/take`, {});
    const third = await b.post(`/api/medication/treatments/${prn.id}/take`, {});
    expect(third.status).toBe(409);
    expect(third.body.error.message).toMatch(/daily maximum/);
    expect((await b.post(`/api/medication/treatments/${prn.id}/take`, { override: true })).status).toBe(201);
    expect((await b.get(`/api/medication/medicines/${med.id}`)).body.available).toBe(9);
    const today = (await b.get('/api/medication/today')).body;
    expect(today.asNeeded[0]).toMatchObject({ id: prn.id, takenToday: 3 });
    await b.post(`/api/medication/doses/${one.body.dose.id}/undo`);
    expect((await b.get(`/api/medication/medicines/${med.id}`)).body.available).toBe(10);
    expect((await b.get('/api/medication/today')).body.doses).toHaveLength(2);
  });

  it('warns when the stock runs low and adds to the buy list only when asked', async () => {
    const b = await signedIn();
    const med = (await b.post('/api/medication/medicines', { name: 'Ibuprofen', strength: '400 mg' })).body.medicine;
    await b.post(`/api/medication/medicines/${med.id}/packages`, { quantity: 8, expiresOn: '2027-06-30' });
    const treatment = (
      await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times', times: ['08:00', '14:00'] })
    ).body.treatment;
    // 8 tablets at 2 a day: 4 days, under the default 5.
    expect(treatment).toMatchObject({ daysLeft: 4, low: true, lowDays: 5 });
    expect((await b.get('/api/medication?filter=low')).body.medicines).toHaveLength(1);
    expect((await b.get('/api/wishlist')).body.items).toHaveLength(0);

    const buy = await b.post(`/api/medication/treatments/${treatment.id}/buy`);
    expect(buy.body).toMatchObject({ already: false, item: { name: 'Ibuprofen 400 mg', urgency: 'now' } });
    expect((await b.post(`/api/medication/treatments/${treatment.id}/buy`)).body.already).toBe(true);
    expect((await b.get('/api/wishlist')).body.items).toHaveLength(1);

    // A short course that the stock covers is not low.
    const short = (
      await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times', times: ['08:00'], endKind: 'days', endDays: 3, lowDays: 30 })
    ).body.treatment;
    expect(short.low).toBe(false);
    await b.post(`/api/medication/treatments/${treatment.id}/stop`);
    const view = (await b.get('/api/medication/treatments')).body.treatments;
    expect(view.find((x: { id: string }) => x.id === short.id).low).toBe(false);
    expect(view.find((x: { id: string }) => x.id === treatment.id).status).toBe('finished');
  });

  it('rejects incomplete schedules', async () => {
    const b = await signedIn();
    const { med } = await setup(b);
    expect((await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'times' })).status).toBe(400);
    expect((await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'interval' })).status).toBe(400);
    expect(
      (await b.post('/api/medication/treatments', { medicineId: med.id, dose: 1, kind: 'prn', endKind: 'days' })).status,
    ).toBe(400);
  });
});
