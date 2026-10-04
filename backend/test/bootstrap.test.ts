import { describe, expect, it } from 'vitest';
import { ensureBootstrapAdmin, findUserByEmail } from '../src/modules/users';
import { setupTestApp, testConfig } from './helpers';

const t = setupTestApp();

describe('first admin from the environment', () => {
  it('is created once, only when there is no admin yet', async () => {
    const config = testConfig({
      ADMIN_EMAIL: 'Owner@Example.com',
      ADMIN_PASSWORD: 'owner-password-1',
      ADMIN_NAME: 'Cristian',
    });
    const deps = { ...t.deps, config };
    const log: string[] = [];
    await ensureBootstrapAdmin(deps, (m) => log.push(m));
    await ensureBootstrapAdmin(deps, (m) => log.push(m));
    const owner = await findUserByEmail(t.db, 'owner@example.com');
    expect(owner).toMatchObject({ role: 'admin', name: 'Cristian', mustChangePassword: false });
    expect(log).toHaveLength(1);
    expect((await t.browser().login('owner@example.com', 'owner-password-1')).status).toBe(200);
  });

  it('refuses to start in production without https', () => {
    expect(() =>
      testConfig({ NODE_ENV: 'production', PASSWORD_HASH_COST: 'standard', RATE_LIMITS: 'true' }),
    ).toThrow(/https/);
  });
});

describe('hourly cleanup', () => {
  it('drops expired rate-limit windows and month-old ended sessions, keeps live ones', async () => {
    const { cleanup } = await import('../src/db/migrations');
    const user = await t.createUser({ email: 'ana@example.com' });
    const now = new Date();
    const day = 86_400_000;
    await t.db.query(
      `INSERT INTO rate_limits (key, count, expires_at) VALUES ('old', 1, $1), ('live', 1, $2)`,
      [new Date(now.getTime() - 1000), new Date(now.getTime() + 60_000)],
    );
    await t.db.query(
      `INSERT INTO sessions (id, user_id, token_hash, remember, expires_at, revoked_at) VALUES
        (gen_random_uuid(), $1, 'a', true, $2, NULL), (gen_random_uuid(), $1, 'b', true, $3, $4), (gen_random_uuid(), $1, 'c', true, $3, NULL)`,
      [
        user.id,
        new Date(now.getTime() - 40 * day),
        new Date(now.getTime() + 300 * day),
        new Date(now.getTime() - 31 * day),
      ],
    );
    await cleanup(t.db, now);
    const limits = await t.db.query<{ key: string }>('SELECT key FROM rate_limits');
    expect(limits.rows.map((row) => row.key)).toEqual(['live']);
    const sessions = await t.db.query<{ token_hash: string }>('SELECT token_hash FROM sessions');
    expect(sessions.rows.map((row) => row.token_hash)).toEqual(['c']);
  });
});
