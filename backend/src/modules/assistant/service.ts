import { randomUUID } from 'node:crypto';
import type { AppDeps } from '../../context';
import type { Queryable } from '../../db';
import { AppError } from '../../lib/errors';
import { isUuid } from '../users';

/**
 * The in-app assistant: a thread of messages, answered by Claude Code running on the server PC.
 * The API only keeps the queue; a small script there (deploy/assistant-bridge) takes one job at a
 * time (a reply to write, or a voice note to transcribe), reports progress and hands the result
 * back. Nothing here runs Claude.
 */

export const MODES = ['main', 'assistant', 'developer'] as const;
export type Mode = (typeof MODES)[number];
/** What the bridge script claims; 'main' belongs to the relay (the desktop chat). */
export const BRIDGE_MODES: Mode[] = ['assistant', 'developer'];
/** A main-chat reply may wait while that chat is busy with other work. */
const STALE_MAIN_MS = 12 * 60 * 60 * 1000;

/** Parses ?modes=a,b; unknown names are ignored, and nothing valid means the bridge's own modes. */
export function parseModes(raw: string | undefined | null): Mode[] {
  const list = (raw ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter((m): m is Mode => (MODES as readonly string[]).includes(m));
  return list.length ? [...new Set(list)] : BRIDGE_MODES;
}

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 300;
export const MAX_ATTACHMENTS = 10;
/** A job still "running" after this long lost its bridge (a chat may take 15 minutes). */
const STALE_CHAT_MS = 20 * 60 * 1000;
const STALE_TRANSCRIBE_MS = 6 * 60 * 1000;

interface ThreadRow {
  id: string;
  user_id: string;
  title: string;
  mode: Mode;
  session_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export const toThread = (row: ThreadRow) => ({
  id: row.id,
  title: row.title,
  mode: row.mode,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});

interface MessageRow {
  id: string;
  thread_id: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'stopped';
  progress: string;
  error: string;
  parent_id: string | null;
  stop_requested: boolean;
  created_at: Date;
  updated_at: Date;
}

interface AttachmentMeta {
  id: string;
  message_id: string | null;
  kind: 'image' | 'audio' | 'file';
  mime: string;
  name: string;
}

export const attachmentUrl = (id: string) => `/api/assistant/attachments/${id}`;

export async function messagesOf(db: Queryable, threadId: string) {
  const { rows } = await db.query<MessageRow>(
    `SELECT id, thread_id, role, text, status, progress, error, parent_id, stop_requested, created_at, updated_at
       FROM assistant_messages WHERE thread_id = $1 ORDER BY created_at, id`,
    [threadId],
  );
  const { rows: files } = await db.query<AttachmentMeta>(
    `SELECT a.id, a.message_id, a.kind, a.mime, a.name FROM assistant_attachments a
       JOIN assistant_messages m ON m.id = a.message_id
      WHERE m.thread_id = $1 ORDER BY a.created_at, a.id`,
    [threadId],
  );
  return rows.map((row) => ({
    id: row.id,
    threadId: row.thread_id,
    role: row.role,
    text: row.text,
    status: row.status,
    steps: row.progress ? row.progress.split('\n') : [],
    error: row.error,
    stopRequested: row.stop_requested,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    attachments: files
      .filter((file) => file.message_id === row.id)
      .map((file) => ({
        id: file.id,
        kind: file.kind,
        mime: file.mime,
        name: file.name,
        url: attachmentUrl(file.id),
      })),
  }));
}
export type AssistantMessage = Awaited<ReturnType<typeof messagesOf>>[number];

/** Tells the thread's owner's open apps to refetch it (live sync area 'assistant'). */
export function announce(deps: AppDeps, userId: string, threadId: string): void {
  try {
    deps.live.publish(
      {
        area: 'assistant',
        path: `/api/assistant/threads/${threadId}`,
        by: userId,
        at: deps.now().toISOString(),
      },
      { userId, householdId: null },
    );
  } catch (error) {
    console.error('[assistant] publish failed', error);
  }
}

export async function findThread(db: Queryable, userId: string, id: string): Promise<ThreadRow> {
  if (!isUuid(id)) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
  const { rows } = await db.query<ThreadRow>(
    'SELECT * FROM assistant_threads WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
  return rows[0];
}

export async function listThreads(db: Queryable, userId: string) {
  const { rows } = await db.query<ThreadRow>(
    'SELECT * FROM assistant_threads WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 50',
    [userId],
  );
  return rows.map(toThread);
}

export async function createThread(deps: AppDeps, userId: string, mode: Mode) {
  const now = deps.now();
  const { rows } = await deps.db.query<ThreadRow>(
    `INSERT INTO assistant_threads (id, user_id, title, mode, created_at, updated_at)
     VALUES ($1, $2, '', $3, $4, $4) RETURNING *`,
    [randomUUID(), userId, mode, now],
  );
  return toThread(rows[0]!);
}

/**
 * Sends a message: the person's own (done at once) and Claude's reply, queued for the bridge.
 * Attachments uploaded earlier (and not yet sent) are attached to the person's message.
 */
export async function sendMessage(
  deps: AppDeps,
  userId: string,
  threadId: string,
  input: { text: string; attachmentIds: string[] },
): Promise<string> {
  const thread = await findThread(deps.db, userId, threadId);
  const ids = [...new Set(input.attachmentIds)];
  if (ids.length > MAX_ATTACHMENTS)
    throw new AppError(400, 'VALIDATION', 'Too many attachments', {
      fields: { attachmentIds: 'Too many attachments' },
    });
  const now = deps.now();
  const replyId = await deps.db.tx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`assistant:${threadId}`]);
    const busy = await client.query(
      `SELECT 1 FROM assistant_messages WHERE thread_id = $1 AND status IN ('queued', 'running') LIMIT 1`,
      [threadId],
    );
    if (busy.rowCount) throw new AppError(409, 'BUSY', 'Wait for the answer, or stop it first');
    if (ids.length) {
      const { rows } = await client.query<{ id: string }>(
        `SELECT id FROM assistant_attachments
          WHERE id = ANY ($1::uuid[]) AND user_id = $2 AND message_id IS NULL AND kind <> 'audio'`,
        [ids, userId],
      );
      if (rows.length !== ids.length)
        throw new AppError(400, 'VALIDATION', 'An attachment is missing', {
          fields: { attachmentIds: 'An attachment is missing' },
        });
    }
    const userMessageId = randomUUID();
    const reply = randomUUID();
    await client.query(
      `INSERT INTO assistant_messages (id, thread_id, role, text, status, created_at, updated_at)
       VALUES ($1, $2, 'user', $3, 'done', $4, $4)`,
      [userMessageId, threadId, input.text, now],
    );
    if (ids.length)
      await client.query(
        'UPDATE assistant_attachments SET message_id = $1 WHERE id = ANY ($2::uuid[])',
        [userMessageId, ids],
      );
    // The reply sorts right after the question, even within the same millisecond.
    await client.query(
      `INSERT INTO assistant_messages (id, thread_id, role, text, status, parent_id, created_at, updated_at)
       VALUES ($1, $2, 'assistant', '', 'queued', $3, $4, $4)`,
      [reply, threadId, userMessageId, new Date(now.getTime() + 1)],
    );
    const title = thread.title || input.text.replace(/\s+/g, ' ').trim().slice(0, 60);
    await client.query('UPDATE assistant_threads SET updated_at = $2, title = $3 WHERE id = $1', [
      threadId,
      now,
      title,
    ]);
    return reply;
  });
  announce(deps, userId, threadId);
  return replyId;
}

