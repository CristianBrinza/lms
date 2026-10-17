import { z } from 'zod';
import { AppError } from '../../lib/errors';
import type { Tool, ToolEnv } from '../mcp/tools';
import {
  addDrink,
  householdPeople,
  listDrinks,
  setStock,
  updateDrink,
  type Drink,
} from './drinks';
import { addPhoto } from './photos';
import {
  DrinkInput,
  DrinkPatch,
  ListQuery,
  PhotoInput,
  StockInput,
  TastingInput,
} from './schemas';
import { drinkDetail } from './stats';
import { addTasting } from './tastings';

/** Drinks over MCP: Claude adds bottles from label photos, logs tastings, keeps the cellar. */

type Def<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  access: 'read' | 'write';
  destructive?: boolean;
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(def: Def<S>): Tool => def as unknown as Tool;

const stars = (rating: number | null) => (rating === null ? null : rating / 2);

/** A drink, briefly: the facts that tell versions apart, the cellar, the ratings. */
const brief = (d: Drink) => ({
  id: d.id,
  name: d.name,
  category: d.category,
  ...(d.producer ? { producer: d.producer } : {}),
  ...(d.line ? { line: d.line } : {}),
  ...(d.variant ? { variant: d.variant } : {}),
  ...(d.vintage ? { vintage: d.vintage } : {}),
  ...(d.ageYears !== null ? { ageYears: d.ageYears } : {}),
  ...(d.country ? { country: d.country } : {}),
  ...(d.region ? { region: d.region } : {}),
  ...(d.style ? { style: d.style } : {}),
  ...(d.color ? { color: d.color } : {}),
  ...(d.abv !== null ? { abv: d.abv } : {}),
  ...(d.stock ? { stock: d.stock, ...(d.location ? { location: d.location } : {}) } : {}),
  ...(d.opened ? { opened: true } : {}),
  ...(d.wanted ? { wanted: true } : {}),
  ...(d.tastings
    ? { tastings: d.tastings, stars: stars(d.rating), lastTasted: d.lastTasted }
    : {}),
  ...(d.price !== null ? { price: `${d.price} ${d.currency}` } : {}),
  photos: d.photos,
});

/** Someone named in the household ("Maria"), to their id. */
async function personNamed(env: ToolEnv, name: string | undefined) {
  if (!name) return undefined;
  const people = await householdPeople(env.ctx);
  const wanted = name.trim().toLowerCase();
  const found = people.find(
    (p) => p.id === name || p.name.toLowerCase() === wanted || `${p.name} ${p.surname}`.toLowerCase() === wanted,
  );
  if (!found) throw new AppError(400, 'VALIDATION', `No one called ${name} at home`);
  return found.id;
}

