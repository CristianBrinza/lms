import { removeBackground as remove, type Config } from '@imgly/background-removal';

/**
 * The cut-out itself, in its own chunk: @imgly/background-removal (ONNX in WebAssembly, or WebGPU
 * where the browser has it). Its model and runtime come from IMG.LY's CDN the first time and are
 * kept by the browser's cache (and the installed app's service worker) after that.
 */

let running: Promise<unknown> = Promise.resolve();

export function removeBackground(source: Blob, onProgress: (fraction: number) => void): Promise<Blob> {
  const config: Config = {
    model: 'isnet_fp16',
    device: 'gpu',
    output: { format: 'image/png' },
    fetchArgs: { cache: 'force-cache' },
    progress: (key, current, total) => {
      if (key.startsWith('fetch:') && total > 0) onProgress(Math.min(1, current / total));
    },
  };
  // One photo at a time: the model is big, and phones have little memory.
  const next = running.then(
    () => remove(source, config),
    () => remove(source, config),
  );
  running = next.catch(() => undefined);
  return next;
}
