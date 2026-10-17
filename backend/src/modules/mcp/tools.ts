import { z } from 'zod';
import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
import { Translations, type Locale } from '../../lib/i18n';
import type { FoodCtx } from '../food/kitchen';
import {
  addMealPart,
  completeMeal,
  eatOut,
  cookRecipe,
  deleteMeal,
  listMeals,
  planMeal,
  removeMealPart,
  reopenMeal,
  setLineChoice,
  setMealIngredients,
  updateMeal,
  updateMealPart,
  type Meal,
  ateNow,
} from '../food/meals';
import { IconInput, listIcons, saveIcon } from '../food/icons';
import { archiveTool, listTools, markDirty, saveTool, TOOL_ICONS, wash } from '../food/kitchenware';
import { FOOD_ICONS } from '../food/presets';
import { overview } from '../food/overview';
import { planNeeds } from '../food/plan';
import { createProduct, listProducts, updateProduct } from '../food/products';
import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipes,
  updateRecipe,
  type Recipe,
} from '../food/recipes';
import {
  AddShoppingInput,
  AddStockInput,
  AteInput,
  CheckoutInput,
  CompleteMealInput,
  CookInput,
  EatOutInput,
  dateField,
  idField,
  locationField,
  LotPatch,
  MealIngredientInput,
  MealInput,
  MealPartInput,
  MealPartPatchFields,
  MealPatchFields,
  PourInput,
  ToolInput,
  WashInput,
  ProductInput,
  RecipeInput,
  RestrictionInput,
  MoveShoppingInput,
  ShoppingItemPatch,
  StoreInput,
  UseStockInput,
} from '../food/schemas';
import {
  addShoppingItems,
  checkout,
  listShopping,
  listTrips,
  moveShoppingItems,
  removeShoppingItem,
  undoTrip,
  updateShoppingItem,
} from '../food/shopping';
import {
  addStock,
  kitchen,
  productDetail,
  setLevel,
  undoEvents,
  pourLot,
  updateLot,
  useStock,
  type StockedProduct,
} from '../food/stock';
import { addRestriction, kitchenPeople, listRestrictions } from '../food/restrictions';
import { createStore, listStores } from '../food/stores';
import { EQUIPMENT_PRESETS } from '../training/catalog';
import { generateWorkout } from '../training/generate';
import { healthSummary, importHealth } from '../training/health';
import { energySummary } from '../training/energy';
import { NutritionInput } from '../food/nutrition';
import { ProfileFields, saveProfileFields } from '../profile';
import {
  addEquipment,
  createExercise,
  listEquipment,
  listExercises,
  syncCatalog,
  updateExercise,
} from '../training/library';
import {
  EquipmentInput,
  ExerciseCreate,
  ExercisePatch,
  GenerateInput,
  RoutineInput,
  SetInput,
  WorkoutInput,
} from '../training/schemas';
import { stats, trainingOverview } from '../training/stats';
import {
  createRoutine,
  createWorkout,
  listWorkouts,
  logSet,
  personId,
  trainingPeople,
} from '../training/workouts';
import { localDate } from '../food/stock';
import {
  BagInput,
  CheckInput,
  GearInput,
  ItemInput,
  TripInput,
  TripPatch,
} from '../travel/schemas';
import {
  addBag,
  addCheck,
  addGear,
  listGear,
  addItem,
  createTrip,
  getTrip,
  listBags,
  listItems,
  listTrips as listTravelTrips,
  shopForTrip,
  updateCheck,
  updateTrip,
} from '../travel/travel';
import type { TokenScope } from '../tokens';

/**
 * The tools Claude gets over MCP. Each calls the same service the app's screens use, so the rules
 * are the same; answers are compact JSON (ids, names, amounts) to keep conversations light.
 */

export type Access = 'read' | 'write' | 'admin';

export interface ToolEnv {
  ctx: FoodCtx;
  deps: AppDeps;
  /** The key owner's language: what the server writes itself (workouts, insights, lines) uses it. */
  locale: Locale;
  /** Calls this API as the same key (used by the people tools). */
  internal: (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; body: unknown }>;
}

interface ToolDef<S extends z.ZodType> {
  name: string;
  title: string;
  description: string;
  access: Access;
  destructive?: boolean;
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
}

export type Tool = ToolDef<z.ZodType>;

/** Types `run`'s arguments from the tool's own schema. */
const tool = <S extends z.ZodType>(def: ToolDef<S>): Tool => def as unknown as Tool;

interface PersonRow {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
  isActive: boolean;
  kitchen: { name: string } | null;
  gender: string | null;
  birthDate: string | null;
  heightCm: number | null;
}

export const scopeAllows = (scope: TokenScope, access: Access) =>
  access === 'read' ||
  (access === 'write' && scope !== 'food:read') ||
  (access === 'admin' && scope === 'admin');

// ---------------------------------------------------------------- languages

/** Every record people read gets its words in English, Romanian and Russian (see INSTRUCTIONS). */
const translationsField = {
  translations: Translations.optional().describe(
    'This record’s text in the other languages, per field (the same field names as the record: name, note…; recipes and meals use title, description, steps, notes), e.g. { "ro": { "name": "Smântână" }, "ru": { "name": "Сметана" }, "en": { "name": "Sour cream" } }. Always fill en, ro and ru.',
  ),
};
const translatable = <S extends z.ZodType>(schema: S) => schema.and(z.object(translationsField));

/** A record's stored translations, when it has any, so the assistant sees what exists. */
const withTranslations = (row: object) => {
  const value = (row as { translations?: Translations | null }).translations;
  return value && Object.keys(value).length ? { translations: value } : {};
};

// ---------------------------------------------------------------- compact shapes for the model

const stockItem = (p: StockedProduct) => ({
  id: p.id,
  name: p.name,
  ...withTranslations(p),
  category: p.category,
  unit: p.unit,
  total: p.total,
  ...(p.low ? { low: true, minStock: p.minStock } : {}),
  ...(p.trackMode === 'none' ? { alwaysThere: true } : {}),
  ...(p.trackMode === 'level' ? { trackedBy: 'level', level: p.level } : {}),
  lots: p.lots.map((l) => ({
    id: l.id,
    quantity: l.quantity,
    location: l.location,
    expiresOn: l.expiresOn,
    ...(l.openedAt ? { opened: true } : {}),
    ...(l.price !== null ? { price: l.price } : {}),
    ...(l.storeName ? { store: l.storeName } : {}),
    added: l.addedAt.slice(0, 10),
  })),
});

