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

export interface CustomUnit {
  name: string;
  plural?: string;
  /** How much one usually holds, in the item's base unit (a loaf: 20 slices; a jar of honey: 400 g). */
  size: number;
  /** Sizes it comes in, to pick from (a bottle of cola: 500, 1000, 1250… ml). */
  sizes?: number[];
}

/** Packages bought: "2 cans of 300 g". Sizes in the item's base unit unless sizeUnit says. */
export interface PackageInput {
  count: number;
  size: number;
  sizeUnit?: string;
}

export interface Warning {
  person: string;
  kind: 'allergy' | 'avoid';
}

export interface PlannedMealRef {
  id: string;
  title: string;
  date: string;
}

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
  /** Where it goes once opened (an opened can: the fridge). */
  openedLocation: Location | null;
  trackMode: TrackMode;
  level: Level;
  levelAt: string | null;
  trackStock: boolean;
  freezerDays: number | null;
  thawedDays: number | null;
  units: CustomUnit[];
  variants: string[];
  /** A picture per kind (keys in lower case), where the catalog has one. */
  variantIcons?: Record<string, string>;
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
  variant: string;
  /** The package it came in (jar, bottle, loaf) and what one held; '' and null when loose. */
  package: string;
  packageSize: number | null;
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
  openedLocation?: Location;
  track?: TrackMode;
  freezerDays?: number;
  thawedDays?: number;
  units?: CustomUnit[];
  variants?: string[];
  variantIcons?: Record<string, string>;
}

export interface UseResult {
  productId: string;
  used: number;
  shortfall: number;
  lots: Array<{
    lotId: string;
    taken: number;
    left: number;
    opened: boolean;
    expiresOn: string | null;
    location: Location;
  }>;
  events: number[];
}

/** A package cooking opened. */
export interface Opened {
  productId: string;
  lotId: string;
  name: string;
  left: number;
  unit: BaseUnit;
  expiresOn: string | null;
  location: Location;
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
  unit: string | null;
  note: string;
  variant: string;
  priority: boolean;
  needBy: string | null;
  source: 'manual' | 'plan' | 'low_stock' | 'recipe' | 'ai';
  checked: boolean;
  price: number | null;
  lastPrice: { price: number; storeName: string | null; boughtAt: string } | null;
  estimate: number | null;
  /** At least this much, in the base unit (null: no amount asked). */
  need: number | null;
  /** What was really bought, package by package (sizes in the base unit). */
  bought: Array<{ count: number; size: number }> | null;
  package: string;
  boughtTotal: number | null;
  baseUnit: BaseUnit | null;
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
  /** The meal part it belongs to (meals only). */
  partId: string | null;
  /** Only this type will do ('' for any). */
  variant: string;
  /** Or one of these instead, in order. */
  alternatives: Array<{
    productId: string | null;
    name: string;
    icon: string;
    amount: number | null;
    unit: string | null;
    variant: string;
    enough: boolean | null;
    missing: number;
    inStock: number | null;
    baseUnit: BaseUnit | null;
  }>;
  /** Enough of the main item itself, and how much of it is missing. */
  mainEnough: boolean | null;
  mainMissing: number;
  /** Picked for this meal: 0 the main item, 1… an alternative; null: the first there is. */
  choice: number | null;
  /** The option that will be used. */
  chosen: number;
  /** Short because what there is goes off before the meal (planned meals). */
  spoilsBefore: boolean;
  /** Covered by an alternative rather than the main item. */
  using: { productId: string; name: string; icon: string } | null;
  name: string;
  icon: string;
  amount: number | null;
  unit: string | null;
  note: string;
  optional: boolean;
  inStock: number | null;
  level: Level | null;
  baseUnit: BaseUnit | null;
  enough: boolean | null;
  missing: number;
  reservedFor: PlannedMealRef | null;
  warnings: Warning[];
  expiresSoon: boolean;
}

export interface Availability {
  have: number;
  total: number;
  ready: boolean;
  missing: Array<{ productId: string; name: string; missing: number; unit: BaseUnit }>;
  useSoon: number;
  warnings: Array<Warning & { item: string }>;
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
  tools: ToolNeed[];
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
  toGo: boolean;
  doneAt: string | null;
  createdVia: Via;
  leftoversLotId: string | null;
  /** Eaten out (or planned to be): nothing is taken from the kitchen. */
  eatenOut: { kind: OutKind; place: string; cost: number | null } | null;
  parts: MealPart[];
  tools: ToolNeed[];
  ingredients: IngredientLine[];
  availability: Availability;
}

