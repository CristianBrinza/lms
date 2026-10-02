/** Food API shapes (mirrors backend/src/modules/food). Quantities are in the item's base unit. */

export type BaseUnit = 'pcs' | 'g' | 'ml';
export type Unit = 'pcs' | 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup';
export type Location = 'fridge' | 'freezer' | 'pantry' | 'garden' | 'other';
export type TrackMode = 'exact' | 'level' | 'none';
export type Level = 'full' | 'low' | 'out';
export type Category =
  | 'produce'
  | 'bakery'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'frozen'
  | 'pantry'
  | 'spices'
  | 'drinks'
  | 'snacks'
  | 'meals'
  | 'household'
  | 'other';
export type Via = 'app' | 'ai';
export type StoreTone = 'butter' | 'cyan' | 'pink' | 'mint' | 'lav' | 'peach' | 'ink';
export type Slot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Product {
  id: string;
  name: string;
  icon: string;
  category: Category;
  unit: BaseUnit;
  pieceSize: number | null;
  pieceUnit: 'g' | 'ml' | null;
  location: Location;
  shelfLifeDays: number | null;
  openedDays: number | null;
  trackMode: TrackMode;
  level: Level;
  levelAt: string | null;
  trackStock: boolean;
  freezerDays: number | null;
  thawedDays: number | null;
  minStock: number | null;
  storeId: string | null;
  note: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Lot {
  id: string;
  productId: string;
  quantity: number;
  initialQuantity: number;
  location: Location;
  addedAt: string;
  expiresOn: string | null;
  openedAt: string | null;
  price: number | null;
  storeId: string | null;
  storeName: string | null;
  tripId: string | null;
  note: string;
}

export interface StockedProduct extends Product {
  total: number;
  totalHere?: number;
  lots: Lot[];
  nextExpiry: string | null;
  low: boolean;
}

export interface StockEvent {
  id: number;
  kind: 'added' | 'used' | 'wasted' | 'adjusted' | 'moved' | 'restored' | 'level';
  delta: number;
  lotId: string | null;
  mealId: string | null;
  note: string;
  via: Via;
  actor: string | null;
  createdAt: string;
}

export interface PricePoint {
  storeId: string | null;
  storeName: string | null;
  price: number;
  quantity: number;
  unitPrice: number;
  boughtAt: string;
}

export interface Preset {
  name: string;
  aliases?: string[];
  icon: string;
  category: Category;
  unit: BaseUnit;
  location: Location;
  shelfLifeDays?: number;
  pieceSize?: number;
  pieceUnit?: 'g' | 'ml';
  openedDays?: number;
  track?: TrackMode;
  freezerDays?: number;
  thawedDays?: number;
}

export interface UseResult {
  productId: string;
  used: number;
  shortfall: number;
  lots: Array<{ lotId: string; taken: number; left: number }>;
  events: number[];
}

export interface Store {
  id: string;
  name: string;
  tone: StoreTone;
  sort: number;
  open: number;
  inCart: number;
  createdAt: string;
}

export interface ShoppingItem {
  id: string;
  storeId: string | null;
  productId: string | null;
  name: string;
  icon: string;
  category: Category;
  amount: number | null;
  unit: Unit | null;
  note: string;
  source: 'manual' | 'plan' | 'low_stock' | 'recipe' | 'ai';
  checked: boolean;
  price: number | null;
  lastPrice: { price: number; storeName: string | null; boughtAt: string } | null;
  estimate: number | null;
  createdAt: string;
}

export interface Trip {
  id: string;
  storeId: string | null;
  storeName: string;
  total: number | null;
  itemCount: number;
  finishedAt: string;
}

export interface IngredientLine {
  id: string;
  productId: string | null;
  lotId: string | null;
  name: string;
  icon: string;
  amount: number | null;
  unit: Unit | null;
  note: string;
  optional: boolean;
  inStock: number | null;
  level: Level | null;
  baseUnit: BaseUnit | null;
  enough: boolean | null;
  missing: number;
  expiresSoon: boolean;
}

export interface Availability {
  have: number;
  total: number;
  ready: boolean;
  missing: Array<{ productId: string; name: string; missing: number; unit: BaseUnit }>;
  useSoon: number;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  tags: string[];
  steps: string[];
  icon: string;
  sourceUrl: string;
  notes: string;
  favorite: boolean;
  createdVia: Via;
  createdAt: string;
  updatedAt: string;
  shownServings: number;
  ingredients: IngredientLine[];
  availability: Availability;
  timesCooked: number;
  lastCooked: string | null;
}

export interface Meal {
  id: string;
  date: string;
  time: string | null;
  slot: Slot;
  recipeId: string | null;
  title: string;
  icon: string;
  servings: number;
  status: 'planned' | 'done' | 'skipped';
  note: string;
  doneAt: string | null;
  createdVia: Via;
  leftoversLotId: string | null;
  ingredients: IngredientLine[];
  availability: Availability;
}

export interface NeedLine {
  productId: string;
  name: string;
  icon: string;
  category: Category;
  unit: BaseUnit;
  needed: number;
  inStock: number;
  onList: number;
  toBuy: number;
  toBuyAmount: number;
  toBuyUnit: Unit;
  storeId: string | null;
  level: 'low' | 'out' | null;
  meals: Array<{ id: string; title: string; date: string }>;
}

export interface FoodOverview {
  kitchen: { name: string; currency: string };
  stock: {
    products: number;
    expiring: Array<{ lotId: string; productId: string; name: string; icon: string; quantity: number; unit: BaseUnit; expiresOn: string }>;
    expired: number;
    low: Array<{ productId: string; name: string; icon: string; total: number; minStock: number; unit: BaseUnit; level: Level | null }>;
  };
  recipes: { total: number; ready: number; favorites: number };
  shopping: { open: number; inCart: number; stores: Array<{ id: string; name: string; tone: StoreTone; open: number }>; anyStore: number };
  meals: { today: Meal[]; upcoming: Meal[]; plannedThisWeek: number };
}

export interface IngredientInput {
  productId?: string;
  name: string;
  amount?: number | null;
  unit?: Unit | null;
  note?: string;
  optional?: boolean;
  link?: boolean;
  lotId?: string | null;
}

export interface RecipeInput {
  title: string;
  description?: string;
  servings?: number;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  tags?: string[];
  steps?: string[];
  icon?: string;
  sourceUrl?: string;
  notes?: string;
  favorite?: boolean;
  ingredients?: IngredientInput[];
}

export interface AccessKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'food:read' | 'food' | 'admin';
  createdAt: string;
  lastUsedAt: string | null;
}
