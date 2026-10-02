import { z } from 'zod';
import { TOOL_ICONS, TOOL_KINDS } from './kitchenware';
import { CATEGORIES, FOOD_ICONS, LEVELS, LOCATIONS, TRACK_MODES } from './presets';
import { BASE_UNITS, UNITS } from './units';

/**
 * Request shapes for Food, shared by the REST routes and the MCP tools so the app and the
 * assistant are held to the same rules. Descriptions double as the MCP tools' documentation.
 */

export const idField = z.uuid('Not a valid id');

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-31')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Not a real date');

export const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 18:30');

export const nameField = z.string().trim().min(1, 'Give it a name').max(80, 'Keep the name under 80 characters');
export const noteField = z.string().trim().max(500, 'Keep the note under 500 characters');

export const quantityField = z.number({ error: 'Enter an amount' }).positive('Enter an amount above zero').max(1_000_000, 'That amount is too large');
/** A standard unit, or one of the item's own (slice, pack); whether it fits is checked against the item. */
export const unitField = z
  .string({ error: 'Pick a unit' })
  .trim()
  .min(1, 'Pick a unit')
  .max(24, 'That unit name is too long')
  .describe(`${UNITS.join(', ')}, or one of the item’s own units (slice, pack…)`);
export const baseUnitField = z.enum(BASE_UNITS, { error: 'Count it in pcs, g or ml' });
export const locationField = z.enum(LOCATIONS, { error: 'Fridge, freezer, pantry or other' });
export const categoryField = z.enum(CATEGORIES, { error: 'Pick a category' });
export const iconField = z.enum(FOOD_ICONS, { error: 'Pick an icon from the set' });
export const priceField = z.number().min(0, 'Price can’t be negative').max(1_000_000, 'That price is too large');

export const ProductInput = z.object({
  name: nameField,
  icon: iconField.optional(),
  category: categoryField.optional(),
  unit: baseUnitField.optional().describe('How it is counted: pcs (pieces), g (weight) or ml (volume)'),
  pieceSize: z.number().positive().max(100_000).nullable().optional().describe('One piece in grams or ml, e.g. a tomato ≈ 120'),
  pieceUnit: z.enum(['g', 'ml']).nullable().optional(),
  location: locationField.optional().describe('Where it is usually kept'),
  shelfLifeDays: z.number().int().positive().max(3650).nullable().optional().describe('Default days until it expires once bought'),
  openedDays: z.number().int().positive().max(3650).nullable().optional().describe('Days it keeps once opened'),
  openedLocation: locationField.nullable().optional().describe('Where it goes once opened (an opened can: fridge); null: it stays put'),
  trackStock: z.boolean().optional().describe('Older form of trackMode: false means none'),
  trackMode: z
    .enum(TRACK_MODES)
    .optional()
    .describe('exact: amounts and dates (meat, cheese); level: just full/low/out (spices, sauces, oil); none: always there'),
  level: z.enum(LEVELS).optional().describe('For level items: full, low or out'),
  freezerDays: z.number().int().positive().max(3650).nullable().optional().describe('Days it keeps frozen'),
  units: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(20),
        plural: z.string().trim().min(1).max(24).optional(),
        size: z.number().positive().max(1_000_000).describe('How much one usually holds, in the item’s base unit'),
        sizes: z.array(z.number().positive().max(1_000_000)).max(12).optional().describe('Sizes it comes in, to pick from'),
      }),
    )
    .max(10)
    .optional()
    .describe('The item’s own units, usually its packages: [{ name: "jar", size: 400, sizes: [250, 400, 500] }] for honey in grams'),
  variants: z.array(z.string().trim().min(1).max(40)).max(30).optional().describe('Kinds of it: ["Cheddar", "Parmesan"]'),
  thawedDays: z.number().int().positive().max(365).nullable().optional().describe('Days it keeps once thawed'),
  minStock: z.number().min(0).max(1_000_000).nullable().optional().describe('Below this (in the base unit) it is “running low”'),
  storeId: idField.nullable().optional().describe('The store it is usually bought at'),
  note: noteField.optional(),
});
export type ProductInput = z.infer<typeof ProductInput>;

