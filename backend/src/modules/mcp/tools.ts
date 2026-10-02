import { z } from 'zod';
import type { AppDeps } from '../../context';
import { AppError } from '../../lib/errors';
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
} from '../food/meals';
import { archiveTool, listTools, markDirty, saveTool, wash } from '../food/kitchenware';
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
  ShoppingItemPatch,
  StoreInput,
  UseStockInput,
} from '../food/schemas';
import {
  addShoppingItems,
  checkout,
  listShopping,
  listTrips,
  removeShoppingItem,
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
import type { TokenScope } from '../tokens';

/**
 * The tools Claude gets over MCP. Each calls the same service the app's screens use, so the rules
 * are the same; answers are compact JSON (ids, names, amounts) to keep conversations light.
 */

export type Access = 'read' | 'write' | 'admin';

export interface ToolEnv {
  ctx: FoodCtx;
  deps: AppDeps;
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
}

export const scopeAllows = (scope: TokenScope, access: Access) =>
  access === 'read' ||
  (access === 'write' && scope !== 'food:read') ||
  (access === 'admin' && scope === 'admin');

// ---------------------------------------------------------------- compact shapes for the model

const stockItem = (p: StockedProduct) => ({
  id: p.id,
  name: p.name,
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
    ...(i.warnings.length ? { warnings: i.warnings.map((w) => `${w.kind === 'allergy' ? 'ALLERGY' : 'avoids'}: ${w.person}`) } : {}),
  }));

const recipeBrief = (r: Recipe) => ({
  id: r.id,
  title: r.title,
  servings: r.servings,
  minutes: (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) || null,
  tags: r.tags,
  ...(r.favorite ? { favorite: true } : {}),
  ready: r.availability.ready,
  have: `${r.availability.have}/${r.availability.total}`,
  missing: r.availability.missing.map((m) => m.name),
  usesSoonExpiring: r.availability.useSoon,
  ...(r.availability.warnings.length ? { warnings: r.availability.warnings.map((w) => `${w.person} ${w.kind === 'allergy' ? 'is ALLERGIC to' : 'avoids'} ${w.item}`) } : {}),
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
  recipeId: m.recipeId,
  servings: m.servings,
  status: m.status,
  ...(m.note ? { note: m.note } : {}),
  ingredients: lines(m.ingredients),
  missing: m.availability.missing.map((x) => `${x.name} (${x.missing} ${x.unit})`),
});

// ---------------------------------------------------------------- the tools

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
    description: 'The people sharing this kitchen and their allergies and foods they avoid. Check before suggesting or planning recipes.',
    access: 'read',
    input: z.object({}),
    run: async ({ ctx }) => ({
      people: (await kitchenPeople(ctx)).map((p) => ({ id: p.id, name: `${p.name} ${p.surname}`.trim() })),
      restrictions: (await listRestrictions(ctx)).map((r) => ({ id: r.id, person: r.person, kind: r.kind, food: r.productName ?? `any ${r.category}`, note: r.note || undefined })),
    }),
  }),
  tool({
    name: 'set_restriction',
    title: 'Record an allergy or dislike',
    description: 'Someone in the kitchen is allergic to (allergy) or doesn’t eat (avoid) an item by name, or a whole category (fish, dairy, meat…).',
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
    description: 'Pots, pans, bowls, glasses and other things the kitchen counts: how many, how many are clean, dirty or in the dishwasher (and until when).',
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
    input: ToolInput.extend({ toolId: idField.optional(), used: z.number().int().min(1).max(50).optional(), remove: z.boolean().optional() }),
    run: async ({ ctx }, { toolId, used, remove, ...input }) => {
      if (toolId && remove) {
        await archiveTool(ctx, toolId);
        return { removed: toolId };
      }
      let saved = toolId || input.name ? await saveTool(ctx, { ...input, ...(toolId ? { id: toolId } : {}) }) : null;
      if (used && saved) saved = await markDirty(ctx, saved.id, used);
      if (!saved) throw new AppError(400, 'VALIDATION', 'Say which: toolId or name');
      return { tool: saved };
    },
  }),
  tool({
    name: 'wash_kitchenware',
    title: 'Wash the dishes',
    description: 'how: hand (clean now) or machine (clean when the dishwasher is done). toolIds omitted: everything dirty.',
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
      'Create a catalog item, or change one (productId): icon, category, unit, piece size, place, shelf life, frozen/thawed days, running-low amount, usual store, and trackMode (exact amounts, level = full/low/out for spices and sauces, none = always there).',
    access: 'write',
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
    input: RecipeInput.partial().and(z.object({ recipeId: idField.optional() })),
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
    input: MealInput,
    run: async ({ ctx }, args) => meal(await planMeal(ctx, args)),
  }),
  tool({
    name: 'update_meal',
    title: 'Change a planned meal',
    description:
      'Move, rescale, swap the recipe, skip (status: skipped) or annotate a meal; ingredients (optional) replace its list for that day only, e.g. to use a specific lot.',
    access: 'write',
    input: MealPatchFields.partial().extend({
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
    input: z.object({ mealId: idField, lineId: idField, choice: z.number().int().min(0).max(4).nullable() }),
    run: async ({ ctx }, { mealId, lineId, choice }) => meal(await setLineChoice(ctx, mealId, lineId, choice)),
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
    description: 'Renames a part, changes its kind, or rescales it (its lines follow). Use remove: true to take it off the meal.',
    access: 'write',
    input: MealPartPatchFields.partial().extend({ mealId: idField, partId: idField, remove: z.boolean().optional() }),
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
    input: StoreInput,
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
    description: 'Admin: name, email, role, or switch an account off/on (isActive).',
    access: 'admin',
    input: z.object({
      userId: idField,
      email: z.string().max(254).optional(),
      name: z.string().max(60).optional(),
      surname: z.string().max(60).optional(),
      role: z.enum(['member', 'admin']).optional(),
      isActive: z.boolean().optional(),
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
