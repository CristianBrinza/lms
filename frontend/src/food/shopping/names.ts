import { tr, type Translations } from '@/i18n';
import { kindName, kindOf } from '../format';
import type { ShoppingItem } from '../types';

type Item = { name: string; variants?: string[]; translations?: Translations | null };

/**
 * A line's name in the current language: its own translation when the API sent one, else the
 * linked item's (a line for "Tomatoes" reads "Roșii" when the item does).
 */
export function lineTitle(line: ShoppingItem, product?: Item | null): string {
  const own = tr(line, 'name');
  if (own !== line.name || !product || product.name !== line.name) return own;
  return tr(product, 'name');
}

/** The same with its kind when the brand prints it: "Coca-Cola Zero". */
export function lineName(line: ShoppingItem, product?: Item | null): string {
  const title = lineTitle(line, product);
  if (!line.variant || kindName(line.name, line.variant, line.kindInName) === line.name)
    return title;
  return `${title} ${kindOf(line, product)}`;
}
