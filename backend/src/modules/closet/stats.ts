import { householdPeople } from '../drinks/drinks';
import type { FoodCtx } from '../food/kitchen';
import { localDate } from '../food/stock';
import { findItem, listItems, resolveOwner, type Item } from './items';
import { listLooks } from './looks';
import { itemPhotos } from './photos';
import { listPlaces, pathText, placePath, placeTree } from './places';
import { OWNED_STATUSES } from './schemas';
import { listTrips } from './trips';
import { listWears } from './wears';

/** A piece's page, the closet in numbers, and the whole closet to take away (JSON or CSV). */

export async function itemDetail(ctx: FoodCtx, id: string) {
  const item = await findItem(ctx, id);
  const { photos, originals } = await itemPhotos(ctx, id);
  const places = placeTree(await listPlaces(ctx));
  const { rows: days } = await ctx.db.query<{ worn_on: string; planned: boolean }>(
    `SELECT worn_on::text, planned FROM closet_wears
      WHERE household_id = $1 AND item_ids @> ARRAY[$2::uuid] ORDER BY worn_on DESC LIMIT 400`,
    [ctx.actor.householdId, id],
  );
  const { rows: looks } = await ctx.db.query<{ id: string; name: string }>(
    `SELECT id, name FROM closet_looks
      WHERE household_id = $1 AND canvas->'items' @> jsonb_build_array(jsonb_build_object('itemId', $2::text))
      ORDER BY updated_at DESC`,
    [ctx.actor.householdId, id],
  );
  const { rows: trips } = await ctx.db.query<{ id: string; name: string; packed: boolean }>(
    `SELECT t.id, t.name, x.packed FROM closet_trip_items x JOIN closet_trips t ON t.id = x.trip_id
      WHERE x.item_id = $1 AND t.back_at IS NULL ORDER BY t.starts_on NULLS LAST`,
    [id],
  );
  return {
    item,
    photos,
    originals,
    placePath: placePath(places, item.placeId).map((p) => p.id),
    worn: days.filter((d) => !d.planned).map((d) => d.worn_on),
    planned: days.filter((d) => d.planned).map((d) => d.worn_on),
    looks,
    trips,
  };
}

const owned = (item: Item) => OWNED_STATUSES.includes(item.status);