export type PartKind = 'dish' | 'side' | 'sauce' | 'drink';
export type OutKind = 'restaurant' | 'delivery' | 'party' | 'work' | 'other';

export interface MealPart {
  id: string;
  recipeId: string | null;
  title: string;
  kind: PartKind;
  servings: number;
  icon: string;
}

export interface MealPartInput {
  recipeId?: string | null;
  title?: string;
  kind?: PartKind;
  servings?: number;
  ingredients?: IngredientInput[];
}

export type ToolKind =
  'cookware' | 'bakeware' | 'utensil' | 'dishes' | 'bar' | 'appliance' | 'disposable' | 'other';

export interface Tool {
  id: string;
  name: string;
  icon: string;
  kind: ToolKind;
  count: number;
  clean: number;
  dirty: number;
  washing: number;
  washingUntil: string | null;
  washable: boolean;
  /** False: washed by hand only (knives, the grill). */
  dishwasherSafe: boolean;
  /** Single-use things: at or below this many, running low. */
  minCount: number | null;
  low: boolean;
  place: string;
  note: string;
}

export type ToolStatus = 'ready' | 'washing' | 'dirty' | 'missing';

export interface ToolNeed {
  toolId: string;
  name: string;
  icon: string;
  count: number;
  perServing: boolean;
  status: ToolStatus;
  readyAt: string | null;
  /** The tool and what can be used instead, each with its status; `using` is the one to use. */
  options: Array<{
    toolId: string;
    name: string;
    icon: string;
    status: ToolStatus;
    readyAt: string | null;
  }>;
  using: string;
}

export interface ToolNeedInput {
  toolId?: string;
  name?: string;
  count?: number;
  perServing?: boolean;
  or?: Array<{ toolId?: string; name?: string }>;
}

export interface ToolInput {
  name?: string;
  icon?: string;
  kind?: ToolKind;
  count?: number;
  washable?: boolean;
  dishwasherSafe?: boolean;
  minCount?: number | null;
  place?: string;
  note?: string;
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
  needBy: string | null;
  meals: Array<{ id: string; title: string; date: string }>;
}

export interface FoodOverview {
  kitchen: { name: string; currency: string };
  stock: {
    products: number;
    expiring: Array<{
      lotId: string;
      productId: string;
      name: string;
      icon: string;
      quantity: number;
      unit: BaseUnit;
      expiresOn: string;
    }>;
    expired: number;
    opened: Array<{
      lotId: string;
      productId: string;
      name: string;
      icon: string;
      quantity: number;
      unit: BaseUnit;
      expiresOn: string | null;
      location: Location;
      package: string;
      recipes: number;
    }>;
    low: Array<{
      productId: string;
      name: string;
      icon: string;
      total: number;
      minStock: number;
      unit: BaseUnit;
      level: Level | null;
    }>;
  };
  recipes: { total: number; ready: number; favorites: number };
  shopping: {
    open: number;
    inCart: number;
    stores: Array<{ id: string; name: string; tone: StoreTone; open: number }>;
    anyStore: number;
  };
  meals: { today: Meal[]; upcoming: Meal[]; plannedThisWeek: number };
}

export interface IngredientInput {
  productId?: string;
  name: string;
  amount?: number | null;
  unit?: string | null;
  note?: string;
  optional?: boolean;
  link?: boolean;
  lotId?: string | null;
  partId?: string | null;
  variant?: string;
  or?: Array<{
    productId?: string;
    name: string;
    amount?: number | null;
    unit?: string | null;
    variant?: string;
  }>;
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
  tools?: ToolNeedInput[];
}

export interface KitchenPerson {
  id: string;
  name: string;
  surname: string;
}

export interface Restriction {
  id: string;
  userId: string;
  person: string;
  kind: 'allergy' | 'avoid';
  productId: string | null;
  productName: string | null;
  category: Category | null;
  note: string;
}

export interface Reminder {
  id: string;
  kind: 'shopping' | 'expiring' | 'meal' | 'prep' | 'custom';
  time: string | null;
  minutesBefore: number | null;
  days: number[];
  text: string;
  enabled: boolean;
}

export interface AccessKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'food:read' | 'food' | 'admin';
  createdAt: string;
  lastUsedAt: string | null;
}
