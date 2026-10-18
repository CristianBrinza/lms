import type { Translations } from '@/i18n';

/** Food API shapes (mirrors backend/src/modules/food). Quantities are in the item's base unit. */

export type BaseUnit = 'pcs' | 'g' | 'ml';
export type Unit = 'pcs' | 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup';
export type Location =
  'fridge' | 'freezer' | 'pantry' | 'garden' | 'bathroom' | 'storage' | 'other';
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
  | 'bathroom'
  | 'cleaning'
  | 'laundry'
  | 'paper'
  | 'pets'
  | 'household'
  | 'other';

/** Food (the kitchen) or the house (bathroom, cleaning…); the Shopping card shows both. */
export type Area = 'food' | 'house';
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
  /** Its title in other languages ({ ro: { title } }). */
  translations?: Translations;
  date: string;
}

/** A note the server wrote ("Poured out", "fridge → freezer"), by key; the app words it. */
export type NoteKey =
  | 'nowByLevel'
  | 'itemRemoved'
  | 'removed'
  | 'pouredOut'
  | 'pouredIn'
  | 'undone'
  | 'reopened'
  | 'moved'
  | 'level'
  | 'leftoversFrom';

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
  /** A brand whose kind is part of its name: Coca-Cola + Zero reads "Coca-Cola Zero". */
  kindInName?: boolean;
  /** The values that count (own or the catalog's typical ones), or null when unknown. */
  nutrition?: { entry: NutritionEntry; source: 'own' | 'catalog' } | null;
  minStock: number | null;
  storeId: string | null;
  note: string;
  archived: boolean;
  /** Its name (and note) in the other languages: the catalog's, or what the household wrote. */
  translations?: Translations;
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
  /** The store's name in other languages ({ ro: { name } }). */
  storeTranslations?: Translations;
  tripId: string | null;
  note: string;
  /** A note the server wrote, as a key and its values; null for what people wrote. */
  noteKey?: NoteKey | null;
  noteValues?: Record<string, string>;
  variant: string;
  /** The package it came in (jar, bottle, loaf) and what one held; '' and null when loose. */
  package: string;
  packageSize: number | null;
  /** Its kind in other languages ({ ro: { variant } }), when the catalog names it. */
  translations?: Translations;
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
  /** A note the server wrote, as a key and its values; null for what people wrote. */
  noteKey?: NoteKey | null;
  noteValues?: Record<string, string>;
  via: Via;
  actor: string | null;
  createdAt: string;
}

export interface PricePoint {
  storeId: string | null;
  storeName: string | null;
  storeTranslations?: Translations;
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
  kindInName?: boolean;
  /** The catalog's own names in Romanian and Russian (name, variants). */
  translations?: Translations;
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
  translations?: Translations;
}

export interface Store {
  id: string;
  name: string;
  tone: StoreTone;
  sort: number;
  open: number;
  inCart: number;
  createdAt: string;
  translations?: Translations;
}

export interface ShoppingItem {
  id: string;
  storeId: string | null;
  productId: string | null;
  name: string;
  icon: string;
  category: Category;
  /** Food or the house: which list it shows on (Shopping shows both). */
  area?: Area;
  amount: number | null;
  unit: string | null;
  note: string;
  variant: string;
  kindInName?: boolean;
  priority: boolean;
  needBy: string | null;
  source: 'manual' | 'plan' | 'low_stock' | 'recipe' | 'ai';
  checked: boolean;
  price: number | null;
  lastPrice: {
    price: number;
    storeName: string | null;
    storeTranslations?: Translations;
    boughtAt: string;
  } | null;
  estimate: number | null;
  /** At least this much, in the base unit (null: no amount asked). */
  need: number | null;
  /** What was really bought, package by package (sizes in the base unit). */
  bought: Array<{ count: number; size: number }> | null;
  package: string;
  boughtTotal: number | null;
  baseUnit: BaseUnit | null;
  createdAt: string;
  /** The linked item's names in other languages, when it has them. */
  translations?: Translations;
}