export async function closetStats(ctx: FoodCtx, ownerParam?: string) {
  const owner = await resolveOwner(ctx, ownerParam);
  const items = await listItems(ctx, { owner });
  const mine = items.filter(owned);
  const currency = ctx.actor.currency;

  const today = localDate(ctx.now);
  const monthStart = `${today.slice(0, 8)}01`;
  const values: unknown[] = [ctx.actor.householdId, monthStart];
  if (owner !== 'all') values.push(owner);
  const { rows: months } = await ctx.db.query<{ month: string; days: number; pieces: number }>(
    `SELECT to_char(date_trunc('month', worn_on), 'YYYY-MM') AS month, count(*)::int AS days,
        coalesce(sum(cardinality(item_ids)), 0)::int AS pieces
       FROM closet_wears
      WHERE household_id = $1 AND NOT planned AND worn_on >= ($2::date - interval '11 months')
        ${owner === 'all' ? '' : 'AND owner_id = $3'}
      GROUP BY 1 ORDER BY 1`,
    values,
  );

  const count = <K extends string>(keys: (item: Item) => K[]) => {
    const map = new Map<K, number>();
    for (const item of mine) for (const key of keys(item)) map.set(key, (map.get(key) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  // Material mix: each piece counts once, split by its label's percentages (evenly when none).
  const materials = new Map<string, number>();
  for (const item of mine) {
    if (!item.materials.length) continue;
    const known = item.materials.reduce((sum, m) => sum + (m.percent ?? 0), 0);
    const share = (m: Item['materials'][number]) =>
      known > 0 ? (m.percent ?? 0) / Math.max(known, 100) : 1 / item.materials.length;
    for (const m of item.materials) materials.set(m.material, (materials.get(m.material) ?? 0) + share(m));
  }

  const priced = mine.filter((i) => i.price !== null && i.currency === currency);
  const worn = mine.filter((i) => i.wears > 0);
  const brief = (i: Item) => i.id;
  const thisMonth = months.find((m) => m.month === today.slice(0, 7));

  return {
    owner,
    currency,
    totals: {
      pieces: mine.length,
      value: Math.round(priced.reduce((sum, i) => sum + (i.price ?? 0), 0) * 100) / 100,
      priced: priced.length,
      otherCurrencies: mine.filter((i) => i.price !== null && i.currency !== currency).length,
      wears: mine.reduce((sum, i) => sum + i.wears, 0),
      daysThisMonth: thisMonth?.days ?? 0,
      piecesThisMonth: thisMonth?.pieces ?? 0,
      neverWorn: mine.filter((i) => i.wears === 0).length,
      toWash: items.filter((i) => i.status === 'to_wash').length,
      lent: items.filter((i) => i.status === 'lent').length,
      wishlist: items.filter((i) => i.status === 'wishlist').length,
      needsDetails: mine.filter((i) => i.needsDetails).length,
    },
    colors: count((i) => i.colors.slice(0, 1)).map(([color, pieces]) => ({ color, pieces })),
    categories: count((i) => (i.category ? [i.category] : [])).map(([category, pieces]) => ({
      category,
      pieces,
    })),
    materials: [...materials.entries()]
      .map(([material, share]) => ({ material, pieces: Math.round(share * 10) / 10 }))
      .sort((a, b) => b.pieces - a.pieces),
    mostWorn: [...worn].sort((a, b) => b.wears - a.wears).slice(0, 8).map(brief),
    leastWorn: [...worn].sort((a, b) => a.wears - b.wears).slice(0, 8).map(brief),
    neverWorn: mine.filter((i) => i.wears === 0).map(brief),
    bestValue: mine
      .filter((i) => i.costPerWear !== null && i.currency === currency)
      .sort((a, b) => a.costPerWear! - b.costPerWear!)
      .slice(0, 8)
      .map(brief),
    months: months.map((m) => ({ month: m.month, days: m.days, pieces: m.pieces })),
  };
}

// ---------------------------------------------------------------- export

const CSV_COLUMNS = [
  'id',
  'owner',
  'name',
  'category',
  'subcategory',
  'colors',
  'materials',
  'size',
  'sizeSystem',
  'brand',
  'price',
  'currency',
  'boughtOn',
  'store',
  'seasons',
  'occasions',
  'fit',
  'condition',
  'issues',
  'status',
  'lentTo',
  'place',
  'storage',
  'wears',
  'lastWorn',
  'costPerWear',
  'care',
  'storageAdvice',
  'madeIn',
  'tags',
  'notes',
  'url',
  'createdAt',
] as const;

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  // A cell starting like a formula is kept as text when a spreadsheet opens it.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Everything of a person's closet (or the household's), to keep or move elsewhere. */
export async function exportCloset(ctx: FoodCtx, ownerParam: string | undefined, format: 'json' | 'csv') {
  const owner = await resolveOwner(ctx, ownerParam);
  const items = await listItems(ctx, { owner });
  const places = await listPlaces(ctx);
  const tree = placeTree(places);
  const people = await householdPeople(ctx);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? '';

  if (format === 'csv') {
    const rows = items.map((item) => {
      const row: Record<(typeof CSV_COLUMNS)[number], unknown> = {
        id: item.id,
        owner: name(item.ownerId),
        name: item.name,
        category: item.category,
        subcategory: item.subcategory,
        colors: item.colors.join(' '),
        materials: item.materials
          .map((m) => (m.percent ? `${m.percent}% ${m.material}` : m.material))
          .join(', '),
        size: item.size,
        sizeSystem: item.sizeSystem,
        brand: item.brand,
        price: item.price,
        currency: item.currency,
        boughtOn: item.boughtOn,
        store: item.store,
        seasons: item.seasons.join(' '),
        occasions: item.occasions.join(' '),
        fit: item.fit,
        condition: item.condition,
        issues: item.issues.join(' '),
        status: item.status,
        lentTo: item.lentTo,
        place: pathText(tree, item.placeId),
        storage: item.storage,
        wears: item.wears,
        lastWorn: item.lastWorn,
        costPerWear: item.costPerWear,
        care: item.care ? JSON.stringify(item.care) : '',
        storageAdvice: item.storageAdvice,
        madeIn: item.madeIn,
        tags: item.tags.join(' '),
        notes: item.notes,
        url: item.url,
        createdAt: item.createdAt,
      };
      return CSV_COLUMNS.map((column) => csvCell(row[column])).join(',');
    });
    // A byte-order mark first, so spreadsheets read the names' diacritics right.
    return { csv: `${String.fromCharCode(0xfeff)}${CSV_COLUMNS.join(',')}\r\n${rows.join('\r\n')}\r\n` };
  }

  const { looks } = await listLooks(ctx, owner === 'all' ? 'all' : owner);
  const { wears } = await listWears(ctx, { owner: owner === 'all' ? 'all' : owner });
  const { trips } = await listTrips(ctx, owner === 'all' ? 'all' : owner);
  return {
    json: {
      format: 'lms-closet',
      version: 1,
      exportedAt: ctx.now.toISOString(),
      owner: owner === 'all' ? 'all' : { id: owner, name: name(owner) },
      people: people.map((p) => ({ id: p.id, name: p.name, surname: p.surname })),
      places: places.map((p) => ({ ...p, path: pathText(tree, p.id) })),
      items: items.map((item) => ({ ...item, place: pathText(tree, item.placeId) })),
      looks,
      wears,
      trips,
    },
  };
}
