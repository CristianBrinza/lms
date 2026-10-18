import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson } from '../../lib/validation';
import { requireAuth, requireRole, sessionOf } from '../../middleware/auth';
import { decodePhoto, encodePhoto } from '../drinks/photos';
import { BRIDGE_SCOPE } from '../tokens';
import { isUuid } from '../users';
import {
  announce,
  claimNext,
  createThread,
  finishMessage,
  finishTranscription,
  findThread,
  listThreads,
  MAX_ATTACHMENTS,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_SECONDS,
  MAX_FILE_BYTES,
  messagesOf,
  MODES,
  resetRunning,
  sendMessage,
  stopMessage,
  stopRequested,
  toThread,
  updateRunning,
} from './service';

const ThreadInput = z.object({ mode: z.enum(MODES).optional() });
const ThreadPatch = z.object({ mode: z.enum(MODES).optional(), title: z.string().trim().max(120).optional() });
const MessageInput = z.object({
  text: z.string().trim().max(20000).default(''),
  attachmentIds: z.array(z.string()).max(MAX_ATTACHMENTS).default([]),
});
const AttachmentInput = z.object({
  kind: z.enum(['image', 'audio', 'file']),
  name: z.string().trim().max(200).default(''),
  mime: z.string().trim().max(100).default(''),
  /** Base64, or a data URL. */
  data: z.string().min(1),
  durationSec: z.number().min(0).max(24 * 3600).optional(),
});
const TranscribeInput = z.object({
  attachmentId: z.string(),
  /** How long this request may wait for the text, in seconds (the client polls after that). */
  waitSec: z.number().min(0).max(90).default(90),
});
const ProgressInput = z.object({
  progress: z.string().max(300).optional(),
  text: z.string().max(60000).optional(),
  textMode: z.enum(['replace', 'append']).optional(),
});
const DoneInput = z.object({
  text: z.string().max(60000).default(''),
  sessionId: z.string().max(200).optional(),
  stopped: z.boolean().optional(),
});
const FailedInput = z.object({ error: z.string().max(500).default('Failed') });
const TextInput = z.object({ text: z.string().max(20000).default('') });

const NEXT_WAIT_MS = 25_000;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function cleanName(name: string): string {
  return name.replace(/[\\/\0\r\n]/g, '_').slice(0, 200);
}

/**
 * The assistant: for now only admins (Claude runs on the server). People use /threads, /messages
 * and /attachments from the app; the bridge script uses /bridge/* with its own key scope.
 */