export interface Trip {
  id: string;
  storeId: string | null;
  storeName: string;
  /** The store's name in other languages ({ ro: { name } }). */
  storeTranslations?: Translations;
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
  /** The recipe choice's option it comes with (Creamy coffee); null: always used. */
  optionId: string | null;
  /** The section of the meal it is for (drink, first, dish…); null: none named. */
  course: PartKind | null;
  /**
   * Planned meals, optional lines: true counts it this time (needed, eaten, taken), false leaves
   * it out; null: as usual (taken if there, never needed).
   */
  included: boolean | null;
  /** Only this type will do ('' for any). */
  variant: string;
  /** Or one of these instead, in order. */
  alternatives: Array<{
    productId: string | null;
    name: string;
    /** Its name and kind in other languages ({ ro: { name, variant } }). */
    translations?: Translations;
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
  using: { productId: string; name: string; icon: string; translations?: Translations } | null;
  name: string;
  /** The line's name and kind in other languages ({ ro: { name, variant } }). */
  translations?: Translations;
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
  missing: Array<{
    productId: string;
    name: string;
    translations?: Translations;
    missing: number;
    unit: BaseUnit;
  }>;
  useSoon: number;
  /** translations: { ro: { item } }. */
  warnings: Array<Warning & { item: string; translations?: Translations }>;
}

/** Energy and nutrients (g; kcal for energy). */
export interface Nutrients {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  sugar?: number;
  fiber?: number;
  salt?: number;
}

export interface NutritionEntry {
  /** What the numbers are for. */
  per: '100g' | '100ml' | 'piece';
  base: Nutrients;
  /** Kinds that differ (Zero, 2.5%…), by kind name. */
  kinds?: Record<string, Nutrients>;
}

/** A dish's nutrition: whole and per serving; lines with an amount but unknown values are named. */
export interface DishNutrition {
  total: Nutrients;
  perServing: Nutrients;
  known: number;
  counted: number;
  unknown: string[];
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
  /** Its own lines, always used; each choice's options carry theirs. */
  ingredients: IngredientLine[];
  /** Of its own lines and the chosen options'. */
  availability: Availability;
  /** Parts made one way or another (Drink: creamy coffee or tea). */
  choices: RecipeChoice[];
  tools: ToolNeed[];
  timesCooked: number;
  lastCooked: string | null;
  nutrition: DishNutrition;
  /** Its title, description, steps and notes in other languages (shown with `tr`). */
  translations?: Translations;
}

/** One way to make a choice: its own lines and steps, and whether it can be made now. */
export interface RecipeOption {
  id: string;
  name: string;
  /** Its name and steps in other languages ({ ro: { name, steps } }). */
  translations?: Translations;
  steps: string[];
  ingredients: IngredientLine[];
  availability: Availability;
}

export interface RecipeChoice {
  id: string;
  name: string;
  /** The section it is in (drink); null: none named. */
  course: PartKind | null;
  translations?: Translations;
  options: RecipeOption[];
  /** In use: asked for, else picked last time, else the first. */
  chosen: string;
  remembered: string | null;
}

export interface MealPartChoice {
  id: string;
  name: string;
  course: PartKind | null;
  translations?: Translations;
  options: Array<{ id: string; name: string; translations?: Translations }>;
  /** The option this meal makes; null: none. */
  chosen: string | null;
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
  eatenOut: { kind: OutKind; place: string; cost: number | null; kcal: number | null } | null;
  /** Who ate it (empty: everyone when there's a serving each, else whoever marked it eaten). */
  eaters: string[];
  doneBy: string | null;
  nutrition: DishNutrition;
  parts: MealPart[];
  tools: ToolNeed[];
  ingredients: IngredientLine[];
  availability: Availability;
  /** Its title, note and eating-out place in other languages ({ ro: { title, note, place } }). */
  translations?: Translations;
}

/** A meal's sections in eating order; dish is the second (main) course. */
export type PartKind = 'first' | 'dish' | 'side' | 'sauce' | 'dessert' | 'drink';
export type OutKind = 'restaurant' | 'delivery' | 'party' | 'work' | 'other';

export interface MealPart {
  id: string;
  recipeId: string | null;
  title: string;
  /** Its title in other languages ({ ro: { title } }). */
  translations?: Translations;
  kind: PartKind;
  servings: number;
  icon: string;
  /** Its recipe's choices and the option this meal makes. */
  choices: MealPartChoice[];
}

export interface MealPartInput {
  recipeId?: string | null;
  title?: string;
  kind?: PartKind;
  servings?: number;
  ingredients?: IngredientInput[];
  /** Options of its recipe's choices, by id. */
  options?: string[];
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
  /** Its name in other languages: the catalog's, or what the household wrote. */
  translations?: Translations;
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
    translations?: Translations;
  }>;
  using: string;
  /** The tool's name in other languages, when the API sends it. */
  translations?: Translations;
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
  translations?: Translations;
}

export interface NeedLine {
  productId: string;
  name: string;
  /** Its name in other languages ({ ro: { name } }). */
  translations?: Translations;
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
  meals: Array<{ id: string; title: string; translations?: Translations; date: string }>;
}

/** A plan line that can't be counted: check it at home. translations: { ro: { name, meal } }. */
export interface ToCheck {
  name: string;
  meal: string;
  translations?: Translations;
}

/** What a meal was short of. */
export interface Shortfall {
  name: string;
  translations?: Translations;
  missing: number;
  unit: string;
}

/** A shopping line named in a checkout's summary. */
export interface NamedLine {
  name: string;
  translations?: Translations;
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
      translations?: Translations;
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
      translations?: Translations;
    }>;
    low: Array<{
      productId: string;
      name: string;
      icon: string;
      total: number;
      minStock: number;
      unit: BaseUnit;
      level: Level | null;
      translations?: Translations;
    }>;
  };
  recipes: { total: number; ready: number; favorites: number };
  shopping: {
    open: number;
    inCart: number;
    stores: Array<{
      id: string;
      name: string;
      tone: StoreTone;
      open: number;
      translations?: Translations;
    }>;
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
  optionId?: string | null;
  included?: boolean | null;
  course?: PartKind | null;
  /** Its name in other languages, for a line not kept in the kitchen ({ ro: { name: 'Apă' } }). */
  translations?: Translations;
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
  /** Replaces the choices; ids keep them (and what was picked last time). */
  choices?: RecipeChoiceInput[];
  /** Per language: title, description, notes (strings) and steps (an array). */
  translations?: Translations;
}

export interface RecipeChoiceInput {
  id?: string;
  name: string;
  course?: PartKind | null;
  translations?: Translations;
  options: Array<{
    id?: string;
    name: string;
    ingredients?: IngredientInput[];
    steps?: string[];
    translations?: Translations;
  }>;
}

export interface KitchenPerson {
  id: string;
  name: string;
  surname: string;
  avatarUrl?: string | null;
}

export interface Restriction {
  id: string;
  userId: string;
  person: string;
  kind: 'allergy' | 'avoid';
  productId: string | null;
  productName: string | null;
  /** The item's name in other languages ({ ro: { name } }). */
  productTranslations?: Translations;
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
  /** The text in the other languages ({ ro: { text } }). */
  translations?: Translations;
}

export interface AccessKey {
  id: string;
  name: string;
  prefix: string;
  scope: 'food:read' | 'food' | 'admin';
  createdAt: string;
  lastUsedAt: string | null;
}
