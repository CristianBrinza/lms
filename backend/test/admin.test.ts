import { describe, expect, it } from 'vitest';
import { PASSWORD, setupTestApp } from './helpers';

const t = setupTestApp();

async function signedInAdmin() {
  const admin = await t.createUser({ email: 'admin@example.com', role: 'admin', name: 'Cristian' });
  const b = t.browser();
  await b.login('admin@example.com');
  return { admin, b };
}

describe('admin: accounts', () => {
  it('is for admins only', async () => {
    await t.createUser({ email: 'ana@example.com' });
    const b = t.browser();
    await b.login('ana@example.com');
    expect((await b.get('/api/admin/users')).status).toBe(403);
    expect((await b.post('/api/admin/users', { email: 'x@example.com', name: 'X' })).status).toBe(403);
  });

  it('creates a person with a one-time password they must replace', async () => {
    const { b } = await signedInAdmin();
    const res = await b.post('/api/admin/users', { email: 'Mama@Example.com', name: 'Elena', surname: 'Brinza' });
    expect(res.status).toBe(201);
    expect(res.body.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(res.body.user).toMatchObject({ email: 'mama@example.com', role: 'member', isActive: true, mustChangePassword: true });

    const person = t.browser();
    const login = await person.login('mama@example.com', res.body.password);
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it('creates an account with a chosen password', async () => {
    const { b } = await signedInAdmin();
    const res = await b.post('/api/admin/users', { email: 'dad@example.com', name: 'Ion', password: 'family-password-1', mustChangePassword: false });
    expect(res.status).toBe(201);
    expect(res.body.password).toBeNull();
    expect((await t.browser().login('dad@example.com', 'family-password-1')).body.user.mustChangePassword).toBe(false);
  });

  it('refuses a taken email and invalid fields', async () => {
    const { b } = await signedInAdmin();
    const taken = await b.post('/api/admin/users', { email: 'ADMIN@example.com', name: 'Twin' });
    expect(taken.status).toBe(409);
    expect(taken.body.error.fields.email).toBeTruthy();
    const invalid = await b.post('/api/admin/users', { email: 'not-an-email', name: '' });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fields)).toEqual(expect.arrayContaining(['email', 'name']));
  });

  it('lists and searches people', async () => {
    const { b } = await signedInAdmin();
    await t.createUser({ email: 'elena@example.com', name: 'Elena', surname: 'Brînză' });
    await t.createUser({ email: 'ion@example.com', name: 'Ion' });
    const all = await b.get('/api/admin/users');
    expect(all.body.users).toHaveLength(3);
    const found = await b.get('/api/admin/users?q=bRÎn');
    expect(found.body.users.map((u: any) => u.email)).toEqual(['elena@example.com']);
    expect((await b.get('/api/admin/users?q=%25')).body.users).toHaveLength(0);
  });

  it('switching someone off signs them out everywhere at once', async () => {
    const { b } = await signedInAdmin();
    const ana = await t.createUser({ email: 'ana@example.com' });
    const anaBrowser = t.browser();
    await anaBrowser.login('ana@example.com');
    const res = await b.patch(`/api/admin/users/${ana.id}`, { isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
    expect((await anaBrowser.get('/api/me')).status).toBe(401);
    expect((await anaBrowser.post('/api/auth/refresh')).status).toBe(401);
    expect((await t.browser().login('ana@example.com')).status).toBe(403);
  });

  it('role changes apply on the next request', async () => {
    const { b } = await signedInAdmin();
    const ana = await t.createUser({ email: 'ana@example.com' });
    const anaBrowser = t.browser();
    await anaBrowser.login('ana@example.com');
    expect((await anaBrowser.get('/api/admin/users')).status).toBe(403);
    await b.patch(`/api/admin/users/${ana.id}`, { role: 'admin' });
    expect((await anaBrowser.get('/api/admin/users')).status).toBe(200);
  });

  it('never leaves the app without an active admin', async () => {
    const { admin, b } = await signedInAdmin();
    expect((await b.patch(`/api/admin/users/${admin.id}`, { role: 'member' })).body.error.code).toBe('LAST_ADMIN');
    expect((await b.patch(`/api/admin/users/${admin.id}`, { isActive: false })).body.error.code).toBe('SELF');
    expect((await b.delete(`/api/admin/users/${admin.id}`)).body.error.code).toBe('SELF');

    const second = await t.createUser({ email: 'second@example.com', role: 'admin' });
    expect((await b.patch(`/api/admin/users/${admin.id}`, { role: 'member' })).status).toBe(200);
    // Now `second` is the only admin left, and the demoted one has no access.
    expect((await b.get('/api/admin/users')).status).toBe(403);
    const secondBrowser = t.browser();
    await secondBrowser.login('second@example.com');
    expect((await secondBrowser.patch(`/api/admin/users/${second.id}`, { role: 'member' })).body.error.code).toBe('LAST_ADMIN');
  });

  it('resets a password: old sessions end, the new one-time password works', async () => {
    const { b } = await signedInAdmin();
    const ana = await t.createUser({ email: 'ana@example.com' });
    const anaBrowser = t.browser();
    await anaBrowser.login('ana@example.com');
    const res = await b.post(`/api/admin/users/${ana.id}/password`, {});
    expect(res.status).toBe(200);
    expect((await anaBrowser.get('/api/me')).status).toBe(401);
    expect((await t.browser().login('ana@example.com', PASSWORD)).status).toBe(401);
    const fresh = await t.browser().login('ana@example.com', res.body.password);
    expect(fresh.body.user.mustChangePassword).toBe(true);
  });

  it('signs someone out of every device', async () => {
    const { b } = await signedInAdmin();
    const ana = await t.createUser({ email: 'ana@example.com' });
    const anaBrowser = t.browser();
    await anaBrowser.login('ana@example.com');
    expect((await b.get(`/api/admin/users/${ana.id}`)).body.user.activeSessions).toBe(1);
    const res = await b.post(`/api/admin/users/${ana.id}/sign-out`);
    expect(res.body.user.activeSessions).toBe(0);
    expect((await anaBrowser.get('/api/me')).status).toBe(401);
  });

  it('deletes an account and records it in the activity log', async () => {
    const { b } = await signedInAdmin();
    const ana = await t.createUser({ email: 'ana@example.com' });
    expect((await b.delete(`/api/admin/users/${ana.id}`)).status).toBe(204);
    expect((await b.get(`/api/admin/users/${ana.id}`)).status).toBe(404);
    const activity = await b.get('/api/admin/activity');
    expect(activity.body.activity[0]).toMatchObject({ action: 'user.deleted', actor: { name: 'Cristian Popescu' } });
    expect(activity.body.activity[0].meta.email).toBe('ana@example.com');
  });

  it('answers 404 for ids that are not ids', async () => {
    const { b } = await signedInAdmin();
    expect((await b.get('/api/admin/users/not-a-uuid')).status).toBe(404);
  });
});
