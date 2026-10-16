import { parseArgs } from 'node:util';
import { loadConfig } from '../config';
import { createDatabase } from '../db';
import { loadDotEnv } from '../lib/dotenv';
import { createToken, TOKEN_SCOPES, type TokenScope } from '../modules/tokens';
import { findUserByEmail } from '../modules/users';
import { createDeps } from '../runtime';

/**
 * Makes an access key for an assistant that runs on the server itself (the production Claude),
 * without a browser: the same key the app makes in Settings → Claude access, listed and revocable
 * there. The key is the only thing written to stdout, so it can go straight into a file:
 *
 *   docker compose exec -T api node dist/create-key.cjs --email you@example.com \
 *     --name "Claude on the server PC" --scope admin > key   (then chmod 600)
 *
 * Messages go to stderr; the key is never logged.
 */
async function main() {
  loadDotEnv(process.env.ENV_FILE ?? '.env');
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string', default: 'Claude on the server' },
      scope: { type: 'string', default: 'food' },
    },
  });
  if (!values.email) throw new Error('Pass --email of the account the key acts as');
  const scope = values.scope as TokenScope;
  if (!TOKEN_SCOPES.includes(scope)) throw new Error(`--scope is one of ${TOKEN_SCOPES.join(', ')}`);

  const config = loadConfig({ ...process.env, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' });
  const db = createDatabase(config);
  const deps = createDeps(config, db, { clientIp: () => '' });
  try {
    const user = await findUserByEmail(db, values.email);
    if (!user || !user.isActive) throw new Error(`No active account for ${values.email}`);
    const { token, key } = await createToken(deps, user, { name: values.name, scope });
    process.stdout.write(`${token}\n`);
    console.error(`[create-key] "${key.name}" (${key.scope}) for ${user.email}, ${key.prefix}…`);
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(`[create-key] ${(error as Error).message}`);
  process.exit(1);
});
