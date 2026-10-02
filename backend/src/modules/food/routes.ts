import { Hono, type Context } from 'hono';
import type { AppDeps, AppEnv } from '../../context';
import { AppError } from '../../lib/errors';
import { readJson, readQuery } from '../../lib/validation';
import { requireAuth } from '../../middleware/auth';
import { z } from 'zod';
import { foodCtx, requireKitchen } from './kitchen';
import { addMealPart, completeMeal, cookRecipe, deleteMeal, getMeal, listMeals, planMeal, removeMealPart, reopenMeal, setMealIngredients, uncookMeal, updateMeal, updateMealPart } from './meals';
import {
  archiveTool,
  dishwasherMinutes,
  listTools,
  markDirty,
  saveTool,
  setDishwasherMinutes,
  TOOL_ICONS,
  TOOL_KINDS,
  TOOL_PRESETS,
  unloadDishwasher,
  wash,
} from './kitchenware';
import { overview } from './overview';
import { planNeeds } from './plan';
import { addRestriction, kitchenPeople, listRestrictions, removeRestriction } from './restrictions';
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from './recipes';
import { CATEGORIES, FOOD_ICONS, LOCATIONS, PRESETS, presetOrGuess, type Location } from './presets';
import { archiveProduct, createProduct, listProducts, refreshFromCatalog, updateProduct } from './products';
import {
  AddShoppingInput,
  AddStockInput,
  CheckoutInput,
  CompleteMealInput,
  CookInput,
  dateField,
  LevelInput,
  LotPatch,
  MealIngredientsInput,
  MealInput,
  MealPartInput,
  MealPartPatch,
  MealPatch,
  PourInput,
  ToolInput,
  WashInput,
  ProductInput,
  ProductPatch,
  RangeQuery,
  RecipeInput,
  RecipePatch,
  RestrictionInput,
  UndoInput,
  ShoppingItemPatch,
  StoreInput,
  StorePatch,
  TripItemPatch,
  UseStockInput,
} from './schemas';
import { addShoppingItems, checkout, getTrip, listShopping, listTrips, removeShoppingItem, updateShoppingItem, updateTripItem } from './shopping';
import { addStock, kitchen, pourLot, productDetail, removeLot, setLevel, undoEvents, updateLot, useStock } from './stock';
import { createStore, deleteStore, listStores, updateStore } from './stores';

