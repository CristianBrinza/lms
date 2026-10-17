import { libT } from './i18n';

/**
 * A photo made small enough to be a profile picture: the centre square, at most 384 px, as a JPEG
 * data URL (usually 20–60 KB). Done in the browser, so a 12 MB phone photo never leaves the phone.
 */
export async function shrinkPhoto(file: File, size = 384): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(libT().photo.notImage);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(libT().photo.unreadable);
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(size, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const context = canvas.getContext('2d');
  if (!context) throw new Error(libT().photo.unreadable);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    out,
    out,
  );
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
