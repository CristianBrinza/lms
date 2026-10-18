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

/** A photo upright and at most 2048 px, as a JPEG data URL (a phone photo goes from 5 MB to ~500 KB). */
export async function shrinkImage(file: Blob): Promise<{ dataUrl: string; preview: Blob }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const node = document.createElement('canvas');
    node.width = width;
    node.height = height;
    const context = node.getContext('2d');
    if (!context) throw new Error('no canvas');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => node.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) throw new Error('encode failed');
    return { dataUrl: await readAsDataUrl(blob), preview: blob };
  } finally {
    bitmap.close();
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