/** Stops a reply: at once if it hasn't started, else the bridge is told to kill Claude. */
export async function stopMessage(deps: AppDeps, userId: string, messageId: string) {
  if (!isUuid(messageId)) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  const { rows } = await deps.db.query<{ id: string; thread_id: string; status: string }>(
    `SELECT m.id, m.thread_id, m.status FROM assistant_messages m
       JOIN assistant_threads t ON t.id = m.thread_id
      WHERE m.id = $1 AND t.user_id = $2 AND m.role = 'assistant'`,
    [messageId, userId],
  );
  const row = rows[0];
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  const now = deps.now();
  if (row.status === 'queued')
    await deps.db.query(
      `UPDATE assistant_messages SET status = 'stopped', stop_requested = true, updated_at = $2
        WHERE id = $1 AND status = 'queued'`,
      [messageId, now],
    );
  else if (row.status === 'running')
    await deps.db.query(
      'UPDATE assistant_messages SET stop_requested = true, updated_at = $2 WHERE id = $1',
      [messageId, now],
    );
  announce(deps, userId, row.thread_id);
  return row.thread_id;
}

// ------------------------------------------------------------------ the bridge's queue

export type Job =
  | {
      type: 'chat';
      id: string;
      threadId: string;
      mode: Mode;
      sessionId: string | null;
      text: string;
      attachments: { id: string; mime: string; kind: 'image' | 'file'; name: string }[];
    }
  | { type: 'transcribe'; id: string; mime: string };