export const ProductPatch = ProductInput.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to change');

/** A product by id, or by name (found loosely, or created from the built-in catalog). */
const productRef = {
  productId: idField.optional(),
  name: nameField.optional().describe('Used when productId is not given: matched loosely (tomato/Tomatoes), else created'),
};
const hasProductRef = (body: { productId?: string; name?: string }) => Boolean(body.productId || body.name);

/** Packages bought: "2 cans of 300 g", "1 bottle of 1.25 l". Each size becomes its own lot. */
export const PackagesField = z
  .array(
    z.object({
      count: z.number().int().min(1).max(100).default(1),
      size: z.number().positive().max(1_000_000).describe('What one holds'),
      sizeUnit: unitField.optional().describe('Unit of size (g, l, ml…); default the item’s base unit'),
    }),
  )
  .min(1)
  .max(20);
export type Packages = z.infer<typeof PackagesField>;

export const AddStockInput = z
  .object({
    ...productRef,
    quantity: quantityField.optional().describe('Required unless packages are given'),
    unit: unitField.optional().describe('Defaults to the product’s own unit'),
    location: locationField.optional(),
    expiresOn: dateField.nullable().optional().describe('YYYY-MM-DD; omit to use the product’s shelf life, null for none'),
    price: priceField.nullable().optional().describe('What was paid for this whole amount'),
    storeId: idField.nullable().optional(),
    note: noteField.optional(),
    variant: z.string().trim().max(40).optional().describe('Which kind (Cheddar), when the item has kinds'),
    each: z.number().positive().max(1_000_000).optional().describe('How much one `unit` holds this time, in the item’s base unit: a jar of 14 pickles is quantity 1, unit "jar", each 14'),
    package: z.string().trim().max(20).optional().describe('What the packages are called (jar, bottle, can); default the item’s first package unit'),
    packages: PackagesField.optional().describe('What was bought, package by package: [{ count: 2, size: 300, sizeUnit: "g" }]'),
  })
  .refine(hasProductRef, { message: 'Say which item', path: ['name'] })
  .refine((body) => body.quantity !== undefined || body.packages, { message: 'Say how much', path: ['quantity'] });
export type AddStockInput = z.infer<typeof AddStockInput>;

export const PourInput = z.object({
  quantity: quantityField.describe('How much to pour'),
  unit: unitField.optional(),
  intoLotId: idField.optional().describe('Top up this piece (the small oil bottle on the desk); omitted: a new one'),
  package: z.string().trim().max(20).optional().describe('What the new one is (dispenser, bottle)'),
  packageSize: z.number().positive().max(1_000_000).optional().describe('What the new one holds when full, in the base unit'),
  location: locationField.optional(),
  note: noteField.optional().describe('Where exactly ("on the desk")'),
});
export type PourInput = z.infer<typeof PourInput>;

export const UseStockInput = z.object({
  productId: idField,
  quantity: quantityField,
  unit: unitField.optional(),
  lotId: idField.optional().describe('Take it from this piece/package; otherwise first-expiring first'),
  wasted: z.boolean().optional().describe('True when it was thrown away rather than eaten'),
  variant: z.string().trim().max(40).optional().describe('Take only pieces of this type'),
  note: noteField.optional(),
});
export type UseStockInput = z.infer<typeof UseStockInput>;

