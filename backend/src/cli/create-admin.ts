import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { loadConfig } from '../config';
import { createDatabase } from '../db';
import { migrate } from '../db/migrations';
import { emailField, newPasswordField } from '../lib/validation';
import { loadDotEnv } from '../lib/dotenv';
import { findUserByEmail, insertUser } from '../modules/users';
import { createDeps } from '../runtime';
import { revokeAllSessions } from '../modules/auth/sessions';

/**
 * Creates an admin, or makes an existing account an admin with a new password.
 *   yarn create-admin --email you@example.com --name Cristian --surname Brinza
 * The password is asked for (hidden), or read from ADMIN_PASSWORD.
 * In Docker: docker compose -f deploy/docker-compose.yml exec api node dist/create-admin.cjs --email …
 */

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as {
      _writeToOutput: (text: string) => void;
      output: NodeJS.WriteStream;
    };
    let prompted = false;
    output._writeToOutput = (text: string) => {
      if (!prompted) {
        process.stdout.write(text);
        prompted = true;
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  loadDotEnv(process.env.ENV_FILE ?? '.env');
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      surname: { type: 'string', default: '' },
    },
  });
  const email = emailField.safeParse(values.email ?? '');
  if (!email.success) throw new Error('Pass --email you@example.com');

  const password = process.env.ADMIN_PASSWORD || (await askHidden('Password (10+ characters): '));
  const checked = newPasswordField.safeParse(password);
  if (!checked.success) throw new Error(checked.error.issues[0]?.message ?? 'Invalid password');

  const config = loadConfig({ ...process.env, ADMIN_EMAIL: '', ADMIN_PASSWORD: '' });
  const db = createDatabase(config);
  const deps = createDeps(config, db, { clientIp: () => '' });
  try {
    await migrate(db, (message) => console.info(`[db] ${message}`));
    const hash = await deps.passwords.hash(checked.data);
    const existing = await findUserByEmail(db, email.data);
    if (existing) {
      await db.tx(async (tx) => {
        await tx.query(
          `UPDATE users SET role = 'admin', is_active = true, password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1`,
          [existing.id, hash],
        );
        await revokeAllSessions(tx, existing.id, new Date());
      });
      console.info(`[create-admin] ${email.data} is now an admin with the new password.`);
    } else {
      if (!values.name) throw new Error('Pass --name for a new account');
      await insertUser(db, {
        email: email.data,
        name: values.name,
        surname: values.surname ?? '',
        role: 'admin',
        passwordHash: hash,
        mustChangePassword: false,
        createdBy: null,
      });
      console.info(`[create-admin] created admin ${email.data}.`);
    }
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error(`[create-admin] ${(error as Error).message}`);
  process.exit(1);
});