/**
 * The next job, oldest first, one at a time: nothing is handed out while another is running
 * (a job whose bridge went quiet for too long is failed first). Marks the job running.
 */
export async function claimNext(deps: AppDeps, modes: Mode[] = BRIDGE_MODES): Promise<Job | null> {
  const now = deps.now();
  // Voice notes are the bridge's work, never the relay's.
  const transcribes = modes.some((m) => m !== 'main');
  const claimed = await deps.db.tx(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['assistant:queue']);
    await client.query(
      `UPDATE assistant_messages m SET status = 'failed', error = 'The assistant stopped answering', updated_at = $1
         FROM assistant_threads t
        WHERE t.id = m.thread_id AND m.role = 'assistant' AND m.status = 'running'
          AND m.updated_at < $1::timestamptz
              - (CASE WHEN t.mode = 'main' THEN $3::bigint ELSE $2::bigint END) * interval '1 millisecond'`,
      [now, STALE_CHAT_MS, STALE_MAIN_MS],
    );
    await client.query(
      `UPDATE assistant_attachments SET transcript_status = 'failed', transcript_error = 'The transcription timed out'
        WHERE transcript_status = 'running'
          AND transcript_requested_at < $1::timestamptz - $2 * interval '1 millisecond'`,
      [now, STALE_TRANSCRIBE_MS],
    );
    // One job at a time per consumer: a running main-chat reply never blocks the bridge, and the
    // other way round.
    const running = await client.query(
      `SELECT 1 FROM assistant_messages m JOIN assistant_threads t ON t.id = m.thread_id
        WHERE m.role = 'assistant' AND m.status = 'running' AND t.mode = ANY ($1::text[])
       UNION ALL SELECT 1 FROM assistant_attachments WHERE $2::boolean AND transcript_status = 'running' LIMIT 1`,
      [modes, transcribes],
    );
    if (running.rowCount) return null;
    const { rows } = await client.query<{ kind: 'chat' | 'transcribe'; id: string }>(
      `SELECT kind, id FROM (
         SELECT 'chat' AS kind, m.id::text AS id, m.created_at AS at FROM assistant_messages m
           JOIN assistant_threads t ON t.id = m.thread_id
          WHERE m.role = 'assistant' AND m.status = 'queued' AND t.mode = ANY ($1::text[])
         UNION ALL
         SELECT 'transcribe', id::text, transcript_requested_at FROM assistant_attachments
          WHERE $2::boolean AND transcript_status = 'queued'
       ) q ORDER BY at, id LIMIT 1`,
      [modes, transcribes],
    );
    const next = rows[0];
    if (!next) return null;
    if (next.kind === 'transcribe') {
      const { rows: file } = await client.query<{ mime: string }>(
        `UPDATE assistant_attachments SET transcript_status = 'running', transcript_requested_at = $2
          WHERE id = $1 RETURNING mime`,
        [next.id, now],
      );
      return { job: { type: 'transcribe', id: next.id, mime: file[0]!.mime } as Job, owner: null };
    }
    const { rows: message } = await client.query<{
      id: string;
      thread_id: string;
      parent_id: string | null;
      user_id: string;
      mode: Mode;
      session_id: string | null;
    }>(
      `UPDATE assistant_messages m SET status = 'running', updated_at = $2
         FROM assistant_threads t
        WHERE m.id = $1 AND t.id = m.thread_id
        RETURNING m.id, m.thread_id, m.parent_id, t.user_id, t.mode, t.session_id`,
      [next.id, now],
    );
    const row = message[0]!;
    const { rows: question } = await client.query<{ text: string }>(
      'SELECT text FROM assistant_messages WHERE id = $1',
      [row.parent_id],
    );
    const { rows: files } = await client.query<{
      id: string;
      mime: string;
      kind: 'image' | 'file';
      name: string;
    }>(
      `SELECT id, mime, kind, name FROM assistant_attachments
        WHERE message_id = $1 AND kind <> 'audio' ORDER BY created_at, id`,
      [row.parent_id],
    );
    return {
      job: {
        type: 'chat',
        id: row.id,
        threadId: row.thread_id,
        mode: row.mode,
        sessionId: row.session_id,
        text: question[0]?.text ?? '',
        attachments: files,
      } as Job,
      owner: row.user_id,
    };
  });
  if (!claimed) return null;
  if (claimed.owner && claimed.job.type === 'chat')
    announce(deps, claimed.owner, claimed.job.threadId);
  return claimed.job;
}