export function assistantRoutes(deps: AppDeps, options: { pollMs?: number; nextWaitMs?: number } = {}) {
  const app = new Hono<AppEnv>();
  const pollMs = options.pollMs ?? 400;
  const nextWaitMs = options.nextWaitMs ?? NEXT_WAIT_MS;

  // ------------------------------------------------------------------ the bridge
  const bridge = new Hono<AppEnv>();
  bridge.use('*', requireAuth(deps), async (c, next) => {
    if (c.get('tokenScope') !== BRIDGE_SCOPE)
      throw new AppError(403, 'KEY_SCOPE', 'This access key can’t do that');
    await next();
  });

  bridge.post('/reset', async (c) => {
    await resetRunning(deps);
    return c.json({ ok: true });
  });

  /** Long poll: the next job, or {job: null} after ~25 s so the bridge asks again. */
  bridge.get('/next', async (c) => {
    const until = Date.now() + nextWaitMs;
    for (;;) {
      const job = await claimNext(deps);
      if (job) return c.json({ job });
      if (Date.now() + pollMs >= until) return c.json({ job: null });
      await sleep(pollMs);
    }
  });

  bridge.get('/attachments/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No attachment');
    const { rows } = await deps.db.query<{ mime: string; bytes: Buffer }>(
      'SELECT mime, bytes FROM assistant_attachments WHERE id = $1',
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'No attachment');
    return c.body(new Uint8Array(rows[0].bytes), 200, { 'content-type': rows[0].mime });
  });

  bridge.post('/messages/:id/progress', async (c) =>
    c.json(await updateRunning(deps, c.req.param('id'), await readJson(c, ProgressInput))),
  );
  bridge.get('/messages/:id/stop', async (c) =>
    c.json({ stop: await stopRequested(deps, c.req.param('id')) }),
  );
  bridge.post('/messages/:id/done', async (c) => {
    const body = await readJson(c, DoneInput);
    await finishMessage(deps, c.req.param('id'), { ok: true, ...body });
    return c.json({ ok: true });
  });
  bridge.post('/messages/:id/failed', async (c) => {
    const body = await readJson(c, FailedInput);
    await finishMessage(deps, c.req.param('id'), { ok: false, error: body.error });
    return c.json({ ok: true });
  });
  bridge.post('/transcriptions/:id/done', async (c) => {
    const body = await readJson(c, TextInput);
    await finishTranscription(deps, c.req.param('id'), { ok: true, text: body.text.trim() });
    return c.json({ ok: true });
  });
  bridge.post('/transcriptions/:id/failed', async (c) => {
    const body = await readJson(c, FailedInput);
    await finishTranscription(deps, c.req.param('id'), { ok: false, error: body.error });
    return c.json({ ok: true });
  });
  app.route('/bridge', bridge);

  // ------------------------------------------------------------------ the app (admins)
  app.use('*', requireAuth(deps), requireRole('admin'), async (c, next) => {
    sessionOf(c);
    await next();
  });

  app.get('/threads', async (c) => c.json({ threads: await listThreads(deps.db, c.get('user').id) }));

  app.post('/threads', async (c) => {
    const body = await readJson(c, ThreadInput);
    return c.json({ thread: await createThread(deps, c.get('user').id, body.mode ?? 'assistant') }, 201);
  });

  app.patch('/threads/:id', async (c) => {
    const user = c.get('user');
    const thread = await findThread(deps.db, user.id, c.req.param('id'));
    const body = await readJson(c, ThreadPatch);
    const { rows } = await deps.db.query<Parameters<typeof toThread>[0]>(
      `UPDATE assistant_threads SET mode = $2, title = $3 WHERE id = $1 RETURNING *`,
      [thread.id, body.mode ?? thread.mode, body.title ?? thread.title],
    );
    announce(deps, user.id, thread.id);
    return c.json({ thread: toThread(rows[0]!) });
  });

  app.delete('/threads/:id', async (c) => {
    const user = c.get('user');
    const thread = await findThread(deps.db, user.id, c.req.param('id'));
    await deps.db.query('DELETE FROM assistant_threads WHERE id = $1', [thread.id]);
    announce(deps, user.id, thread.id);
    return c.body(null, 204);
  });

  app.get('/threads/:id/messages', async (c) => {
    const thread = await findThread(deps.db, c.get('user').id, c.req.param('id'));
    return c.json({ thread: toThread(thread), messages: await messagesOf(deps.db, thread.id) });
  });

  app.post('/threads/:id/messages', async (c) => {
    const body = await readJson(c, MessageInput);
    if (!body.text && !body.attachmentIds.length)
      throw new AppError(400, 'VALIDATION', 'Write something first', {
        fields: { text: 'Write something first' },
      });
    const replyId = await sendMessage(deps, c.get('user').id, c.req.param('id'), body);
    return c.json({ replyId }, 201);
  });

  app.post('/messages/:id/stop', async (c) => {
    await stopMessage(deps, c.get('user').id, c.req.param('id'));
    return c.body(null, 204);
  });

  // Attachments: a photo (re-encoded), a file, or a voice note (kept as recorded).
  app.post('/attachments', async (c) => {
    const user = c.get('user');
    const body = await readJson(c, AttachmentInput);
    let bytes: Buffer;
    let mime = body.mime || 'application/octet-stream';
    let name = cleanName(body.name);
    if (body.kind === 'image') {
      const decoded = decodePhoto(body.data);
      const encoded = await encodePhoto(decoded.bytes, decoded.mime, 2048);
      bytes = encoded.full;
      mime = encoded.mime;
      name = name || 'photo';
    } else {
      const base64 = body.data.replace(/^data:[^;,]*;base64,/, '').replace(/\s+/g, '');
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))
        throw new AppError(400, 'VALIDATION', 'Not a valid file', { fields: { data: 'Not a valid file' } });
      bytes = Buffer.from(base64, 'base64');
      if (!bytes.length) throw new AppError(400, 'VALIDATION', 'The file is empty', { fields: { data: 'Empty' } });
      if (body.kind === 'audio') {
        if (bytes.length > MAX_AUDIO_BYTES || (body.durationSec ?? 0) > MAX_AUDIO_SECONDS)
          throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'The recording is too long (5 minutes at most)');
        if (!/^(audio|video)\//.test(mime)) mime = 'audio/mp4';
      } else if (bytes.length > MAX_FILE_BYTES) {
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'That file is too large (15 MB at most)');
      }
    }
    const id = randomUUID();
    await deps.db.query(
      `INSERT INTO assistant_attachments (id, user_id, kind, mime, name, bytes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, user.id, body.kind, mime, name, bytes, deps.now()],
    );
    return c.json({ attachment: { id, kind: body.kind, mime, name, url: `/api/assistant/attachments/${id}` } }, 201);
  });

  app.get('/attachments/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No attachment');
    const { rows } = await deps.db.query<{ mime: string; name: string; kind: string; bytes: Buffer }>(
      'SELECT mime, name, kind, bytes FROM assistant_attachments WHERE id = $1 AND user_id = $2',
      [id, c.get('user').id],
    );
    const row = rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'No attachment');
    const inline = row.kind === 'image' && /^image\/(jpeg|png|webp)$/.test(row.mime);
    return c.body(new Uint8Array(row.bytes), 200, {
      'content-type': inline ? row.mime : 'application/octet-stream',
      'content-disposition': inline
        ? 'inline'
        : `attachment; filename*=UTF-8''${encodeURIComponent(row.name || 'file')}`,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, max-age=31536000, immutable',
    });
  });

  /** Removes an attachment that was not sent yet (a chip the person took off). */
  app.delete('/attachments/:id', async (c) => {
    const id = c.req.param('id');
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No attachment');
    await deps.db.query(
      'DELETE FROM assistant_attachments WHERE id = $1 AND user_id = $2 AND message_id IS NULL',
      [id, c.get('user').id],
    );
    return c.body(null, 204);
  });

  async function transcriptOf(userId: string, id: string) {
    if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'No recording');
    const { rows } = await deps.db.query<{
      transcript_status: string;
      transcript: string;
      transcript_error: string;
    }>(
      `SELECT transcript_status, transcript, transcript_error FROM assistant_attachments
        WHERE id = $1 AND user_id = $2 AND kind = 'audio'`,
      [id, userId],
    );
    const row = rows[0];
    if (!row) throw new AppError(404, 'NOT_FOUND', 'No recording');
    return { status: row.transcript_status, text: row.transcript, error: row.transcript_error };
  }

  app.get('/attachments/:id/transcript', async (c) =>
    c.json(await transcriptOf(c.get('user').id, c.req.param('id'))),
  );

  /**
   * Asks the bridge to turn a voice note into text. Waits for it up to waitSec (90 s): 200 with
   * the text when it is ready, else 202 and the app polls /attachments/:id/transcript.
   */
  app.post('/transcribe', async (c) => {
    const user = c.get('user');
    const body = await readJson(c, TranscribeInput);
    const current = await transcriptOf(user.id, body.attachmentId);
    if (current.status !== 'done') {
      if (current.status !== 'queued' && current.status !== 'running')
        await deps.db.query(
          `UPDATE assistant_attachments SET transcript_status = 'queued', transcript = '', transcript_error = '',
                  transcript_requested_at = $2 WHERE id = $1`,
          [body.attachmentId, deps.now()],
        );
      const until = Date.now() + body.waitSec * 1000;
      for (;;) {
        const now = await transcriptOf(user.id, body.attachmentId);
        if (now.status === 'done' || now.status === 'failed') return c.json(now);
        if (Date.now() + pollMs >= until) return c.json(now, 202);
        await sleep(pollMs);
      }
    }
    return c.json(current);
  });

  return app;
}
