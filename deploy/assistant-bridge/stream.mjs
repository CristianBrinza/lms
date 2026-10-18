// Pure parser for `claude -p --output-format stream-json --verbose --include-partial-messages`.
// No I/O. Tolerant of unknown or invalid lines.

const MAX_PROGRESS = 80;

export function redact(text, extra = []) {
  let out = String(text ?? '');
  out = out.replace(/lms_[A-Za-z0-9_-]{6,}/g, '[key]').replace(/sk-ant-[A-Za-z0-9_-]+/g, '[token]');
  for (const secret of extra) {
    if (secret && secret.length >= 8) out = out.split(secret).join('[secret]');
  }
  return out;
}

function oneLine(value, max = MAX_PROGRESS) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** A short progress line for one tool_use block. */
export function describeTool(name, input = {}) {
  const i = input && typeof input === 'object' ? input : {};
  const tool = String(name ?? '');
  let line;
  if (tool === 'Bash') line = `Rulez: ${i.command ?? ''}`;
  else if (tool === 'Read') line = `Citesc: ${i.file_path ?? i.path ?? ''}`;
  else if (tool === 'Glob' || tool === 'Grep') line = `Caut: ${i.pattern ?? ''}`;
  else if (tool === 'Edit' || tool === 'Write' || tool === 'MultiEdit' || tool === 'NotebookEdit') {
    line = `Editez: ${i.file_path ?? i.notebook_path ?? ''}`;
  } else if (tool === 'WebSearch' || tool === 'WebFetch') line = `Web: ${i.query ?? i.url ?? ''}`;
  else line = `Unealta: ${tool.replace(/^mcp__lms__/, '').replace(/^mcp__[^_]+__/, '')}`;
  return oneLine(line);
}

export function parseLine(line) {
  const trimmed = String(line ?? '').trim();
  if (!trimmed || trimmed[0] !== '{') return null;
  try {
    const value = JSON.parse(trimmed);
    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function createState() {
  return {
    sessionId: null,
    turnText: '', // text of the assistant turn being written (cumulative)
    result: null, // authoritative final text
    isError: false,
    done: false,
  };
}

/**
 * Feeds one event into the state. Returns { progress: string[], textChanged: boolean }.
 * state.turnText is the reply shown so far; state.result is set by the final result event.
 */
export function applyEvent(state, event) {
  const out = { progress: [], textChanged: false };
  if (!event || typeof event !== 'object') return out;
  if (typeof event.session_id === 'string' && event.session_id) state.sessionId = event.session_id;

  if (event.type === 'stream_event' && event.event) {
    const inner = event.event;
    if (inner.type === 'message_start') {
      if (state.turnText !== '') out.textChanged = true;
      state.turnText = '';
    } else if (inner.type === 'content_block_delta' && inner.delta?.type === 'text_delta' && typeof inner.delta.text === 'string') {
      state.turnText += inner.delta.text;
      out.textChanged = true;
    }
    return out;
  }

  if (event.type === 'assistant' && event.message && Array.isArray(event.message.content)) {
    const blocks = event.message.content;
    const text = blocks.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
    if (text && text !== state.turnText) {
      state.turnText = text;
      out.textChanged = true;
    }
    for (const block of blocks) {
      if (block && block.type === 'tool_use') out.progress.push(describeTool(block.name, block.input));
    }
    return out;
  }

  if (event.type === 'result') {
    state.done = true;
    state.isError = event.is_error === true || (typeof event.subtype === 'string' && event.subtype.startsWith('error'));
    state.result = typeof event.result === 'string' ? event.result : null;
    return out;
  }
  return out;
}

/** The text to show or store: the final result when known, else the last turn's text. */
export function finalText(state) {
  const text = state.result != null && state.result.trim() !== '' ? state.result : state.turnText;
  return String(text ?? '').trim();
}
