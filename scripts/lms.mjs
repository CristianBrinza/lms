#!/usr/bin/env node
/**
 * Talks to an LMS (production by default) with an access key, through the app's public address:
 * the same API the app uses, the same rules, no back door. For Claude in a chat, and for scripts.
 *
 *   node scripts/lms.mjs login                     save the address and an access key (asked, hidden)
 *   node scripts/lms.mjs whoami                    who the key belongs to, its scope, the kitchen
 *   node scripts/lms.mjs GET /api/food/kitchen     any API call; JSON body as the next argument
 *   node scripts/lms.mjs POST /api/food/stock '{"name":"Milk","quantity":1,"unit":"l"}'
 *   node scripts/lms.mjs POST /api/food/stock @body.json
 *   node scripts/lms.mjs health                    the live versions (no key needed)
 *
 * The key comes from LMS_KEY, else ~/.config/lms/production.env (written by `login`, readable by
 * you only); the address from LMS_URL, else that file, else https://lms.shades.md. Create keys in
 * the app: Settings → Claude access. The key is never printed.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const DIR = join(homedir(), '.config', 'lms');
const FILE = join(DIR, process.env.LMS_PROFILE ? `${process.env.LMS_PROFILE}.env` : 'production.env');
const DEFAULT_URL = 'https://lms.shades.md';

function readFile() {
  if (!existsSync(FILE)) return {};
  return Object.fromEntries(
    readFileSync(FILE, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map((m) => [m[1], m[2].trim()]),
  );
}

const saved = readFile();
const URL_BASE = (process.env.LMS_URL || saved.LMS_URL || DEFAULT_URL).replace(/\/$/, '');
const KEY = process.env.LMS_KEY || saved.LMS_KEY || '';

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const write = rl._writeToOutput.bind(rl);
      rl._writeToOutput = (text) => write(text.startsWith(question) ? text : '*'.repeat(text.length ? 1 : 0));
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function call(method, path, body) {
  if (!KEY) {
    console.error(`No access key. Run: node scripts/lms.mjs login   (or set LMS_KEY)`);
    process.exit(2);
  }
  const response = await fetch(URL_BASE + path, {
    method,
    headers: { authorization: `Bearer ${KEY}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  return { status: response.status, data };
}

function parseBody(argument) {
  if (argument === undefined) return undefined;
  const raw = argument.startsWith('@') ? readFileSync(argument.slice(1), 'utf8') : argument;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`The body isn't JSON: ${error.message}`);
    process.exit(2);
  }
}

const [command = 'help', ...rest] = process.argv.slice(2);

if (command === 'login') {
  const url = (await ask(`Address [${URL_BASE}]: `)) || URL_BASE;
  const key = await ask('Access key (Settings → Claude access): ', true);
  if (!key.startsWith('lms_')) {
    console.error('That is not an LMS access key (they start with lms_).');
    process.exit(2);
  }
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FILE, `LMS_URL=${url.replace(/\/$/, '')}\nLMS_KEY=${key}\n`, { mode: 0o600 });
  chmodSync(FILE, 0o600);
  console.info(`Saved to ${FILE} (readable by you only).`);
  process.exit(0);
}

if (command === 'health') {
  // The Worker's /health (web + API); a dev server has only the API's.
  let response = await fetch(`${URL_BASE}/health`, { signal: AbortSignal.timeout(15_000) });
  if (!(response.headers.get('content-type') ?? '').includes('json')) response = await fetch(`${URL_BASE}/api/health`, { signal: AbortSignal.timeout(15_000) });
  console.info(JSON.stringify(await response.json(), null, 2));
  process.exit(response.ok ? 0 : 1);
}

if (command === 'whoami') {
  const { status, data } = await call('GET', '/api/me');
  if (status !== 200) {
    console.error(`${status} ${JSON.stringify(data)}`);
    process.exit(1);
  }
  const overview = await call('GET', `/api/food/overview`);
  console.info(JSON.stringify({ address: URL_BASE, user: data.user ?? data, kitchen: overview.data?.kitchen ?? null }, null, 2));
  process.exit(0);
}

if (/^(GET|POST|PUT|PATCH|DELETE)$/i.test(command)) {
  const [path, bodyArgument] = rest;
  if (!path?.startsWith('/')) {
    console.error('Usage: node scripts/lms.mjs GET /api/food/kitchen');
    process.exit(2);
  }
  const { status, data } = await call(command.toUpperCase(), path, parseBody(bodyArgument));
  console.info(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  process.exit(status >= 200 && status < 300 ? 0 : 1);
}

console.info(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n\/\*\*/, '').replace(/^ \* ?/gm, ''));
