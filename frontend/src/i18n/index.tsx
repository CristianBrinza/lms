import { useSyncExternalStore } from 'react';
import { storage } from '@/lib/storage';

/**
 * The app speaks English, Romanian and Russian. Every screen's copy lives in typed dictionaries
 * (one per area, made with `messages()`): `ro` and `ru` must have every key `en` has, so a
 * missing translation is a type error, not an English word left on a Romanian screen.
 *
 * The language is per person: chosen in Settings (or on the sign-in screen), kept on the device
 * and on the account, so a new phone and the server's notifications follow it too.
 */

export const LOCALES = ['en', 'ro', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

/** Each language in its own words, for the picker. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ro: 'Română',
  ru: 'Русский',
};

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

const KEY = 'lms.locale';

/** The device's first language LMS speaks; English otherwise. */
function deviceLocale(): Locale {
  const wanted = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of wanted) {
    const base = tag?.slice(0, 2).toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'en';
}

let current: Locale = (() => {
  const saved = storage.get(KEY);
  return isLocale(saved) ? saved : deviceLocale();
})();
const listeners = new Set<() => void>();

function applyDocument(locale: Locale) {
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}
applyDocument(current);

/** The language now. Safe anywhere: the app remounts when it changes (see I18nRoot). */
export const getLocale = (): Locale => current;

/** Switches the language on this device (the account is updated by the provider). */
export function setLocale(locale: Locale): void {
  if (locale === current) return;
  current = locale;
  storage.set(KEY, locale);
  applyDocument(locale);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The language, re-rendering when it changes. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}

/** The tag Intl formats with: Moldova's Romanian and Russian; English with day-first dates. */
export function intlLocale(locale: Locale = current): string {
  if (locale === 'ro') return 'ro-MD';
  if (locale === 'ru') return 'ru-RU';
  return 'en-GB';
}

/**
 * A dictionary for one area. Keys are plain properties, values strings or functions (for numbers
 * and names): `t.kitchen.title`, `t.items(3)`.
 *
 *   export const useFoodT = messages({ en, ro, ru }); // ro and ru typed as `typeof en`
 *   const t = useFoodT();
 *
 * The returned function is a hook-free lookup, so it also works outside components (formatters,
 * toasts); the app remounts on a language change, so nothing keeps the old words.
 */
export function messages<T>(dictionaries: { en: T; ro: NoInfer<T>; ru: NoInfer<T> }): () => T {
  return () => dictionaries[current];
}

type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };
const rules = new Map<Locale, Intl.PluralRules>();

/**
 * The right form for a count in the current language: English one/other, Romanian one/few/other,
 * Russian one/few/many/other. `#` is replaced by the number.
 *
 *   plural(n, { one: '# item', other: '# items' })
 *   plural(n, { one: '# товар', few: '# товара', many: '# товаров', other: '# товара' })
 */
export function plural(count: number, forms: PluralForms): string {
  let rule = rules.get(current);
  if (!rule) {
    rule = new Intl.PluralRules(intlLocale(current));
    rules.set(current, rule);
  }
  const form = forms[rule.select(count)] ?? forms.other;
  return form.replace(/#/g, formatNumber(count));
}

/** A number in the current language's style (1 234,5 in Romanian and Russian). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(intlLocale(current), options).format(value);
}

/** "A, B and C" / "A, B și C" / "A, B и C". */
export function formatList(items: string[], type: 'conjunction' | 'disjunction' = 'conjunction') {
  return new Intl.ListFormat(intlLocale(current), { style: 'long', type }).format(items);
}

// ── Translated content ──────────────────────────────────────────────────────────────────────

/**
 * What people and Claude write (a recipe's name, an exercise's steps, a bag) is stored once, in
 * the language it was written in, plus optional translations: `{ ro: { name: '…' }, ru: {…} }`.
 */
export type Translations = Partial<Record<Locale, Record<string, unknown>>>;

/**
 * A text field of a record in the current language, falling back to what was written.
 *
 *   tr(recipe, 'name')   tr(exercise, 'steps')  // arrays work too
 */
export function tr<T extends { translations?: Translations | null }, K extends keyof T & string>(
  row: T,
  field: K,
): T[K] {
  const value = row.translations?.[current]?.[field];
  if (value === undefined || value === null || value === '') return row[field];
  if (Array.isArray(value) && !value.length) return row[field];
  return value as T[K];
}
