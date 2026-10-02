import { useSyncExternalStore } from 'react';

/** Whether a media query matches now, following changes (rotating an iPad, resizing a window). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tablets and up (44rem, an iPad mini held upright): room for a list and its details side by side. */
export const useWide = () => useMediaQuery('(min-width: 44rem)');
