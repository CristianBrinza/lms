import { formatNumber, getLocale, intlLocale, type Translations } from '@/i18n';
import { formatT, UNIT_KEY, UNIT_WORDS, unitForm } from './format.i18n';
import type { BaseUnit, Category, CustomUnit, Location, NoteKey, Slot, Unit } from './types';

/**
 * How food reads on screen: "1.3 kg", "3 pcs", "Expires tomorrow", "45.50 lei", in the person's
 * language ("3 buc.", "3 шт."). The unit maths mirrors the API (backend/src/modules/food/units.ts)
 * so the app can preview before it saves. Units stay stored by their English names; only what is
 * shown changes language.
 */

export interface Measured {
  unit: BaseUnit;
  pieceSize: number | null;
  pieceUnit: 'g' | 'ml' | null;
  /** The item's own units (slice, pack), sizes in its base unit. */
  units?: CustomUnit[];
  /** Its kind: things poured or spooned convert between grams and millilitres. */
  category?: Category;
}

/** Kinds weighed and poured alike (the API's rule): 300 g of milk ≈ 300 ml. */
const POURABLE = new Set<Category>(['dairy', 'drinks', 'spices', 'pantry']);

/** The word for one piece of a counted item ("slice" of bread, "pickle"), when it has one. */
export function pieceName(product: Pick<Measured, 'unit' | 'units'>): CustomUnit | null {
  if (product.unit !== 'pcs') return null;
  return product.units?.find((u) => u.size === 1) ?? null;
}

