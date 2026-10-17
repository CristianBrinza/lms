import type { FoodCtx } from '../food/kitchen';
import { drinkPhotos } from './photos';
import { familyOf, findDrink, householdPeople, listDrinks, priceHistory } from './drinks';
import { drinkTastings, insights } from './tastings';

/** A drink's page: the drink, its photos, every tasting, what they add up to, its family. */
export async function drinkDetail(ctx: FoodCtx, id: string) {
  const drink = await findDrink(ctx, id);
  const tastings = await drinkTastings(ctx, id);
  return {
    drink,
    photos: await drinkPhotos(ctx, id),
    tastings,
    insights: insights(tastings),
    prices: await priceHistory(ctx, id),
    family: await familyOf(ctx, drink),
    people: await householdPeople(ctx),
  };
}

/** The whole journal in numbers: most loved, by kind and country, countries, this year. */
export async function drinkStats(ctx: FoodCtx) {
  const { householdId } = ctx.actor;
  const year = ctx.now.getFullYear();
  const drinks = await listDrinks(ctx, { sort: 'rating' });
  const tried = drinks.filter((d) => d.tastings > 0);

  const { rows: years } = await ctx.db.query<{ year: number; tastings: number; drinks: number }>(
    `SELECT extract(year FROM tasted_on)::int AS year, count(*)::int AS tastings,
        count(DISTINCT drink_id)::int AS drinks
       FROM drink_tastings WHERE household_id = $1 GROUP BY 1 ORDER BY 1`,
    [householdId],
  );
  const { rows: places } = await ctx.db.query<{ country: string; tastings: number }>(
    `SELECT country, count(*)::int AS tastings FROM drink_tastings
      WHERE household_id = $1 AND country <> '' GROUP BY 1 ORDER BY 2 DESC, 1`,
    [householdId],
  );
  const { rows: thisYear } = await ctx.db.query<{
    drink_id: string;
    rating: number | null;
    first: boolean;
  }>(
    `SELECT t.drink_id, avg(t.rating)::float AS rating,
        min(t.tasted_on) = (SELECT min(x.tasted_on) FROM drink_tastings x WHERE x.drink_id = t.drink_id)
          AS first
       FROM drink_tastings t
      WHERE t.household_id = $1 AND extract(year FROM t.tasted_on) = $2
      GROUP BY t.drink_id`,
    [householdId, year],
  );
  const { rows: people } = await ctx.db.query<{
    id: string;
    name: string;
    tastings: number;
    rating: number | null;
  }>(
    `SELECT u.id, u.name, count(*)::int AS tastings, avg(t.rating)::float AS rating
       FROM drink_tastings t JOIN users u ON u.id = t.user_id
      WHERE t.household_id = $1 GROUP BY u.id, u.name ORDER BY 3 DESC`,
    [householdId],
  );

  const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
  const group = <K extends string>(key: (d: (typeof drinks)[number]) => K) => {
    const map = new Map<K, { drinks: number; tastings: number; sum: number; rated: number }>();
    for (const drink of drinks) {
      const k = key(drink);
      const entry = map.get(k) ?? { drinks: 0, tastings: 0, sum: 0, rated: 0 };
      entry.drinks += 1;
      entry.tastings += drink.tastings;
      if (drink.rating !== null) {
        entry.sum += drink.rating;
        entry.rated += 1;
      }
      map.set(k, entry);
    }
    return [...map.entries()]
      .map(([k, v]) => ({
        key: k,
        drinks: v.drinks,
        tastings: v.tastings,
        rating: v.rated ? round(v.sum / v.rated) : null,
      }))
      .sort((a, b) => b.drinks - a.drinks || b.tastings - a.tastings);
  };
  const byId = new Map(drinks.map((d) => [d.id, d]));
  const yearTop = thisYear
    .filter((row) => row.rating !== null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 5)
    .map((row) => ({ drink: byId.get(row.drink_id)!, rating: round(row.rating) }))
    .filter((row) => row.drink);

  return {
    totals: {
      drinks: drinks.length,
      tried: tried.length,
      tastings: years.reduce((sum, y) => sum + y.tastings, 0),
      bottles: drinks.reduce((sum, d) => sum + d.stock, 0),
      inCellar: drinks.filter((d) => d.stock > 0).length,
      wanted: drinks.filter((d) => d.wanted).length,
      countries: new Set(tried.map((d) => d.country).filter(Boolean)).size,
      tastedIn: places.length,
    },
    mostLoved: tried.filter((d) => d.rating !== null).slice(0, 8),
    byCategory: group((d) => d.category).map(({ key, ...rest }) => ({ category: key, ...rest })),
    byCountry: group((d) => d.country)
      .filter((g) => g.key)
      .map(({ key, ...rest }) => ({ country: key, ...rest })),
    tastedIn: places,
    years: years.map((y) => ({ year: y.year, tastings: y.tastings, drinks: y.drinks })),
    thisYear: {
      year,
      tastings: years.find((y) => y.year === year)?.tastings ?? 0,
      drinks: thisYear.length,
      firsts: thisYear.filter((row) => row.first).length,
      top: yearTop,
    },
    people: people.map((p) => ({ ...p, rating: round(p.rating) })),
  };
}
