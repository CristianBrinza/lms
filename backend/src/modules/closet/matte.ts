import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import type { FoodCtx } from '../food/kitchen';
import { photoBytes } from './photos';
import { connectSpace, createGate, fetchSpaceFile, fileUrl, type SpaceClient } from './space';

/**
 * Cut-outs from a free Hugging Face Space running BiRefNet (the best open background-removal
 * model), called with @gradio/client and the same HF_TOKEN as the try-on. The browser asks for a
 * photo's matte here first and falls back to its own smaller model if this fails. One at a time.
 * The Space answers a pair: [the photo, the cut-out as an RGBA PNG at the photo's full size].
 */
export const MATTE_SPACE = 'ZhengPeng7/BiRefNet_demo';
export const MATTE_ENDPOINT = '/image';
export const MATTE_TIMEOUT_MS = 2 * 60 * 1000;

type Connect = (token: string | null) => Promise<SpaceClient>;
const realConnect: Connect = (token) => connectSpace(MATTE_SPACE, token);
let connect: Connect = realConnect;
/** Tests swap the Space for a fake; call with nothing to put the real one back. */
export function setMatteClient(next?: Connect) {
  connect = next ?? realConnect;
}

const gate = createGate();
export const matteIdle = () => gate.idle();

export const MATTE_MESSAGES = {
  quota: 'Hugging Face’s free quota is used up for today',
  timeout: 'The cut-out service took too long',
  failed: 'The cut-out service didn’t answer',
} as const;

/** A Space or network error → an AppError with a short reason. */
export function matteError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (/quota|exceeded your|zerogpu|429|rate.?limit|too many requests/.test(text))
    return new AppError(429, 'MATTE_QUOTA', MATTE_MESSAGES.quota);
  if (/timeout|timed out|aborted/.test(text)) return new AppError(504, 'MATTE_TIMEOUT', MATTE_MESSAGES.timeout);
  return new AppError(502, 'MATTE_FAILED', MATTE_MESSAGES.failed);
}

/** The cut-out (RGBA PNG) of a stored photo, at its full size. */
export async function photoMatte(deps: AppDeps, ctx: FoodCtx, photoId: string): Promise<Buffer> {
  const photo = await photoBytes(ctx, photoId, 'full');
  const token = deps.config.hf.token;
  return gate.run(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MATTE_TIMEOUT_MS);
    try {
      const aborted = new Promise<never>((_, reject) =>
        controller.signal.addEventListener('abort', () => reject(new Error('timeout')), { once: true }),
      );
      const work = (async () => {
        const client = await connect(token);
        const data = await client.predict(
          MATTE_ENDPOINT,
          {
            images: new Blob([new Uint8Array(photo.data)], { type: photo.mime }),
            resolution: '',
            weights_file: 'General',
          },
          controller.signal,
        );
        const pair = Array.isArray(data[0]) ? (data[0] as unknown[]) : data;
        const url = fileUrl(pair[pair.length - 1]);
        if (!url) throw new Error('no cut-out picture');
        return fetchSpaceFile(url, token);
      })();
      work.catch(() => undefined);
      return await Promise.race([work, aborted]);
    } catch (error) {
      const failure = matteError(error);
      if (failure.code === 'MATTE_FAILED') console.error('[closet] cut-out failed:', String(error).slice(0, 200));
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  });
}