export const LotPatch = z
  .object({
    quantity: z.number().min(0).max(1_000_000).optional().describe('What is left now'),
    unit: unitField.optional(),
    location: locationField.optional(),
    expiresOn: dateField.nullable().optional(),
    opened: z.boolean().optional(),
    price: priceField.nullable().optional(),
    note: noteField.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type LotPatch = z.infer<typeof LotPatch>;

export const STORE_TONES = ['butter', 'cyan', 'pink', 'mint', 'lav', 'peach', 'ink'] as const;

export const StoreInput = z.object({
  name: z.string().trim().min(1, 'Name the store').max(40, 'Keep it under 40 characters'),
  tone: z.enum(STORE_TONES).optional().describe('Colour of its tab'),
});
export const StorePatch = StoreInput.extend({ sort: z.number().int().min(0).max(1000) })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export const ShoppingItemInput = z
  .object({
    ...productRef,
    amount: quantityField.nullable().optional().describe('How much to buy, in `unit`'),
    unit: unitField.nullable().optional(),
    storeId: idField.nullable().optional().describe('Which store’s list; null for “any store”; omitted: the item’s usual store'),
    note: noteField.optional(),
    variant: z.string().trim().max(40).optional().describe('Which kind to buy (Cheddar)'),
    priority: z.boolean().optional().describe('Important: shown first'),
    needBy: dateField.nullable().optional().describe('The day it is needed (the meal’s day); buy it before'),
  })
  .refine(hasProductRef, { message: 'Say what to buy', path: ['name'] });
export type ShoppingItemInput = z.infer<typeof ShoppingItemInput>;

export const AddShoppingInput = z.object({
  items: z.array(ShoppingItemInput).min(1, 'Add at least one item').max(100, 'At most 100 at once'),
  source: z.enum(['manual', 'plan', 'low_stock', 'recipe']).optional().describe('Why they are added'),
});

export const ShoppingItemPatch = z
  .object({
    checked: z.boolean().describe('In the cart'),
    amount: quantityField.nullable(),
    unit: unitField.nullable(),
    price: priceField.nullable().describe('What the whole line cost'),
    storeId: idField.nullable(),
    note: noteField,
    variant: z.string().trim().max(40),
    priority: z.boolean(),
    needBy: dateField.nullable(),
    package: z.string().trim().max(20).describe('What the packages bought are called'),
    bought: PackagesField.nullable().describe('What was actually bought; null to clear'),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type ShoppingItemPatch = z.infer<typeof ShoppingItemPatch>;

export const CheckoutInput = z.object({
  storeId: idField.nullable().describe('The store being finished; null for the “any store” list'),
  lines: z
    .array(
      z.object({
        id: idField,
        price: priceField.nullable().optional(),
        amount: quantityField.nullable().optional(),
        unit: unitField.nullable().optional(),
        expiresOn: dateField.nullable().optional(),
        location: locationField.optional(),
        addToKitchen: z.boolean().optional().describe('Default true: the item goes into the kitchen'),
        package: z.string().trim().max(20).optional(),
        bought: PackagesField.nullable().optional().describe('What was actually bought, package by package'),
        variant: z.string().trim().max(40).optional().describe('The type actually bought'),
        keepRest: z.boolean().optional().describe('Default true: when less was bought than needed, the rest stays on the list'),
      }),
    )
    .max(200)
    .default([])
    .describe('Overrides for the bought lines; every line in the cart is bought'),
});
export type CheckoutInput = z.infer<typeof CheckoutInput>;

export const TripItemPatch = z
  .object({ price: priceField.nullable(), amount: quantityField, unit: unitField })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type TripItemPatch = z.infer<typeof TripItemPatch>;

export const UndoInput = z.object({
  events: z.array(z.number().int().positive()).min(1).max(100).describe('The events a use returned'),
});

const minutesField = z.number().int().min(0).max(10_000).nullable().optional();

export const IngredientInput = z.object({
  productId: idField.optional().describe('A kitchen item; omitted: found (or created) by name'),
  name: nameField.describe('As the recipe says it: "Tomatoes", "Beef steak"'),
  amount: quantityField.nullable().optional().describe('Omit for “to taste”'),
  unit: unitField.nullable().optional(),
  note: z.string().trim().max(120, 'Keep the note short').optional().describe('"diced", "room temperature"'),
  optional: z.boolean().optional(),
  link: z.boolean().optional().describe('False for things not kept in the kitchen (tap water): never checked or deducted'),
  variant: z.string().trim().max(40).optional().describe('Only this type will do (Vodka: "Finlandia"); omit for any'),
  or: z
    .array(
      z.object({
        productId: idField.optional(),
        name: nameField,
        amount: quantityField.nullable().optional().describe('Omit for the same amount as the main one'),
        unit: unitField.nullable().optional(),
        variant: z.string().trim().max(40).optional(),
      }),
    )
    .max(4)
    .optional()
    .describe('Or one of these instead, in this order: milk, or whipped cream'),
});
export type IngredientInput = z.infer<typeof IngredientInput>;

export const ToolInput = z.object({
  name: z.string().trim().min(1, 'Name it').max(60).optional(),
  icon: z.enum(TOOL_ICONS, { error: 'Pick an icon from the set' }).optional(),
  kind: z.enum(TOOL_KINDS).optional().describe('cookware, bakeware, utensil, dishes, bar, appliance or other'),
  count: z.number().int().min(0).max(500).optional().describe('How many the kitchen has'),
  washable: z.boolean().optional().describe('False for things never washed (the oven, pens)'),
  place: z.string().trim().max(60).optional().describe('Where it is kept'),
  note: noteField.optional(),
});
export type ToolInput = z.infer<typeof ToolInput>;

export const ToolNeedInput = z
  .object({
    toolId: idField.optional(),
    name: z.string().trim().min(1).max(60).optional().describe('Kitchenware by name ("Big pot", "Frying pan"); added if the kitchen has none'),
    count: z.number().int().min(1).max(20).optional(),
  })
  .refine((body) => Boolean(body.toolId || body.name), { message: 'Say which', path: ['name'] });
export type ToolNeedInput = z.infer<typeof ToolNeedInput>;

export const WashInput = z.object({
  how: z.enum(['hand', 'machine']).describe('By hand: clean now; machine: clean when the dishwasher is done'),
  toolIds: z.array(idField).max(100).optional().describe('Omit to wash everything dirty'),
  minutes: z.number().int().min(10).max(600).optional().describe('This dishwasher run; default the kitchen’s setting'),
});
export type WashInput = z.infer<typeof WashInput>;

export const RecipeInput = z.object({
  title: z.string().trim().min(1, 'Give the recipe a name').max(120, 'Keep the name under 120 characters'),
  description: z.string().trim().max(1000).optional(),
  servings: z.number().int().min(1).max(100).optional().describe('How many people the amounts are for'),
  prepMinutes: minutesField,
  cookMinutes: minutesField,
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional().describe('"breakfast", "quick", "soup"…'),
  steps: z.array(z.string().trim().min(1).max(2000)).max(60).optional(),
  icon: iconField.optional(),
  sourceUrl: z.union([z.url('Use a full link (https://…)').max(500), z.literal('')]).optional(),
  notes: z.string().trim().max(2000).optional(),
  favorite: z.boolean().optional(),
  ingredients: z.array(IngredientInput).max(60, 'At most 60 ingredients').optional(),
  tools: z.array(ToolNeedInput).max(20).optional().describe('Kitchenware it needs: [{ name: "Big pot" }, { name: "Colander" }]'),
});
export type RecipeInput = z.infer<typeof RecipeInput>;

export const RecipePatch = RecipeInput.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export const slotField = z.enum(MEAL_SLOTS, { error: 'Breakfast, lunch, dinner or snack' });

export const MealIngredientInput = IngredientInput.extend({
  lotId: idField.nullable().optional().describe('Use this exact piece (e.g. the 2 kg steak) when cooking'),
  partId: idField.nullable().optional().describe('The meal part this line belongs to; keep it when sending lines back'),
});
export type MealIngredientInput = z.infer<typeof MealIngredientInput>;

export const MEAL_PART_KINDS = ['dish', 'side', 'sauce', 'drink'] as const;

export const MealPartInput = z
  .object({
    recipeId: idField.nullable().optional().describe('A recipe: its ingredients come with it, scaled to servings'),
    title: z.string().trim().min(1).max(120).optional().describe('Needed without a recipe ("Coffee", "Bread with Philadelphia and salmon")'),
    kind: z.enum(MEAL_PART_KINDS).optional().describe('dish (default), side, sauce or drink'),
    servings: z.number().int().min(1).max(100).optional().describe('Default: the meal’s servings'),
    ingredients: z.array(IngredientInput).max(40).optional().describe('Its own lines, for a part without a recipe (or replacing the recipe’s)'),
  })
  .refine((body) => Boolean(body.recipeId || body.title), { message: 'Pick a recipe or name it', path: ['title'] });
export type MealPartInput = z.infer<typeof MealPartInput>;

export const MealPartPatchFields = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(MEAL_PART_KINDS),
  servings: z.number().int().min(1).max(100).describe('Its lines scale with it'),
});
export const MealPartPatch = MealPartPatchFields.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type MealPartPatch = z.infer<typeof MealPartPatch>;

export const MealInput = z
  .object({
    date: dateField,
    time: timeField.nullable().optional(),
    slot: slotField.optional(),
    recipeId: idField.nullable().optional(),
    title: z.string().trim().min(1).max(120).optional().describe('Needed without a recipe ("Eat out", "Leftover soup")'),
    servings: z.number().int().min(1).max(100).optional(),
    note: noteField.optional(),
    toGo: z.boolean().optional().describe('Packed to take along (lunch at work): can be prepared the evening before'),
    ingredients: z.array(MealIngredientInput).max(60).optional().describe('Replaces the recipe’s ingredients for this meal only'),
    parts: z.array(MealPartInput).max(10).optional().describe('More than one dish: an omelette, coffee, bread with salmon on the side, a sauce'),
  })
  .refine((body) => Boolean(body.recipeId || body.title || body.parts?.length), { message: 'Pick a recipe or name the meal', path: ['title'] });
export type MealInput = z.infer<typeof MealInput>;

export const MealPatchFields = z.object({
    date: dateField,
    time: timeField.nullable(),
    slot: slotField,
    recipeId: idField.nullable().describe('Swap the recipe; the ingredients follow'),
    title: z.string().trim().min(1).max(120),
    servings: z.number().int().min(1).max(100).describe('Ingredients scale with it'),
    note: noteField,
    status: z.enum(['planned', 'skipped']),
    toGo: z.boolean(),
});
export const MealPatch = MealPatchFields.partial().refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type MealPatch = z.infer<typeof MealPatch>;

export const MealIngredientsInput = z.object({ ingredients: z.array(MealIngredientInput).max(60) });

export const CompleteMealInput = z.object({
  leftovers: z
    .object({
      portions: z.number().positive().max(100),
      location: locationField.optional(),
      expiresOn: dateField.nullable().optional(),
    })
    .optional()
    .describe('Portions left over go to the kitchen as their own item'),
});
export type CompleteMealInput = z.infer<typeof CompleteMealInput>;

export const CookInput = z.object({
  servings: z.number().int().min(1).max(100).optional(),
  leftovers: CompleteMealInput.shape.leftovers,
});

export const RangeQuery = z.object({ from: dateField, to: dateField }).refine((r) => r.from <= r.to, { message: '“from” must be before “to”', path: ['to'] });

export const LevelInput = z.object({ level: z.enum(LEVELS, { error: 'Full, low or out' }) });

export const RestrictionInput = z
  .object({
    userId: idField.describe('Who (a person in this kitchen)'),
    kind: z.enum(['allergy', 'avoid']).describe('allergy: a hazard; avoid: doesn’t eat it'),
    productId: idField.optional(),
    name: nameField.optional().describe('An item by name (Honey)'),
    category: categoryField.optional().describe('Or a whole kind (fish, dairy)'),
    note: noteField.optional(),
  })
  .refine((body) => Boolean(body.productId || body.name || body.category), { message: 'Say which food', path: ['name'] });
