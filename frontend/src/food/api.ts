import { api, query } from '@/services/api/client';
import type {
  AccessKey,
  Category,
  KitchenPerson,
  Reminder,
  Restriction,
  FoodOverview,
  IngredientInput,
  Location,
  Lot,
  Meal,
  MealPartInput,
  NeedLine,
  OutKind,
  Opened,
  PackageInput,
  PartKind,
  Preset,
  PricePoint,
  Product,
  Recipe,
  RecipeInput,
  ShoppingItem,
  Slot,
  StockEvent,
  StockedProduct,
  Store,
  StoreTone,
  Tool,
  ToolInput,
  ToolKind,
  Trip,
  UseResult,
} from './types';

/** /api/food and the AI access keys. */

export const foodKeys = {
  all: ['food'] as const,
  overview: ['food', 'overview'] as const,
  presets: ['food', 'presets'] as const,
  kitchen: ['food', 'kitchen'] as const,
  product: (id: string) => ['food', 'product', id] as const,
  products: (q: string) => ['food', 'products', q] as const,
  shopping: ['food', 'shopping'] as const,
  trips: ['food', 'trips'] as const,
  trip: (id: string) => ['food', 'trip', id] as const,
  recipes: ['food', 'recipes'] as const,
  recipe: (id: string, servings?: number) => ['food', 'recipe', id, servings ?? null] as const,
  meals: (from: string, to: string) => ['food', 'meals', from, to] as const,
  needs: (from: string, to: string) => ['food', 'needs', from, to] as const,
  keys: ['me', 'keys'] as const,
  people: ['food', 'people'] as const,
  reminders: ['me', 'reminders'] as const,
  kitchenware: ['food', 'kitchenware'] as const,
};

type Shortfall = { name: string; missing: number; unit: string };

export interface AddStockBody {
  productId?: string;
  name?: string;
  /** Required unless packages are given. */
  quantity?: number;
  unit?: string;
  variant?: string;
  /** What the packages are called (jar, bottle), and what was bought, one entry per size. */
  package?: string;
  packages?: PackageInput[];
  /** How much one `unit` holds this time (a jar of 14). */
  each?: number;
  location?: Location;
  expiresOn?: string | null;
  price?: number | null;
  storeId?: string | null;
  note?: string;
}

export interface ShoppingLineBody {
  productId?: string;
  name?: string;
  amount?: number | null;
  unit?: string | null;
  storeId?: string | null;
  note?: string;
  variant?: string;
  priority?: boolean;
  needBy?: string | null;
}

export interface MealBody {
  date: string;
  time?: string | null;
  slot?: Slot;
  recipeId?: string | null;
  title?: string;
  servings?: number;
  note?: string;
  toGo?: boolean;
  ingredients?: IngredientInput[];
  parts?: MealPartInput[];
  out?: { kind: OutKind; place?: string; cost?: number | null };
}

export interface CheckoutLine {
  id: string;
  price?: number | null;
  amount?: number | null;
  unit?: string | null;
  expiresOn?: string | null;
  location?: Location;
  addToKitchen?: boolean;
  package?: string;
  bought?: PackageInput[] | null;
  variant?: string;
  keepRest?: boolean;
}

