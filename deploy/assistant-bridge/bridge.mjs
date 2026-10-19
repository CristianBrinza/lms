#!/usr/bin/env node
// LMS assistant bridge: pulls chat and transcription jobs from the LMS API and runs them with the
// Claude Code CLI and whisper.cpp. Plain Node 22, no dependencies, no build step. One job at a time.
// Config: ~/.config/lms/assistant.env (see deploy/server/set-assistant-key.sh).
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { buildSystemPrompt } from './prompt.mjs';
import { applyEvent, createState, finalText, parseLine, redact } from './stream.mjs';

// ---- config ---------------------------------------------------------------------------------
const configDir = path.join(homedir(), '.config', 'lms');

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(raw);
    if (!match || raw.trim().startsWith('#')) continue;
    let value = match[2].trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (process.env[match[1]] === undefined || process.env[match[1]] === '') process.env[match[1]] = value;
  }
}
loadEnvFile(path.join(configDir, 'assistant.env'));

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const LMS_URL = (env.LMS_URL || 'https://lms.shades.md').replace(/\/+$/, '');
const BRIDGE_KEY = env.LMS_BRIDGE_KEY || '';
const MCP_KEY = env.LMS_MCP_KEY || '';
const CLAUDE_BIN = env.CLAUDE_BIN || path.join(homedir(), '.local', 'bin', 'claude');
const REPO_DIR = env.REPO_DIR || path.resolve(here, '..', '..');
const WHISPER_DIR = env.WHISPER_DIR || path.join(homedir(), 'whisper.cpp');
const FFMPEG_BIN = env.FFMPEG_BIN || '/usr/bin/ffmpeg';
const HEAVY_LOCK = env.HEAVY_LOCK || '/tmp/shades-heavy.lock';
const CHAT_TIMEOUT_MS = Number(env.CHAT_TIMEOUT_MS) || 15 * 60 * 1000;
const TRANSCRIBE_TIMEOUT_MS = Number(env.TRANSCRIBE_TIMEOUT_MS) || 3 * 60 * 1000;
const SECRETS = [BRIDGE_KEY, MCP_KEY, env.CLAUDE_CODE_OAUTH_TOKEN || ''].filter(Boolean);
const clean = (text) => redact(text, SECRETS);

const ASSISTANT_TOOLS = [
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'mcp__lms',
  'Bash(node /tmp/recipes/*)',
  // One-liners that import /tmp/recipes/api.mjs: a pattern can't tell them from any other
  // `node -e`, so all of them are allowed; Write and Edit stay inside the scratch folders.
  'Bash(node -e *)',
  'Bash(node scripts/lms.mjs*)',
  'Bash(node scripts/*)',
  'Write(//tmp/recipes/**)',
  'Write(//tmp/assistant-*/**)',
  'Edit(//tmp/recipes/**)',
  'Edit(//tmp/assistant-*/**)',
].join(',');