const STANDARD = new Set(['pcs', 'g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'cup']);

/** The item's packages (jar, bottle, loaf, can): its own units that hold more than one piece. */
export function packageUnits(product: Pick<Measured, 'unit' | 'units'>): CustomUnit[] {
  return (product.units ?? []).filter(
    (u) =>
      !STANDARD.has(u.name.toLowerCase()) &&
      !(product.unit === 'pcs' && u.size === 1) &&
      u.name !== 'shot' &&
      u.name !== 'pump' &&
      u.name !== 'glass',
  );
}

/** Sizes to offer for a package: its own list, else its usual size. */
export function packageSizes(unit: CustomUnit): number[] {
  return unit.sizes?.length ? unit.sizes : [unit.size];
}

function customUnit(unit: string, product: Measured): CustomUnit | null {
  const word = unit.trim().toLowerCase();
  return (
    product.units?.find(
      (u) => u.name.toLowerCase() === word || (u.plural ?? `${u.name}s`).toLowerCase() === word,
    ) ?? null
  );
}

const FACTOR: Record<Unit, { family: 'count' | 'mass' | 'volume'; factor: number }> = {
  pcs: { family: 'count', factor: 1 },
  g: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  ml: { family: 'volume', factor: 1 },
  l: { family: 'volume', factor: 1000 },
  tsp: { family: 'volume', factor: 5 },
  tbsp: { family: 'volume', factor: 15 },
  cup: { family: 'volume', factor: 240 },
};
const BASE_FAMILY = { pcs: 'count', g: 'mass', ml: 'volume' } as const;

const round = (value: number) => Math.round(value * 1000) / 1000;

function factorOf(unit: string, product: Measured): number | null {
  const custom = customUnit(unit, product);
  if (custom) return custom.size;
  const measure = FACTOR[unit as Unit];
  if (!measure) return null;
  const base = BASE_FAMILY[product.unit];
  if (measure.family === base) return measure.factor;
  // Spoons and cups of something weighed; grams of something poured: about 1 g per ml.
  if (base === 'mass' && (unit === 'tsp' || unit === 'tbsp' || unit === 'cup'))
    return measure.factor;
  if (
    product.category &&
    POURABLE.has(product.category) &&
    ((base === 'mass' && measure.family === 'volume') ||
      (base === 'volume' && measure.family === 'mass'))
  ) {
    return measure.factor;
  }
  if (!product.pieceSize) return null;
  if (product.unit === 'pcs')
    return measure.family === BASE_FAMILY[product.pieceUnit ?? 'g']
      ? measure.factor / product.pieceSize
      : null;
  return measure.family === 'count' ? product.pieceSize : null;
}

export function toBase(quantity: number, unit: string, product: Measured): number {
  const factor = factorOf(unit, product);
  return factor === null ? NaN : round(quantity * factor);
}

export function fromBase(base: number, unit: string, product: Measured): number {
  const factor = factorOf(unit, product);
  return factor === null ? NaN : round(base / factor);
}

/** The units an item can be entered in; `cooking` adds spoons and cups for liquids. */
export function unitsFor(product: Measured, options: { cooking?: boolean } = {}): string[] {
  const spoons = options.cooking ? ['tsp', 'tbsp', 'cup'] : [];
  const piece = pieceName(product);
  const own: string[] =
    product.unit === 'g'
      ? ['g', 'kg', ...spoons]
      : product.unit === 'ml'
        ? ['ml', 'l', ...spoons]
        : [piece ? piece.name : 'pcs'];
  const extra = (product.units ?? []).map((u) => u.name).filter((name) => !own.includes(name));
  if (!product.pieceSize) return [...own, ...extra];
  if (product.unit === 'pcs')
    return [...own, ...((product.pieceUnit ?? 'g') === 'g' ? ['g', 'kg'] : ['ml', 'l']), ...extra];
  return [...own, 'pcs', ...extra];
}

/** The unit a person would say: kg from 1000 g, l from 1000 ml. */
export function displayUnit(base: number, unit: BaseUnit): Unit {
  if (unit === 'g') return Math.abs(base) >= 1000 ? 'kg' : 'g';
  if (unit === 'ml') return Math.abs(base) >= 1000 ? 'l' : 'ml';
  return 'pcs';
}

// ---------------------------------------------------------------- unit words

/**
 * A unit's word for a count, in the current language: pcs → "pcs" / "buc." / "шт.", slice →
 * "slices" / "felii" / "ломтика". Units are stored by their English names; a word somebody typed
 * themselves (not one the app knows) reads as written, with an English plural in English.
 */
export function unitWord(
  unit: string,
  count = 1,
  own?: Pick<CustomUnit, 'name' | 'plural'> | null,
): string {
  const raw = unit.trim();
  const key = UNIT_KEY.get(raw.toLowerCase());
  const locale = getLocale();
  if (key) {
    const words = UNIT_WORDS[key]!;
    if (locale === 'en') return count === 1 ? words.en[0] : words.en[1];
    return unitForm(words[locale], count);
  }
  if (locale !== 'en') return raw;
  if (count === 1) return own?.name ?? raw;
  return own?.plural ?? (raw.endsWith('s') ? raw : `${raw}s`);
}

/**
 * A package's name as a noun beside a number shown elsewhere (a stepper, a chip): "bottles",
 * "sticle", "бутылки" (no Romanian "de" in front).
 */
export function packageWord(
  name: string,
  count = 1,
  own?: Pick<CustomUnit, 'name' | 'plural'> | null,
): string {
  return unitWord(name, count, own).replace(/^de /, '');
}

/** The same, starting with a capital: a chip, a badge. */
export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** "1.3 kg", "300 g", "3 pcs", "½ pc" from an amount in a unit ("1,3 kg", "3 шт." elsewhere). */
export function formatAmount(
  amount: number,
  unit: string,
  own?: Pick<CustomUnit, 'name' | 'plural'> | null,
): string {
  const counted = unit === 'pcs' || !(unit in FACTOR);
  const fraction = counted ? FRACTIONS[String(round(amount))] : undefined;
  // Half a slice is "½ slice" ("½ felie"); Russian takes the genitive, as for any fraction.
  const count = fraction && getLocale() !== 'ru' ? 1 : amount;
  const number = fraction ?? formatNumber(amount, { maximumFractionDigits: 2 });
  return `${number} ${unitWord(unit, count, own)}`;
}

/** What a lot came in: "Jar of 400 g", "2 bottles of 500 ml" (null when loose). */
export function packageLabel(
  lot: { package: string; packageSize: number | null; initialQuantity: number },
  product: Pick<Measured, 'unit' | 'units'>,
): string | null {
  if (!lot.package) return null;
  const own = product.units?.find((u) => u.name === lot.package);
  const one = capitalized(packageWord(lot.package, 1, own));
  if (!lot.packageSize) return one;
  const t = formatT();
  const count = Math.max(1, Math.round(lot.initialQuantity / lot.packageSize));
  const size = formatQty(lot.packageSize, product);
  return count > 1
    ? t.manyPackages(`${formatNumber(count)} ${unitWord(lot.package, count, own)}`, size)
    : t.onePackage(one, size);
}

/** A package row: "bottles of 1.5 l" beside its count ("sticle de 1,5 l", "бутылки по 1,5 л"). */
export function packageRowText(
  unit: Pick<CustomUnit, 'name' | 'plural'>,
  count: number,
  size: number,
  product: Pick<Measured, 'unit' | 'units'>,
): string {
  return formatT().packageRow(packageWord(unit.name, count, unit), formatQty(size, product));
}

/** "3 l in 2 bottles" ("2 бутылки, всего 3 л"). */
export function packagesTotal(
  unit: Pick<CustomUnit, 'name' | 'plural'>,
  count: number,
  total: number,
  product: Pick<Measured, 'unit' | 'units'>,
): string {
  return formatT().totalIn(
    formatQty(total, product),
    `${formatNumber(count)} ${unitWord(unit.name, count, unit)}`,
  );
}

/** The unit a person would use for this amount of this item: its piece name, kg, l, g, ml, pcs. */
export function naturalUnit(base: number, product: Pick<Measured, 'unit' | 'units'>): string {
  return pieceName(product)?.name ?? displayUnit(base, product.unit);
}

/** A base quantity of an item, in the unit a person would say ("20 slices" when it names its pieces). */
export function formatQty(
  base: number,
  product: Pick<Measured, 'unit'> & { units?: CustomUnit[] },
): string {
  const piece = pieceName({ unit: product.unit, units: product.units });
  if (piece) return formatAmount(round(base), piece.name, piece);
  const unit = displayUnit(base, product.unit);
  const factor = FACTOR[unit].factor;
  return formatAmount(round(base / factor), unit);
}

// ---------------------------------------------------------------- calendar days

const pad = (value: number) => String(value).padStart(2, '0');

/** YYYY-MM-DD on the device's calendar. */
export function localDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12);
}

