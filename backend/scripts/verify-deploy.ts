/**
 * Live checks after a deploy: `yarn deploy:verify` (APP_URL and API_ORIGIN from the environment,
 * or from ../.env.deploy). Exits non-zero when any check fails.
 *
 *  - the web app, its version, manifest and security headers (Cloudflare Worker)
 *  - /health: the web build and the API's database, both fine
 *  - the API through the Worker: private routes need a session, bad sign-ins are refused
 *  - the tunnel hostname directly, without the Worker's key: a bare 404
 */
import { existsSync, readFileSync } from 'node:fs';
import { parseDotEnv } from '../src/lib/dotenv';

const file = new URL('../../.env.deploy', import.meta.url);
const fromFile = existsSync(file) ? parseDotEnv(readFileSync(file, 'utf8')) : {};
const APP_URL = (process.env.APP_URL || fromFile.APP_URL || '').replace(/\/$/, '');
const API_ORIGIN = (process.env.API_ORIGIN || fromFile.API_ORIGIN || '').replace(/\/$/, '');

if (!APP_URL) {
  console.error('[verify] set APP_URL (the public web app address) in .env.deploy or the environment');
  process.exit(1);
}

let failed = 0;
async function check(name: string, run: () => Promise<string | void>) {
  try {
    const detail = await run();
    console.info(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name} — ${(error as Error).message}`);
  }
}
function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
const get = (url: string, init?: RequestInit) => fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000), ...init });

await check('web app loads', async () => {
  const response = await get(`${APP_URL}/`);
  expect(response.status === 200, `status ${response.status}`);
  const html = await response.text();
  expect(html.includes('<title>LMS</title>'), 'not the LMS page');
  expect(response.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"), 'Content-Security-Policy missing');
  expect(response.headers.get('x-frame-options') === 'DENY', 'X-Frame-Options missing');
});

await check('web version', async () => {
  const response = await get(`${APP_URL}/version.json`);
  expect(response.ok, `status ${response.status}`);
  const body = (await response.json()) as { version?: string };
  expect(body.version, 'no version');
  expect((response.headers.get('cache-control') ?? '').includes('no-store'), 'version.json must not be cached');
  return body.version;
});

await check('installable (manifest + service worker)', async () => {
  const manifest = await get(`${APP_URL}/manifest.webmanifest`);
  expect(manifest.ok, `manifest status ${manifest.status}`);
  const body = (await manifest.json()) as { short_name?: string; display?: string };
  expect(body.short_name === 'LMS' && body.display === 'standalone', 'manifest is not the LMS app');
  const sw = await get(`${APP_URL}/sw.js`);
  expect(sw.ok, `sw.js status ${sw.status}`);
});

await check('health (web + API + database)', async () => {
  const response = await get(`${APP_URL}/health`);
  const body = (await response.json().catch(() => null)) as { status?: string; api?: { version?: string; database?: string } } | null;
  expect(response.status === 200 && body?.status === 'ok', `status ${response.status}: ${JSON.stringify(body)}`);
  return `api ${body.api?.version}, database ${body.api?.database}`;
});

await check('private routes need a session', async () => {
  const response = await get(`${APP_URL}/api/me`);
  expect(response.status === 401, `status ${response.status}`);
});

await check('wrong sign-in is refused', async () => {
  const response = await get(`${APP_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: APP_URL },
    body: JSON.stringify({ email: 'nobody@invalid.example', password: 'definitely-not-a-password', remember: false }),
  });
  const body = (await response.json().catch(() => null)) as { error?: { code?: string } } | null;
  expect(response.status === 401 && body?.error?.code === 'INVALID_CREDENTIALS', `status ${response.status}: ${JSON.stringify(body)}`);
});

if (API_ORIGIN) {
  await check('tunnel hostname is closed without the Worker key', async () => {
    const response = await get(`${API_ORIGIN}/api/health`);
    expect(response.status === 404, `status ${response.status} (PROXY_SECRET is not enforced)`);
  });
} else {
  console.info('SKIP  tunnel hostname check — set API_ORIGIN to run it');
}

if (failed > 0) {
  console.error(`\n[verify] ${failed} check(s) failed`);
  process.exit(1);
}
console.info('\n[verify] all checks passed');
