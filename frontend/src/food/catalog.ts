import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { Translations } from '@/i18n';
import { foodApi, foodKeys } from './api';
import type { BaseUnit, Category, CustomUnit, Location, Preset, Product, TrackMode } from './types';

/** The kitchen's item list and the built-in food catalog, searched the way the API matches names. */

/** What a pick carries: an existing item (productId), a catalog food, or a brand-new name. */
export interface PickedProduct {
  productId?: string;
  name: string;
  icon: string;
  category: Category;
  unit: BaseUnit;
  pieceSize: number | null;
  pieceUnit: 'g' | 'ml' | null;
  location: Location;
  shelfLifeDays: number | null;
  units: CustomUnit[];
  variants: string[];
  variantIcons?: Record<string, string>;
  trackMode: TrackMode;
  /** The type picked with it ("guava juice": Juice, Guava). */
  variant?: string;
  /** Neither in the kitchen nor in the catalog: the person says how it is counted. */
  isNew?: boolean;
  /** What it holds, when known (the kitchen's items). */
  nutrition?: Product['nutrition'];
  /** Its name (and kinds) in other languages: shown with tr(); `name` stays the key sent to the API. */
  translations?: Translations;
}

/** Every name a row goes by: as written and in each language ("Tomatoes", "Roșii", "Помидоры"). */
export function namesOf(row: { name: string; translations?: Translations | null }): string[] {
  const names = [row.name];
  for (const fields of Object.values(row.translations ?? {})) {
    const name = fields?.name;
    if (typeof name === 'string' && name.trim()) names.push(name);
  }
  return names;
}

export const COMMON = [
  'Tomatoes',
  'Cucumbers',
  'Eggs',
  'Milk',
  'Bread',
  'Chicken breast',
  'Beef steak',
  'Potatoes',
  'Onions',
  'Apples',
  'Cheese',
  'Water',
];

/** Lowercase, no diacritics, punctuation as spaces: "Coca-Cola" and "coca cola" are the same (as in the API). */
export const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** tomato ↔ tomatoes, cherry ↔ cherries (the API matches the same way). */
export function sameName(a: string, b: string): boolean {
  const forms = (value: string) => {
    const base = normalize(value);
    const out = new Set([
      base,
      base.replace(/ies$/, 'y'),
      base.replace(/oes$/, 'o'),
      base.replace(/s$/, ''),
    ]);
    return out;
  };
  const left = forms(a);
  for (const form of forms(b)) if (left.has(form)) return true;
  return false;
}

export const fromProduct = (p: Product): PickedProduct => ({
  productId: p.id,
  name: p.name,
  icon: p.icon,
  category: p.category,
  unit: p.unit,
  pieceSize: p.pieceSize,
  pieceUnit: p.pieceUnit,
  location: p.location,
  shelfLifeDays: p.shelfLifeDays,
  units: p.units,
  variants: p.variants,
  variantIcons: p.variantIcons,
  trackMode: p.trackMode,
  nutrition: p.nutrition,
  translations: p.translations,
});

export const fromPreset = (p: Preset): PickedProduct => ({
  name: p.name,
  icon: p.icon,
  category: p.category,
  unit: p.unit,
  pieceSize: p.pieceSize ?? null,
  pieceUnit: p.pieceUnit ?? null,
  location: p.location,
  shelfLifeDays: p.shelfLifeDays ?? null,
  units: p.units ?? [],
  variants: p.variants ?? [],
  variantIcons: p.variantIcons,
  trackMode: p.track ?? 'exact',
  translations: p.translations,
});

export function usePresets() {
  return useQuery({
    queryKey: foodKeys.presets,
    queryFn: foodApi.presets,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useCatalog() {
  return useQuery({ queryKey: foodKeys.products(''), queryFn: () => foodApi.products('') });
}

/** Search the kitchen's items and the built-in catalog; offer the typed name as a new item. */
export function useProductSearch(query: string, limit = 8) {
  const catalog = useCatalog();
  const presets = usePresets();
  return useMemo(() => {
    const q = normalize(query);
    const products = catalog.data ?? [];
    // The kitchen's items, by name in any language or by what the catalog also calls them
    // ("roșii", "помидоры", "coca cola").
    const aliases = (name: string) =>
      (presets.data ?? []).find((p) => sameName(p.name, name))?.aliases ?? [];
    const own = products
      .filter(
        (p) =>
          !q ||
          namesOf(p).some((name) => normalize(name).includes(q) || sameName(name, query)) ||
          aliases(p.name).some((alias) => normalize(alias).includes(q)),
      )
      .map(fromProduct);
    const foods = (presets.data ?? [])
      .filter((p) => !products.some((mine) => sameName(mine.name, p.name)))
      .filter(
        (p) =>
          q &&
          (namesOf(p).some((name) => normalize(name).includes(q)) ||
            p.aliases?.some((alias) => normalize(alias).includes(q))),
      )
      .map(fromPreset);
    const results = [...own, ...foods].slice(0, limit);
    // Typed a known name or a catalog alias ("steak", "roșii"): nothing new to offer.
    const exact =
      q &&
      ([...own, ...foods].some((p) => namesOf(p).some((name) => sameName(name, query))) ||
        (presets.data ?? []).some((p) => p.aliases?.some((alias) => sameName(alias, query))));
    return {
      results,
      exact: Boolean(exact),
      loading: catalog.isPending || presets.isPending,
      products,
      presets: presets.data ?? [],
    };
  }, [catalog.data, catalog.isPending, presets.data, presets.isPending, query, limit]);
}