export function addDays(day: string, days: number): string {
  const date = parseDay(day);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);
}

/** The Monday of the week a day falls in. */
export function weekStart(day: string): string {
  const date = parseDay(day);
  return addDays(day, -((date.getDay() + 6) % 7));
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
/** A date format in the current language (made once per language). */
function dateFormat(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${getLocale()}:${name}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(), options);
    dateFormats.set(key, format);
  }
  return format;
}

/** "Mon", "lun.", "пн". */
export const weekdayShort = (day: string) =>
  dateFormat('weekday', { weekday: 'short' }).format(parseDay(day));
/** "5 Oct", "5 oct.", "5 окт.". */
/** Another year than this one shows its year: "18 oct. 2027" is not next week. */
const otherYear = (day: string) => day.slice(0, 4) !== localDate().slice(0, 4);
export const dayAndMonth = (day: string) =>
  otherYear(day)
    ? dateFormat('dayMonthYear', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        parseDay(day),
      )
    : dateFormat('dayMonth', { day: 'numeric', month: 'short' }).format(parseDay(day));
/** "Monday 5 October", "Luni, 5 octombrie", "Понедельник, 5 октября" (with the year when not this one). */
export const dayLong = (day: string) =>
  capitalized(
    otherYear(day)
      ? dateFormat('longYear', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }).format(parseDay(day))
      : dateFormat('long', { weekday: 'long', day: 'numeric', month: 'long' }).format(
          parseDay(day),
        ),
  );

/** "Today", "Tomorrow", "Yesterday", else "Mon, 5 Oct". */
export function relativeDay(day: string, today = localDate()): string {
  const t = formatT();
  const diff = daysBetween(today, day);
  if (diff === 0) return t.today;
  if (diff === 1) return t.tomorrow;
  if (diff === -1) return t.yesterday;
  return capitalized(`${weekdayShort(day)}, ${dayAndMonth(day)}`);
}

/** relativeDay inside a sentence: "today", "tomorrow", but "Tue, 6 Oct" keeps its capitals in English. */
export function relativeDayInline(day: string, today = localDate()): string {
  const t = formatT();
  const diff = daysBetween(today, day);
  if (diff === 0) return t.todayInline;
  if (diff === 1) return t.tomorrowInline;
  if (diff === -1) return t.yesterdayInline;
  return `${weekdayShort(day)}, ${dayAndMonth(day)}`;
}

export type ExpiryTone = 'expired' | 'today' | 'soon' | 'later' | 'none';

