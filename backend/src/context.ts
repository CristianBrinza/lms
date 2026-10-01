import type { Context } from 'hono';
import type { AppConfig } from './config';
import type { Database } from './db';
import type { PasswordHasher } from './lib/password';
import type { User } from './modules/users';

/** Everything a route needs, built once (server, CLI, tests) and passed down. */
export interface AppDeps {
  config: AppConfig;
  db: Database;
  passwords: PasswordHasher;
  now: () => Date;
  clientIp: (c: Context) => string;
}

export interface AppEnv {
  Variables: {
    requestId: string;
    ip: string;
    user: User;
    sessionId: string;
  };
}