/** Queued replies for these modes, oldest first, without claiming them (the relay's `peek`). */
export async function peekQueued(deps: AppDeps, modes: Mode[]) {
  const { rows } = await deps.db.query<{ id: string; thread_id: string; text: string; created_at: Date }>(
    `SELECT m.id, m.thread_id, q.text, m.created_at
       FROM assistant_messages m
       JOIN assistant_threads t ON t.id = m.thread_id
       LEFT JOIN assistant_messages q ON q.id = m.parent_id
      WHERE m.role = 'assistant' AND m.status = 'queued' AND t.mode = ANY ($1::text[])
      ORDER BY m.created_at, m.id`,
    [modes],
  );
  return rows.map((r) => ({
    id: r.id,
    threadId: r.thread_id,
    text: (r.text ?? '').slice(0, 200),
    createdAt: r.created_at.toISOString(),
  }));
}

/** What the bridge may change on a reply that is running. */
export async function updateRunning(
  deps: AppDeps,
  messageId: string,
  patch: { progress?: string; text?: string; textMode?: 'replace' | 'append' },
): Promise<{ stop: boolean }> {
  if (!isUuid(messageId)) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  const { rows } = await deps.db.query<{
    stop_requested: boolean;
    thread_id: string;
    user_id: string;
  }>(
    `UPDATE assistant_messages m SET
        progress = CASE WHEN $2::text IS NULL OR $2::text = '' THEN m.progress
                        WHEN m.progress = '' THEN $2::text
                        ELSE right(m.progress || E'\\n' || $2::text, 4000) END,
        text = CASE WHEN $3::text IS NULL THEN m.text
                    WHEN $4::text = 'append' THEN left(m.text || $3::text, 60000)
                    ELSE left($3::text, 60000) END,
        updated_at = $5
       FROM assistant_threads t
      WHERE m.id = $1 AND m.role = 'assistant' AND m.status = 'running' AND t.id = m.thread_id
      RETURNING m.stop_requested, m.thread_id, t.user_id`,
    [
      messageId,
      patch.progress ?? null,
      patch.text ?? null,
      patch.textMode ?? 'replace',
      deps.now(),
    ],
  );
  const row = rows[0];
  if (!row) return { stop: true }; // not running any more: the bridge should let go
  announce(deps, row.user_id, row.thread_id);
  return { stop: row.stop_requested };
}

