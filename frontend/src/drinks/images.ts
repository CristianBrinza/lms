import { toast } from '@/components/ui';
import { libT } from '@/lib/i18n';
import { MAX_SIDE, optimizeImage, PhotoTooLarge, readAsDataUrl } from '@/lib/optimizeImage';

/**
 * A label or medicine photo as a data URL for upload, through the shared optimizer: under 8 MB, up
 * to 4000 px, upright. "Optimizing photo…" shows while a big one is shrunk. A format the browser
 * can't draw (HEIC on most desktops) goes as it is: the server converts it.
 */
export { PhotoTooLarge };

export async function photoForUpload(file: File): Promise<string> {
  let note: string | number | undefined;
  try {
    const { blob } = await optimizeImage(file, {
      maxSide: MAX_SIDE.photo,
      onWork: () => (note = toast.loading(libT().photo.optimizing)),
    });
    return await readAsDataUrl(blob);
  } finally {
    if (note !== undefined) toast.dismiss(note);
  }
}
