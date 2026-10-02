import type { BaseUnit } from './units';

/**
 * The built-in catalog: common foods with sensible defaults, so "tomatoes" arrives with its icon,
 * counted in pieces (about 120 g each), kept in the fridge, good for about a week. Names match in
 * English, loosely (plural or singular, any case, without diacritics) and through aliases,
 * including the Romanian and Russian words used in Moldovan shops.
 *
 * Icon keys are drawn in frontend/src/food/icons; keep the two lists in step.
 */

/** Where food is: fridge, freezer, pantry (the shelf), the balcony garden, anywhere else. */
export const LOCATIONS = ['fridge', 'freezer', 'pantry', 'garden', 'other'] as const;
export type Location = (typeof LOCATIONS)[number];

/** In the order a shop is usually walked: produce at the door, household at the end. */
export const CATEGORIES = [
  'produce',
  'bakery',
  'meat',
  'fish',
  'dairy',
  'frozen',
  'pantry',
  'spices',
  'drinks',
  'snacks',
  'meals',
  'household',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const FOOD_ICONS = [
  // produce
  'tomato', 'cucumber', 'carrot', 'potato', 'onion', 'garlic', 'bell-pepper', 'chili', 'lettuce', 'cabbage',
  'broccoli', 'mushroom', 'eggplant', 'zucchini', 'corn', 'avocado', 'lemon', 'apple', 'banana', 'orange',
  'strawberry', 'grapes', 'pear', 'watermelon', 'cherry', 'herbs',
  // bakery
  'bread', 'baguette', 'croissant',
  // meat, fish
  'steak', 'chicken', 'mince', 'sausage', 'bacon', 'fish', 'shrimp',
  // dairy
  'milk', 'egg', 'cheese', 'butter', 'yogurt', 'cottage',
  // frozen
  'frozen', 'ice-cream', 'dumplings',
  // pantry
  'rice', 'pasta', 'flour', 'sugar', 'oats', 'grain', 'can', 'oil', 'honey', 'nuts', 'coffee', 'tea', 'jar',
  // spices and sauces
  'salt', 'spice', 'sauce',
  // drinks
  'water', 'juice', 'soda', 'wine', 'beer',
  // snacks
  'chocolate', 'cookie', 'chips',
  // dishes (recipes and leftovers)
  'pot', 'bowl', 'soup', 'salad', 'pizza', 'sandwich', 'cake', 'pancakes', 'omelette', 'spaghetti', 'container',
  // household and fallback
  'roll', 'detergent', 'box', 'basket',
] as const;
export type FoodIcon = (typeof FOOD_ICONS)[number];

export interface Preset {
  name: string;
  aliases?: string[];
  icon: FoodIcon;
  category: Category;
  unit: BaseUnit;
  location: Location;
  shelfLifeDays?: number;
  /** One piece, in grams or millilitres (pieceUnit, default g). */
  pieceSize?: number;
  pieceUnit?: 'g' | 'ml';
  /** Days it keeps once opened. */
  openedDays?: number;
  /** How it is kept track of; exact (amounts) when not given. */
  track?: TrackMode;
  /** Days it keeps in the freezer, and once thawed. */
  freezerDays?: number;
  thawedDays?: number;
}

/**
 * How long food keeps frozen and after thawing, by kind, for items that don't say. Moving a piece
 * to the freezer resets its date to today + frozen days; taking it out, to today + thawed days.
 */
export const FREEZING: Partial<Record<Category, { freezerDays: number; thawedDays: number }>> = {
  meat: { freezerDays: 120, thawedDays: 2 },
  fish: { freezerDays: 90, thawedDays: 1 },
  produce: { freezerDays: 240, thawedDays: 2 },
  bakery: { freezerDays: 90, thawedDays: 2 },
  dairy: { freezerDays: 90, thawedDays: 3 },
  meals: { freezerDays: 60, thawedDays: 2 },
  frozen: { freezerDays: 180, thawedDays: 1 },
};

/** Frozen days for one item: its own, else its kind's. */
export function freezingFor(item: { category: Category; freezerDays?: number | null; thawedDays?: number | null }) {
  const byKind = FREEZING[item.category];
  return {
    freezerDays: item.freezerDays ?? byKind?.freezerDays ?? null,
    thawedDays: item.thawedDays ?? byKind?.thawedDays ?? null,
  };
}

/**
 * exact: amounts and dates, lot by lot (meat, cheese, each steak). level: just full, low or out
 * (spices, sauces, oil): never weighed, never deducted, on the list when low. none: always there.
 */
export const TRACK_MODES = ['exact', 'level', 'none'] as const;
export type TrackMode = (typeof TRACK_MODES)[number];
export const LEVELS = ['full', 'low', 'out'] as const;
export type Level = (typeof LEVELS)[number];

/** Days once opened, for the presets where it matters. */
const OPENED: Record<string, number> = {
  Milk: 5, Cream: 4, Kefir: 4, 'Sour cream': 7, Juice: 5, Soda: 3, Wine: 5, Yogurt: 2, 'Cottage cheese': 3, Mozzarella: 3,
  'Canned beans': 3, 'Canned tomatoes': 4, 'Tuna (canned)': 2, 'Tomato paste': 7, Mayonnaise: 30, Ketchup: 60, Mustard: 60,
  Ham: 4, Bacon: 5, Sausages: 5, Cheese: 14, Feta: 7, Jam: 30,
};
/** Kept by level rather than weighed: everything in Spices & sauces, plus these. */
const BY_LEVEL = new Set(['Sunflower oil', 'Olive oil', 'Honey', 'Jam', 'Tomato paste', 'Coffee', 'Tea', 'Instant coffee', 'Peanut butter', 'Chocolate spread']);

const P = (
  name: string,
  icon: FoodIcon,
  category: Category,
  unit: BaseUnit,
  location: Location,
  shelfLifeDays?: number,
  piece?: [number, 'g' | 'ml'] | number,
  aliases?: string[],
): Preset => ({
  name,
  icon,
  category,
  unit,
  location,
  ...(shelfLifeDays ? { shelfLifeDays } : {}),
  ...(piece ? { pieceSize: Array.isArray(piece) ? piece[0] : piece, pieceUnit: Array.isArray(piece) ? piece[1] : 'g' } : {}),
  ...(aliases ? { aliases } : {}),
});

const RAW_PRESETS: readonly Preset[] = [
  // Produce
  P('Tomatoes', 'tomato', 'produce', 'pcs', 'fridge', 7, 120, ['roșii', 'rosii', 'помидоры']),
  P('Cherry tomatoes', 'tomato', 'produce', 'g', 'fridge', 7),
  P('Cucumbers', 'cucumber', 'produce', 'pcs', 'fridge', 7, 200, ['castraveți', 'castraveti', 'огурцы']),
  P('Carrots', 'carrot', 'produce', 'pcs', 'fridge', 21, 80, ['morcovi', 'морковь']),
  P('Potatoes', 'potato', 'produce', 'g', 'pantry', 30, 150, ['cartofi', 'картофель']),
  P('Onions', 'onion', 'produce', 'pcs', 'pantry', 30, 110, ['ceapă', 'ceapa', 'лук']),
  P('Red onions', 'onion', 'produce', 'pcs', 'pantry', 30, 110),
  P('Garlic', 'garlic', 'produce', 'pcs', 'pantry', 60, 50, ['usturoi', 'чеснок']),
  P('Bell peppers', 'bell-pepper', 'produce', 'pcs', 'fridge', 10, 160, ['ardei', 'перец']),
  P('Chili peppers', 'chili', 'produce', 'pcs', 'fridge', 14, 15),
  P('Lettuce', 'lettuce', 'produce', 'pcs', 'fridge', 5, 300, ['salată', 'salata', 'салат']),
  P('Cabbage', 'cabbage', 'produce', 'pcs', 'fridge', 30, 1200, ['varză', 'varza', 'капуста']),
  P('Broccoli', 'broccoli', 'produce', 'pcs', 'fridge', 5, 400),
  P('Mushrooms', 'mushroom', 'produce', 'g', 'fridge', 5, undefined, ['ciuperci', 'грибы', 'champignons']),
  P('Eggplants', 'eggplant', 'produce', 'pcs', 'fridge', 7, 300, ['vinete', 'баклажаны']),
  P('Zucchini', 'zucchini', 'produce', 'pcs', 'fridge', 7, 250, ['dovlecei', 'кабачки']),
  P('Corn', 'corn', 'produce', 'pcs', 'fridge', 3, 250, ['porumb']),
  P('Avocados', 'avocado', 'produce', 'pcs', 'pantry', 5, 170),
  P('Lemons', 'lemon', 'produce', 'pcs', 'fridge', 21, 100, ['lămâi', 'lamai', 'лимоны']),
  P('Apples', 'apple', 'produce', 'pcs', 'fridge', 30, 180, ['mere', 'яблоки']),
  P('Bananas', 'banana', 'produce', 'pcs', 'pantry', 5, 120, ['banane', 'бананы']),
  P('Oranges', 'orange', 'produce', 'pcs', 'fridge', 21, 200, ['portocale', 'апельсины']),
  P('Strawberries', 'strawberry', 'produce', 'g', 'fridge', 3, undefined, ['căpșuni', 'capsuni', 'клубника']),
  P('Grapes', 'grapes', 'produce', 'g', 'fridge', 7, undefined, ['struguri', 'виноград']),
  P('Pears', 'pear', 'produce', 'pcs', 'fridge', 14, 180, ['pere', 'груши']),
  P('Watermelon', 'watermelon', 'produce', 'pcs', 'pantry', 14, 5000, ['pepene', 'арбуз']),
  P('Cherries', 'cherry', 'produce', 'g', 'fridge', 5, undefined, ['cireșe', 'cirese', 'черешня']),
  P('Dill', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['mărar', 'marar', 'укроп']),
  P('Parsley', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['pătrunjel', 'patrunjel', 'петрушка']),
  P('Basil', 'herbs', 'produce', 'pcs', 'fridge', 5, 25),
  P('Spinach', 'lettuce', 'produce', 'g', 'fridge', 4, undefined, ['spanac', 'шпинат']),
  P('Beetroot', 'potato', 'produce', 'pcs', 'fridge', 30, 200, ['sfeclă', 'sfecla', 'свёкла', 'beets']),
  // Bakery
  P('Bread', 'bread', 'bakery', 'pcs', 'pantry', 4, 500, ['pâine', 'paine', 'хлеб', 'loaf']),
  P('Baguette', 'baguette', 'bakery', 'pcs', 'pantry', 2, 250),
  P('Croissants', 'croissant', 'bakery', 'pcs', 'pantry', 2, 60),
  P('Tortillas', 'bread', 'bakery', 'pcs', 'pantry', 14, 60, ['lavash', 'lavaș']),
  // Meat and fish
  P('Beef steak', 'steak', 'meat', 'g', 'fridge', 3, undefined, ['steak', 'beef', 'vită', 'vita', 'говядина']),
  P('Pork', 'steak', 'meat', 'g', 'fridge', 3, undefined, ['porc', 'свинина', 'pork chop']),
  P('Chicken breast', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['piept de pui', 'куриная грудка']),
  P('Chicken thighs', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['pulpe de pui']),
  P('Whole chicken', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['pui', 'курица', 'chicken']),
  P('Minced meat', 'mince', 'meat', 'g', 'fridge', 2, undefined, ['carne tocată', 'carne tocata', 'фарш', 'ground beef', 'mince']),
  P('Sausages', 'sausage', 'meat', 'g', 'fridge', 7, undefined, ['crenvurști', 'crenvursti', 'cârnați', 'colbasă', 'колбаса', 'сосиски']),
  P('Bacon', 'bacon', 'meat', 'g', 'fridge', 7, undefined, ['slănină', 'бекон']),
  P('Ham', 'bacon', 'meat', 'g', 'fridge', 7, undefined, ['șuncă', 'sunca', 'ветчина']),
  P('Salmon', 'fish', 'fish', 'g', 'fridge', 2, undefined, ['somon', 'лосось']),
  P('Fish fillet', 'fish', 'fish', 'g', 'fridge', 2, undefined, ['pește', 'peste', 'рыба', 'fish']),
  P('Shrimp', 'shrimp', 'fish', 'g', 'freezer', 90, undefined, ['creveți', 'creveti', 'креветки', 'prawns']),
  P('Tuna (canned)', 'can', 'fish', 'pcs', 'pantry', 730, 160, ['ton', 'тунец', 'tuna']),
  // Dairy and eggs
  P('Milk', 'milk', 'dairy', 'ml', 'fridge', 7, [1000, 'ml'], ['lapte', 'молоко']),
  P('Eggs', 'egg', 'dairy', 'pcs', 'fridge', 21, 60, ['ouă', 'oua', 'яйца']),
  P('Cheese', 'cheese', 'dairy', 'g', 'fridge', 21, undefined, ['cașcaval', 'cascaval', 'сыр']),
  P('Feta', 'cheese', 'dairy', 'g', 'fridge', 14, undefined, ['brânză', 'branza', 'брынза']),
  P('Mozzarella', 'cheese', 'dairy', 'g', 'fridge', 7),
  P('Butter', 'butter', 'dairy', 'g', 'fridge', 30, undefined, ['unt', 'масло сливочное']),
  P('Yogurt', 'yogurt', 'dairy', 'pcs', 'fridge', 14, 150, ['iaurt', 'йогурт']),
  P('Sour cream', 'yogurt', 'dairy', 'g', 'fridge', 10, undefined, ['smântână', 'smantana', 'сметана']),
  P('Cream', 'milk', 'dairy', 'ml', 'fridge', 7, undefined, ['frișcă', 'frisca', 'сливки']),
  P('Cottage cheese', 'cottage', 'dairy', 'g', 'fridge', 5, undefined, ['brânză de vaci', 'branza de vaci', 'творог']),
  P('Kefir', 'milk', 'dairy', 'ml', 'fridge', 7, [1000, 'ml'], ['chefir', 'кефир']),
  // Frozen
  P('Frozen vegetables', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, ['legume congelate', 'замороженные овощи']),
  P('Mexican mix', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, ['amestec mexican', 'мексиканская смесь', 'mexican vegetables']),
  P('Frozen spinach', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, ['spanac congelat']),
  P('Frozen berries', 'frozen', 'frozen', 'g', 'freezer', 180),
  P('Ice cream', 'ice-cream', 'frozen', 'g', 'freezer', 180, undefined, ['înghețată', 'inghetata', 'мороженое']),
  P('Dumplings', 'dumplings', 'frozen', 'g', 'freezer', 120, undefined, ['pelmeni', 'colțunași', 'coltunasi', 'пельмени', 'вареники']),
  // Pantry
  P('Rice', 'rice', 'pantry', 'g', 'pantry', 365, undefined, ['orez', 'рис']),
  P('Pasta', 'pasta', 'pantry', 'g', 'pantry', 365, undefined, ['paste', 'макароны', 'spaghetti']),
  P('Flour', 'flour', 'pantry', 'g', 'pantry', 180, undefined, ['făină', 'faina', 'мука']),
  P('Sugar', 'sugar', 'pantry', 'g', 'pantry', 730, undefined, ['zahăr', 'zahar', 'сахар']),
  P('Oats', 'oats', 'pantry', 'g', 'pantry', 180, undefined, ['fulgi de ovăz', 'овсянка', 'oatmeal']),
  P('Buckwheat', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['hrișcă', 'hrisca', 'гречка']),
  P('Lentils', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['linte', 'чечевица']),
  P('Corn grits', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['mălai', 'malai', 'кукурузная крупа', 'polenta']),
  P('Canned beans', 'can', 'pantry', 'pcs', 'pantry', 730, 400, ['fasole', 'фасоль', 'beans']),
  P('Canned tomatoes', 'can', 'pantry', 'pcs', 'pantry', 730, 400),
  P('Tomato paste', 'jar', 'pantry', 'g', 'pantry', 365, undefined, ['pastă de tomate', 'pasta de tomate', 'томатная паста']),
  P('Sunflower oil', 'oil', 'pantry', 'ml', 'pantry', 365, undefined, ['ulei', 'масло подсолнечное', 'oil']),
  P('Olive oil', 'oil', 'pantry', 'ml', 'pantry', 365, undefined, ['ulei de măsline']),
  P('Honey', 'honey', 'pantry', 'g', 'pantry', 730, undefined, ['miere', 'мёд', 'мед']),
  P('Walnuts', 'nuts', 'pantry', 'g', 'pantry', 180, undefined, ['nuci', 'грецкие орехи', 'nuts']),
  P('Coffee', 'coffee', 'pantry', 'g', 'pantry', 180, undefined, ['cafea', 'кофе']),
  P('Tea', 'tea', 'pantry', 'pcs', 'pantry', 365, undefined, ['ceai', 'чай', 'tea bags']),
  P('Jam', 'jar', 'pantry', 'g', 'pantry', 365, undefined, ['gem', 'dulceață', 'варенье']),
  P('Breakfast cereal', 'box', 'pantry', 'g', 'pantry', 180, undefined, ['cereals', 'cereale']),
  // Spices and sauces
  P('Salt', 'salt', 'spices', 'g', 'pantry', 3650, undefined, ['sare', 'соль']),
  P('Black pepper', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['piper', 'перец чёрный', 'pepper']),
  P('Paprika', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['boia', 'паприка']),
  P('Ketchup', 'sauce', 'spices', 'ml', 'fridge', 90, undefined, ['кетчуп']),
  P('Mayonnaise', 'sauce', 'spices', 'ml', 'fridge', 60, undefined, ['maioneză', 'maioneza', 'майонез', 'mayo']),
  P('Mustard', 'sauce', 'spices', 'ml', 'fridge', 90, undefined, ['muștar', 'mustar', 'горчица']),
  P('Soy sauce', 'sauce', 'spices', 'ml', 'pantry', 365, undefined, ['sos de soia', 'соевый соус']),
  P('Vinegar', 'sauce', 'spices', 'ml', 'pantry', 730, undefined, ['oțet', 'otet', 'уксус']),
  // Drinks
  P('Water', 'water', 'drinks', 'ml', 'pantry', 365, [1500, 'ml'], ['apă', 'apa', 'вода']),
  P('Sparkling water', 'water', 'drinks', 'ml', 'pantry', 365, [1500, 'ml'], ['apă minerală', 'apa minerala', 'минеральная вода']),
  P('Juice', 'juice', 'drinks', 'ml', 'fridge', 7, [1000, 'ml'], ['suc', 'сок']),
  P('Soda', 'soda', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['cola', 'lemonade', 'limonadă']),
  P('Wine', 'wine', 'drinks', 'ml', 'pantry', 730, [750, 'ml'], ['vin', 'вино']),
  P('Beer', 'beer', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['bere', 'пиво']),
  // Snacks
  P('Chocolate', 'chocolate', 'snacks', 'g', 'pantry', 180, undefined, ['ciocolată', 'ciocolata', 'шоколад']),
  P('Cookies', 'cookie', 'snacks', 'g', 'pantry', 90, undefined, ['biscuiți', 'biscuiti', 'печенье', 'biscuits']),
  P('Chips', 'chips', 'snacks', 'g', 'pantry', 90, undefined, ['chipsuri', 'чипсы', 'crisps']),
  // Household
  P('Toilet paper', 'roll', 'household', 'pcs', 'other', undefined, undefined, ['hârtie igienică', 'туалетная бумага']),
  P('Paper towels', 'roll', 'household', 'pcs', 'other'),
  P('Dish soap', 'detergent', 'household', 'ml', 'other', undefined, undefined, ['detergent de vase', 'fairy']),
  P('Laundry detergent', 'detergent', 'household', 'ml', 'other'),
  P('Trash bags', 'box', 'household', 'pcs', 'other', undefined, undefined, ['saci de gunoi', 'мешки для мусора']),
  P('Aluminium foil', 'roll', 'household', 'pcs', 'other', undefined, undefined, ['folie de aluminiu', 'фольга']),
  P('Cling film', 'roll', 'household', 'pcs', 'other', undefined, undefined, ['folie alimentară', 'пищевая плёнка']),
  P('Baking paper', 'roll', 'household', 'pcs', 'other', undefined, undefined, ['hârtie de copt', 'пергамент']),
  P('Napkins', 'box', 'household', 'pcs', 'other', undefined, undefined, ['șervețele', 'servetele', 'салфетки']),
  P('Dishwasher tablets', 'box', 'household', 'pcs', 'other', undefined, undefined, ['tablete vase']),
  P('Sponges', 'detergent', 'household', 'pcs', 'other', undefined, undefined, ['bureți', 'губки']),
  P('Hand soap', 'detergent', 'household', 'ml', 'other', undefined, undefined, ['săpun', 'sapun', 'мыло']),

  // More produce
  P('Radishes', 'tomato', 'produce', 'g', 'fridge', 7, undefined, ['ridichi', 'редис']),
  P('Green onions', 'herbs', 'produce', 'pcs', 'fridge', 5, 50, ['ceapă verde', 'зелёный лук']),
  P('Leek', 'herbs', 'produce', 'pcs', 'fridge', 14, 300, ['praz', 'лук-порей']),
  P('Celery', 'herbs', 'produce', 'pcs', 'fridge', 14, 400, ['țelină', 'telina', 'сельдерей']),
  P('Cilantro', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['coriandru', 'кинза']),
  P('Mint', 'herbs', 'produce', 'pcs', 'fridge', 5, 20, ['mentă', 'menta', 'мята']),
  P('Ginger root', 'potato', 'produce', 'g', 'fridge', 30, undefined, ['ghimbir', 'имбирь']),
  P('Pumpkin', 'orange', 'produce', 'g', 'pantry', 60, undefined, ['dovleac', 'тыква']),
  P('Sweet potatoes', 'potato', 'produce', 'g', 'pantry', 21, undefined, ['cartofi dulci', 'батат']),
  P('Plums', 'cherry', 'produce', 'g', 'fridge', 5, undefined, ['prune', 'сливы']),
  P('Peaches', 'orange', 'produce', 'pcs', 'fridge', 5, 150, ['piersici', 'персики']),
  P('Apricots', 'orange', 'produce', 'g', 'fridge', 5, undefined, ['caise', 'абрикосы']),
  P('Kiwi', 'pear', 'produce', 'pcs', 'fridge', 14, 80),
  P('Pomegranate', 'apple', 'produce', 'pcs', 'fridge', 30, 300, ['rodie', 'гранат']),
  P('Blueberries', 'grapes', 'produce', 'g', 'fridge', 7, undefined, ['afine', 'черника']),
  P('Raspberries', 'strawberry', 'produce', 'g', 'fridge', 3, undefined, ['zmeură', 'zmeura', 'малина']),

  // More meat and fish
  P('Turkey', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['curcan', 'индейка']),
  P('Lamb', 'steak', 'meat', 'g', 'fridge', 3, undefined, ['miel', 'баранина']),
  P('Chicken wings', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['aripioare', 'крылышки']),
  P('Chicken liver', 'mince', 'meat', 'g', 'fridge', 2, undefined, ['ficat', 'печень']),
  P('Salami', 'sausage', 'meat', 'g', 'fridge', 21, undefined, ['salam', 'салями']),
  P('Smoked meat', 'bacon', 'meat', 'g', 'fridge', 14, undefined, ['pastramă', 'pastrama', 'копчёности']),
  P('Herring', 'fish', 'fish', 'g', 'fridge', 5, undefined, ['scrumbie', 'hering', 'сельдь', 'селёдка']),
  P('Canned sardines', 'can', 'fish', 'pcs', 'pantry', 730, 120, ['sardine', 'сардины']),
  P('Crab sticks', 'fish', 'fish', 'g', 'fridge', 10, undefined, ['bețișoare de crab', 'крабовые палочки']),

  // More dairy
  P('Parmesan', 'cheese', 'dairy', 'g', 'fridge', 60),
  P('Cream cheese', 'cottage', 'dairy', 'g', 'fridge', 14, undefined, ['brânză cremă', 'сливочный сыр']),
  P('Mascarpone', 'cottage', 'dairy', 'g', 'fridge', 10),
  P('Telemea', 'cheese', 'dairy', 'g', 'fridge', 21, undefined, ['brânză telemea']),
  P('Oat milk', 'milk', 'drinks', 'ml', 'pantry', 180, [1000, 'ml'], ['lapte de ovăz', 'овсяное молоко']),

  // More pantry
  P('Bulgur', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['булгур']),
  P('Couscous', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['кускус']),
  P('Quinoa', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['киноа']),
  P('Semolina', 'flour', 'pantry', 'g', 'pantry', 365, undefined, ['griș', 'gris', 'манка']),
  P('Breadcrumbs', 'flour', 'pantry', 'g', 'pantry', 180, undefined, ['pesmet', 'панировочные сухари']),
  P('Canned chickpeas', 'can', 'pantry', 'pcs', 'pantry', 730, 400, ['năut', 'naut', 'нут', 'chickpeas']),
  P('Canned corn', 'can', 'pantry', 'pcs', 'pantry', 730, 340, ['porumb conservat', 'кукуруза консервированная']),
  P('Canned peas', 'can', 'pantry', 'pcs', 'pantry', 730, 400, ['mazăre', 'mazare', 'горошек']),
  P('Olives', 'jar', 'pantry', 'g', 'pantry', 365, undefined, ['măsline', 'masline', 'оливки', 'маслины']),
  P('Pickles', 'jar', 'pantry', 'g', 'pantry', 365, undefined, ['castraveți murați', 'castraveti murati', 'солёные огурцы', 'маринованные огурцы']),
  P('Sauerkraut', 'jar', 'pantry', 'g', 'fridge', 60, undefined, ['varză murată', 'varza murata', 'квашеная капуста']),
  P('Coconut milk', 'can', 'pantry', 'pcs', 'pantry', 730, [400, 'ml']),
  P('Peanut butter', 'jar', 'pantry', 'g', 'pantry', 180, undefined, ['unt de arahide', 'арахисовая паста']),
  P('Chocolate spread', 'jar', 'pantry', 'g', 'pantry', 180, undefined, ['nutella', 'cremă de ciocolată']),
  P('Sunflower seeds', 'nuts', 'pantry', 'g', 'pantry', 180, undefined, ['semințe', 'seminte', 'семечки']),
  P('Almonds', 'nuts', 'pantry', 'g', 'pantry', 180, undefined, ['migdale', 'миндаль']),
  P('Raisins', 'nuts', 'pantry', 'g', 'pantry', 365, undefined, ['stafide', 'изюм']),
  P('Dried apricots', 'nuts', 'pantry', 'g', 'pantry', 365, undefined, ['caise uscate', 'курага']),
  P('Prunes', 'nuts', 'pantry', 'g', 'pantry', 365, undefined, ['prune uscate', 'чернослив']),
  P('Muesli', 'oats', 'pantry', 'g', 'pantry', 180, undefined, ['мюсли']),
  P('Crackers', 'cookie', 'snacks', 'g', 'pantry', 120, undefined, ['crackers', 'крекеры']),
  P('Instant coffee', 'coffee', 'pantry', 'g', 'pantry', 365, undefined, ['cafea solubilă', 'растворимый кофе']),

  // Spices and seasonings (kept by level)
  P('Oregano', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['oregano', 'орегано']),
  P('Dried basil', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['busuioc uscat', 'базилик сушёный']),
  P('Thyme', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['cimbru', 'тимьян', 'чабрец']),
  P('Rosemary', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['rozmarin', 'розмарин']),
  P('Bay leaves', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['foi de dafin', 'лавровый лист']),
  P('Dried dill', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['mărar uscat', 'укроп сушёный']),
  P('Mixed herbs', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['herbes de provence', 'ierburi provensale', 'italian seasoning', 'прованские травы']),
  P('Cumin', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['chimion', 'кумин', 'зира']),
  P('Ground coriander', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['coriandru măcinat', 'кориандр']),
  P('Cinnamon', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['scorțișoară', 'scortisoara', 'корица']),
  P('Turmeric', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['turmeric', 'куркума']),
  P('Curry powder', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['curry', 'карри']),
  P('Chili flakes', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['fulgi de chili', 'ardei iute uscat', 'хлопья чили']),
  P('Smoked paprika', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['boia afumată']),
  P('Garlic powder', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['usturoi granulat', 'чесночный порошок']),
  P('Onion powder', 'spice', 'spices', 'g', 'pantry', 730),
  P('Ground ginger', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['ghimbir măcinat']),
  P('Nutmeg', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['nucșoară', 'nucsoara', 'мускатный орех']),
  P('Cloves', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['cuișoare', 'cuisoare', 'гвоздика']),
  P('Allspice', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['ienibahar', 'душистый перец']),
  P('Cardamom', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['cardamom', 'кардамон']),
  P('Vegeta', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['condiment universal', 'приправа универсальная', 'вегета']),
  P('Khmeli-suneli', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['хмели-сунели', 'hmeli suneli']),
  P('Vanilla', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['vanilie', 'ваниль', 'vanilla extract']),
  P('Hot sauce', 'sauce', 'spices', 'ml', 'fridge', 365, undefined, ['sos iute', 'острый соус', 'tabasco']),
  P('Adjika', 'sauce', 'spices', 'ml', 'fridge', 60, undefined, ['ajica', 'аджика']),
  P('Horseradish', 'jar', 'spices', 'g', 'fridge', 60, undefined, ['hrean', 'хрен']),
  P('BBQ sauce', 'sauce', 'spices', 'ml', 'fridge', 90),
  P('Pesto', 'jar', 'spices', 'g', 'fridge', 10),
  P('Tomato sauce', 'sauce', 'spices', 'ml', 'pantry', 365, undefined, ['sos de roșii', 'sos de rosii', 'томатный соус', 'passata']),
  P('Balsamic vinegar', 'sauce', 'spices', 'ml', 'pantry', 730, undefined, ['oțet balsamic', 'бальзамический уксус']),
  P('Apple cider vinegar', 'sauce', 'spices', 'ml', 'pantry', 730, undefined, ['oțet de mere', 'яблочный уксус']),

  // Baking (kept by level)
  P('Baking soda', 'box', 'spices', 'g', 'pantry', 730, undefined, ['bicarbonat', 'сода']),
  P('Baking powder', 'box', 'spices', 'g', 'pantry', 365, undefined, ['praf de copt', 'разрыхлитель']),
  P('Dry yeast', 'box', 'spices', 'g', 'pantry', 365, undefined, ['drojdie', 'дрожжи']),
  P('Cocoa powder', 'box', 'spices', 'g', 'pantry', 730, undefined, ['cacao', 'какао']),
  P('Corn starch', 'flour', 'spices', 'g', 'pantry', 730, undefined, ['amidon', 'крахмал']),
  P('Vanilla sugar', 'sugar', 'spices', 'g', 'pantry', 730, undefined, ['zahăr vanilat', 'ванильный сахар']),
  P('Powdered sugar', 'sugar', 'spices', 'g', 'pantry', 730, undefined, ['zahăr pudră', 'zahar pudra', 'сахарная пудра']),

  // Frozen extras
  P('Frozen pizza', 'pizza', 'frozen', 'pcs', 'freezer', 180, 400),
  P('Fish sticks', 'fish', 'frozen', 'g', 'freezer', 180, undefined, ['bețișoare de pește', 'рыбные палочки']),
  P('French fries', 'frozen', 'frozen', 'g', 'freezer', 180, undefined, ['cartofi pai', 'картофель фри']),
];

export const PRESETS: readonly Preset[] = RAW_PRESETS.map((preset) => ({
  ...preset,
  ...(OPENED[preset.name] ? { openedDays: OPENED[preset.name] } : {}),
  ...(preset.category === 'spices' || BY_LEVEL.has(preset.name) ? { track: 'level' as const } : {}),
}));

/** Lowercase, no diacritics, single spaces. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** The forms a name could take: "tomatoes" also matches "tomato", "cherries" → "cherry", "cookies" → "cookie". */
export function nameForms(value: string): Set<string> {
  const base = normalizeName(value);
  const forms = new Set([base]);
  if (base.endsWith('ies')) {
    forms.add(`${base.slice(0, -3)}y`);
    forms.add(base.slice(0, -1));
  }
  if (base.endsWith('oes') || base.endsWith('ches') || base.endsWith('shes') || base.endsWith('xes')) forms.add(base.slice(0, -2));
  if (base.endsWith('s') && !base.endsWith('ss')) forms.add(base.slice(0, -1));
  if (!base.endsWith('s')) {
    forms.add(`${base}s`);
    forms.add(`${base}es`);
  }
  return forms;
}

export function sameName(a: string, b: string): boolean {
  const left = nameForms(a);
  for (const form of nameForms(b)) if (left.has(form)) return true;
  return false;
}

/** The preset a typed name refers to, if any ("tomato", "Roșii" and "TOMATOES" all find Tomatoes). */
export function findPreset(name: string): Preset | null {
  for (const preset of PRESETS) {
    if (sameName(preset.name, name)) return preset;
    if (preset.aliases?.some((alias) => sameName(alias, name))) return preset;
  }
  return null;
}

/** Words in a name that say what kind of food it is, for names the catalog doesn't know. */
const GUESSES: Array<{ match: RegExp; preset: Omit<Preset, 'name'> }> = [
  { match: /\b(spice|seasoning|powder|ground|dried|condiment|condimente|mix|приправ)/, preset: { icon: 'spice', category: 'spices', unit: 'g', location: 'pantry', track: 'level' } },
  { match: /\b(herb|leaves|leaf|frunze|травы)/, preset: { icon: 'herbs', category: 'spices', unit: 'g', location: 'pantry', track: 'level' } },
  { match: /\b(sauce|ketchup|dressing|sos|соус)/, preset: { icon: 'sauce', category: 'spices', unit: 'ml', location: 'fridge', track: 'level' } },
  { match: /\b(oil|ulei|масло)\b/, preset: { icon: 'oil', category: 'pantry', unit: 'ml', location: 'pantry', track: 'level' } },
  { match: /\b(vinegar|otet|уксус)/, preset: { icon: 'sauce', category: 'spices', unit: 'ml', location: 'pantry', track: 'level' } },
  { match: /\b(juice|suc|сок)\b/, preset: { icon: 'juice', category: 'drinks', unit: 'ml', location: 'fridge', shelfLifeDays: 7 } },
  { match: /\b(water|apa|вода)\b/, preset: { icon: 'water', category: 'drinks', unit: 'ml', location: 'pantry' } },
  { match: /\b(beer|bere|пиво)\b/, preset: { icon: 'beer', category: 'drinks', unit: 'ml', location: 'pantry' } },
  { match: /\b(wine|vin|вино)\b/, preset: { icon: 'wine', category: 'drinks', unit: 'ml', location: 'pantry' } },
  { match: /\b(tea|ceai|чай)\b/, preset: { icon: 'tea', category: 'pantry', unit: 'pcs', location: 'pantry', track: 'level' } },
  { match: /\b(coffee|cafea|кофе)\b/, preset: { icon: 'coffee', category: 'pantry', unit: 'g', location: 'pantry', track: 'level' } },
  { match: /\b(cheese|branza|cascaval|сыр)/, preset: { icon: 'cheese', category: 'dairy', unit: 'g', location: 'fridge', shelfLifeDays: 14 } },
  { match: /\b(yogh?urt|iaurt|йогурт)/, preset: { icon: 'yogurt', category: 'dairy', unit: 'pcs', location: 'fridge', shelfLifeDays: 14 } },
  { match: /\b(milk|lapte|молоко)\b/, preset: { icon: 'milk', category: 'dairy', unit: 'ml', location: 'fridge', shelfLifeDays: 7 } },
  { match: /\b(chocolate|ciocolat|шоколад)/, preset: { icon: 'chocolate', category: 'snacks', unit: 'g', location: 'pantry' } },
  { match: /\b(cookie|biscuit|печенье)/, preset: { icon: 'cookie', category: 'snacks', unit: 'g', location: 'pantry' } },
  { match: /\b(cake|tort|prajitur|торт)/, preset: { icon: 'cake', category: 'snacks', unit: 'pcs', location: 'fridge', shelfLifeDays: 3 } },
  { match: /\b(frozen|congelat|заморож)/, preset: { icon: 'frozen', category: 'frozen', unit: 'g', location: 'freezer', shelfLifeDays: 180 } },
  { match: /\b(chicken|pui|куриц)/, preset: { icon: 'chicken', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 2 } },
  { match: /\b(meat|carne|pork|porc|beef|vita|lamb|miel|мясо)/, preset: { icon: 'steak', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 3 } },
  { match: /\b(sausage|salam|carnati|колбас)/, preset: { icon: 'sausage', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 7 } },
  { match: /\b(fish|peste|рыба)/, preset: { icon: 'fish', category: 'fish', unit: 'g', location: 'fridge', shelfLifeDays: 2 } },
  { match: /\b(rice|orez|рис)\b/, preset: { icon: 'rice', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(pasta|paste|spaghetti|macaroni|penne|fusilli)/, preset: { icon: 'pasta', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(flour|faina|мука)/, preset: { icon: 'flour', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(sugar|zahar|сахар)/, preset: { icon: 'sugar', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(nut|nuci|seed|seminte|almond|орех)/, preset: { icon: 'nuts', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(can|canned|conserv|консерв)/, preset: { icon: 'can', category: 'pantry', unit: 'pcs', location: 'pantry', shelfLifeDays: 730 } },
  { match: /\b(jam|gem|dulceata|pickle|murat|olive|masline|варенье)/, preset: { icon: 'jar', category: 'pantry', unit: 'g', location: 'pantry' } },
  { match: /\b(bread|paine|bun|chifl|хлеб)/, preset: { icon: 'bread', category: 'bakery', unit: 'pcs', location: 'pantry', shelfLifeDays: 4 } },
  { match: /\b(soap|sapun|detergent|clean|spray|мыло)/, preset: { icon: 'detergent', category: 'household', unit: 'pcs', location: 'other', track: 'level' } },
  { match: /\b(paper|hartie|napkin|servet|foil|folie|бумаг)/, preset: { icon: 'roll', category: 'household', unit: 'pcs', location: 'other', track: 'level' } },
];

/** A good guess for a name nobody has seen: "Smoked salt", "Oat cookies", "Frozen dumplings". */
export function guessPreset(name: string): Preset | null {
  const normalized = normalizeName(name);
  for (const guess of GUESSES) if (guess.match.test(normalized)) return { name, ...guess.preset };
  return null;
}

/** The catalog's food for a name, or a guess from its words. */
export function presetOrGuess(name: string): Preset | null {
  return findPreset(name) ?? guessPreset(name);
}
