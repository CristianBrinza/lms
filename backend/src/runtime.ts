import type { Context } from 'hono';
import type { AppConfig } from './config';
import type { AppDeps } from './context';
import type { Database } from './db';
import { migrate } from './db/migrations';
import { createPasswordHasher } from './lib/password';
import { createPushSender, type PushSender } from './modules/reminders/push';
import { ensureBootstrapAdmin } from './modules/users';

/** Builds the dependency graph shared by the server, the CLI and the tests. */
export function createDeps(
  config: AppConfig,
  db: Database,
  runtime: { clientIp: (c: Context) => string; now?: () => Date; push?: PushSender | null },
): AppDeps {
  return {
    config,
    db,
    passwords: createPasswordHasher(config.passwordHashCost),
    now: runtime.now ?? (() => new Date()),
    clientIp: runtime.clientIp,
    push: runtime.push === undefined ? createPushSender(config.push) : runtime.push,
  };
}

/** Migrations, then the first admin from the environment (when there is none yet). */
export async function prepare(deps: AppDeps, log: (message: string) => void): Promise<void> {
  await migrate(deps.db, log);
  await ensureBootstrapAdmin(deps, log);
}
