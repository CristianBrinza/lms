#!/usr/bin/env node
/**
 * One command to ship LMS.
 *
 *   yarn deploy              API (Docker + Cloudflare Tunnel on this machine), web (Cloudflare), checks
 *   yarn deploy api          only the API: build the image and restart deploy/docker-compose.yml
 *   yarn deploy web          only the web app: build and `wrangler deploy` (Worker + static assets)
 *   yarn deploy secrets      copy PROXY_SECRET from deploy/.env to the Worker (once, and after changing it)
 *   yarn deploy verify       only the live checks (also: yarn deploy:verify)
 *   --dry-run                build everything, upload and restart nothing
 *
 * Settings: .env.deploy (Cloudflare and public addresses) and deploy/.env (server secrets); both
 * have templates and are git-ignored. The API runs where this command runs; on another machine,
 * pull the repo there and run `yarn deploy api` on it.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = args.find((arg) => !arg.startsWith('--')) ?? 'all';

function readEnv(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match) values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const deployEnv = readEnv(resolve(root, '.env.deploy'));
const serverEnv = readEnv(resolve(root, 'deploy/.env'));

function git(command) {
  const result = spawnSync('git', command.split(' '), { cwd: root, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}
const APP_VERSION = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)}-${git('rev-parse --short HEAD') || 'local'}`;

function run(command, commandArgs, options = {}) {
  console.info(`\n$ ${[command, ...commandArgs].join(' ')}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', cwd: root, ...options, env: { ...process.env, ...options.env } });
  if (result.status !== 0) {
    console.error(`\n[deploy] failed: ${command} ${commandArgs.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

function need(values, keys, file) {
  const missing = keys.filter((key) => !values[key]);
  if (missing.length > 0) {
    console.error(`[deploy] ${file} is missing: ${missing.join(', ')} (see ${file.replace(/\.env$/, '.env.template').replace('.env.deploy', '.env.deploy.template')})`);
    process.exit(1);
  }
}

function cloudflareEnv() {
  const env = {};
  if (deployEnv.CLOUDFLARE_API_TOKEN) env.CLOUDFLARE_API_TOKEN = deployEnv.CLOUDFLARE_API_TOKEN;
  if (deployEnv.CLOUDFLARE_ACCOUNT_ID) env.CLOUDFLARE_ACCOUNT_ID = deployEnv.CLOUDFLARE_ACCOUNT_ID;
  return env;
}

function deployApi() {
  need(serverEnv, ['POSTGRES_PASSWORD', 'APP_URL', 'JWT_SECRET', 'PROXY_SECRET', 'TUNNEL_TOKEN'], 'deploy/.env');
  run('yarn', ['--cwd', 'backend', 'typecheck']);
  const compose = ['compose', '-f', 'deploy/docker-compose.yml', '--env-file', 'deploy/.env'];
  if (dryRun) {
    run('docker', [...compose, 'build', 'api'], { env: { APP_VERSION } });
    return;
  }
  run('docker', [...compose, 'up', '-d', '--build', '--remove-orphans'], { env: { APP_VERSION } });
}

function deployWeb() {
  need(deployEnv, ['API_ORIGIN'], '.env.deploy');
  run('yarn', ['--cwd', 'frontend', 'build'], { env: { APP_VERSION } });
  if (dryRun) {
    run('npx', ['wrangler', 'deploy', '--dry-run', '--var', `API_ORIGIN:${deployEnv.API_ORIGIN}`], { cwd: resolve(root, 'frontend'), env: cloudflareEnv() });
    return;
  }
  run('npx', ['wrangler', 'deploy', '--var', `API_ORIGIN:${deployEnv.API_ORIGIN}`], { cwd: resolve(root, 'frontend'), env: cloudflareEnv() });
}

function deploySecrets() {
  need(serverEnv, ['PROXY_SECRET'], 'deploy/.env');
  if (dryRun) return console.info('[deploy] --dry-run: not setting the Worker secret');
  console.info('\n$ wrangler secret put PROXY_SECRET');
  const result = spawnSync('npx', ['wrangler', 'secret', 'put', 'PROXY_SECRET'], {
    cwd: resolve(root, 'frontend'),
    input: serverEnv.PROXY_SECRET,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: { ...process.env, ...cloudflareEnv() },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function verify() {
  if (dryRun) return console.info('[deploy] --dry-run: skipping live checks');
  run('yarn', ['--cwd', 'backend', 'deploy:verify'], { env: { APP_URL: deployEnv.APP_URL || serverEnv.APP_URL, API_ORIGIN: deployEnv.API_ORIGIN } });
}

const steps = { api: [deployApi], web: [deployWeb], secrets: [deploySecrets], verify: [verify], all: [deployApi, deployWeb, verify] };
if (!steps[target]) {
  console.error(`[deploy] unknown step "${target}". Use one of: ${Object.keys(steps).join(', ')}`);
  process.exit(1);
}
console.info(`[deploy] ${target}${dryRun ? ' (dry run)' : ''}, version ${APP_VERSION}`);
for (const step of steps[target]) step();
console.info(`\n[deploy] ${target} done.`);
