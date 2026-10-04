import type { BaseUnit, Category, CustomUnit, Location, Slot, Unit } from './types';

/**
 * How food reads on screen: "1.3 kg", "3 pcs", "Expires tomorrow", "45.50 lei". The unit maths
 * mirrors the API (backend/src/modules/food/units.ts) so the app can preview before it saves.
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

const number = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.5': '½', '0.75': '¾' };

/** "1.3 kg", "300 g", "3 pcs", "½ pc" from an amount in a unit. */
export function formatAmount(amount: number, unit: string): string {
  if (!(unit in FACTOR)) {
    // The item's own unit: "1 slice", "3 slices", "½ pack".
    const fraction = FRACTIONS[String(round(amount))];
    const noun = amount === 1 || fraction ? unit : unit.endsWith('s') ? unit : `${unit}s`;
    return `${fraction ?? number.format(amount)} ${noun}`;
  }
  if (unit === 'pcs') {
    const fraction = FRACTIONS[String(round(amount))];
    if (fraction) return `${fraction} pc`;
    return `${number.format(amount)} ${amount === 1 ? 'pc' : 'pcs'}`;
  }
  return `${number.format(amount)} ${unit}`;
}

/** What a lot came in: "Jar of 400 g", "2 bottles of 500 ml" (null when loose). */
export function packageLabel(
  lot: { package: string; packageSize: number | null; initialQuantity: number },
  product: Pick<Measured, 'unit' | 'units'>,
): string | null {
  if (!lot.package) return null;
  const name = lot.package.charAt(0).toUpperCase() + lot.package.slice(1);
  if (!lot.packageSize) return name;
  const count = Math.max(1, Math.round(lot.initialQuantity / lot.packageSize));
  const own = product.units?.find((u) => u.name === lot.package);
  const many = own?.plural ?? `${lot.package}s`;
  return count > 1
    ? `${count} ${many} of ${formatQty(lot.packageSize, product)}`
    : `${name} of ${formatQty(lot.packageSize, product)}`;
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
  if (piece)
    return formatAmount(round(base), base === 1 ? piece.name : (piece.plural ?? piece.name));
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

const shortDay = new Intl.DateTimeFormat('en', { weekday: 'short' });
const dayMonth = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' });
const longDay = new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long' });

export const weekdayShort = (day: string) => shortDay.format(parseDay(day));
export const dayAndMonth = (day: string) => dayMonth.format(parseDay(day));
export const dayLong = (day: string) => longDay.format(parseDay(day));

/** "Today", "Tomorrow", "Yesterday", else "Mon, 5 Oct". */
export function relativeDay(day: string, today = localDate()): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return `${weekdayShort(day)}, ${dayAndMonth(day)}`;
}

/** relativeDay inside a sentence: "today", "tomorrow", but "Tue, Oct 6" keeps its capitals. */
export function relativeDayInline(day: string, today = localDate()): string {
  const label = relativeDay(day, today);
  return /^(Today|Tomorrow|Yesterday)$/.test(label) ? label.toLowerCase() : label;
}

export type ExpiryTone = 'expired' | 'today' | 'soon' | 'later' | 'none';

/** How close a best-before is: expired, today, within three days, later, or no date. */
export function expiry(
  expiresOn: string | null,
  today = localDate(),
): { tone: ExpiryTone; label: string; days: number | null } {
  if (!expiresOn) return { tone: 'none', label: 'No date', days: null };
  const days = daysBetween(today, expiresOn);
  if (days < 0)
    return {
      tone: 'expired',
      label: days === -1 ? 'Expired yesterday' : `Expired ${-days} days ago`,
      days,
    };
  if (days === 0) return { tone: 'today', label: 'Today', days };
  if (days === 1) return { tone: 'soon', label: 'Tomorrow', days };
  if (days <= 3) return { tone: 'soon', label: `${days} days`, days };
  if (days <= 14) return { tone: 'later', label: `${days} days`, days };
  if (days <= 120) return { tone: 'later', label: dayAndMonth(expiresOn), days };
  // Far off: months or years, never a bare date that reads like this year's.
  if (days < 365) return { tone: 'later', label: `${Math.round(days / 30)} months`, days };
  const years = Math.floor(days / 365);
  return { tone: 'later', label: years === 1 ? '1 year' : `${years} years`, days };
}

// ---------------------------------------------------------------- money and words

/** "45.50 lei" for the kitchen's lei; other currencies through Intl. */
export function money(value: number, currency = 'MDL'): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  if (currency === 'MDL') return `${value.toFixed(decimals)} lei`;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
  }).format(value);
}

export const LOCATION_LABEL: Record<Location, string> = {
  fridge: 'Fridge',
  freezer: 'Freezer',
  pantry: 'Shelf',
  garden: 'Garden',
  bathroom: 'Bathroom',
  storage: 'Storage',
  other: 'Other',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  produce: 'Fruit & veg',
  bakery: 'Bakery',
  meat: 'Meat',
  fish: 'Fish',
  dairy: 'Dairy & eggs',
  frozen: 'Frozen',
  pantry: 'Pantry',
  spices: 'Spices & sauces',
  drinks: 'Drinks',
  snacks: 'Snacks',
  meals: 'Ready meals',
  bathroom: 'Bathroom',
  cleaning: 'Cleaning',
  laundry: 'Laundry',
  paper: 'Paper',
  pets: 'Pets',
  household: 'Household',
  other: 'Other',
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as Category[];

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

export const SLOT_LABEL: Record<Slot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};
export const SLOT_TIME: Record<Slot, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  snack: '16:30',
  dinner: '19:00',
};

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** "1,3" and "1.3" both mean 1.3. */
export function parseAmount(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
}

/** An ingredient's alternative as people say it: "whipped cream", "syrup (caramel)". */
export const altLabel = (alt: { name: string; variant: string }) =>
  `${alt.name.toLowerCase()}${alt.variant ? ` (${alt.variant.toLowerCase()})` : ''}`;

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

/** The one kind everything in stock is (all Zero, all Penne), or null when mixed or unsaid. */
export function stockKind(lots: ReadonlyArray<{ variant: string }>): string | null {
  const kinds = new Set(lots.map((lot) => lot.variant.trim().toLowerCase()));
  const kind = lots[0]?.variant.trim();
  return kinds.size === 1 && kind ? kind : null;
}