const lines = (items: Recipe['ingredients']) =>
  items.map((i) => ({
    ...(i.productId ? { productId: i.productId } : {}),
    ...(i.lotId ? { lotId: i.lotId } : {}),
    name: i.name,
    amount: i.amount,
    unit: i.unit,
    ...(i.note ? { note: i.note } : {}),
    ...(i.optional ? { optional: true } : {}),
    ...(i.inStock !== null ? { inStock: i.inStock, baseUnit: i.baseUnit, enough: i.enough } : {}),
    ...(i.reservedFor ? { reservedFor: `${i.reservedFor.title} (${i.reservedFor.date})` } : {}),
    ...(i.warnings.length
      ? {
          warnings: i.warnings.map(
            (w) => `${w.kind === 'allergy' ? 'ALLERGY' : 'avoids'}: ${w.person}`,
          ),
        }
      : {}),
  }));

const recipeBrief = (r: Recipe) => ({
  id: r.id,
  title: r.title,
  ...withTranslations(r),
  servings: r.servings,
  minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
  tags: r.tags,
  ...(r.favorite ? { favorite: true } : {}),
  ready: r.availability.ready,
  have: `${r.availability.have}/${r.availability.total}`,
  missing: r.availability.missing.map((m) => m.name),
  usesSoonExpiring: r.availability.useSoon,
  ...(r.availability.warnings.length
    ? {
        warnings: r.availability.warnings.map(
          (w) => `${w.person} ${w.kind === 'allergy' ? 'is ALLERGIC to' : 'avoids'} ${w.item}`,
        ),
      }
    : {}),
  timesCooked: r.timesCooked,
  lastCooked: r.lastCooked,
});

const recipeFull = (r: Recipe) => ({
  ...recipeBrief(r),
  description: r.description,
  prepMinutes: r.prepMinutes,
  cookMinutes: r.cookMinutes,
  shownServings: r.shownServings,
  icon: r.icon,
  sourceUrl: r.sourceUrl || undefined,
  notes: r.notes || undefined,
  ingredients: lines(r.ingredients),
  steps: r.steps,
});

const meal = (m: Meal) => ({
  id: m.id,
  date: m.date,
  time: m.time,
  slot: m.slot,
  title: m.title,
  ...withTranslations(m),
  recipeId: m.recipeId,
  servings: m.servings,
  status: m.status,
  ...(m.note ? { note: m.note } : {}),
  ingredients: lines(m.ingredients),
  missing: m.availability.missing.map((x) => `${x.name} (${x.missing} ${x.unit})`),
});

// ---------------------------------------------------------------- the tools

/** create_icon's description: the house style, so new drawings sit with the built-in ones. */
const CREATE_ICON = `Draw a new icon for this kitchen and get its key (custom:…), usable at once: save_item, save_recipe or save_kitchenware with icon: "custom:…". The flow: if no built-in icon fits the item (list_icons), create one, then save the item with that key. One icon per kind of thing: Coca-Cola Zero gets its black can, not the generic can. Passing an existing key redraws that icon; name it in English with translations (en, ro, ru).

House style (match the built-in icons exactly):
- One <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="var(--color-ink-900, #1d1d24)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">. Every shape inherits that ink outline: never set an outline colour, only stroke="none" for a shape without one.
- Allowed tags: path, circle, ellipse, rect, line, polyline, polygon, g. Attributes: d, cx, cy, r, rx, ry, x, y, width, height, x1, y1, x2, y2, points, transform (translate, rotate, scale, matrix), fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray, opacity, fill-rule. Colours are hex, none or currentColor. No text, gradients, filters, style, class, id, images or links. At most 60 shapes and 20 KB.
- Composition: one object, upright or slightly tilted, centred, spanning about x 8 to 40 and y 6 to 42, with about 4 units of air on every side. A bold silhouette that reads at 32 px: what makes it that thing (the bottle's shape, the can's colour, the label band), not a photo. Typically 3 to 12 shapes.
- Strokes: 2.2 for the main outline, 1.8 for parts sitting on it (lids, caps, labels, leaves), 1.3 to 1.6 for small details (seeds, crumbs, highlights). Shapes are drawn in order, back to front.
- Fills: flat, from the palette, no shading. Colour bands without an outline use stroke="none". Palette: white #ffffff, cream #fff6e0, yellow #f6d47a, gold #f0c44f, mustard #e0ab2f, orange #f6a04d, peach #f4cfac, tan #e2b06f, brown #b87a4b, chocolate #7a4a2e, red #f0705f, brand red #e2433a, meat #df7b70, fat #f8dcd2, pink #f7a8c8, pale pink #fde3f1, beet #a8325e, wine #8c2440, purple #9b72c4, lavender #dcdcfa, periwinkle #a2a3ee, sky #a6e2f1, ice #dcf3f9, glass #eef9fc, mint #bfeedd, lime #a5d36a, green #8fcf7a, leaf #69b86b, dark green #4f9a5a, blue #3f6cc6, navy #2e4f9e, grey #dedee6, steel #c8c8d3, lid #efeff4, iron #4a4a58, black (cans, bottles) #2f2f38.
- Brands: the real packaging colours and shape, without lettering or logos; a stripe or wave suggests the label.

Example, an apple:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="var(--color-ink-900, #1d1d24)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M24 17.5c-3.5-3-12.5-2.5-14 6-1.5 9 4.5 18.5 10 18.5 1.8 0 2.8-1 4-1s2.2 1 4 1c5.5 0 11.5-9.5 10-18.5-1.5-8.5-10.5-9-14-6z" fill="#f0705f"/>
  <path d="M24 17.5c0-3.5.8-6 2.5-8"/>
  <path d="M26.4 12.2c2-3 5.5-4 9-3-1.5 3-5 4.5-9 3z" fill="#69b86b" stroke-width="1.8"/>
</svg>

Example, a black can of cola zero:
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" stroke="var(--color-ink-900, #1d1d24)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15.5 12.5l1.8-3.5h13.4l1.8 3.5v24l-1.8 3.5H17.3l-1.8-3.5z" fill="#2f2f38"/>
  <path d="M15.6 24.5c3.2-3.4 6.6-3.4 9.6-.8 2.8 2.4 5 2.4 7.2.8v3.4c-2.2 1.6-4.4 1.6-7.2-.8-3-2.6-6.4-2.6-9.6.8z" fill="#e2433a" stroke-width="1.6"/>
  <path d="M15.5 12.5l1.8-3.5h13.4l1.8 3.5z" fill="#efeff4" stroke-width="1.8"/>
  <path d="M15.5 36.5h17l-1.8 3.5H17.3z" fill="#c8c8d3" stroke-width="1.8"/>
  <path d="M21.5 9.5l1-2.5h4" stroke-width="1.8"/>
</svg>`;

const batch = <T extends z.ZodType>(item: T, max = 50) =>
  z.object({ items: z.array(item).min(1).max(max) });

