/**
 * TMDB's images come straight from its CDN in small sizes (never through or onto the PC); the
 * service worker keeps up to 300 of them on the device (vite.config.ts, "lms-tmdb-images").
 */

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/';

export type PosterSize = 'w92' | 'w185' | 'w342';
export type StillSize = 'w300' | 'w780';
export type ImageSize = PosterSize | StillSize | 'w185' | 'h632' | 'original';

/** A TMDB path ('/abc.jpg') at a size, or null when there's no picture. */
export function tmdbImage(path: string | null | undefined, size: ImageSize): string | null {
  if (!path) return null;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}${size}${clean}`;
}

export interface ImageSources {
  src: string;
  srcSet: string;
}

/**
 * A poster: w185 for phones' rows, w342 when the box is wide or the screen dense. Width
 * descriptors let the browser pick from `sizes`.
 */
export function posterSources(path: string | null | undefined): ImageSources | null {
  const small = tmdbImage(path, 'w185');
  const large = tmdbImage(path, 'w342');
  if (!small || !large) return null;
  return { src: small, srcSet: `${small} 185w, ${large} 342w` };
}

/** An episode still or a backdrop (16:9): w300 in cards, w780 only where it's shown big. */
export function stillSources(path: string | null | undefined): ImageSources | null {
  const small = tmdbImage(path, 'w300');
  const large = tmdbImage(path, 'w780');
  if (!small || !large) return null;
  return { src: small, srcSet: `${small} 300w, ${large} 780w` };
}

/** A face: w185 only (shown at most 5rem wide). */
export const profileImage = (path: string | null | undefined) => tmdbImage(path, 'w185');