export const foodApi = {
  overview: (today: string) => api.get<FoodOverview>(`/food/overview${query({ today })}`),
  presets: () => api.get<{ presets: Preset[] }>('/food/presets').then((r) => r.presets),

  kitchen: () => api.get<{ products: StockedProduct[] }>('/food/kitchen').then((r) => r.products),
  products: (q = '') => api.get<{ products: Product[] }>(`/food/products${query({ q })}`).then((r) => r.products),
  product: (id: string) => api.get<{ product: StockedProduct; events: StockEvent[]; prices: PricePoint[] }>(`/food/products/${id}`),
  createProduct: (body: Partial<Product> & { name: string }) => api.post<{ product: Product }>('/food/products', body).then((r) => r.product),
  updateProduct: (id: string, body: Partial<Product>) => api.patch<{ product: Product }>(`/food/products/${id}`, body).then((r) => r.product),
  archiveProduct: (id: string) => api.delete<void>(`/food/products/${id}`),

  addStock: (body: AddStockBody) => api.post<{ product: Product; lot: Lot | null; lots: Lot[] }>('/food/stock', body),
  pour: (lotId: string, body: { quantity: number; unit?: string; intoLotId?: string; package?: string; packageSize?: number; location?: Location; note?: string }) =>
    api.post<{ from: Lot; into: Lot }>(`/food/lots/${lotId}/pour`, body),
  refreshCatalog: () => api.post<{ changed: number }>('/food/products/refresh'),
  useStock: (body: { productId: string; quantity: number; unit?: string; lotId?: string; wasted?: boolean }) =>
    api.post<{ result: UseResult }>('/food/stock/use', body).then((r) => r.result),
  undo: (events: number[]) => api.post<{ undone: number }>('/food/stock/undo', { events }),
  setLevel: (id: string, level: 'full' | 'low' | 'out') => api.put<{ product: Product }>(`/food/products/${id}/level`, { level }).then((r) => r.product),
  guess: (name: string) => api.get<{ guess: Preset | null; match: { item: string; variant: string } | null }>(`/food/guess${query({ name })}`),
  updateLot: (id: string, body: { quantity?: number; unit?: string; location?: Location; expiresOn?: string | null; opened?: boolean; price?: number | null; note?: string }) =>
    api.patch<{ lot: Lot }>(`/food/lots/${id}`, body).then((r) => r.lot),
  removeLot: (id: string) => api.delete<void>(`/food/lots/${id}`),

  stores: () => api.get<{ stores: Store[] }>('/food/stores').then((r) => r.stores),
  createStore: (body: { name: string; tone?: StoreTone }) => api.post<{ store: Store }>('/food/stores', body).then((r) => r.store),
  updateStore: (id: string, body: { name?: string; tone?: StoreTone; sort?: number }) => api.patch<{ store: Store }>(`/food/stores/${id}`, body).then((r) => r.store),
  deleteStore: (id: string) => api.delete<void>(`/food/stores/${id}`),

  shopping: () => api.get<{ items: ShoppingItem[]; stores: Store[] }>('/food/shopping'),
  addLines: (items: ShoppingLineBody[], source?: 'manual' | 'plan' | 'low_stock' | 'recipe') =>
    api.post<{ items: ShoppingItem[] }>('/food/shopping/items', { items, ...(source ? { source } : {}) }).then((r) => r.items),
  updateLine: (
    id: string,
    body: {
      checked?: boolean;
      amount?: number | null;
      unit?: string | null;
      price?: number | null;
      storeId?: string | null;
      note?: string;
      priority?: boolean;
      needBy?: string | null;
      variant?: string;
      package?: string;
      bought?: PackageInput[] | null;
    },
  ) =>
    api.patch<{ item: ShoppingItem }>(`/food/shopping/items/${id}`, body).then((r) => r.item),
  removeLine: (id: string) => api.delete<void>(`/food/shopping/items/${id}`),
  checkout: (body: { storeId: string | null; lines: CheckoutLine[] }) =>
    api.post<{ trip: Trip; stocked: number; notStocked: string[]; leftOver: string[] }>('/food/shopping/checkout', body),
  trips: () => api.get<{ trips: Trip[] }>('/food/shopping/trips').then((r) => r.trips),
  trip: (id: string) => api.get<{ trip: Trip; items: ShoppingItem[] }>(`/food/shopping/trips/${id}`),
  updateTripLine: (tripId: string, id: string, body: { price?: number | null; amount?: number; unit?: string }) =>
    api.patch<{ trip: Trip; items: ShoppingItem[] }>(`/food/shopping/trips/${tripId}/items/${id}`, body),

  recipes: () => api.get<{ recipes: Recipe[] }>('/food/recipes').then((r) => r.recipes),
  recipe: (id: string, servings?: number) => api.get<{ recipe: Recipe }>(`/food/recipes/${id}${query({ servings })}`).then((r) => r.recipe),
  createRecipe: (body: RecipeInput) => api.post<{ recipe: Recipe }>('/food/recipes', body).then((r) => r.recipe),
  updateRecipe: (id: string, body: Partial<RecipeInput>) => api.patch<{ recipe: Recipe }>(`/food/recipes/${id}`, body).then((r) => r.recipe),
  deleteRecipe: (id: string) => api.delete<void>(`/food/recipes/${id}`),
  cook: (id: string, body: { servings?: number; leftovers?: { portions: number }; choices?: Record<string, number> }) =>
    api.post<{ meal: Meal; shortfalls: Shortfall[]; opened: Opened[] }>(`/food/recipes/${id}/cook`, body),

  meals: (from: string, to: string) => api.get<{ meals: Meal[] }>(`/food/meals${query({ from, to })}`).then((r) => r.meals),
  planMeal: (body: MealBody) => api.post<{ meal: Meal }>('/food/meals', body).then((r) => r.meal),
  updateMeal: (id: string, body: Partial<Omit<MealBody, 'ingredients'>> & { status?: 'planned' | 'skipped'; toGo?: boolean }) =>
    api.patch<{ meal: Meal }>(`/food/meals/${id}`, body).then((r) => r.meal),
  setMealIngredients: (id: string, ingredients: IngredientInput[]) => api.put<{ meal: Meal }>(`/food/meals/${id}/ingredients`, { ingredients }).then((r) => r.meal),
  completeMeal: (id: string, body: { leftovers?: { portions: number } }) =>
    api.post<{ meal: Meal; shortfalls: Shortfall[]; opened: Opened[] }>(`/food/meals/${id}/done`, body),
  setChoice: (mealId: string, lineId: string, choice: number | null) =>
    api.put<{ meal: Meal }>(`/food/meals/${mealId}/ingredients/${lineId}/choice`, { choice }).then((r) => r.meal),
  addPart: (mealId: string, body: MealPartInput) => api.post<{ meal: Meal }>(`/food/meals/${mealId}/parts`, body).then((r) => r.meal),
  updatePart: (mealId: string, partId: string, body: { title?: string; kind?: PartKind; servings?: number }) =>
    api.patch<{ meal: Meal }>(`/food/meals/${mealId}/parts/${partId}`, body).then((r) => r.meal),
  removePart: (mealId: string, partId: string) => api.delete<{ meal: Meal }>(`/food/meals/${mealId}/parts/${partId}`).then((r) => r.meal),
  eatOut: (id: string, body: { kind: OutKind; place?: string; cost?: number | null }) => api.post<{ meal: Meal }>(`/food/meals/${id}/out`, body).then((r) => r.meal),
  reopenMeal: (id: string) => api.post<{ meal: Meal }>(`/food/meals/${id}/reopen`).then((r) => r.meal),
  uncook: (id: string) => api.post<void>(`/food/meals/${id}/uncook`),
  deleteMeal: (id: string) => api.delete<void>(`/food/meals/${id}`),
  needs: (from: string, to: string) => api.get<{ lines: NeedLine[]; toCheck: Array<{ name: string; meal: string }> }>(`/food/plan/needs${query({ from, to })}`),
};

