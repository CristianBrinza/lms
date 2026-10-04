import { toBase, type Measured } from './format';
import type { Meal, Nutrients, NutritionEntry } from './types';

/**
 * Nutrition as it reads on screen ("1 240 kcal", "per 100 g", "4.5 g") and the sums the app
 * previews before it saves. The maths mirrors the API (backend/src/modules/food/nutrition.ts and
 * training/energy.ts), so what the app shows is what the day's energy will count.
 */

export const PER_LABEL: Record<NutritionEntry['per'], string> = {
  '100g': 'per 100 g',
  '100ml': 'per 100 ml',
  piece: 'per piece',
};

/** "1 240": whole kcal, thousands apart by a narrow space. */
export function formatKcal(kcal: number): string {
  return String(Math.round(kcal)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "12 g", "4.5 g", "0.3 g": grams to one decimal under 10, whole above. */
export function formatGrams(grams: number): string {
  const value = grams >= 10 ? Math.round(grams) : Math.round(grams * 10) / 10;
  return `${value} g`;
}

/** A typed value: "4,5" and "4.5" both mean 4.5; 0 is a value (Cola Zero); empty or junk is null. */
export function parseNutrient(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** The values for one kind (any case), else the item's own. */
export function kindValues(entry: NutritionEntry, kind: string | null | undefined): Nutrients {
  if (kind && entry.kinds) {
    const wanted = kind.toLowerCase();
    const found = Object.entries(entry.kinds).find(([name]) => name.toLowerCase() === wanted);
    if (found) return found[1];
  }
  return entry.base;
}

/** What an amount of an item holds, or null when it can't be told (no piece weight). */
export function nutrientsIn(
  entry: NutritionEntry,
  product: Measured,
  amount: number,
  unit: string,
  kind?: string | null,
): Nutrients | null {
  const base = toBase(amount, unit, product);
  if (!Number.isFinite(base)) return null;
  let factor: number | null;
  if (entry.per === 'piece')
    factor = product.unit === 'pcs' ? base : product.pieceSize ? base / product.pieceSize : null;
  else {
    const grams =
      product.unit === 'pcs' ? (product.pieceSize ? base * product.pieceSize : null) : base;
    factor = grams === null ? null : grams / 100;
  }
  if (factor === null) return null;
  const values = kindValues(entry, kind);
  const out = {} as Nutrients;
  for (const [key, value] of Object.entries(values) as Array<[keyof Nutrients, number]>)
    out[key] = value * factor;
  return out;
}

type EatenMeal = Pick<Meal, 'status' | 'servings' | 'eaters' | 'doneBy' | 'eatenOut' | 'nutrition'>;

/**
 * Whether a meal counts for a person: they're named; or no one is and there was a serving each
 * (everyone ate); or no one is and they marked it eaten.
 */
export function ateIt(meal: EatenMeal, userId: string, household: number): boolean {
  if (meal.eaters.length) return meal.eaters.includes(userId);
  return meal.servings >= household || meal.doneBy === userId;
}

/** One person's kcal from a meal: eaten out, the kcal given; else their share of the whole. */
export function kcalShare(meal: EatenMeal): number {
  if (meal.eatenOut) return meal.eatenOut.kcal ?? 0;
  return meal.nutrition.total.kcal / Math.max(1, meal.servings, meal.eaters.length);
}

/** What a person ate of a day's meals (eaten ones only), and how many meals that was. */
export function eatenBy(
  meals: EatenMeal[],
  userId: string,
  household: number,
): { kcal: number; meals: number } {
  const mine = meals.filter((m) => m.status === 'done' && ateIt(m, userId, household));
  return { kcal: Math.round(mine.reduce((sum, m) => sum + kcalShare(m), 0)), meals: mine.length };
}

/** A serving's kcal, when known: eaten out, as given; cooked, when some of it has values. */
export function kcalEach(meal: Pick<Meal, 'eatenOut' | 'nutrition'>): number | null {
  if (meal.eatenOut) return meal.eatenOut.kcal;
  return meal.nutrition.known ? meal.nutrition.perServing.kcal : null;
}

/** "32 g protein · 20 g fat · 55 g carbs" (and sugar, fibre, salt when known and asked for). */
export function macroText(n: Nutrients, extras = false): string {
  const parts = [
    `${formatGrams(n.protein)} protein`,
    `${formatGrams(n.fat)} fat`,
    `${formatGrams(n.carbs)} carbs`,
  ];
  if (extras)
    for (const key of EXTRA_KEYS)
      if (n[key] !== undefined)
        parts.push(`${formatGrams(n[key])} ${NUTRIENT_LABEL[key].toLowerCase()}`);
  return parts.join(' · ');
}

export const MAIN_KEYS = ['kcal', 'protein', 'fat', 'carbs'] as const;
export const EXTRA_KEYS = ['sugar', 'fiber', 'salt'] as const;
export const NUTRIENT_LABEL: Record<keyof Nutrients, string> = {
  kcal: 'Energy',
  protein: 'Protein',
  fat: 'Fat',
  carbs: 'Carbs',
  sugar: 'Sugar',
  fiber: 'Fibre',
  salt: 'Salt',
};

/** The editor's fields, as typed. */
export type NutrientForm = Partial<Record<keyof Nutrients, string>>;

export function formFrom(n: Nutrients | undefined): NutrientForm {
  if (!n) return {};
  return Object.fromEntries(Object.entries(n).map(([key, value]) => [key, String(value)]));
}

/**
 * Typed fields as values: 'empty' when nothing is filled in (a kind left alone), 'missing' when
 * energy, protein, fat or carbs is blank or not a number; sugar, fibre and salt are optional.
 */
export function readForm(form: NutrientForm): Nutrients | 'empty' | 'missing' {
  if (Object.values(form).every((text) => !text?.trim())) return 'empty';
  const out = {} as Nutrients;
  for (const key of MAIN_KEYS) {
    const value = parseNutrient(form[key] ?? '');
    if (value === null) return 'missing';
    out[key] = value;
  }
  for (const key of EXTRA_KEYS) {
    const value = parseNutrient(form[key] ?? '');
    if (value !== null) out[key] = value;
  }
  return out;
}