/** How close a best-before is: expired, today, within three days, later, or no date. */
export function expiry(
  expiresOn: string | null,
  today = localDate(),
): { tone: ExpiryTone; label: string; days: number | null } {
  const t = formatT();
  if (!expiresOn) return { tone: 'none', label: t.noDate, days: null };
  const days = daysBetween(today, expiresOn);
  if (days < 0)
    return {
      tone: 'expired',
      label: days === -1 ? t.expiredYesterday : t.expiredAgo(-days),
      days,
    };
  if (days === 0) return { tone: 'today', label: t.today, days };
  if (days === 1) return { tone: 'soon', label: t.tomorrow, days };
  if (days <= 3) return { tone: 'soon', label: t.days(days), days };
  if (days <= 14) return { tone: 'later', label: t.days(days), days };
  if (days <= 120) return { tone: 'later', label: dayAndMonth(expiresOn), days };
  // Far off: months or years, never a bare date that reads like this year's.
  if (days < 365) return { tone: 'later', label: t.months(Math.round(days / 30)), days };
  return { tone: 'later', label: t.years(Math.floor(days / 365)), days };
}

// ---------------------------------------------------------------- money and words

/** "45.50 lei" for the kitchen's lei ("45,50 lei" in Romanian and Russian); other currencies through Intl. */
export function money(value: number, currency = 'MDL'): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  if (currency === 'MDL')
    return `${formatNumber(value, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} lei`;
  return new Intl.NumberFormat(intlLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
  }).format(value);
}

/**
 * A label table that always reads in the current language: `LABEL[key]` looks the word up when
 * it is read, so a table imported once still follows a change of language.
 */
function liveLabels<K extends string>(
  keys: readonly K[],
  read: () => Record<K, string>,
): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys)
    Object.defineProperty(out, key, { get: () => read()[key], enumerable: true });
  return out;
}

const LOCATIONS: readonly Location[] = [
  'fridge',
  'freezer',
  'pantry',
  'garden',
  'bathroom',
  'storage',
  'other',
];

export const LOCATION_LABEL: Record<Location, string> = liveLabels(
  LOCATIONS,
  () => formatT().location,
);

/** Where something is, inside a sentence: "in the fridge", "în frigider", "в холодильнике". */
export const locationIn = (location: Location) => formatT().locationIn[location];
/** Where something goes: "to the fridge", "în frigider", "в холодильник". */
export const locationTo = (location: Location) => formatT().locationTo[location];

export const CATEGORY_ORDER: Category[] = [
  'produce',
  'bakery',
  'meat',
  'fish',
  'dairy',
  'frozen',
  'pantry',
  'spices',
  'drinks',
  'snacks',
  'meals',
  'bathroom',
  'cleaning',
  'laundry',
  'paper',
  'pets',
  'household',
  'other',
];

export const CATEGORY_LABEL: Record<Category, string> = liveLabels(
  CATEGORY_ORDER,
  () => formatT().category,
);

/** The house's kinds of things; everything else is food. */
export const HOUSE_CATEGORIES: readonly Category[] = [
  'bathroom',
  'cleaning',
  'laundry',
  'paper',
  'pets',
  'household',
];
export const areaOf = (category: Category): 'food' | 'house' =>
  HOUSE_CATEGORIES.includes(category) ? 'house' : 'food';

export const SLOT_LABEL: Record<Slot, string> = liveLabels(
  ['breakfast', 'lunch', 'snack', 'dinner'] as const,
  () => formatT().slot,
);
export const SLOT_TIME: Record<Slot, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  snack: '16:30',
  dinner: '19:00',
};

/**
 * English only ("3 items"): screens use plural() from '@/i18n' with their own words. Kept for the
 * places not translated yet.
 */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "1,3" and "1.3" both mean 1.3. */
export function parseAmount(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
}

/** An ingredient's alternative as people say it: "whipped cream", "syrup (caramel)". */
export const altLabel = (alt: {
  name: string;
  variant: string;
  translations?: Translations | null;
}) => {
  const name = trText(alt.name, alt.translations).toLowerCase();
  const kind = alt.variant ? trText(alt.variant, alt.translations, 'variant').toLowerCase() : '';
  return `${name}${kind ? ` (${kind})` : ''}`;
};

/** "Coca-Cola" + "Zero" → "Coca-Cola Zero" for brands that print the kind in the name; else the name. */
export function kindName(
  name: string,
  variant: string | null | undefined,
  kindInName: boolean | undefined,
): string {
  const kind = variant?.trim();
  if (!kindInName || !kind || /^(classic|original|regular)$/i.test(kind)) return name;
  return `${name} ${kind}`;
}