export const kitchenwareApi = {
  list: () =>
    api.get<{ tools: Tool[]; dishwasherMinutes: number; kinds: ToolKind[]; icons: string[]; presets: Array<{ name: string; icon: string; kind: ToolKind; washable?: boolean }> }>(
      '/food/kitchenware',
    ),
  create: (body: ToolInput & { name: string }) => api.post<{ tool: Tool }>('/food/kitchenware', body).then((r) => r.tool),
  update: (id: string, body: ToolInput) => api.patch<{ tool: Tool }>(`/food/kitchenware/${id}`, body).then((r) => r.tool),
  remove: (id: string) => api.delete<void>(`/food/kitchenware/${id}`),
  used: (id: string, count = 1) => api.post<{ tool: Tool }>(`/food/kitchenware/${id}/used`, { count }).then((r) => r.tool),
  wash: (body: { how: 'hand' | 'machine'; toolIds?: string[]; minutes?: number }) => api.post<{ tools: Tool[] }>('/food/kitchenware/wash', body).then((r) => r.tools),
  unload: () => api.post<{ tools: Tool[] }>('/food/kitchenware/unload').then((r) => r.tools),
  setDishwasher: (minutes: number) => api.put<{ dishwasherMinutes: number }>('/food/kitchenware/dishwasher', { minutes }),
};

export const peopleApi = {
  list: () => api.get<{ people: KitchenPerson[]; restrictions: Restriction[] }>('/food/people'),
  add: (body: { userId: string; kind: 'allergy' | 'avoid'; productId?: string; name?: string; category?: Category; note?: string }) =>
    api.post<{ restriction: Restriction }>('/food/restrictions', body).then((r) => r.restriction),
  remove: (id: string) => api.delete<void>(`/food/restrictions/${id}`),
};

export const remindersApi = {
  list: () => api.get<{ reminders: Reminder[]; push: { available: boolean; publicKey: string | null; devices: number } }>('/me/reminders'),
  create: (body: Partial<Omit<Reminder, 'id'>>) => api.post<{ reminder: Reminder }>('/me/reminders', body).then((r) => r.reminder),
  update: (id: string, body: Partial<Omit<Reminder, 'id' | 'kind'>>) => api.patch<{ reminder: Reminder }>(`/me/reminders/${id}`, body).then((r) => r.reminder),
  remove: (id: string) => api.delete<void>(`/me/reminders/${id}`),
  subscribe: (subscription: PushSubscriptionJSON) => api.post<{ devices: number }>('/me/push', subscription),
  unsubscribe: (endpoint: string) => api.delete<void>('/me/push', { endpoint }),
  test: () => api.post<{ sent: number }>('/me/push/test'),
};

export const keysApi = {
  list: () => api.get<{ keys: AccessKey[] }>('/me/tokens').then((r) => r.keys),
  create: (body: { name: string; scope: AccessKey['scope'] }) => api.post<{ token: string; key: AccessKey }>('/me/tokens', body),
  revoke: (id: string) => api.delete<void>(`/me/tokens/${id}`),
};
