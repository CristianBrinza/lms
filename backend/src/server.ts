import { serve } from '@hono/node-server';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';
import { createApp } from './app';
import { BUILD } from './build-info';
import { ConfigError, loadConfig, type AppConfig } from './config';
import { createDatabase, describeDatabase } from './db';
import { cleanup } from './db/migrations';
import { loadDotEnv } from './lib/dotenv';
import { runReminders } from './modules/reminders/service';
import { createDeps, prepare } from './runtime';

/**
 * Node.js entry: local development (`yarn dev`) and production (Docker behind a Cloudflare
 * Tunnel, deploy/docker-compose.yml). Bundled to one file by `yarn build` (dist/server.cjs).
 */

function clientIpResolver(config: AppConfig) {
  return (c: Context): string => {
    // Behind the Cloudflare Tunnel (production): only cloudflared reaches this port, and
    // Cloudflare sets the visitor's address in cf-connecting-ip.
    if (config.trustProxy) {
      const forwarded =
        c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (forwarded) return forwarded;
    }
    try {
      return getConnInfo(c).remote.address ?? '0.0.0.0';
    } catch {
      return '0.0.0.0';
    }
  };
}

async function main() {
  loadDotEnv(process.env.ENV_FILE ?? '.env');
  let config: AppConfig;
  try {
    config = loadConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(
        `[api] ${error.message}\n  See backend/.env.template (development) or deploy/.env.template (server).`,
      );
      process.exit(1);
    }
    throw error;
  }
  const db = createDatabase(config);
  const deps = createDeps(config, db, { clientIp: clientIpResolver(config) });

  // Listen first: while the database is unreachable the API still answers (health says 503)
  // instead of crashing and being restarted in a loop.
  const app = createApp(deps);
  const hostname = process.env.HOST || '127.0.0.1';
  const server = serve({ fetch: app.fetch, port: config.port, hostname }, (info) => {
    console.info(
      `[api] ${config.env} ${BUILD.version} on http://${hostname}:${info.port} (db: ${describeDatabase(config.database.url)})`,
    );
  });

  let cleanupTimer: NodeJS.Timeout | undefined;
  let reminderTimer: NodeJS.Timeout | undefined;
  void retry(() => prepare(deps, (message) => console.info(`[db] ${message}`))).then(() => {
    const tidy = () =>
      void cleanup(db, new Date()).catch((error) =>
        console.error('[db] cleanup failed', error.message),
      );
    tidy();
    cleanupTimer = setInterval(tidy, 60 * 60 * 1000);
    // Reminders: a look every minute at what is due (only when push keys are configured).
    if (deps.push) {
      reminderTimer = setInterval(
        () => void runReminders(deps).catch((error) => console.error('[reminders] failed', error)),
        60 * 1000,
      );
      console.info('[reminders] on');
    }
  });

  const shutdown = async (signal: string) => {
    console.info(`[api] ${signal} received, shutting down`);
    clearInterval(cleanupTimer);
    clearInterval(reminderTimer);
    server.close();
    await db.close().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

/** Connects, migrates and creates the first admin, retrying with backoff (2 s doubling to 60 s). */
async function retry(task: () => Promise<void>): Promise<void> {
  for (let delay = 2_000; ; delay = Math.min(delay * 2, 60_000)) {
    try {
      await task();
      console.info('[api] database ready');
      return;
    } catch (error) {
      console.error(
        `[api] database not ready (${(error as Error).message}); retrying in ${delay / 1000} s`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

main().catch((error) => {
  console.error('[api] failed to start', error);
  process.exit(1);
});
