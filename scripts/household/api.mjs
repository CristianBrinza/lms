// The small API helper the household scripts share: api(method, path, body) against the live LMS,
// with the access key from ~/.config/lms/production.env (LMS_URL, LMS_KEY). The key is never printed.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync(join(homedir(), '.config', 'lms', 'production.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
export const base = (process.env.LMS_URL || env.LMS_URL || 'https://lms.shades.md').replace(/\/$/, '');
const key = process.env.LMS_KEY || env.LMS_KEY;

/** Raw fetch with the key, for bytes (photos). */
export const raw = (path, init = {}) =>
  fetch(base + path, { ...init, headers: { authorization: `Bearer ${key}`, ...(init.headers ?? {}) } });

export async function api(method, path, body) {
  const response = await raw(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}