/** True when a stop was asked for, or the reply is no longer running at all. */
export async function stopRequested(deps: AppDeps, messageId: string): Promise<boolean> {
  if (!isUuid(messageId)) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  const { rows } = await deps.db.query<{ stop_requested: boolean; status: string }>(
    'SELECT stop_requested, status FROM assistant_messages WHERE id = $1',
    [messageId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  return rows[0].stop_requested || rows[0].status !== 'running';
}

export async function finishMessage(
  deps: AppDeps,
  messageId: string,
  result:
    | { ok: true; text: string; sessionId?: string; stopped?: boolean }
    | { ok: false; error: string },
): Promise<void> {
  if (!isUuid(messageId)) throw new AppError(404, 'NOT_FOUND', 'Message not found');
  const now = deps.now();
  const status = !result.ok ? 'failed' : result.stopped ? 'stopped' : 'done';
  const { rows } = await deps.db.query<{ thread_id: string; user_id: string }>(
    `UPDATE assistant_messages m SET status = $2, updated_at = $3,
            text = CASE WHEN $4::text IS NULL THEN m.text ELSE left($4::text, 60000) END,
            error = left($5::text, 500)
       FROM assistant_threads t
      WHERE m.id = $1 AND m.role = 'assistant' AND m.status = 'running' AND t.id = m.thread_id
      RETURNING m.thread_id, t.user_id`,
    [messageId, status, now, result.ok ? result.text : null, result.ok ? '' : result.error],
  );
  const row = rows[0];
  if (!row) throw new AppError(409, 'NOT_RUNNING', 'That reply is not running');
  if (result.ok && result.sessionId)
    await deps.db.query(
      'UPDATE assistant_threads SET session_id = $2, updated_at = $3 WHERE id = $1',
      [row.thread_id, result.sessionId.slice(0, 200), now],
    );
  announce(deps, row.user_id, row.thread_id);
}

export async function finishTranscription(
  deps: AppDeps,
  attachmentId: string,
  result: { ok: true; text: string } | { ok: false; error: string },
): Promise<void> {
  if (!isUuid(attachmentId)) throw new AppError(404, 'NOT_FOUND', 'Recording not found');
  const { rowCount } = await deps.db.query(
    `UPDATE assistant_attachments SET transcript_status = $2, transcript = $3, transcript_error = $4
      WHERE id = $1 AND kind = 'audio' AND transcript_status = 'running'`,
    [
      attachmentId,
      result.ok ? 'done' : 'failed',
      result.ok ? result.text.slice(0, 20000) : '',
      result.ok ? '' : result.error.slice(0, 500),
    ],
  );
  if (!rowCount) throw new AppError(409, 'NOT_RUNNING', 'That transcription is not running');
}

/** The bridge restarted: whatever was running is not any more. */
export async function resetRunning(deps: AppDeps): Promise<void> {
  const now = deps.now();
  // Only the bridge's own jobs: a main-chat reply belongs to the relay, which has not restarted.
  await deps.db.query(
    `UPDATE assistant_messages m SET status = 'failed', error = 'The assistant restarted, try again', updated_at = $1
       FROM assistant_threads t
      WHERE t.id = m.thread_id AND m.role = 'assistant' AND m.status = 'running' AND t.mode <> 'main'`,
    [now],
  );
  await deps.db.query(
    `UPDATE assistant_attachments SET transcript_status = 'failed', transcript_error = 'The assistant restarted, try again'
      WHERE transcript_status = 'running'`,
  );
}
