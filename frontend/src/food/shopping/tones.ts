import type { Translations } from '@/i18n';
import type { StoreTone } from '../types';
import { shoppingT } from './shopping.i18n';

const tone = (value: StoreTone, dot: string, soft: string) => ({
  dot,
  soft,
  /** Its name, in the current language whenever it's read. */
  get label() {
    return shoppingT().storesSheet.tones[value];
  },
});

/** A store's colour: its tab dot and, when chosen, its soft tab. From the LMS pastels. */
export const STORE_TONE: Record<StoreTone, { dot: string; soft: string; label: string }> = {
  butter: tone('butter', 'bg-butter-300', 'bg-butter-100'),
  cyan: tone('cyan', 'bg-cyan-400', 'bg-cyan-100'),
  pink: tone('pink', 'bg-pink-400', 'bg-pink-100'),
  mint: tone('mint', 'bg-mint-200', 'bg-mint-100'),
  lav: tone('lav', 'bg-lav-400', 'bg-lav-100'),
  peach: tone('peach', 'bg-peach-200', 'bg-peach-100'),
  ink: tone('ink', 'bg-ink-900', 'bg-ink-100'),
};

export const STORE_TONES = Object.keys(STORE_TONE) as StoreTone[];

/** Shops people in Moldova use most, offered when adding a store. Brands keep their names. */
export const SUGGESTED_STORES: Array<{
  name: string;
  tone: StoreTone;
  translations?: Translations;
}> = [
  { name: 'Linella', tone: 'mint' },
  { name: 'Metro', tone: 'butter' },
  { name: 'Nr1', tone: 'cyan' },
  { name: 'Fourchette', tone: 'pink' },
  { name: 'Green Hills', tone: 'mint' },
  { name: 'Velmart', tone: 'peach' },
  {
    name: 'Piața Centrală',
    tone: 'lav',
    translations: { en: { name: 'Central Market' }, ru: { name: 'Центральный рынок' } },
  },
];
