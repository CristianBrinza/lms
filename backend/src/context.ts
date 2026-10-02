import type { Context } from 'hono';
import type { AppConfig } from './config';
import type { Database } from './db';
import type { PasswordHasher } from './lib/password';
import type { Actor } from './modules/food/kitchen';
import type { TokenScope } from './modules/tokens';
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
    /** The signed-in session; null when the request carries an AI access key instead. */
    sessionId: string | null;
    /** How the request is made: in the app (session cookie) or by an assistant (access key). */
    via: 'app' | 'ai';
    /** The access key's scope; null for a person in the app. */
    tokenScope: TokenScope | null;
    /** Who acts on which kitchen (set by requireKitchen on /api/food). */
    actor: Actor;
  };
}
