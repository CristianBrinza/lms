import { describe, expect, it } from 'vitest';
import { ensureBootstrapAdmin, findUserByEmail } from '../src/modules/users';
import { setupTestApp, testConfig } from './helpers';

const t = setupTestApp();

describe('first admin from the environment', () => {
  it('is created once, only when there is no admin yet', async () => {
    const config = testConfig({ ADMIN_EMAIL: 'Owner@Example.com', ADMIN_PASSWORD: 'owner-password-1', ADMIN_NAME: 'Cristian' });
    const deps = { ...t.deps, config };
    const log: string[] = [];
    await ensureBootstrapAdmin(deps, (m) => log.push(m));
    await ensureBootstrapAdmin(deps, (m) => log.push(m));
    const owner = await findUserByEmail(t.db, 'owner@example.com');
    expect(owner).toMatchObject({ role: 'admin', name: 'Cristian', mustChangePassword: false });
    expect(log).toHaveLength(1);
    expect((await t.browser().login('owner@example.com', 'owner-password-1')).status).toBe(200);
  });

  it('refuses to start in production without the Worker key and https', () => {
    expect(() => testConfig({ NODE_ENV: 'production', PASSWORD_HASH_COST: 'standard', RATE_LIMITS: 'true' })).toThrow(/PROXY_SECRET|https/);
  });
});