/**
 * kindName in the current language: the item's translated name, and its kind (translated where
 * the catalog names it) when the brand prints it ("Coca-Cola Zero"). `kind` overrides the kind's
 * shown word (a shopping line's own translation).
 */
export function localKindName(
  item: {
    name: string;
    kindInName?: boolean;
    variants?: string[];
    translations?: Translations | null;
  },
  variant: string | null | undefined,
  kind?: string,
): string {
  const own = item.translations?.[getLocale()]?.name;
  const name = typeof own === 'string' && own.trim() ? own : item.name;
  if (!variant || kindName(item.name, variant, item.kindInName) === item.name) return name;
  return `${name} ${kind ?? kindText(variant, item)}`;
}

/**
 * A kind ("Penne", "Lime", "2.5%") in the current language, from the item's translations: an
 * array beside its `variants` (`ro.variants[i]` names `variants[i]`), or a map by kind. Kinds
 * without a translation (brands, most of them) read as they are.
 */
export function kindText(
  variant: string,
  source?: { variants?: string[]; translations?: Translations | null } | null,
): string {
  const kind = variant.trim();
  if (!kind) return variant;
  const own = source?.translations?.[getLocale()];
  const names = own?.variants ?? own?.kinds;
  let text: unknown;
  if (Array.isArray(names)) {
    const index = (source?.variants ?? []).findIndex((v) => v.toLowerCase() === kind.toLowerCase());
    text = index >= 0 ? names[index] : undefined;
  } else if (names && typeof names === 'object') {
    const map = names as Record<string, unknown>;
    text =
      map[kind] ?? Object.entries(map).find(([k]) => k.toLowerCase() === kind.toLowerCase())?.[1];
  }
  return typeof text === 'string' && text.trim() ? text : variant;
}

/**
 * A row's own kind (a lot, a shopping line) in the current language: its `variant` translation
 * when the API sent one, else looked up on the item it is of.
 */
export function kindOf(
  row: { variant: string; translations?: Translations | null },
  source?: { variants?: string[]; translations?: Translations | null } | null,
): string {
  const own = row.translations?.[getLocale()]?.variant;
  return typeof own === 'string' && own.trim() ? own : kindText(row.variant, source);
}

/** The one kind everything in stock is (all Zero, all Penne), or null when mixed or unsaid. */
export function stockKind(lots: ReadonlyArray<{ variant: string }>): string | null {
  const kinds = new Set(lots.map((lot) => lot.variant.trim().toLowerCase()));
  const kind = lots[0]?.variant.trim();
  return kinds.size === 1 && kind ? kind : null;
}

/**
 * A field of a record in the current language, from translations given beside it ("storeName" +
 * "storeTranslations"): the translated field, else what was written.
 */
export function trText(
  text: string,
  translations: Translations | null | undefined,
  field = 'name',
): string {
  const own = translations?.[getLocale()]?.[field];
  return typeof own === 'string' && own.trim() ? own : text;
}

/** A store's name in the current language ("Piața Centrală" → "Центральный рынок"). */
export const storeText = (
  name: string | null | undefined,
  translations: Translations | null | undefined,
): string => (name ? trText(name, translations) : '');

const placeWord = (place: string | undefined) =>
  place && place in LOCATION_LABEL ? LOCATION_LABEL[place as Location] : (place ?? '');

/**
 * A note on a piece or in the history, in the current language: the server's notes by their key
 * ("Poured out", "fridge → freezer, keeps until …"), else what was written.
 */
export function noteText(row: {
  note: string;
  noteKey?: NoteKey | null;
  noteValues?: Record<string, string> | null;
}): string {
  const words = formatT().note;
  const v = row.noteValues ?? {};
  switch (row.noteKey) {
    case 'nowByLevel':
    case 'itemRemoved':
    case 'removed':
    case 'pouredOut':
    case 'pouredIn':
    case 'undone':
      return words[row.noteKey];
    case 'reopened':
      return v.meal ? words.reopened(v.meal) : row.note;
    case 'moved':
      return v.from && v.to
        ? words.moved(
            placeWord(v.from),
            placeWord(v.to),
            v.until ? dayAndMonth(v.until) : undefined,
          )
        : row.note;
    case 'level':
      return (v.level && words.level[v.level]) || row.note;
    case 'leftoversFrom':
      return v.meal && v.date ? words.leftoversFrom(v.meal, dayAndMonth(v.date)) : row.note;
    default:
      return row.note;
  }
}
