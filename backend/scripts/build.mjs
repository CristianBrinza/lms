#!/usr/bin/env node
/**
 * Bundles the API into single CommonJS files (every dependency inlined; no install on the server):
 *   dist/server.cjs        the API          (node dist/server.cjs)
 *   dist/create-admin.cjs  the admin CLI    (node dist/create-admin.cjs --email …)
 *   dist/create-key.cjs    an access key for the server's own assistant (stdout = the key only)
 */
import { execSync } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const git = (args) => {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
const commit = git('rev-parse --short HEAD') || 'local';
const builtAt = new Date().toISOString();
const version = process.env.APP_VERSION || `${builtAt.replace(/[-:T]/g, '').slice(0, 12)}-${commit}`;

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });

const options = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  minify: true,
  keepNames: true,
  legalComments: 'none',
  // pg's optional native driver and its Cloudflare socket are never used here.
  external: ['pg-native', 'pg-cloudflare'],
  define: {
    'process.env.NODE_ENV': '"production"',
    __APP_VERSION__: JSON.stringify(version),
    __APP_BUILT_AT__: JSON.stringify(builtAt),
  },
  logLevel: 'warning',
};
await build({ ...options, entryPoints: ['src/server.ts'], outfile: 'dist/server.cjs' });
await build({ ...options, entryPoints: ['src/cli/create-admin.ts'], outfile: 'dist/create-admin.cjs' });
await build({ ...options, entryPoints: ['src/cli/create-key.ts'], outfile: 'dist/create-key.cjs' });
await writeFile('dist/version.json', `${JSON.stringify({ service: 'lms-api', version, commit, builtAt }, null, 2)}\n`);
console.info(`[build] dist/server.cjs ${version}`);
