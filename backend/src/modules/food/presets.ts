import type { BaseUnit } from './units';

/**
 * The built-in catalog: common foods with sensible defaults, so "tomatoes" arrives with its icon,
 * counted in pieces (about 120 g each), kept in the fridge, good for about a week. Names match in
 * English, loosely (plural or singular, any case, without diacritics) and through aliases,
 * including the Romanian and Russian words used in Moldovan shops.
 *
 * Icon keys are drawn in frontend/src/food/icons; keep the two lists in step.
 */

export const LOCATIONS = ['fridge', 'freezer', 'pantry', 'other'] as const;
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
}

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

export const PRESETS: readonly Preset[] = [
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
  P('Frozen vegetables', 'frozen', 'frozen', 'g', 'freezer', 180, undefined, ['legume congelate']),
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
];

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
