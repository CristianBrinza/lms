import { removeBackground as remove, type Config } from '@imgly/background-removal';

/**
 * The cut-out itself, in its own chunk: @imgly/background-removal (ONNX in WebAssembly, or WebGPU
 * where the browser has it). Its model and runtime come from IMG.LY's CDN the first time and are
 * kept by the browser's cache (and the installed app's service worker) after that.
 */

let running: Promise<unknown> = Promise.resolve();

export function removeBackground(source: Blob, onProgress: (fraction: number) => void): Promise<Blob> {
  // WebGPU where the browser really has it (desktop Chrome); elsewhere (iPhone Safari) the CPU
  // with the small quantized model, which fits a phone's memory.
  const gpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  const config: Config = {
    model: gpu ? 'isnet_fp16' : 'isnet_quint8',
    device: gpu ? 'gpu' : 'cpu',
    output: { format: 'image/png' },
    fetchArgs: { cache: 'force-cache' },
    progress: (key, current, total) => {
      if (key.startsWith('fetch:') && total > 0) onProgress(Math.min(1, current / total));
    },
  };
  // One photo at a time: the model is big, and phones have little memory.
  const run = async () => {
    try {
      return await remove(source, config);
    } catch (error) {
      // The GPU path can fail on some devices: try once more on the CPU with the small model.
      console.error('[closet] cut-out failed', error);
      if (config.device !== 'gpu') throw error;
      return remove(source, { ...config, device: 'cpu', model: 'isnet_quint8' });
    }
  };
  const next = running.then(run, run);
  running = next.catch(() => undefined);
  return next;
}
