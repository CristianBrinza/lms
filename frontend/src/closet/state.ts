import { useSyncExternalStore, type CSSProperties } from 'react';
import { storage } from '@/lib/storage';

/** What the closet remembers on this device: whose closet, the last places used; the studio light. */

const OWNER_KEY = 'lms:closet-owner';
const listeners = new Set<() => void>();
let owner = storage.get(OWNER_KEY) ?? 'me';

/** Whose closet the screens show: 'me', a person's id, or 'all'. Remembered on this device. */
export function useOwner(): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => owner,
  );
  return [
    value,
    (next) => {
      owner = next;
      storage.set(OWNER_KEY, next);
      listeners.forEach((listener) => listener());
    },
  ];
}

export const STUDIO: CSSProperties = {
  background:
    'radial-gradient(120% 85% at 50% 22%, #ffffff 0%, #f7f7fa 48%, #ececf2 100%)',
};

// ---------------------------------------------------------------- recent places

const RECENT_KEY = 'lms:closet-recent-places';
export const recentPlaces = (): string[] => storage.getJson<string[]>(RECENT_KEY) ?? [];
export function rememberPlace(id: string | null) {
  if (!id) return;
  storage.setJson(RECENT_KEY, [id, ...recentPlaces().filter((p) => p !== id)].slice(0, 6));
}