export const DRINKS_TOOLS: Tool[] = [
  tool({
    name: 'drinks_list',
    title: 'Search the drinks cellar and journal',
    description:
      'The household’s drinks: search words (name, producer, region, grape, tag), and filters — category, country (ISO code), shelf (cellar: bottles at home, tried, wanted), tag, minRating (1–10 = half stars), sort (recent, rating, name, vintage). Check here before drinks_add, so a bottle already known gets a tasting or stock instead of a duplicate.',
    access: 'read',
    input: ListQuery,
    run: async (env, args) => {
      const drinks = await listDrinks(env.ctx, args);
      return { count: drinks.length, drinks: drinks.slice(0, 60).map(brief) };
    },
  }),
  tool({
    name: 'drinks_get',
    title: 'One drink, with its tastings',
    description:
      'Everything about a drink (id from drinks_list): its facts, back-label text, the cellar, every tasting (who, when, where, stars, comment, sheet), the average, the price history and other versions of the same line.',
    access: 'read',
    input: z.object({ id: z.uuid() }),
    run: async (env, { id }) => {
      const detail = await drinkDetail(env.ctx, id);
      return {
        drink: { ...brief(detail.drink), ...detail.drink, cover: undefined },
        insights: detail.insights,
        tastings: detail.tastings.map((t) => ({
          id: t.id,
          by: t.person.name,
          tastedOn: t.tastedOn,
          ...(t.place ? { place: t.place } : {}),
          ...(t.country ? { country: t.country } : {}),
          ...(t.rating !== null ? { stars: stars(t.rating) } : {}),
          ...(t.score !== null ? { score: t.score } : {}),
          ...(t.buyAgain !== null ? { buyAgain: t.buyAgain } : {}),
          ...(t.comment ? { comment: t.comment } : {}),
          ...(t.pairing ? { pairing: t.pairing } : {}),
          ...(t.sheet ? { sheet: t.sheet } : {}),
        })),
        prices: detail.prices,
        family: detail.family.map(brief),
        photos: detail.photos.length,
      };
    },
  }),
  tool({
    name: 'drinks_add',
    title: 'Add a drink',
    description:
      'A new drink, one specific version: category, the full name as on the label, and every fact you can read from the photos — producer, line (the family: "Jack Daniel’s") and variant ("Tennessee Honey"), vintage, age statement, ABV, volume, country (ISO code), region, appellation, grapes, colour, style (Brut, XO, Single malt), cask, the back label’s text (labelText, as written), tags, price and where bought. stock: bottles at home (0 when only tasted somewhere); wanted: true for the want-to-try list. fromId starts from another version of the same line. Then drinks_add_photo with the label photos (front first, then back).',
    access: 'write',
    input: DrinkInput,
    run: async (env, args) => brief((await addDrink(env.ctx, args)).drink),
  }),
  tool({
    name: 'drinks_update',
    title: 'Change a drink',
    description: 'Changes the fields given on a drink (id from drinks_list); the rest stay.',
    access: 'write',
    input: z.object({ id: z.uuid() }).and(DrinkPatch),
    run: async (env, { id, ...patch }) => brief((await updateDrink(env.ctx, id, patch as DrinkPatch)).drink),
  }),
  tool({
    name: 'drinks_add_photo',
    title: 'Add a photo to a drink',
    description:
      'A label or bottle photo for a drink: image as a data URL or plain base64 (JPEG, PNG, WebP or HEIC, up to 12 MB; it is shrunk on the server). kind: front (default) or back (the back label) or other. The drink’s first photo is its cover. tastingId attaches it to a tasting instead.',
    access: 'write',
    input: z.object({ drinkId: z.uuid() }).and(PhotoInput),
    run: async (env, { drinkId, ...input }) => {
      const { photo } = await addPhoto(env.ctx, drinkId, input);
      return { id: photo.id, kind: photo.kind, width: photo.width, height: photo.height, bytes: photo.bytes };
    },
  }),
  tool({
    name: 'drinks_add_tasting',
    title: 'Log a tasting',
    description:
      'Someone tasted a drink: tastedOn (default today), place, occasion, country (ISO), person (a household member’s name; default the key’s owner), withPeople (household user ids) and withOthers (anyone else, as words), rating 1–10 in half stars (8 = 4 stars), an optional 100-point score, buyAgain, comment, pairing, and a structured sheet when they described it in detail (see the sheet field).',
    access: 'write',
    input: z
      .object({ drinkId: z.uuid(), person: z.string().trim().max(120).optional() })
      .and(TastingInput),
    run: async (env, { drinkId, person, ...input }) => {
      const personId = input.personId ?? (await personNamed(env, person));
      const { tasting } = await addTasting(env.ctx, drinkId, {
        ...(input as z.infer<typeof TastingInput>),
        ...(personId ? { personId } : {}),
      });
      return {
        id: tasting.id,
        by: tasting.person.name,
        tastedOn: tasting.tastedOn,
        stars: stars(tasting.rating),
        mode: tasting.mode,
      };
    },
  }),
  tool({
    name: 'drinks_set_stock',
    title: 'Bottles at home',
    description:
      'The cellar for a drink: stock (bottles now) or delta (+1 bought, −1 finished), location, opened, boughtOn, wanted (want to try), and the price and shop of a new bottle (kept in its price history).',
    access: 'write',
    input: z.object({ id: z.uuid() }).and(StockInput),
    run: async (env, { id, ...input }) =>
      brief((await setStock(env.ctx, id, input as z.infer<typeof StockInput>)).drink),
  }),
];