/** /api/food — the kitchen's products and stock (stores, lists, recipes and plan join in later phases). */
export function foodRoutes(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(deps), requireKitchen(deps));
  const ctx = (c: Context<AppEnv>) => foodCtx(deps, c.get('actor'));

  app.get('/overview', async (c) => c.json(await overview(ctx(c), readQuery(c, z.object({ today: dateField.optional() })).today)));

  app.get('/presets', (c) => c.json({ presets: PRESETS, categories: CATEGORIES, icons: FOOD_ICONS, locations: LOCATIONS }));

  // What a name the catalog doesn't know probably is ("Smoked salt" → a spice, kept by level).
  app.get('/guess', (c) => c.json({ guess: presetOrGuess((c.req.query('name') ?? '').slice(0, 80)) }));

  app.put('/products/:id/level', async (c) => c.json({ product: await setLevel(ctx(c), c.req.param('id'), (await readJson(c, LevelInput)).level) }));
  app.get('/products', async (c) => c.json({ products: await listProducts(ctx(c), c.req.query('q') ?? '') }));
  app.post('/products', async (c) => c.json({ product: await createProduct(ctx(c), await readJson(c, ProductInput)) }, 201));
  app.get('/products/:id', async (c) => c.json(await productDetail(ctx(c), c.req.param('id'))));
  app.patch('/products/:id', async (c) => c.json({ product: await updateProduct(ctx(c), c.req.param('id'), await readJson(c, ProductPatch)) }));
  app.delete('/products/:id', async (c) => {
    await archiveProduct(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/kitchen', async (c) => {
    const location = c.req.query('location');
    if (location && !(LOCATIONS as readonly string[]).includes(location)) throw new AppError(400, 'VALIDATION', 'Unknown place');
    return c.json({ products: await kitchen(ctx(c), { location: location as Location | undefined }) });
  });
  app.post('/products/refresh', async (c) => c.json({ changed: await refreshFromCatalog(ctx(c)) }));
  app.post('/stock', async (c) => c.json(await addStock(ctx(c), await readJson(c, AddStockInput)), 201));
  app.post('/stock/use', async (c) => c.json({ result: await useStock(ctx(c), await readJson(c, UseStockInput)) }));
  app.post('/stock/undo', async (c) => c.json({ undone: await undoEvents(ctx(c), (await readJson(c, UndoInput)).events) }));
  app.patch('/lots/:id', async (c) => c.json({ lot: await updateLot(ctx(c), c.req.param('id'), await readJson(c, LotPatch)) }));
  app.post('/lots/:id/pour', async (c) => c.json(await pourLot(ctx(c), c.req.param('id'), await readJson(c, PourInput))));
  app.delete('/lots/:id', async (c) => {
    await removeLot(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/people', async (c) => c.json({ people: await kitchenPeople(ctx(c)), restrictions: await listRestrictions(ctx(c)) }));
  app.post('/restrictions', async (c) => c.json({ restriction: await addRestriction(ctx(c), await readJson(c, RestrictionInput)) }, 201));
  app.delete('/restrictions/:id', async (c) => {
    await removeRestriction(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/stores', async (c) => c.json({ stores: await listStores(ctx(c)) }));
  app.post('/stores', async (c) => c.json({ store: await createStore(ctx(c), await readJson(c, StoreInput)) }, 201));
  app.patch('/stores/:id', async (c) => c.json({ store: await updateStore(ctx(c), c.req.param('id'), await readJson(c, StorePatch)) }));
  app.delete('/stores/:id', async (c) => {
    await deleteStore(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/shopping', async (c) => c.json({ items: await listShopping(ctx(c)), stores: await listStores(ctx(c)) }));
  app.post('/shopping/items', async (c) => {
    const body = await readJson(c, AddShoppingInput);
    return c.json({ items: await addShoppingItems(ctx(c), body.items, body.source) }, 201);
  });
  app.patch('/shopping/items/:id', async (c) => c.json({ item: await updateShoppingItem(ctx(c), c.req.param('id'), await readJson(c, ShoppingItemPatch)) }));
  app.delete('/shopping/items/:id', async (c) => {
    await removeShoppingItem(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/shopping/checkout', async (c) => c.json(await checkout(ctx(c), await readJson(c, CheckoutInput)), 201));
  app.get('/shopping/trips', async (c) => c.json({ trips: await listTrips(ctx(c)) }));
  app.get('/shopping/trips/:id', async (c) => c.json(await getTrip(ctx(c), c.req.param('id'))));
  app.patch('/shopping/trips/:tripId/items/:id', async (c) =>
    c.json(await updateTripItem(ctx(c), c.req.param('tripId'), c.req.param('id'), await readJson(c, TripItemPatch))),
  );

  app.get('/recipes', async (c) => c.json({ recipes: await listRecipes(ctx(c)) }));
  app.post('/recipes', async (c) => c.json({ recipe: await createRecipe(ctx(c), await readJson(c, RecipeInput)) }, 201));
  app.get('/recipes/:id', async (c) => {
    const { servings } = readQuery(c, z.object({ servings: z.coerce.number().int().min(1).max(100).optional() }));
    return c.json({ recipe: await getRecipe(ctx(c), c.req.param('id'), servings) });
  });
  app.patch('/recipes/:id', async (c) => c.json({ recipe: await updateRecipe(ctx(c), c.req.param('id'), await readJson(c, RecipePatch)) }));
  app.delete('/recipes/:id', async (c) => {
    await deleteRecipe(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/recipes/:id/cook', async (c) => c.json(await cookRecipe(ctx(c), c.req.param('id'), await readJson(c, CookInput)), 201));

  app.get('/meals', async (c) => {
    const { from, to } = readQuery(c, RangeQuery);
    return c.json({ meals: await listMeals(ctx(c), from, to) });
  });
  app.post('/meals', async (c) => c.json({ meal: await planMeal(ctx(c), await readJson(c, MealInput)) }, 201));
  app.get('/meals/:id', async (c) => c.json({ meal: await getMeal(ctx(c), c.req.param('id')) }));
  app.patch('/meals/:id', async (c) => c.json({ meal: await updateMeal(ctx(c), c.req.param('id'), await readJson(c, MealPatch)) }));
  app.put('/meals/:id/ingredients', async (c) =>
    c.json({ meal: await setMealIngredients(ctx(c), c.req.param('id'), (await readJson(c, MealIngredientsInput)).ingredients) }),
  );
  app.post('/meals/:id/parts', async (c) => c.json({ meal: await addMealPart(ctx(c), c.req.param('id'), await readJson(c, MealPartInput)) }, 201));
  app.patch('/meals/:id/parts/:partId', async (c) =>
    c.json({ meal: await updateMealPart(ctx(c), c.req.param('id'), c.req.param('partId'), await readJson(c, MealPartPatch)) }),
  );
  app.delete('/meals/:id/parts/:partId', async (c) => c.json({ meal: await removeMealPart(ctx(c), c.req.param('id'), c.req.param('partId')) }));
  app.post('/meals/:id/done', async (c) => c.json(await completeMeal(ctx(c), c.req.param('id'), await readJson(c, CompleteMealInput))));
  app.post('/meals/:id/reopen', async (c) => c.json({ meal: await reopenMeal(ctx(c), c.req.param('id')) }));
  app.post('/meals/:id/uncook', async (c) => {
    await uncookMeal(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.delete('/meals/:id', async (c) => {
    await deleteMeal(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });

  app.get('/kitchenware', async (c) =>
    c.json({
      tools: await listTools(ctx(c)),
      dishwasherMinutes: await dishwasherMinutes(ctx(c)),
      kinds: TOOL_KINDS,
      icons: TOOL_ICONS,
      presets: TOOL_PRESETS,
    }),
  );
  app.post('/kitchenware', async (c) => c.json({ tool: await saveTool(ctx(c), await readJson(c, ToolInput.extend({ name: z.string().trim().min(1, 'Name it').max(60) }))) }, 201));
  app.patch('/kitchenware/:id', async (c) => c.json({ tool: await saveTool(ctx(c), { ...(await readJson(c, ToolInput)), id: c.req.param('id') }) }));
  app.delete('/kitchenware/:id', async (c) => {
    await archiveTool(ctx(c), c.req.param('id'));
    return c.body(null, 204);
  });
  app.post('/kitchenware/:id/used', async (c) => {
    const { count } = await readJson(c, z.object({ count: z.number().int().min(1).max(50).default(1) }));
    return c.json({ tool: await markDirty(ctx(c), c.req.param('id'), count) });
  });
  app.post('/kitchenware/wash', async (c) => c.json({ tools: await wash(ctx(c), await readJson(c, WashInput)) }));
  app.post('/kitchenware/unload', async (c) => c.json({ tools: await unloadDishwasher(ctx(c)) }));
  app.put('/kitchenware/dishwasher', async (c) => {
    const { minutes } = await readJson(c, z.object({ minutes: z.number().int().min(10).max(600) }));
    return c.json({ dishwasherMinutes: await setDishwasherMinutes(ctx(c), minutes) });
  });

  app.get('/plan/needs', async (c) => {
    const { from, to } = readQuery(c, RangeQuery);
    return c.json(await planNeeds(ctx(c), from, to));
  });

  return app;
}
