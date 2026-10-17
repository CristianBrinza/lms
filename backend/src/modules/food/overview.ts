import type { Translations } from '../../lib/i18n';
import { onlyFields } from './catalog-i18n';
import type { FoodCtx } from './kitchen';
import { listMeals, type Meal } from './meals';
import type { FoodIcon } from './presets';
import { listRecipes } from './recipes';
import { listShopping } from './shopping';
import { kitchen, localDate } from './stock';
import { listStores } from './stores';
import type { BaseUnit } from './units';

/** The Food home in one request: what to use soon, what ran low, the lists, and today's meals. */

export interface FoodOverview {
  kitchen: { name: string; currency: string };
  stock: {
    products: number;
    expiring: Array<{
      lotId: string;
      productId: string;
      name: string;
      /** Its name in other languages ({ ro: { name } }). */
      translations: Translations;
      icon: FoodIcon;
      quantity: number;
      unit: BaseUnit;
      expiresOn: string;
    }>;
    expired: number;
    /** Started packages (an opened can, a cut cake): use these first, so nothing is thrown away. */
    opened: Array<{
      lotId: string;
      productId: string;
      name: string;
      /** Its name in other languages ({ ro: { name } }). */
      translations: Translations;
      icon: FoodIcon;
      quantity: number;
      unit: BaseUnit;
      expiresOn: string | null;
      location: string;
      package: string;
      /** Recipes that use it. */
      recipes: number;
    }>;
    low: Array<{
      productId: string;
      name: string;
      /** Its name in other languages ({ ro: { name } }). */
      translations: Translations;
      icon: FoodIcon;
      total: number;
      minStock: number;
      unit: BaseUnit;
      level: 'full' | 'low' | 'out' | null;
    }>;
  };
  recipes: { total: number; ready: number; favorites: number };
  shopping: {
    open: number;
    inCart: number;
    stores: Array<{
      id: string;
      name: string;
      tone: string;
      open: number;
      translations: Translations;
    }>;
    anyStore: number;
  };
  meals: { today: Meal[]; upcoming: Meal[]; plannedThisWeek: number };
}

/** The front page of Food (area food) or of the House (area house): each its own items and list lines. */
export async function overview(
  ctx: FoodCtx,
  today = localDate(ctx.now),
  area: 'food' | 'house' = 'food',
): Promise<FoodOverview> {
  const day = new Date(`${today}T12:00:00`);
  const soon = localDate(day, 3);
  const weekEnd = localDate(day, 6);
  const [{ rows: kitchenRow }, products, recipes, items, stores, meals] = await Promise.all([
    ctx.db.query<{ name: string; currency: string }>(
      'SELECT name, currency FROM households WHERE id = $1',
      [ctx.actor.householdId],
    ),
    kitchen(ctx, { area }),
    listRecipes(ctx),
    listShopping(ctx).then((list) => list.filter((item) => item.area === area)),
    listStores(ctx),
    listMeals(ctx, today, weekEnd),
  ]);

  const expiring = products
    .flatMap((product) =>
      product.lots
        .filter((lot) => lot.expiresOn && lot.expiresOn <= soon)
        .map((lot) => ({
          lotId: lot.id,
          productId: product.id,
          name: product.name,
          translations: onlyFields(product.translations, ['name']),
          icon: product.icon,
          quantity: lot.quantity,
          unit: product.unit,
          expiresOn: lot.expiresOn!,
        })),
    )
    .sort((a, b) => a.expiresOn.localeCompare(b.expiresOn));

  const usedIn = new Map<string, number>();
  for (const recipe of recipes)
    for (const id of new Set(recipe.ingredients.map((i) => i.productId).filter(Boolean)))
      usedIn.set(id!, (usedIn.get(id!) ?? 0) + 1);
  const opened = products
    .flatMap((product) =>
      product.lots
        // Packages, or things that keep less once opened: a started tomato or steak isn't "opened".
        .filter(
          (lot) =>
            lot.openedAt &&
            lot.quantity > 0 &&
            product.trackMode === 'exact' &&
            (lot.package || product.openedDays),
        )
        .map((lot) => ({
          lotId: lot.id,
          productId: product.id,
          name: product.name,
          translations: onlyFields(product.translations, ['name']),
          icon: product.icon,
          quantity: lot.quantity,
          unit: product.unit,
          expiresOn: lot.expiresOn,
          location: lot.location,
          package: lot.package,
          recipes: usedIn.get(product.id) ?? 0,
        })),
    )
    .sort((a, b) => (a.expiresOn ?? '9999').localeCompare(b.expiresOn ?? '9999'));

  return {
    kitchen: kitchenRow[0] ?? { name: 'Kitchen', currency: 'MDL' },
    stock: {
      products: products.filter(
        (p) => p.total > 0 || (p.trackMode === 'level' && p.level !== 'out'),
      ).length,
      expiring: expiring.slice(0, 12),
      expired: expiring.filter((lot) => lot.expiresOn < today).length,
      opened: opened.slice(0, 12),
      low: products
        .filter((p) => p.low)
        .map((p) => ({
          productId: p.id,
          name: p.name,
          translations: onlyFields(p.translations, ['name']),
          icon: p.icon,
          total: p.total,
          minStock: p.minStock ?? 0,
          unit: p.unit,
          level: p.trackMode === 'level' ? p.level : null,
        })),
    },
    recipes: {
      total: recipes.length,
      ready: recipes.filter((r) => r.availability.ready).length,
      favorites: recipes.filter((r) => r.favorite).length,
    },
    shopping: {
      open: items.filter((i) => !i.checked).length,
      inCart: items.filter((i) => i.checked).length,
      stores: stores.map((s) => ({
        id: s.id,
        name: s.name,
        tone: s.tone,
        open: s.open,
        translations: s.translations,
      })),
      anyStore: items.filter((i) => !i.storeId && !i.checked).length,
    },
    meals: {
      today: meals.filter((m) => m.date === today),
      upcoming: meals.filter((m) => m.date > today && m.status === 'planned').slice(0, 5),
      plannedThisWeek: meals.filter((m) => m.status === 'planned').length,
    },
  };
}