const log = (...args) => console.log(new Date().toISOString(), ...args.map((a) => clean(typeof a === 'string' ? a : JSON.stringify(a))));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---- HTTP -----------------------------------------------------------------------------------
async function api(method, route, body, timeoutMs = 20000) {
  const res = await fetch(`${LMS_URL}/api/assistant/bridge${route}`, {
    method,
    headers: { Authorization: `Bearer ${BRIDGE_KEY}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${method} ${route} -> HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  return type.includes('json') ? res.json() : null;
}

/** Retries network errors and 5xx with a 2 s -> 30 s backoff (for calls that must land). */
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

async function download(attachmentId, target) {
  const res = await fetch(`${LMS_URL}/api/assistant/bridge/attachments/${encodeURIComponent(attachmentId)}`, {
    headers: { Authorization: `Bearer ${BRIDGE_KEY}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok || !res.body) throw new Error(`attachment ${attachmentId} -> HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(target, { mode: 0o600 }));
}

// ---- child processes --------------------------------------------------------------------------
let currentChild = null;

function killChild(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  child.once('exit', () => clearTimeout(timer));
}

/** Runs a command; resolves { code, signal, stdout, stderr, timedOut } (stdout/stderr tails only). */
function run(cmd, args, { cwd, childEnv, input, timeoutMs, onLine } = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: childEnv || process.env, stdio: ['pipe', 'pipe', 'pipe'] });
    currentChild = child;
    let timedOut = false;
    let stdout = '';
    let stderr = '';
    let pending = '';
    const timer = setTimeout(() => {
      timedOut = true;
      killChild(child);
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      currentChild = null;
      resolve({ code: -1, signal: null, stdout, stderr: `${stderr}${error.message}`, timedOut });
    });
    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      if (onLine) {
        pending += text;
        let index;
        while ((index = pending.indexOf('\n')) >= 0) {
          onLine(pending.slice(0, index));
          pending = pending.slice(index + 1);
        }
      } else {
        stdout = (stdout + text).slice(-200000);
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr = (stderr + chunk.toString('utf8')).slice(-4000);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (onLine && pending) onLine(pending);
      if (currentChild === child) currentChild = null;
      resolve({ code, signal, stdout, stderr, timedOut });
    });
  });
}

// ---- attachments ------------------------------------------------------------------------------
const MIME_EXT = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic',
  'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv', 'text/markdown': 'md', 'application/json': 'json',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/aac': 'aac', 'video/mp4': 'mp4', 'video/webm': 'webm',
};
const extFor = (mime) => MIME_EXT[String(mime || '').split(';')[0].trim().toLowerCase()] || 'bin';

function safeName(name, index, mime) {
  const base = path.basename(String(name || '')).replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '').slice(-80);
  const withExt = base && /\.[A-Za-z0-9]{1,8}$/.test(base) ? base : `${base || 'file'}.${extFor(mime)}`;
  return `${index}-${withExt}`;
}

// ---- chat job -----------------------------------------------------------------------------------
async function writeMcpConfig() {
  await mkdir(configDir, { recursive: true, mode: 0o700 });
  const file = path.join(configDir, 'assistant-mcp.json');
  const config = { mcpServers: { lms: { type: 'http', url: `${LMS_URL}/api/mcp`, headers: { Authorization: `Bearer ${MCP_KEY}` } } } };
  await writeFile(file, JSON.stringify(config), { mode: 0o600 });
  await chmod(file, 0o600);
  return file;
}

function claudeEnv() {
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY; // the subscription is used, never a paid API key
  if (!childEnv.CLAUDE_CODE_OAUTH_TOKEN) delete childEnv.CLAUDE_CODE_OAUTH_TOKEN;
  return childEnv;
}

async function runChat(job) {
  const id = job.id;
  const dir = await mkdtemp(path.join(tmpdir(), `lms-assistant-${String(id).replace(/[^A-Za-z0-9_-]/g, '')}-`));
  let stopRequested = false;
  let finished = false;
  const state = createState();
  const progressQueue = [];
  let lastSentText = null;
  let lastSend = 0;
  let flushTimer = null;
  let flushing = null;
  let child = null;

  const onStop = () => {
    if (stopRequested) return;
    stopRequested = true;
    killChild(currentChild);
  };

  const flush = async () => {
    flushTimer = null;
    const text = state.turnText;
    const payload = {};
    if (progressQueue.length) payload.progress = progressQueue.shift();
    if (text !== lastSentText && text !== '') {
      payload.text = text;
      payload.textMode = 'replace';
    }
    if (!Object.keys(payload).length) return;
    lastSend = Date.now();
    try {
      const res = await api('POST', `/messages/${id}/progress`, payload);
      if (payload.text !== undefined) lastSentText = payload.text;
      if (res && res.stop) onStop();
    } catch (error) {
      log('progress failed:', error.message);
    }
    if (!finished && (progressQueue.length || state.turnText !== lastSentText)) schedule();
  };
  const schedule = () => {
    if (flushTimer || finished) return;
    flushTimer = setTimeout(() => {
      flushing = flush();
    }, Math.max(0, 700 - (Date.now() - lastSend)));
  };

  const stopPoll = setInterval(async () => {
    try {
      const res = await api('GET', `/messages/${id}/stop`);
      if (res && res.stop) onStop();
    } catch {
      /* network blip: the next poll tries again */
    }
  }, 2000);

  try {
    // Attachments -> files in a fresh temp dir; one line each in the prompt.
    const lines = [];
    let n = 0;
    for (const att of job.attachments || []) {
      n++;
      const isImage = att.kind === 'image';
      const file = isImage ? `${n}.${extFor(att.mime) === 'bin' ? 'jpg' : extFor(att.mime)}` : safeName(att.name, n, att.mime);
      const target = path.join(dir, file);
      await download(att.id, target);
      lines.push(isImage ? `Image ${n}: ${target} (read it with the Read tool)` : `File ${n} (${att.name || file}): ${target} (read it with the Read tool)`);
    }
    const prompt = [String(job.text || ''), ...lines].filter(Boolean).join('\n');

    const mcpFile = await writeMcpConfig();
    const attempt = async (resume) => {
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
        '--append-system-prompt', buildSystemPrompt(), '--mcp-config', mcpFile, '--strict-mcp-config'];
      if (job.mode === 'developer') args.push('--permission-mode', 'bypassPermissions');
      else args.push('--permission-mode', 'dontAsk', '--permission-prompts', 'none', `--allowedTools=${ASSISTANT_TOOLS}`);
      if (resume) args.push('--resume', resume);
      return run(CLAUDE_BIN, args, {
        cwd: REPO_DIR,
        childEnv: claudeEnv(),
        input: prompt,
        timeoutMs: CHAT_TIMEOUT_MS,
        onLine: (line) => {
          const out = applyEvent(state, parseLine(line));
          for (const p of out.progress) progressQueue.push(clean(p));
          if (out.progress.length || out.textChanged) schedule();
        },
      });
    };

    let result = await attempt(job.sessionId || null);
    if (job.sessionId && !stopRequested && !result.timedOut && (state.isError || result.code !== 0) && /no conversation found|session.*not found/i.test(`${finalText(state)} ${result.stderr}`)) {
      Object.assign(state, createState());
      result = await attempt(null);
    }

    finished = true;
    clearTimeout(flushTimer);
    if (flushing) await flushing;
    const text = clean(finalText(state));
    const sessionId = state.sessionId || job.sessionId || undefined;
    if (stopRequested) {
      await apiRetry('POST', `/messages/${id}/done`, { text: clean(state.turnText.trim()) || text, sessionId, stopped: true });
    } else if (result.timedOut) {
      await apiRetry('POST', `/messages/${id}/failed`, { error: 'The assistant took longer than 15 minutes and was stopped.' });
    } else if (state.isError || (result.code !== 0 && !state.done)) {
      const reason = text || clean(result.stderr.trim().split('\n').slice(-3).join(' ')) || `The assistant exited with code ${result.code}.`;
      await apiRetry('POST', `/messages/${id}/failed`, { error: reason.slice(0, 500) });
    } else if (!text) {
      await apiRetry('POST', `/messages/${id}/failed`, { error: 'The assistant gave an empty reply.' });
    } else {
      await apiRetry('POST', `/messages/${id}/done`, { text, sessionId });
    }
  } catch (error) {
    finished = true;
    clearTimeout(flushTimer);
    await apiRetry('POST', `/messages/${id}/failed`, { error: clean(error.message).slice(0, 300) }).catch(() => {});
  } finally {
    finished = true;
    clearInterval(stopPoll);
    clearTimeout(flushTimer);
    child = null;
    await rm(dir, { recursive: true, force: true });
  }
}

// ---- transcription job ----------------------------------------------------------------------------
function whisperBinary() {
  for (const rel of ['build/bin/whisper-cli', 'build/bin/main', 'main']) {
    const file = path.join(WHISPER_DIR, rel);
    if (existsSync(file)) return file;
  }
  return null;
}

async function runTranscribe(job) {
  const id = job.id;
  const dir = await mkdtemp(path.join(tmpdir(), `lms-assistant-t-${String(id).replace(/[^A-Za-z0-9_-]/g, '')}-`));
  const deadline = Date.now() + TRANSCRIBE_TIMEOUT_MS;
  const left = () => Math.max(1000, deadline - Date.now());
  const fail = (error) => apiRetry('POST', `/transcriptions/${id}/failed`, { error }).catch(() => {});
  try {
    const bin = whisperBinary();
    const model = path.join(WHISPER_DIR, 'models', 'ggml-base.bin');
    if (!bin || !existsSync(model)) {
      await fail('Transcription is not set up (whisper missing).');
      return;
    }
    const input = path.join(dir, `in.${extFor(job.mime)}`);
    const wav = path.join(dir, 'out.wav');
    await download(id, input);
    const ff = await run('flock', [HEAVY_LOCK, FFMPEG_BIN, '-y', '-i', input, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], { timeoutMs: left() });
    if (ff.timedOut) return await fail('Transcription timed out (3 minutes).');
    if (ff.code !== 0) return await fail('The audio could not be read.');
    const wh = await run('flock', [HEAVY_LOCK, bin, '-m', model, '-f', wav, '-l', 'auto', '-t', '2', '-nt', '-np'], { timeoutMs: left() });
    if (wh.timedOut) return await fail('Transcription timed out (3 minutes).');
    if (wh.code !== 0) return await fail('Transcription failed.');
    const text = wh.stdout.replace(/\[[A-Z_ ]+\]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return await fail('No speech was detected.');
    await apiRetry('POST', `/transcriptions/${id}/done`, { text });
  } catch (error) {
    await fail(clean(error.message).slice(0, 300));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// ---- main loop ------------------------------------------------------------------------------------
async function main() {
  if (!BRIDGE_KEY) {
    console.error('LMS_BRIDGE_KEY is not set. Run deploy/server/set-assistant-key.sh <admin-email>.');
    process.exit(1);
  }
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      killChild(currentChild);
      setTimeout(() => process.exit(0), 300);
    });
  }
  log('assistant bridge starting', { url: LMS_URL, repo: REPO_DIR });
  let delay = 2000;
  for (;;) {
    try {
      await api('POST', '/reset', {});
      break;
    } catch (error) {
      log('reset failed:', error.message);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
    }
  }
  delay = 2000;
  for (;;) {
    let job = null;
    try {
      const res = await api('GET', '/next?modes=assistant,developer', undefined, 40000);
      job = res && res.job ? res.job : null;
      delay = 2000;
    } catch (error) {
      log('next failed:', error.message);
      await sleep(delay);
      delay = Math.min(delay * 2, 30000);
      continue;
    }
    if (!job) continue;
    log('job', { type: job.type, id: job.id, mode: job.mode });
    try {
      if (job.type === 'chat') await runChat(job);
      else if (job.type === 'transcribe') await runTranscribe(job);
      else log('unknown job type', job.type);
    } catch (error) {
      log('job crashed:', error.message);
    }
  }
}

main();
