import { Client } from '@gradio/client';

/** One call to a Hugging Face Space: the inputs by name, the outputs in order. */
export interface SpaceClient {
  predict(endpoint: string, payload: Record<string, unknown>, signal: AbortSignal): Promise<unknown[]>;
}

/** Connects to a (free) Hugging Face Space with the server's token and runs jobs with @gradio/client. */
export async function connectSpace(space: string, token: string | null): Promise<SpaceClient> {
  const client = await Client.connect(space, token ? { token: token as `hf_${string}` } : {});
  return {
    async predict(endpoint, payload, signal) {
      const job = client.submit(endpoint, payload);
      const stop = () => void job.cancel().catch(() => undefined);
      signal.addEventListener('abort', stop, { once: true });
      try {
        let data: unknown[] | null = null;
        for await (const message of job) {
          if (message.type === 'data') data = message.data as unknown[];
          if (message.type === 'status' && message.stage === 'error')
            throw new Error(String(message.message ?? message.title ?? 'error'));
        }
        if (signal.aborted) throw new Error('timeout');
        if (!data) throw new Error('no result');
        return data;
      } finally {
        signal.removeEventListener('abort', stop);
      }
    },
  };
}

/** Runs the jobs one after another (the free Spaces' quota is small and shared). */
export function createGate() {
  let queue: Promise<unknown> = Promise.resolve();
  return {
    run<T>(work: () => Promise<T>): Promise<T> {
      const next = queue.then(work, work);
      queue = next.catch(() => undefined);
      return next;
    },
    idle: (): Promise<void> => queue.then(() => undefined),
  };
}

/** Downloads a file the Space produced (its URLs need the token when the Space is private). */
export async function fetchSpaceFile(url: string, token: string | null): Promise<Buffer> {
  const response = await fetch(url, token ? { headers: { authorization: `Bearer ${token}` } } : {});
  if (!response.ok) throw new Error(`result ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/** The URL of a file in a Space's answer (a FileData object, or a plain URL). */
export function fileUrl(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const file = value as { url?: unknown; path?: unknown };
    if (typeof file.url === 'string') return file.url;
    if (typeof file.path === 'string' && /^https?:/.test(file.path)) return file.path;
  }
  return null;
}
