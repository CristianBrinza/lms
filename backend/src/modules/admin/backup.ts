import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppDeps, AppEnv } from '../../context';
import { audit } from '../../lib/audit';
import { AppError } from '../../lib/errors';
import { maskIp } from '../../lib/text';
import { requireAuth, requireRole } from '../../middleware/auth';
import { findUserById } from '../users';

/**
 * /api/admin/backup — the whole database, out and back in, for the admin signed in to the app
 * (never an access key). Download: a fresh pg_dump. Restore: the admin's password and the word
 * RESTORE, a safety export of what's there now, then pg_restore in one transaction, so a bad
 * file changes nothing. Files go to BACKUP_DIR (deploy/backups on the server), else the temp dir.
 */

const MAX_RESTORE = 512 * 1024 * 1024;
const restoreLimit = bodyLimit({
  maxSize: MAX_RESTORE,
  onError: () => {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That backup is larger than 512 MB');
  },
});

/** Runs pg_dump or pg_restore; resolves with stderr's tail, rejects when it fails. */
function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-2000);
    });
    child.on('error', (error) =>
      reject(
        new AppError(503, 'BACKUP_UNAVAILABLE', `${command} isn’t available here`, {
          fields: { detail: error.message },
        }),
      ),
    );
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(
            new AppError(422, 'BACKUP_FAILED', `${command} failed`, {
              fields: { detail: stderr.trim().split('\n').slice(-6).join('\n') },
            }),
          ),
    );
  });
}

async function workDir(): Promise<string> {
  const dir = process.env.BACKUP_DIR || path.join(tmpdir(), 'lms-backups');
  await mkdir(dir, { recursive: true });
  return dir;
}

const stamp = (now: Date) => now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');

/** A custom-format pg_dump file starts with these bytes. */
const isDump = (bytes: Uint8Array) =>
  bytes.length > 5 && Buffer.from(bytes.subarray(0, 5)).toString('latin1') === 'PGDMP';

async function dumpTo(deps: AppDeps, file: string) {
  await run('pg_dump', ['-Fc', '--no-owner', `--file=${file}`, `--dbname=${deps.config.database.url}`]);
  const head = await readFile(file).then((b) => b.subarray(0, 5));
  if (!isDump(head)) throw new AppError(422, 'BACKUP_FAILED', 'The export came out empty');
}

/** Backups belong to a person in the app, not to a key Claude holds. */
function appOnly(c: Context<AppEnv>) {
  if (c.get('via') !== 'app')
    throw new AppError(403, 'KEY_SCOPE', 'Backups are only for the admin signed in to the app');
}

export function backupRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireRole('admin'));

  app.get('/', async (c) => {
    appOnly(c);
    const dir = await workDir();
    const name = `lms-${stamp(deps.now())}.dump`;
    const file = path.join(dir, `download-${randomUUID()}.dump`);
    try {
      await dumpTo(deps, file);
      const body = await readFile(file);
      await audit(deps, {
        actorId: c.get('user').id,
        action: 'backup.downloaded',
        ip: maskIp(c.get('ip')),
        meta: { bytes: body.length },
      });
      return c.body(new Uint8Array(body), 200, {
        'content-type': 'application/octet-stream',
        'content-disposition': `attachment; filename="${name}"`,
        'content-length': String(body.length),
      });
    } finally {
      await rm(file, { force: true });
    }
  });

  app.post('/restore', restoreLimit, async (c) => {
    appOnly(c);
    if (c.req.header('x-lms-confirm') !== 'RESTORE')
      throw new AppError(400, 'CONFIRM_REQUIRED', 'Type RESTORE to confirm');
    const me = await findUserById(deps.db, c.get('user').id);
    const password = c.req.header('x-lms-password') ?? '';
    if (!me || !password || !(await deps.passwords.verify(password, me.passwordHash)).ok)
      throw new AppError(403, 'WRONG_PASSWORD', 'That password isn’t right');

    const upload = new Uint8Array(await c.req.arrayBuffer());
    if (!isDump(upload))
      throw new AppError(400, 'NOT_A_BACKUP', 'That file isn’t an LMS backup (a .dump file)');

    const dir = await workDir();
    const incoming = path.join(dir, `restore-${randomUUID()}.dump`);
    const safety = path.join(dir, `before-restore-${stamp(deps.now())}.dump`);
    await writeFile(incoming, upload);
    try {
      // What's there now, first: the way back if the restored data isn't what was wanted.
      await dumpTo(deps, safety);
      await run('pg_restore', [
        '--clean',
        '--if-exists',
        '--no-owner',
        '--single-transaction',
        `--dbname=${deps.config.database.url}`,
        incoming,
      ]);
    } finally {
      await rm(incoming, { force: true });
    }
    // Written after the restore, so the restored audit log keeps it.
    await audit(deps, {
      actorId: me.id,
      action: 'backup.restored',
      ip: maskIp(c.get('ip')),
      meta: { bytes: upload.length, safety: path.basename(safety) },
    });
    const kept = await stat(safety).then((s) => s.size).catch(() => 0);
    return c.json({ restored: true, safety: path.basename(safety), safetyBytes: kept });
  });

  return app;
}