export const TOOLS: Tool[] = [
  tool({
    name: 'kitchen_overview',
    title: 'Kitchen overview',
    description:
      'Start here. What expires soon, what ran low, recipe and list counts, and meals for today and the coming days.',
    access: 'read',
    input: z.object({ today: dateField.optional().describe('YYYY-MM-DD; defaults to today') }),
    run: async ({ ctx }, args) => {
      const o = await overview(ctx, args.today);
      return {
        kitchen: o.kitchen,
        expiring: o.stock.expiring,
        expiredLots: o.stock.expired,
        runningLow: o.stock.low,
        itemsInStock: o.stock.products,
        recipes: o.recipes,
        shopping: o.shopping,
        today: o.meals.today.map(meal),
        upcoming: o.meals.upcoming.map((m) => ({
          id: m.id,
          date: m.date,
          time: m.time,
          title: m.title,
        })),
      };
    },
  }),
  tool({
    name: 'kitchen_people',
    title: 'Who eats here',
    description:
      'The people sharing this kitchen and their allergies and foods they avoid. Check before suggesting or planning recipes.',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({
      people: (await kitchenPeople(ctx)).map((p) => ({
        id: p.id,
        name: `${p.name} ${p.surname}`.trim(),
        gender: p.gender ?? undefined,
        age: p.age ?? undefined,
        heightCm: p.heightCm ?? undefined,
      })),
      restrictions: (await listRestrictions(ctx)).map((r) => ({
        id: r.id,
        person: r.person,
        kind: r.kind,
        food: r.productName ?? `any ${r.category}`,
        note: r.note || undefined,
      })),
    }),
  }),
  tool({
    name: 'set_restriction',
    title: 'Record an allergy or dislike',
    description:
      'Someone in the kitchen is allergic to (allergy) or doesn’t eat (avoid) an item by name, or a whole category (fish, dairy, meat…).',
    access: 'write',
    input: RestrictionInput,
    run: async ({ ctx }, args) => addRestriction(ctx, args),
  }),
  tool({
    name: 'list_stock',
    title: 'What is in the kitchen',
    description:
      'Everything in stock, with each piece/package (lot): amount in the base unit, place, expiry. Staples that ran out appear with total 0.',
    access: 'read',
    input: z.object({
      location: locationField.optional(),
      query: z.string().max(80).optional().describe('Filter by name'),
    }),
    run: async ({ ctx }, args) => {
      const query = (args.query ?? '').toLowerCase();
      return (await kitchen(ctx, { location: args.location }))
        .filter((p) => !query || p.name.toLowerCase().includes(query))
        .map(stockItem);
    },
  }),
  tool({
    name: 'find_items',
    title: 'Find kitchen items',
    description:
      'Search the kitchen’s item catalog (also items not in stock): ids, how each is counted, defaults.',
    access: 'read',
    input: z.object({ query: z.string().max(80).default('') }),
    run: async ({ ctx }, args) =>
      (await listProducts(ctx, args.query)).slice(0, 40).map((p) => ({
        id: p.id,
        name: p.name,
        ...withTranslations(p),
        unit: p.unit,
        category: p.category,
        location: p.location,
        pieceSize: p.pieceSize,
        pieceUnit: p.pieceUnit,
        shelfLifeDays: p.shelfLifeDays,
        minStock: p.minStock,
        storeId: p.storeId,
        trackMode: p.trackMode,
        ...(p.trackMode === 'level' ? { level: p.level } : {}),
      })),
  }),
  tool({
    name: 'item_history',
    title: 'Item history and prices',
    description:
      'One item: its lots, the last 30 changes (who, when, app or AI), and the last price paid at each store.',
    access: 'read',
    input: z.object({ productId: idField }),
    run: async ({ ctx }, args) => {
      const detail = await productDetail(ctx, args.productId);
      return { item: stockItem(detail.product), history: detail.events, prices: detail.prices };
    },
  }),
  tool({
    name: 'add_stock',
    title: 'Add to the kitchen',
    description:
      'Put food in the kitchen, one lot per entry (each steak or pack separately). Name items as they are called (matched loosely; unknown names become new items). Expiry defaults from shelf life.',
    access: 'write',
    // Its own translations: the item's name, and its kinds by kind ({ "Greek 2%": "Grecesc 2%" }).
    input: batch(AddStockInput),
    run: async ({ ctx }, args) => {
      return ctx.tx(async (tx) => {
        const out = [];
        for (const item of args.items) {
          const { product, lot } = await addStock(tx, item);
          out.push(
            lot
              ? {
                  item: product.name,
                  productId: product.id,
                  lotId: lot.id,
                  quantity: lot.quantity,
                  unit: product.unit,
                  expiresOn: lot.expiresOn,
                  location: lot.location,
                }
              : { item: product.name, productId: product.id, level: product.level },
          );
        }
        return out;
      });
    },
  }),
  tool({
    name: 'use_stock',
    title: 'Use or throw away',
    description:
      'Take food out of the kitchen (eaten, or wasted: true). From the given lot first, else opened → soonest expiry. Reports any shortfall. Returns events for undo_use. All or nothing: if one item fails, none is taken.',
    access: 'write',
    input: batch(UseStockInput),
    run: async ({ ctx }, args) =>
      // One transaction: a failed item leaves nothing half-done for a retry to double.
      ctx.tx(async (tx) => {
        const out = [];
        for (const item of args.items) out.push(await useStock(tx, item));
        return out;
      }),
  }),
  tool({
    name: 'set_level',
    title: 'Full, low or out',
    description:
      'For items kept by level (spices, sauces, oil): say they are full, running low, or out. Out or low items show on the plan’s shopping needs.',
    access: 'write',
    input: z.object({ productId: idField, level: z.enum(['full', 'low', 'out']) }),
    run: async ({ ctx }, args) => {
      const product = await setLevel(ctx, args.productId, args.level);
      return { item: product.name, level: product.level };
    },
  }),
  tool({
    name: 'undo_use',
    title: 'Undo a use',
    description:
      'Put back what use_stock took, into the same lots: pass the events it returned. Each is undone once; repeating changes nothing.',
    access: 'write',
    input: z.object({ events: z.array(z.number().int().positive()).min(1).max(100) }),
    run: async ({ ctx }, args) => ({ undone: await undoEvents(ctx, args.events) }),
  }),
  tool({
    name: 'update_lot',
    title: 'Correct a piece in stock',
    description:
      'Fix one lot: what is left now, its place (moving to the freezer), expiry, opened, price, note.',
    access: 'write',
    input: LotPatch.and(z.object({ lotId: idField })),
    run: async ({ ctx }, { lotId, ...patch }) => updateLot(ctx, lotId, patch),
  }),
  tool({
    name: 'list_kitchenware',
    title: 'Kitchenware',
    description:
      'Pots, pans, bowls, glasses and other things the kitchen counts: how many, how many are clean, dirty or in the dishwasher (and until when).',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({ tools: await listTools(ctx) }),
  }),
  tool({
    name: 'save_kitchenware',
    title: 'Add or change kitchenware',
    description:
      'Adds kitchenware by name (or changes it with toolId): how many, kind, where it is kept. used: n marks that many dirty; remove: true takes it off.',
    access: 'write',
    input: ToolInput.extend({
      ...translationsField,
      toolId: idField.optional(),
      used: z.number().int().min(1).max(50).optional(),
      remove: z.boolean().optional(),
    }),
    run: async ({ ctx }, { toolId, used, remove, ...input }) => {
      if (toolId && remove) {
        await archiveTool(ctx, toolId);
        return { removed: toolId };
      }
      let saved =
        toolId || input.name
          ? await saveTool(ctx, { ...input, ...(toolId ? { id: toolId } : {}) })
          : null;
      if (used && saved) saved = await markDirty(ctx, saved.id, used);
      if (!saved) throw new AppError(400, 'VALIDATION', 'Say which: toolId or name');
      return { tool: saved };
    },
  }),
  tool({
    name: 'wash_kitchenware',
    title: 'Wash the dishes',
    description:
      'how: hand (clean now) or machine (clean when the dishwasher is done). toolIds omitted: everything dirty.',
    access: 'write',
    input: WashInput,
    run: async ({ ctx }, input) => ({ tools: await wash(ctx, input) }),
  }),
  tool({
    name: 'pour',
    title: 'Pour into another container',
    description:
      'Moves some of one piece into another of the same item, or into a new one: the big oil bottle into the small one on the desk, a jug into a bottle. The total stays the same.',
    access: 'write',
    input: PourInput.extend({ lotId: idField.describe('The piece poured from') }),
    run: async ({ ctx }, { lotId, ...input }) => pourLot(ctx, lotId, input),
  }),
  tool({
    name: 'save_item',
    title: 'Create or change an item',
    description:
      'Create a catalog item, or change one (productId): icon (a built-in key, or a custom:… key from create_icon), category, unit, piece size, place, shelf life, frozen/thawed days, running-low amount, usual store, and trackMode (exact amounts, level = full/low/out for spices and sauces, none = always there).',
    access: 'write',
    // ProductInput's translations take the item's kinds too ({ "ro": { "variants": { … } } }).
    input: ProductInput.partial().and(z.object({ productId: idField.optional() })),
    run: async ({ ctx }, { productId, ...input }) => {
      if (productId) return updateProduct(ctx, productId, input);
      if (!input.name)
        throw new AppError(400, 'VALIDATION', 'Give the new item a name', {
          fields: { name: 'Required' },
        });
      return createProduct(ctx, input as z.infer<typeof ProductInput>);
    },
  }),
  tool({
    name: 'list_icons',
    title: 'Icons',
    description:
      'The drawings items, recipes and kitchenware can have: the built-in keys (items: food, drinks and house things; kitchenware) and this kitchen’s own (custom:…, made with create_icon). Check here before drawing a new one.',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({
      builtIn: { items: FOOD_ICONS, kitchenware: TOOL_ICONS },
      custom: (await listIcons(ctx)).map((icon) => ({
        key: icon.key,
        name: icon.name,
        ...withTranslations(icon),
      })),
    }),
  }),
  tool({
    name: 'create_icon',
    title: 'Draw a new icon',
    description: CREATE_ICON,
    access: 'write',
    input: IconInput,
    run: async ({ ctx }, input) => {
      const { icon, created } = await saveIcon(ctx, input);
      return {
        key: icon.key,
        name: icon.name,
        shapes: icon.shapes.length,
        ...(created ? {} : { redrawn: true }),
      };
    },
  }),
  tool({
    name: 'list_recipes',
    title: 'Recipes',
    description:
      'All recipes with how ready they are to cook from the kitchen, what is missing, and how many ingredients expire soon.',
    access: 'read',
    input: z.object({
      query: z.string().max(80).optional(),
      readyOnly: z.boolean().optional(),
      tag: z.string().max(30).optional(),
    }),
    run: async ({ ctx }, args) => {
      const query = (args.query ?? '').toLowerCase();
      return (await listRecipes(ctx))
        .filter(
          (r) =>
            !query ||
            r.title.toLowerCase().includes(query) ||
            r.ingredients.some((i) => i.name.toLowerCase().includes(query)),
        )
        .filter((r) => !args.readyOnly || r.availability.ready)
        .filter((r) => !args.tag || r.tags.includes(args.tag))
        .map(recipeBrief);
    },
  }),
  tool({
    name: 'get_recipe',
    title: 'One recipe',
    description: 'Full recipe: ingredients with stock, steps. Optionally scaled to other servings.',
    access: 'read',
    input: z.object({ recipeId: idField, servings: z.number().int().min(1).max(100).optional() }),
    run: async ({ ctx }, args) => recipeFull(await getRecipe(ctx, args.recipeId, args.servings)),
  }),
  tool({
    name: 'save_recipe',
    title: 'Save a recipe',
    description:
      'Create a recipe, or replace fields of one (recipeId). Ingredients: name as the kitchen calls it + amount + unit; omit amount for “to taste”; link: false for tap water. Steps are short imperative sentences.',
    access: 'write',
    input: RecipeInput.partial().and(
      z.object({ recipeId: idField.optional(), ...translationsField }),
    ),
    run: async ({ ctx }, { recipeId, ...input }) => {
      if (recipeId) return recipeFull(await updateRecipe(ctx, recipeId, input));
      if (!input.title)
        throw new AppError(400, 'VALIDATION', 'Give the recipe a title', {
          fields: { title: 'Required' },
        });
      return recipeFull(await createRecipe(ctx, input as z.infer<typeof RecipeInput>));
    },
  }),
  tool({
    name: 'delete_recipe',
    title: 'Delete a recipe',
    description: 'Archive a recipe. Planned and past meals keep their copy.',
    access: 'write',
    destructive: true,
    input: z.object({ recipeId: idField }),
    run: async ({ ctx }, args) => {
      await deleteRecipe(ctx, args.recipeId);
      return { deleted: args.recipeId };
    },
  }),
  tool({
    name: 'cook_now',
    title: 'Cook a recipe now',
    description:
      'Cook a recipe right now: makes a meal for today and takes its ingredients from the kitchen; optional leftovers as portions.',
    access: 'write',
    input: CookInput.and(z.object({ recipeId: idField })),
    run: async ({ ctx }, { recipeId, ...input }) => {
      const result = await cookRecipe(ctx, recipeId, input);
      return { meal: meal(result.meal), shortfalls: result.shortfalls };
    },
  }),
  tool({
    name: 'list_meals',
    title: 'Meal plan',
    description: 'Meals between two dates (inclusive) with their ingredients and what is missing.',
    access: 'read',
    input: z.object({ from: dateField, to: dateField }),
    run: async ({ ctx }, args) => (await listMeals(ctx, args.from, args.to)).map(meal),
  }),
  tool({
    name: 'plan_meal',
    title: 'Plan a meal',
    description:
      'Put a meal on a day: from a recipe (ingredients copied and scaled to servings) or just named. Time HH:MM or a slot.',
    access: 'write',
    input: translatable(MealInput),
    run: async ({ ctx }, args) => meal(await planMeal(ctx, args)),
  }),
  tool({
    name: 'update_meal',
    title: 'Change a planned meal',
    description:
      'Move, rescale, swap the recipe, skip (status: skipped) or annotate a meal; ingredients (optional) replace its list for that day only, e.g. to use a specific lot.',
    access: 'write',
    input: MealPatchFields.partial().extend({
      ...translationsField,
      mealId: idField,
      ingredients: z.array(MealIngredientInput).max(60).optional(),
    }),
    run: async ({ ctx }, { mealId, ingredients, ...patch }) => {
      let result: Meal | null = null;
      if (Object.keys(patch).length) result = await updateMeal(ctx, mealId, patch);
      if (ingredients) result = await setMealIngredients(ctx, mealId, ingredients);
      if (!result) throw new AppError(400, 'VALIDATION', 'Nothing to change');
      return meal(result);
    },
  }),
  tool({
    name: 'eat_out',
    title: 'Eaten out',
    description:
      'A planned meal eaten somewhere else (restaurant, delivery, party, work, other): kept in the history as eaten, nothing taken from the kitchen, its reservations freed. To plan eating out ahead, use plan_meal with out.',
    access: 'write',
    input: EatOutInput.extend({ mealId: idField }),
    run: async ({ ctx }, { mealId, ...input }) => meal(await eatOut(ctx, mealId, input)),
  }),
  tool({
    name: 'pick_option',
    title: 'Pick milk or cream',
    description:
      'For a planned meal’s line with alternatives (or), picks which one it takes: choice 0 the main item, 1… an alternative, null back to the first there is. The plan and the shopping needs follow.',
    access: 'write',
    input: z.object({
      mealId: idField,
      lineId: idField,
      choice: z.number().int().min(0).max(4).nullable(),
    }),
    run: async ({ ctx }, { mealId, lineId, choice }) =>
      meal(await setLineChoice(ctx, mealId, lineId, choice)),
  }),
  tool({
    name: 'add_meal_part',
    title: 'Add to a meal',
    description:
      'Adds a dish, side, sauce or drink to a meal: a recipe (its lines scaled to servings) or named with its own ingredients — coffee, bread with Philadelphia and salmon, a sauce.',
    access: 'write',
    input: MealPartInput.and(z.object({ mealId: idField })),
    run: async ({ ctx }, { mealId, ...input }) => meal(await addMealPart(ctx, mealId, input)),
  }),
  tool({
    name: 'update_meal_part',
    title: 'Change part of a meal',
    description:
      'Renames a part, changes its kind, or rescales it (its lines follow). Use remove: true to take it off the meal.',
    access: 'write',
    input: MealPartPatchFields.partial().extend({
      mealId: idField,
      partId: idField,
      remove: z.boolean().optional(),
    }),
    run: async ({ ctx }, { mealId, partId, remove, ...patch }) => {
      if (remove) return meal(await removeMealPart(ctx, mealId, partId));
      if (!Object.keys(patch).length) throw new AppError(400, 'VALIDATION', 'Nothing to change');
      return meal(await updateMealPart(ctx, mealId, partId, patch));
    },
  }),
  tool({
    name: 'complete_meal',
    title: 'Mark a meal eaten',
    description:
      'Done: takes its ingredients from the kitchen (chosen lots, else soonest expiry), reports shortfalls, optionally keeps leftovers.',
    access: 'write',
    input: CompleteMealInput.and(z.object({ mealId: idField })),
    run: async ({ ctx }, { mealId, ...input }) => {
      const result = await completeMeal(ctx, mealId, input);
      return { meal: meal(result.meal), shortfalls: result.shortfalls, opened: result.opened };
    },
  }),
  tool({
    name: 'reopen_meal',
    title: 'Undo a done meal',
    description:
      'Back to planned: what it took returns to the kitchen; untouched leftovers are removed.',
    access: 'write',
    input: z.object({ mealId: idField }),
    run: async ({ ctx }, args) => meal(await reopenMeal(ctx, args.mealId)),
  }),
  tool({
    name: 'delete_meal',
    title: 'Remove a meal',
    description: 'Remove a meal from the plan (stock is not changed).',
    access: 'write',
    destructive: true,
    input: z.object({ mealId: idField }),
    run: async ({ ctx }, args) => {
      await deleteMeal(ctx, args.mealId);
      return { deleted: args.mealId };
    },
  }),
  tool({
    name: 'plan_needs',
    title: 'What to buy for the plan',
    description:
      'For planned meals between two dates: each item needed, minus stock and what is already on a list → toBuy (toBuyAmount/toBuyUnit), with its usual store.',
    access: 'read',
    input: z.object({ from: dateField, to: dateField }),
    run: async ({ ctx }, args) => planNeeds(ctx, args.from, args.to),
  }),
  tool({
    name: 'shopping_lists',
    title: 'Shopping lists',
    description:
      'Stores and the open lines on each list (and on the “any store” list), with last prices and estimates.',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => {
      const [stores, items] = await Promise.all([listStores(ctx), listShopping(ctx)]);
      const line = (i: Awaited<ReturnType<typeof listShopping>>[number]) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        ...(i.checked ? { inCart: true } : {}),
        ...(i.price !== null ? { price: i.price } : {}),
        ...(i.estimate !== null ? { estimate: i.estimate } : {}),
        ...(i.note ? { note: i.note } : {}),
      });
      return {
        stores: stores.map((s) => ({
          id: s.id,
          name: s.name,
          ...withTranslations(s),
          lines: items.filter((i) => i.storeId === s.id).map(line),
        })),
        anyStore: items.filter((i) => !i.storeId).map(line),
      };
    },
  }),
  tool({
    name: 'add_to_shopping_list',
    title: 'Add to a shopping list',
    description:
      'Add lines to a store’s list (storeId), the item’s usual store (omit storeId) or “any store” (null). The same item already waiting is topped up.',
    access: 'write',
    input: AddShoppingInput,
    run: async ({ ctx }, args) =>
      (await addShoppingItems(ctx, args.items, args.source)).map((i) => ({
        id: i.id,
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        storeId: i.storeId,
      })),
  }),
  tool({
    name: 'update_shopping_line',
    title: 'Change a shopping line',
    description: 'Tick into the cart, set amount/price, move to another store, add a note.',
    access: 'write',
    input: ShoppingItemPatch.and(z.object({ lineId: idField })),
    run: async ({ ctx }, { lineId, ...patch }) => updateShoppingItem(ctx, lineId, patch),
  }),
  tool({
    name: 'move_shopping_lines',
    title: 'Move shopping lines to another store',
    description:
      'Move several lines at once to another store’s list (storeId), or to “any store” (null): e.g. what Metro didn’t have, to Linella. Lines already checked out stay with their trip.',
    access: 'write',
    input: MoveShoppingInput,
    run: async ({ ctx }, args) => moveShoppingItems(ctx, args),
  }),
  tool({
    name: 'remove_shopping_line',
    title: 'Remove a shopping line',
    description: 'Take a line off its list.',
    access: 'write',
    destructive: true,
    input: z.object({ lineId: idField }),
    run: async ({ ctx }, args) => {
      await removeShoppingItem(ctx, args.lineId);
      return { removed: args.lineId };
    },
  }),
  tool({
    name: 'create_store',
    title: 'Add a store',
    description: 'A new store with its own list (e.g. Linella, Metro).',
    access: 'write',
    input: translatable(StoreInput),
    run: async ({ ctx }, args) => createStore(ctx, args),
  }),
  tool({
    name: 'checkout',
    title: 'Finish a shop',
    description:
      'Everything in that list’s cart is bought: recorded as a trip with its total and put into the kitchen. Lines can override price, amount, expiry, place.',
    access: 'write',
    input: CheckoutInput,
    run: async ({ ctx }, args) => checkout(ctx, args),
  }),
  tool({
    name: 'list_trips',
    title: 'Past shops',
    description: 'Recent finished shops with store and total.',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => listTrips(ctx, 20),
  }),
  tool({
    name: 'undo_trip',
    title: 'Undo a shop',
    description:
      'A shop finished by mistake: its items leave the kitchen and its lines go back into the cart. Refused once anything from it was used or opened.',
    access: 'write',
    input: z.object({ tripId: z.string().uuid() }),
    run: async ({ ctx }, args) => undoTrip(ctx, args.tripId),
  }),
  // People (admin keys only): through the admin API, as the same key.
  tool({
    name: 'list_people',
    title: 'People',
    description:
      'Admin: everyone with an account, their role, whether they can sign in, and their kitchen.',
    access: 'admin',
    input: z.object({ query: z.string().max(100).optional() }),
    run: async ({ internal }, args) => {
      const res = await internal(
        'GET',
        `/api/admin/users?q=${encodeURIComponent(args.query ?? '')}`,
      );
      return (res.body as { users: PersonRow[] }).users.map((u) => ({
        id: u.id,
        name: `${u.name} ${u.surname}`.trim(),
        email: u.email,
        role: u.role,
        active: u.isActive,
        kitchen: u.kitchen?.name ?? null,
        gender: u.gender,
        birthDate: u.birthDate,
        heightCm: u.heightCm,
      }));
    },
  }),
  tool({
    name: 'create_person',
    title: 'Create an account',
    description:
      'Admin: a new account. Returns a one-time password to pass on; they choose their own at first sign-in.',
    access: 'admin',
    input: z.object({
      email: z.string().max(254),
      name: z.string().max(60),
      surname: z.string().max(60).optional(),
      role: z.enum(['member', 'admin']).optional(),
    }),
    run: async ({ internal }, args) => (await internal('POST', '/api/admin/users', args)).body,
  }),
  tool({
    name: 'update_person',
    title: 'Change an account',
    description:
      'Admin: name, email, role, profile (gender, birthDate YYYY-MM-DD, heightCm), or switch an account off/on (isActive).',
    access: 'admin',
    input: z.object({
      userId: idField,
      email: z.string().max(254).optional(),
      name: z.string().max(60).optional(),
      surname: z.string().max(60).optional(),
      role: z.enum(['member', 'admin']).optional(),
      isActive: z.boolean().optional(),
      gender: z.enum(['female', 'male', 'other']).nullable().optional(),
      birthDate: z.string().max(10).nullable().optional(),
      heightCm: z.number().int().nullable().optional(),
    }),
    run: async ({ internal }, { userId, ...patch }) =>
      (await internal('PATCH', `/api/admin/users/${userId}`, patch)).body,
  }),
  tool({
    name: 'share_kitchen',
    title: 'Share a kitchen',
    description:
      'Admin: seat a person in another person’s kitchen (householdId from list_kitchens), or give them their own (null).',
    access: 'admin',
    input: z.object({ userId: idField, householdId: idField.nullable() }),
    run: async ({ internal }, args) =>
      (
        await internal('PUT', `/api/admin/users/${args.userId}/kitchen`, {
          householdId: args.householdId,
        })
      ).body,
  }),
  tool({
    name: 'list_kitchens',
    title: 'Kitchens',
    description: 'Admin: every kitchen and who shares it.',
    access: 'admin',
    input: z.object({}),
    run: async ({ internal }) =>
      ((await internal('GET', '/api/admin/households')).body as { households: unknown }).households,
  }),
  // Training: home workouts, each person's own (userId: someone in the household; default the key's owner).
  tool({
    name: 'training_overview',
    title: 'Training today',
    description:
      'One person’s training: today’s and the next planned workout, this week day by day, streaks, pinned exercises with today’s count, sets logged today. Also lists the household’s people with gender and age: plan for the person asked about (userId).',
    access: 'read',
    input: z.object({ userId: idField.optional(), today: dateField.optional() }),
    run: async ({ ctx }, args) => {
      const userId = await personId(ctx, args.userId);
      await syncCatalog(ctx, userId);
      return trainingOverview(ctx, userId, args.today);
    },
  }),
  tool({
    name: 'list_exercises',
    title: 'Exercises',
    description:
      'One person’s exercise library (userId; default you): id, name, category, muscles, measure (reps/time/distance), whether it can be done with the equipment at home (available), the weights owned for it, and its options (grips, stances, bands). Filter by text or availability.',
    access: 'read',
    input: z.object({
      userId: idField.optional(),
      query: z.string().max(60).optional(),
      availableOnly: z.boolean().optional(),
    }),
    run: async ({ ctx }, args) => {
      const all = await listExercises(ctx, await personId(ctx, args.userId));
      const q = args.query?.toLowerCase();
      return all
        .filter(
          (e) =>
            (!args.availableOnly || e.available) &&
            (!q || e.name.toLowerCase().includes(q) || e.muscles.some((m) => m.includes(q))),
        )
        .map((e) => ({
          id: e.id,
          name: e.name,
          ...withTranslations(e),
          category: e.category,
          muscles: e.muscles,
          measure: e.measure,
          weighted: e.weighted,
          unilateral: e.unilateral,
          available: e.available,
          weights: e.weights,
          reps: e.reps,
          seconds: e.seconds,
          level: e.level,
          impact: e.impact,
          options: e.options.length
            ? e.options.map((o) => (o.kg ? `${o.name} (${o.kg} kg)` : o.name))
            : undefined,
        }));
    },
  }),
  tool({
    name: 'add_exercise',
    title: 'Add an exercise to someone’s library',
    description:
      'A new exercise in one person’s library (userId): name, category, measure, muscles, equipment alternatives ([] = none; [["dumbbells"],["kettlebell"]]), weighted, unilateral, default reps/seconds/distance, rest, level, impact, steps, variants (grips, stances).',
    access: 'write',
    input: translatable(ExerciseCreate),
    run: async ({ ctx }, args) => createExercise(ctx, await personId(ctx, args.userId), args),
  }),
  tool({
    name: 'update_exercise',
    title: 'Change or hide an exercise',
    description:
      'Changes an exercise in someone’s library (any field of add_exercise), or hides it (archived: true) / shows it again.',
    access: 'write',
    input: z.object({ exerciseId: idField, ...translationsField }).and(ExercisePatch),
    run: async ({ ctx }, { exerciseId, ...patch }) => updateExercise(ctx, exerciseId, patch),
  }),
  tool({
    name: 'save_routine',
    title: 'Save a program',
    description:
      'A saved routine (program) for one person (userId): name, items like plan_workout’s, rounds, roundRest. Plan it on days with plan_workout routineId.',
    access: 'write',
    input: translatable(RoutineInput),
    run: async ({ ctx }, args) => createRoutine(ctx, args),
  }),
  tool({
    name: 'training_equipment',
    title: 'Home equipment',
    description:
      'What the household trains with: mat, dumbbells (weights in kg, pairs or single), pull-up bar, treadmill, running route…',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({
      equipment: await listEquipment(ctx),
      kinds: EQUIPMENT_PRESETS.map((p) => p.kind),
    }),
  }),
  tool({
    name: 'add_equipment',
    title: 'Add home equipment',
    description:
      'Adds equipment the household owns. kind from training_equipment.kinds (or "other" with a name); weights in kg; pairs when they come two of each.',
    access: 'write',
    input: translatable(EquipmentInput),
    run: async ({ ctx }, args) => addEquipment(ctx, args),
  }),
  tool({
    name: 'plan_workout',
    title: 'Plan a workout',
    description:
      'Plans a workout for someone on a date: an ordered list of exercises (exerciseId from list_exercises) with sets and a target (reps, seconds or distance in metres; weight in kg), rest in seconds. rounds > 1 repeats the main block as a circuit; block "warmup"/"cooldown" items are done once. Or routineId to copy a saved routine.',
    access: 'write',
    input: WorkoutInput,
    run: async ({ ctx, locale }, args) => createWorkout(ctx, args, locale),
  }),
  tool({
    name: 'suggest_workout',
    title: 'Make up a workout',
    description:
      'Builds a workout from the equipment at home for a length (minutes), a focus (full, upper, lower, core, cardio, mobility), a level 1–3 and quiet (no jumping). Returns items to pass to plan_workout; saves nothing.',
    access: 'read',
    input: GenerateInput,
    run: async ({ ctx, locale }, args) =>
      generateWorkout(ctx, await personId(ctx, args.userId), args, Math.random, locale),
  }),
  tool({
    name: 'list_workouts',
    title: 'Planned and done workouts',
    description:
      'Workouts between two dates for one person (or everyone: true), with status, sets done of planned, time and the exercises.',
    access: 'read',
    input: z.object({
      from: dateField,
      to: dateField,
      userId: idField.optional(),
      everyone: z.boolean().optional(),
    }),
    run: async ({ ctx }, args) =>
      listWorkouts(ctx, {
        from: args.from,
        to: args.to,
        userId: args.everyone ? null : await personId(ctx, args.userId),
      }),
  }),
  tool({
    name: 'log_exercise',
    title: 'Log a set',
    description:
      'Records a set done: reps (and weight in kg), seconds, or distance in metres. Now by default; at for an exact time, or day when only the day is known. With workoutId it counts in that workout. Returns personal bests it set.',
    access: 'write',
    input: z.object({ workoutId: idField.optional() }).and(SetInput),
    run: async ({ ctx }, args) => logSet(ctx, args, args.workoutId ?? null),
  }),
  tool({
    name: 'training_stats',
    title: 'Training statistics',
    description:
      'For one person between two dates: days trained, workouts, minutes, sets, reps, distance, sets per muscle, top exercises, and streaks.',
    access: 'read',
    input: z.object({ from: dateField, to: dateField, userId: idField.optional() }),
    run: async ({ ctx }, args) =>
      stats(ctx, await personId(ctx, args.userId), args.from, args.to, localDate(ctx.now)),
  }),
  tool({
    name: 'health_summary',
    title: 'Health data',
    description:
      'Steps, distance, sleep (minutes), resting heart rate, HRV, weight, body fat… per day from Apple Health / Health Connect (or typed in), this week against the week before, and plain observations. Not medical advice.',
    access: 'read',
    input: z.object({ from: dateField, to: dateField, userId: idField.optional() }),
    run: async ({ ctx, locale }, args) =>
      healthSummary(ctx, await personId(ctx, args.userId), args.from, args.to, locale),
  }),
  // Nutrition and energy: food in, training and the day out.
  tool({
    name: 'set_nutrition',
    title: 'Set an item’s nutrition',
    description:
      'The nutrition of a kitchen item (productId from list_stock / find_items): per "100g", "100ml" or "piece", kcal, protein, fat, carbs (sugar, fiber, salt optional), and kinds that differ ({"Zero": {...}}). Use real label or database values (search the web when unsure). null goes back to the catalog’s typical values.',
    access: 'write',
    input: z.object({ productId: idField, nutrition: NutritionInput }),
    run: async ({ ctx }, args) => {
      const product = await updateProduct(ctx, args.productId, { nutrition: args.nutrition });
      return { name: product.name, nutrition: product.nutrition };
    },
  }),
  tool({
    name: 'log_food',
    title: 'Log what someone ate',
    description:
      'Something eaten outside the plan (a banana, a protein shake, cake at work): items with amounts (or a recipeId, one serving each), who ate it (eaters, default you), when. Taken from the kitchen unless fromKitchen: false. Counts in the day’s energy.',
    access: 'write',
    input: AteInput,
    run: async ({ ctx }, args) => ateNow(ctx, args),
  }),
  tool({
    name: 'energy_summary',
    title: 'Energy in and out',
    description:
      'For one person (userId) and dates: per day eaten (kcal, protein, fat, carbs from meals they ate), burned (resting + active from the phone or formulas, + training logged here), the balance; the daily target from their goal; insights. Use it to suggest meals and training that fit.',
    access: 'read',
    input: z.object({ from: dateField, to: dateField, userId: idField.optional() }),
    run: async ({ ctx, locale }, args) =>
      energySummary(
        ctx,
        await personId(ctx, args.userId),
        args.from,
        args.to,
        localDate(ctx.now),
        locale,
      ),
  }),
  tool({
    name: 'set_goal',
    title: 'Set someone’s goal',
    description:
      'A person’s goal (lose, keep or gain weight; goalWeight kg; goalRate kg a week, 0.25–0.75 is sensible), activity without training (sedentary … very), and profile facts the formulas need (gender, birthDate, heightCm). Also weightKg (today’s weight, kg; kept as today’s typed-in reading in Health) and paydays: salaryDay and advanceDay, the day of the month (1–31) the salary and the advance (avans) come.',
    access: 'write',
    input: z.object({ userId: idField.optional() }).and(ProfileFields),
    run: async ({ ctx, locale }, { userId, ...fields }) => {
      const id = await personId(ctx, userId);
      await saveProfileFields(ctx.db, id, fields, ctx.now);
      // Health's own import, for this person in this household: the same row as one typed in.
      if (typeof fields.weightKg === 'number')
        await importHealth(ctx, { source: 'manual', userId: id, weight: fields.weightKg }, locale);
      return (await trainingPeople(ctx)).find((p) => p.id === id);
    },
  }),
  // ---------------------------------------------------------------- travel
  tool({
    name: 'travel_overview',
    title: 'Trips, bags and the packing list',
    description:
      'The household’s trips (upcoming first, with how much is packed), its bags (cm, litres) and its packing list: each item with its group, quantity rule (one, person, day, person_day) and the rules for when it belongs on a trip (scope, overnight, transport, kinds, minDays).',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({
      trips: await listTravelTrips(ctx, localDate(ctx.now)),
      bags: await listBags(ctx),
      gear: await listGear(ctx),
      packingList: await listItems(ctx),
    }),
  }),
  tool({
    name: 'trip_checklist',
    title: 'A trip and its checklist',
    description: 'One trip with its checklist (what to take, how many, what is ticked).',
    access: 'read',
    input: z.object({ tripId: idField }),
    run: async ({ ctx }, args) => getTrip(ctx, args.tripId),
  }),
  tool({
    name: 'plan_trip',
    title: 'Plan a trip',
    description:
      'A new trip: name, destination, scope (national/international), kind (vacation, family, day, event, work, other), transport (car, bus, train, plane, other), start and end dates, the times (leave home departTime, arrive there arriveDate/arriveTime, head back backDate/backTime, home again returnTime), who goes (household user ids; default the key’s owner) plus guests, bags. Its checklist is made from the packing list rules; overrides switch packing-list items on or off for this trip.',
    access: 'write',
    input: translatable(TripInput),
    run: async ({ ctx }, args) => createTrip(ctx, args),
  }),
  tool({
    name: 'update_trip',
    title: 'Change a trip',
    description:
      'Change any of a trip’s details; its checklist follows (ticks stay). overrides replaces the trip’s on/off switches for packing-list items.',
    access: 'write',
    input: TripPatch.and(z.object({ tripId: idField, ...translationsField })),
    run: async ({ ctx }, { tripId, ...patch }) => updateTrip(ctx, tripId, patch),
  }),
  tool({
    name: 'tick_trip_items',
    title: 'Tick or untick checklist items',
    description: 'Mark items on a trip’s checklist as packed (checked: true) or not.',
    access: 'write',
    input: z.object({
      tripId: idField,
      checkIds: z.array(idField).min(1).max(100),
      checked: z.boolean(),
    }),
    run: async ({ ctx }, args) => {
      for (const id of args.checkIds)
        await updateCheck(ctx, args.tripId, id, { checked: args.checked });
      return getTrip(ctx, args.tripId);
    },
  }),
  tool({
    name: 'shop_for_trip',
    title: 'Put a trip’s things to buy on the shopping list',
    description:
      'Everything on the trip’s checklist marked toBuy (and not yet listed) goes onto the shopping list, needed the day before leaving. Mark items with update_trip_item (toBuy) first.',
    access: 'write',
    input: z.object({ tripId: idField }),
    run: async ({ ctx, locale }, args) => shopForTrip(ctx, args.tripId, locale),
  }),
  tool({
    name: 'update_trip_item',
    title: 'Change a checklist item',
    description: 'On one trip’s checklist: ticked (checked), to buy (toBuy), how many (quantity).',
    access: 'write',
    input: z.object({
      tripId: idField,
      checkId: idField,
      checked: z.boolean().optional(),
      toBuy: z.boolean().optional(),
      quantity: z.number().int().min(1).max(999).optional(),
    }),
    run: async ({ ctx }, { tripId, checkId, ...patch }) => updateCheck(ctx, tripId, checkId, patch),
  }),
  tool({
    name: 'add_trip_item',
    title: 'Add to one trip’s checklist',
    description:
      'Something to take on this trip only (the household’s packing list stays as it is).',
    access: 'write',
    input: CheckInput.and(z.object({ tripId: idField })),
    run: async ({ ctx }, { tripId, ...input }) => addCheck(ctx, tripId, input),
  }),
  tool({
    name: 'add_packing_item',
    title: 'Add to the packing list',
    description:
      'A new item on the household’s packing list, with its group, quantity rule and when it belongs on a trip; upcoming trips get it if it fits them.',
    access: 'write',
    input: translatable(ItemInput),
    run: async ({ ctx }, args) => addItem(ctx, args),
  }),
  tool({
    name: 'add_gear',
    title: 'Add travel gear',
    description:
      'Gear the household travels with, beyond bags: power banks, chargers, cables, adapters, headphones; with connectors (MagSafe, USB-C, USB-A, Lightning…) and how many it has. Trips pick gear with plan_trip/update_trip (gear: [{gearId, count}]).',
    access: 'write',
    input: translatable(GearInput),
    run: async ({ ctx }, args) => addGear(ctx, args),
  }),
  tool({
    name: 'add_bag',
    title: 'Add a bag',
    description:
      'A bag the household owns: name, kind (backpack, handbag, carry-on, suitcase, duffel, other), size in cm.',
    access: 'write',
    input: translatable(BagInput),
    run: async ({ ctx }, args) => addBag(ctx, args),
  }),
];

/** JSON Schema for a tool's input: the zod schema, without the noise (uuid regexes, $schema). */
export function inputSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  delete json.$schema;
  const tidy = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(tidy);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'pattern' && (node as Record<string, unknown>).format === 'uuid') continue;
      out[key] = tidy(value);
    }
    return out;
  };
  const result = tidy(json) as Record<string, unknown>;
  // MCP wants one object schema: alternatives are merged, required only where all agree.
  const variants = (
    Array.isArray(result.anyOf) ? result.anyOf : Array.isArray(result.allOf) ? result.allOf : null
  ) as Array<Record<string, unknown>> | null;
  if (variants) {
    const properties = Object.assign({}, ...variants.map((v) => v.properties ?? {}));
    const required = variants.map((v) => (v.required as string[]) ?? []);
    const shared = result.allOf
      ? [...new Set(required.flat())]
      : required.reduce((a, b) => a.filter((key) => b.includes(key)));
    return { type: 'object', properties, ...(shared.length ? { required: shared } : {}) };
  }
  return { type: 'object', ...result };
}
