import { afterAll, beforeEach } from 'vitest';
import { createApp } from '../src/app';
import { loadConfig, type AppConfig, type Role } from '../src/config';
import type { AppDeps } from '../src/context';
import { createDatabase } from '../src/db';
import { migrate } from '../src/db/migrations';
import { insertUser, type User } from '../src/modules/users';
import type { PushSender } from '../src/modules/reminders/push';
import { createDeps } from '../src/runtime';
import { TEST_DATABASE_URL } from './global-setup';

export const APP_URL = 'http://localhost:5190';
export const PASSWORD = 'correct-horse-battery';

export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_URL,
    JWT_SECRET: 'test-secret-test-secret-test-secret-0123',
    PASSWORD_HASH_COST: 'fast',
    RATE_LIMITS: 'false',
    DATABASE_POOL_MAX: '4',
    ...overrides,
  });
}

/** One app per test file, a clean database before every test. */
export function setupTestApp(overrides: Record<string, string> = {}, options: { push?: PushSender | null } = {}) {
  const config = testConfig(overrides);
  const db = createDatabase(config);
  let clock: Date | null = null;
  const deps: AppDeps = createDeps(config, db, { clientIp: () => '203.0.113.7', now: () => clock ?? new Date(), push: options.push ?? null });
  const app = createApp(deps);

  beforeEach(async () => {
    clock = null;
    await migrate(db);
    await db.query('TRUNCATE users, sessions, rate_limits, audit_log, households RESTART IDENTITY CASCADE');
  });
  afterAll(() => db.close());

  async function createUser(input: Partial<{ email: string; name: string; surname: string; role: Role; password: string; mustChangePassword: boolean; isActive: boolean }> = {}): Promise<User> {
    const user = await insertUser(db, {
      email: input.email ?? `person${Math.random().toString(36).slice(2, 8)}@example.com`,
      name: input.name ?? 'Ana',
      surname: input.surname ?? 'Popescu',
      role: input.role ?? 'member',
      passwordHash: await deps.passwords.hash(input.password ?? PASSWORD),
      mustChangePassword: input.mustChangePassword ?? false,
      createdBy: null,
    });
    if (input.isActive === false) await db.query('UPDATE users SET is_active = false WHERE id = $1', [user.id]);
    return user;
  }

  /** A browser: keeps cookies between requests and sends same-origin headers like the app. */
  function browser() {
    const jar = new Map<string, string>();
    async function request(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
      const response = await app.request(path, {
        method,
        headers: {
          origin: APP_URL,
          'sec-fetch-site': 'same-origin',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(jar.size ? { cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const index = pair!.indexOf('=');
        const name = pair!.slice(0, index);
        const value = pair!.slice(index + 1);
        if (/max-age=0/i.test(line) || value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const text = await response.text();
      return { status: response.status, headers: response.headers, body: text ? (JSON.parse(text) as any) : null, setCookies: response.headers.getSetCookie() };
    }
    return {
      jar,
      get: (path: string, headers?: Record<string, string>) => request('GET', path, undefined, headers),
      post: (path: string, body?: unknown, headers?: Record<string, string>) => request('POST', path, body, headers),
      patch: (path: string, body?: unknown) => request('PATCH', path, body),
      put: (path: string, body?: unknown) => request('PUT', path, body),
      delete: (path: string) => request('DELETE', path),
      login: (email: string, password = PASSWORD, remember = true) => request('POST', '/api/auth/login', { email, password, remember }),
    };
  }

  return {
    app,
    db,
    deps,
    config,
    createUser,
    browser,
    setNow: (date: Date) => {
      clock = date;
    },
  };
}
