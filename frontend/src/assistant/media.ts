import { toast } from '@/components/ui';
import { libT } from '@/lib/i18n';
import { MAX_SIDE as LIMIT_SIDE, optimizeImage } from '@/lib/optimizeImage';

/** Photos shrunk in the browser, files read as base64, and the recorder's format. */

export const MAX_SIDE = 2048;
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const MAX_RECORD_SECONDS = 300;

/** The size a picture is shrunk to: at most `max` on its long side, never enlarged. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });

/**
 * A photo for the assistant through the shared optimizer: upright, under 8 MB, up to 4000 px, with
 * "Optimizing photo…" while a big one is shrunk. A HEIC the browser can't draw goes as it is.
 */
export async function shrinkImage(file: Blob): Promise<{ dataUrl: string; preview: Blob }> {
  let note: string | number | undefined;
  try {
    const { blob } = await optimizeImage(file, {
      maxSide: LIMIT_SIDE.photo,
      onWork: () => (note = toast.loading(libT().photo.optimizing)),
    });
    return { dataUrl: await readAsDataUrl(blob), preview: blob };
  } finally {
    if (note !== undefined) toast.dismiss(note);
  }
}

/** What this browser records in: Safari gives audio/mp4, Chrome webm. */
export function recorderMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'])
    if (MediaRecorder.isTypeSupported(type)) return type;
  return '';
}

export const humanSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
