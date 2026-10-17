/**
 * A phone's label photo is 3–12 MB; the server keeps a 1600 px WebP anyway. So the app shrinks it
 * first (2000 px, WebP or JPEG), turned upright by its EXIF, which saves the upload on mobile data.
 * A format the browser can't draw (HEIC on most desktops) goes as it is: the server reads it.
 */

const MAX_SIDE = 2000;
const MAX_ORIGINAL = 12 * 1024 * 1024;

const readAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(blob);
  });

export class PhotoTooLarge extends Error {}

export async function photoForUpload(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (file.size > MAX_ORIGINAL) throw new PhotoTooLarge();
    return readAsDataUrl(file);
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return readAsDataUrl(file);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob =
      (await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86))) ??
      null;
    // Safari before 17 can't write WebP and quietly gives PNG: JPEG is smaller then.
    if (blob && blob.type === 'image/webp') return readAsDataUrl(blob);
    const jpeg = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.86),
    );
    return readAsDataUrl(jpeg ?? file);
  } finally {
    bitmap.close();
  }
}
