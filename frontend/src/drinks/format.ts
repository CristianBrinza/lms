import { formatNumber, getLocale, intlLocale, type Locale } from '@/i18n';
import type { Drink } from './api';

/** How drinks read: countries in the reader's language, stars, the one-line facts, the filters. */

/** Every ISO 3166 country code; names come from the browser, in the reader's language. */
const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(
    ' ',
  );

/** The countries drinks most often come from here, offered first. */
const COMMON = ['MD', 'RO', 'FR', 'IT', 'ES', 'PT', 'DE', 'GB', 'IE', 'US', 'MX', 'JP', 'GE', 'UA'];

const names = new Map<Locale, Intl.DisplayNames>();
export function countryName(code: string): string {
  if (!code) return '';
  const locale = getLocale();
  let display = names.get(locale);
  if (!display) {
    display = new Intl.DisplayNames(intlLocale(locale), { type: 'region' });
    names.set(locale, display);
  }
  try {
    return display.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The country list for a picker: the usual ones first, then all of them by name. */
export function countryOptions(): { code: string; name: string; common: boolean }[] {
  const collator = new Intl.Collator(intlLocale(getLocale()));
  const rest = CODES.filter((code) => !COMMON.includes(code))
    .map((code) => ({ code, name: countryName(code), common: false }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return [...COMMON.map((code) => ({ code, name: countryName(code), common: true })), ...rest];
}

/** 1–10 as stars: 9 → "4.5", in the reader's decimal mark. */
export const stars = (rating: number) => formatNumber(rating / 2, { maximumFractionDigits: 1 });

/** A drink's one-line facts: vintage or age, style, where from. */
export function drinkLine(drink: Drink, years: (n: number) => string): string {
  return [
    drink.vintage ?? (drink.ageYears !== null ? years(drink.ageYears) : null),
    drink.style || null,
    drink.region || countryName(drink.country) || null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export type Shelf = 'all' | 'cellar' | 'tried' | 'wanted';
export type Sort = 'recent' | 'rating' | 'name' | 'vintage';

export interface Filters {
  q: string;
  shelf: Shelf;
  category: string;
  country: string;
  minRating: number;
  tag: string;
  sort: Sort;
}

export const NO_FILTERS: Filters = {
  q: '',
  shelf: 'all',
  category: '',
  country: '',
  minRating: 0,
  tag: '',
  sort: 'recent',
};

/** Lower case without accents, so "feteasca" finds Fetească and "rara" Rară. */
export const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();

export function onShelf(drink: Drink, shelf: Shelf): boolean {
  if (shelf === 'cellar') return drink.stock > 0;
  if (shelf === 'tried') return drink.tastings > 0;
  if (shelf === 'wanted') return drink.wanted;
  return true;
}

/** The same search and filters as the API's, done here so typing filters at once. */
export function filterDrinks(drinks: Drink[], filters: Filters): Drink[] {
  const words = fold(filters.q).split(/\s+/).filter(Boolean);
  const shown = drinks.filter((drink) => {
    if (!onShelf(drink, filters.shelf)) return false;
    if (filters.category && drink.category !== filters.category) return false;
    if (filters.country && drink.country !== filters.country) return false;
    if (filters.tag && !drink.tags.includes(filters.tag)) return false;
    if (filters.minRating && (drink.rating ?? 0) < filters.minRating) return false;
    if (!words.length) return true;
    const haystack = fold(
      [
        drink.name,
        drink.producer,
        drink.line,
        drink.variant,
        drink.region,
        drink.appellation,
        drink.style,
        drink.cask,
        countryName(drink.country),
        drink.vintage ?? '',
        ...drink.grapes,
        ...drink.tags,
        drink.notes,
      ].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
  const collator = new Intl.Collator(intlLocale(getLocale()), { numeric: true });
  const recent = (d: Drink) =>
    Math.max(Date.parse(d.updatedAt), d.lastTasted ? Date.parse(d.lastTasted) : 0);
  const by: Record<Sort, (a: Drink, b: Drink) => number> = {
    recent: (a, b) => recent(b) - recent(a),
    rating: (a, b) =>
      (b.rating ?? -1) - (a.rating ?? -1) || b.tastings - a.tastings || collator.compare(a.name, b.name),
    name: (a, b) => collator.compare(a.name, b.name),
    vintage: (a, b) => (b.vintage ?? -1) - (a.vintage ?? -1) || collator.compare(a.name, b.name),
  };
  return [...shown].sort(by[filters.sort]);
}

/** How many filters beyond the shelf and search are on (the dot on the filter button). */
export const activeFilters = (filters: Filters) =>
  [filters.category, filters.country, filters.minRating, filters.tag, filters.sort !== 'recent'].filter(
    Boolean,
  ).length;

/** "1,5" or "1.5" back to a number; null when empty or not a number. */
export function parseNumber(value: string): number | null {
  const n = Number(value.replace(',', '.').replace(/\s/g, ''));
  return value.trim() && Number.isFinite(n) ? n : null;
}

/** A comma list typed by hand → clean words, each once. */
export const splitList = (value: string) => [
  ...new Set(
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean),
  ),
];
