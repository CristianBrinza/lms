#!/usr/bin/env node
// LMS main-chat relay: the app's "Chat principal" mode is a window into the LMS [Server] desktop
// chat. This script is that chat's mailbox. Plain Node 22, no dependencies. Config: LMS_URL and
// LMS_BRIDGE_KEY from ~/.config/lms/assistant.env (the bridge's own file).
//
//   node relay.mjs wait                      block until one main-mode message arrives, download its
//                                            attachments, print one JSON line, exit 0
//   node relay.mjs peek                      list queued main-mode messages without claiming them
//   node relay.mjs progress <id> "<line>"    show a progress line under the reply in the app
//   node relay.mjs reply <id> <file.md>      send the reply text from a file; marks it done
//   node relay.mjs fail <id> "<reason>"      mark the reply failed
//
// Attachments land in <INBOX_DIR>/<messageId>/ (default: the desktop chat's scratchpad, so its
// Read tool can open them); paths are printed in Windows form (C:\Users\...).
import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const MODES = 'main';
const DEFAULT_INBOX =
  '/mnt/c/Users/crist/AppData/Local/Temp/claude/C--Users-crist--claude-spares-spare-kAsOVT/4487f70a-d785-4421-94b9-de67338a6f99/scratchpad/inbox';

export function loadEnvFile(file, target = process.env) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(raw);
    if (!match || raw.trim().startsWith('#')) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (target[match[1]] === undefined || target[match[1]] === '') target[match[1]] = value;
  }
}

/** /mnt/c/Users/x -> C:\Users\x (the form the desktop chat's Read tool needs). */
export function windowsPath(file) {
  const m = /^\/mnt\/([a-z])\/(.*)$/.exec(file);
  return m ? `${m[1].toUpperCase()}:\\${m[2].replace(/\//g, '\\')}` : file;
}

const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md', 'application/json': 'json',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac',
};
const extFor = (mime) => MIME_EXT[String(mime || '').split(';')[0].trim().toLowerCase()] || 'bin';

export function fileNameFor(att, index) {
  if (att.kind === 'image') return `photo${index}.${extFor(att.mime) === 'bin' ? 'jpg' : extFor(att.mime)}`;
  const base = path.basename(String(att.name || '')).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(-80);
  return `${index}-${base && /\.[A-Za-z0-9]{1,8}$/.test(base) ? base : `${base || 'file'}.${extFor(att.mime)}`}`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  loadEnvFile(path.join(homedir(), '.config', 'lms', 'assistant.env'));
  const LMS_URL = (process.env.LMS_URL || 'https://lms.shades.md').replace(/\/+$/, '');
  const KEY = process.env.LMS_BRIDGE_KEY || '';
  const INBOX = process.env.INBOX_DIR || DEFAULT_INBOX;
  const WHISPER_DIR = process.env.WHISPER_DIR || path.join(homedir(), 'whisper.cpp');
  if (!KEY) {
    console.error('LMS_BRIDGE_KEY is not set (~/.config/lms/assistant.env).');
    process.exit(1);
  }

  async function api(method, route, body, timeoutMs = 20000) {
    const res = await fetch(`${LMS_URL}/api/assistant/bridge${route}`, {
      method,
      headers: { Authorization: `Bearer ${KEY}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}`);
    return (res.headers.get('content-type') || '').includes('json') ? res.json() : null;
  }

  async function apiRetry(method, route, body, attempts = 6) {
    let delay = 2000;
    for (let i = 1; ; i++) {
      try {
        return await api(method, route, body);
      } catch (error) {
        if (i >= attempts || /HTTP 4\d\d/.test(error.message)) throw error;
        await sleep(delay);
        delay = Math.min(delay * 2, 30000);
      }
    }
  }

  async function download(id, target) {
    const res = await fetch(`${LMS_URL}/api/assistant/bridge/attachments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${KEY}` },
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok || !res.body) throw new Error(`attachment ${id} -> HTTP ${res.status}`);
    await pipeline(Readable.fromWeb(res.body), createWriteStream(target, { mode: 0o644 }));
  }

  /** Whisper text for an audio file, or null when whisper isn't installed. */
  function transcribe(file) {
    const bin = ['build/bin/whisper-cli', 'build/bin/main', 'main'].map((r) => path.join(WHISPER_DIR, r)).find(existsSync);
    const model = path.join(WHISPER_DIR, 'models', 'ggml-base.bin');
    if (!bin || !existsSync(model)) return null;
    const wav = `${file}.wav`;
    const ff = spawnSync('ffmpeg', ['-y', '-i', file, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { timeout: 120000 });
    if (ff.status !== 0) return null;
    const wh = spawnSync(bin, ['-m', model, '-f', wav, '-l', 'auto', '-t', '2', '-nt', '-np'], { timeout: 180000, encoding: 'utf8' });
    return wh.status === 0 ? wh.stdout.replace(/\[[A-Z_ ]+\]/g, ' ').replace(/\s+/g, ' ').trim() : null;
  }

  const [command, a, b] = process.argv.slice(2);

  if (command === 'wait') {
    let delay = 2000;
    for (;;) {
      let job = null;
      try {
        const res = await api('GET', `/next?modes=${MODES}`, undefined, 40000);
        job = res && res.job ? res.job : null;
        delay = 2000;
      } catch (error) {
        console.error('next failed:', error.message);
        await sleep(delay);
        delay = Math.min(delay * 2, 30000);
        continue;
      }
      if (!job || job.type !== 'chat') continue;
      const dir = path.join(INBOX, job.id);
      await mkdir(dir, { recursive: true });
      const attachments = [];
      const transcripts = [];
      let n = 0;
      for (const att of job.attachments || []) {
        n++;
        const target = path.join(dir, fileNameFor(att, n));
        try {
          await download(att.id, target);
          attachments.push(windowsPath(target));
          if (att.kind === 'audio') {
            const text = transcribe(target);
            if (text) transcripts.push(text);
          }
        } catch (error) {
          console.error('attachment failed:', error.message);
        }
      }
      const out = { messageId: job.id, threadId: job.threadId, text: job.text, attachments };
      if (transcripts.length) out.transcript = transcripts.join('\n');
      console.log(JSON.stringify(out));
      return;
    }
  }

  if (command === 'peek') {
    const res = await api('GET', `/queue?modes=${MODES}`);
    console.log(JSON.stringify(res.queued));
    return;
  }

  if (command === 'progress' && a) {
    const res = await apiRetry('POST', `/messages/${a}/progress`, { progress: String(b || '').slice(0, 300) });
    console.log(JSON.stringify(res)); // {"stop":true} when he pressed Stop in the app
    return;
  }

  if (command === 'reply' && a && b) {
    const text = readFileSync(b, 'utf8').trim().slice(0, 60000);
    if (!text) throw new Error('The reply file is empty.');
    await apiRetry('POST', `/messages/${a}/done`, { text });
    console.log('sent');
    return;
  }

  if (command === 'fail' && a) {
    await apiRetry('POST', `/messages/${a}/failed`, { error: String(b || 'Failed').slice(0, 500) });
    console.log('failed sent');
    return;
  }

  console.error('usage: relay.mjs wait | peek | progress <id> "<line>" | reply <id> <file.md> | fail <id> "<reason>"');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    () => process.exit(0),
    (error) => {
      console.error(error.message);
      process.exit(1);
    },
  );
}
