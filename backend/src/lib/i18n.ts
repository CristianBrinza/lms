import type { Context } from 'hono';
import { z } from 'zod';

/**
 * LMS speaks English, Romanian and Russian. A person's language is on their account (users.locale);
 * the app also sends it with every request (Accept-Language), so a signed-out screen gets it too.
 *
 * What people write is stored once, as written, plus optional translations per record:
 *   translations = { ro: { name: '…', note: '…' }, ru: { … }, en: { … } }
 * The app shows the translation for its language and falls back to the written text.
 */

export const LOCALES = ['en', 'ro', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** The first of the request's languages LMS speaks; English otherwise. */
export function parseAcceptLanguage(header: string | undefined | null): Locale {
  for (const part of (header ?? '').split(',')) {
    const base = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(base)) return base;
  }
  return 'en';
}

/** The language to answer in: the signed-in person's, else what the request asks for. */
export function requestLocale(c: Context): Locale {
  const user = (c.get as (key: string) => unknown)('user') as { locale?: string | null } | undefined;
  if (isLocale(user?.locale)) return user.locale;
  return parseAcceptLanguage(c.req.header('accept-language'));
}

const text = z.union([z.string().max(4000), z.array(z.string().max(4000)).max(100)]);

/** One record's translations, as the API takes them: per language, per field. */
export const Translations = z
  .object({
    en: z.record(z.string().max(40), text).optional(),
    ro: z.record(z.string().max(40), text).optional(),
    ru: z.record(z.string().max(40), text).optional(),
  })
  .describe(
    'The text in other languages, per field: { "ro": { "name": "…" }, "ru": { "name": "…" }, "en": { "name": "…" } }. Fill all three (en, ro, ru) so everyone reads it in their own language.',
  );
export type Translations = z.infer<typeof Translations>;

/** Drops empty entries, so `{ ro: { name: '' } }` is stored as `{}`. */
export function cleanTranslations(value: Translations | null | undefined): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = value?.[locale];
    if (!entry) continue;
    const kept: Record<string, string | string[]> = {};
    for (const [key, item] of Object.entries(entry)) {
      if (typeof item === 'string' ? item.trim() : item.some((part) => part.trim()))
        kept[key] = typeof item === 'string' ? item.trim() : item;
    }
    if (Object.keys(kept).length) out[locale] = kept;
  }
  return out;
}

/** Merges an update into stored translations (per language, per field). */
export function mergeTranslations(
  stored: Translations | null | undefined,
  update: Translations | null | undefined,
): Translations {
  if (!update) return cleanTranslations(stored);
  const out: Translations = { ...(stored ?? {}) };
  for (const locale of LOCALES) {
    if (update[locale]) out[locale] = { ...(stored?.[locale] ?? {}), ...update[locale] };
  }
  return cleanTranslations(out);
}

/** A field in a language, falling back to the written text (for server-made messages). */
export function translated<T extends Record<string, unknown>>(
  row: T & { translations?: Translations | null },
  field: keyof T & string,
  locale: Locale,
): string {
  const value = row.translations?.[locale]?.[field];
  return typeof value === 'string' && value ? value : String(row[field] ?? '');
}
