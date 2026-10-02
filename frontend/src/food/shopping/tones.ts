import type { StoreTone } from '../types';

/** A store's colour: its tab dot and, when chosen, its soft tab. From the LMS pastels. */
export const STORE_TONE: Record<StoreTone, { dot: string; soft: string; label: string }> = {
  butter: { dot: 'bg-butter-300', soft: 'bg-butter-100', label: 'Butter' },
  cyan: { dot: 'bg-cyan-400', soft: 'bg-cyan-100', label: 'Cyan' },
  pink: { dot: 'bg-pink-400', soft: 'bg-pink-100', label: 'Pink' },
  mint: { dot: 'bg-mint-200', soft: 'bg-mint-100', label: 'Mint' },
  lav: { dot: 'bg-lav-400', soft: 'bg-lav-100', label: 'Lavender' },
  peach: { dot: 'bg-peach-200', soft: 'bg-peach-100', label: 'Peach' },
  ink: { dot: 'bg-ink-900', soft: 'bg-ink-100', label: 'Ink' },
};

export const STORE_TONES = Object.keys(STORE_TONE) as StoreTone[];

/** Shops people in Moldova use most, offered when adding a store. */
export const SUGGESTED_STORES: Array<{ name: string; tone: StoreTone }> = [
  { name: 'Linella', tone: 'mint' },
  { name: 'Metro', tone: 'butter' },
  { name: 'Nr1', tone: 'cyan' },
  { name: 'Fourchette', tone: 'pink' },
  { name: 'Green Hills', tone: 'mint' },
  { name: 'Velmart', tone: 'peach' },
  { name: 'Piața Centrală', tone: 'lav' },
];
