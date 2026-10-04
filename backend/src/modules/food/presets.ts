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
  // sports nutrition
  'protein-powder',
  'protein-bar',
  'mass-gainer',
  'creatine',
  'protein-pudding',
  'skyr',
  // kinds: each has its own picture
  'bread-brown',
  'bread-rye',
  'bread-seeded',
  'bread-toast',
  'bread-whole-grain',
  'bread-black',
  'milk-light',
  'milk-semi',
  'milk-whole',
  'milk-lactose-free',
  'milk-oat',
  'milk-almond',
  'milk-barista',
  'rice-brown',
  'rice-sushi',
  'rice-basmati',
  'rice-wild',
  'rice-parboiled',
  'penne',
  'fusilli',
  'farfalle',
  'ravioli',
  'cannelloni',
  'lasagne',
  'tagliatelle',
  'conchiglie',
  'rigatoni',
  'tea-black',
  'tea-green',
  'tea-earl-grey',
  'tea-herbal',
  'tea-fruit',
  'tea-chamomile',
  'tea-mint',
  'tea-jasmine',
  'cola',
  'cola-zero',
  'cola-cherry',
  'cola-lime',
  'cola-vanilla',
  'pepsi',
  'pepsi-zero',
  'sprite',
  'fanta',
  'fanta-lemon',
  'fanta-exotic',
  'mirinda',
  'dr-pepper',
  'seven-up',
  'juice-apple',
  'juice-orange',
  'juice-peach',
  'juice-mango',
  'juice-multifruit',
  'juice-cherry',
  'juice-tomato',
  'juice-grape',
  'juice-pineapple',
  'juice-banana',
  'juice-pomegranate',
  'water-om',
  'water-gura-cainarului',
  'water-dorna',
  'water-izvorul-alb',
  'water-borjomi',
  'water-borsec',
  'syrup-vanilla',
  'syrup-caramel',
  'syrup-salted-caramel',
  'syrup-hazelnut',
  'syrup-coconut',
  'syrup-maracuya',
  'syrup-mint',
  'syrup-strawberry',
  'syrup-grenadine',
  'syrup-chocolate',
  'syrup-irish-cream',
  // produce
  'tomato',
  'cucumber',
  'carrot',
  'potato',
  'onion',
  'garlic',
  'bell-pepper',
  'chili',
  'lettuce',
  'cabbage',
  'broccoli',
  'mushroom',
  'eggplant',
  'zucchini',
  'corn',
  'avocado',
  'lemon',
  'apple',
  'banana',
  'orange',
  'strawberry',
  'grapes',
  'pear',
  'watermelon',
  'cherry',
  'herbs',
  'kiwi',
  'pumpkin',
  'peach',
  'plum',
  'pomegranate',
  'beetroot',
  'radish',
  'seedling',
  'herb-pot',
  // bakery
  'bread',
  'baguette',
  'croissant',
  // meat, fish
  'steak',
  'chicken',
  'mince',
  'sausage',
  'bacon',
  'fish',
  'shrimp',
  // dairy
  'milk',
  'milk-carton',
  'kefir',
  'cream',
  'whipped-cream',
  'egg',
  'cheese',
  'butter',
  'yogurt',
  'cottage',
  // frozen
  'frozen',
  'ice-cream',
  'dumplings',
  // pantry
  'rice',
  'pasta',
  'flour',
  'sugar',
  'oats',
  'cereal',
  'grain',
  'can',
  'oil',
  'olive-oil',
  'vinegar',
  'honey',
  'nuts',
  'dried-fruit',
  'seeds',
  'coffee',
  'coffee-beans',
  'tea',
  'jar',
  // cans and jars
  'can-fish',
  'can-tomato',
  'can-corn',
  'can-beans',
  'can-peas',
  'can-fruit',
  'can-meat',
  'can-mushroom',
  'pate',
  'pickles',
  'jar-spread',
  // spices and sauces
  'salt',
  'spice',
  'spice-jar',
  'pepper-grinder',
  'cinnamon',
  'bay-leaf',
  'sauce',
  'soy-sauce',
  'mayo',
  'mustard',
  // drinks
  'water',
  'juice',
  'soda',
  'wine',
  'beer',
  'soda-can',
  'juice-box',
  'mineral-water',
  'spirit',
  'syrup',
  'cocktail',
  'ice',
  'puree',
  'lime',
  'lemonade',
  'compote',
  'iced-tea',
  'tonic',
  'energy-drink',
  'kvass',
  'whisky',
  'champagne',
  'tea-cup',
  'espresso',
  'cappuccino',
  'latte',
  // snacks
  'chocolate',
  'chocolate-chips',
  'marshmallow',
  'sprinkles',
  'cookie',
  'chips',
  'popcorn',
  'croutons',
  // dishes (recipes and leftovers)
  'pot',
  'bowl',
  'soup',
  'salad',
  'pizza',
  'sandwich',
  'cake',
  'pancakes',
  'omelette',
  'spaghetti',
  'container',
  // household and fallback
  'roll',
  'detergent',
  'sponge',
  'trash-bag',
  'box',
  'basket',
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
  /** Where it goes once opened, when that differs (an opened can: the fridge). */
  openedLocation?: Location;
  /** How it is kept track of; exact (amounts) when not given. */
  track?: TrackMode;
  /** Days it keeps in the freezer, and once thawed. */
  freezerDays?: number;
  thawedDays?: number;
  /** Its own units, sizes in its base unit. */
  units?: Array<{ name: string; plural?: string; size: number; sizes?: number[] }>;
  /** Kinds of it, offered when adding. */
  variants?: string[];
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
export function freezingFor(item: {
  category: Category;
  freezerDays?: number | null;
  thawedDays?: number | null;
}) {
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
  Milk: 5,
  Cream: 4,
  Kefir: 4,
  'Sour cream': 7,
  Juice: 5,
  Soda: 3,
  'Coca-Cola': 3,
  Pepsi: 3,
  Sprite: 3,
  Fanta: 3,
  'Iced tea': 3,
  'Mineral water': 3,
  'Sparkling water': 3,
  Kvass: 2,
  Wine: 5,
  'Sparkling wine': 1,
  'Whipped cream': 14,
  Coffee: 30,
  'Tonic water': 3,
  Syrup: 90,
  'Fruit purée': 3,
  'Sunflower oil': 120,
  'Olive oil': 120,
  Yogurt: 2,
  'Cottage cheese': 3,
  Mozzarella: 3,
  'Canned beans': 3,
  'Canned tomatoes': 4,
  'Chopped tomatoes': 4,
  'Tomato sauce (canned)': 5,
  'Canned corn': 3,
  'Canned peas': 3,
  'Canned mushrooms': 3,
  'Canned pineapple': 3,
  'Canned peaches': 3,
  'Tuna (canned)': 2,
  Sprats: 2,
  'Canned meat': 3,
  'Liver pâté': 2,
  Zacuscă: 10,
  'Eggplant caviar': 7,
  Lecho: 7,
  Ajvar: 10,
  'Tomato paste': 7,
  Mayonnaise: 30,
  Ketchup: 60,
  Mustard: 60,
  Ham: 4,
  Bacon: 5,
  Pickles: 30,
  'Pickled tomatoes': 14,
  Olives: 14,
  Sausages: 5,
  Cheese: 14,
  Feta: 7,
  Jam: 30,
};
/** Kept by level rather than weighed: everything in Spices & sauces, plus these. */
const BY_LEVEL = new Set([
  'Jam',
  'Tomato paste',
  'Tea',
  'Instant coffee',
  'Peanut butter',
  'Chocolate spread',
]);

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
  ...(piece
    ? {
        pieceSize: Array.isArray(piece) ? piece[0] : piece,
        pieceUnit: Array.isArray(piece) ? piece[1] : 'g',
      }
    : {}),
  ...(aliases ? { aliases } : {}),
});

const RAW_PRESETS: readonly Preset[] = [
  // Produce
  P('Tomatoes', 'tomato', 'produce', 'pcs', 'fridge', 7, 120, ['roșii', 'rosii', 'помидоры']),
  P('Cherry tomatoes', 'tomato', 'produce', 'g', 'fridge', 7),
  P('Cucumbers', 'cucumber', 'produce', 'pcs', 'fridge', 7, 200, [
    'castraveți',
    'castraveti',
    'огурцы',
  ]),
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
  P('Mushrooms', 'mushroom', 'produce', 'g', 'fridge', 5, undefined, [
    'ciuperci',
    'грибы',
    'champignons',
  ]),
  P('Eggplants', 'eggplant', 'produce', 'pcs', 'fridge', 7, 300, ['vinete', 'баклажаны']),
  P('Zucchini', 'zucchini', 'produce', 'pcs', 'fridge', 7, 250, ['dovlecei', 'кабачки']),
  P('Corn', 'corn', 'produce', 'pcs', 'fridge', 3, 250, ['porumb']),
  P('Avocados', 'avocado', 'produce', 'pcs', 'pantry', 5, 170),
  P('Lemons', 'lemon', 'produce', 'pcs', 'fridge', 21, 100, ['lămâi', 'lamai', 'лимоны']),
  P('Apples', 'apple', 'produce', 'pcs', 'fridge', 30, 180, ['mere', 'яблоки']),
  P('Bananas', 'banana', 'produce', 'pcs', 'pantry', 5, 120, ['banane', 'бананы']),
  P('Oranges', 'orange', 'produce', 'pcs', 'fridge', 21, 200, ['portocale', 'апельсины']),
  P('Strawberries', 'strawberry', 'produce', 'g', 'fridge', 3, undefined, [
    'căpșuni',
    'capsuni',
    'клубника',
  ]),
  P('Grapes', 'grapes', 'produce', 'g', 'fridge', 7, undefined, ['struguri', 'виноград']),
  P('Pears', 'pear', 'produce', 'pcs', 'fridge', 14, 180, ['pere', 'груши']),
  P('Watermelon', 'watermelon', 'produce', 'pcs', 'pantry', 14, 5000, ['pepene', 'арбуз']),
  P('Cherries', 'cherry', 'produce', 'g', 'fridge', 5, undefined, ['cireșe', 'cirese', 'черешня']),
  P('Dill', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['mărar', 'marar', 'укроп']),
  P('Parsley', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['pătrunjel', 'patrunjel', 'петрушка']),
  P('Basil', 'herbs', 'produce', 'pcs', 'fridge', 5, 25),
  P('Spinach', 'lettuce', 'produce', 'g', 'fridge', 4, undefined, ['spanac', 'шпинат']),
  P('Beetroot', 'beetroot', 'produce', 'pcs', 'fridge', 30, 200, [
    'sfeclă',
    'sfecla',
    'свёкла',
    'beets',
  ]),
  // Bakery
  P('Bread', 'bread', 'bakery', 'pcs', 'pantry', 4, 25, [
    'pâine',
    'paine',
    'хлеб',
    'loaf',
    'slices of bread',
  ]),
  P('Baguette', 'baguette', 'bakery', 'pcs', 'pantry', 2, 250),
  P('Croissants', 'croissant', 'bakery', 'pcs', 'pantry', 2, 60),
  P('Tortillas', 'bread', 'bakery', 'pcs', 'pantry', 14, 60, ['lavash', 'lavaș']),
  // Meat and fish
  P('Beef steak', 'steak', 'meat', 'g', 'fridge', 3, undefined, [
    'steak',
    'beef',
    'vită',
    'vita',
    'говядина',
  ]),
  P('Pork', 'steak', 'meat', 'g', 'fridge', 3, undefined, ['porc', 'свинина', 'pork chop']),
  P('Chicken breast', 'chicken', 'meat', 'g', 'fridge', 2, undefined, [
    'piept de pui',
    'куриная грудка',
  ]),
  P('Chicken thighs', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['pulpe de pui']),
  P('Whole chicken', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['pui', 'курица', 'chicken']),
  P('Minced meat', 'mince', 'meat', 'g', 'fridge', 2, undefined, [
    'carne tocată',
    'carne tocata',
    'фарш',
    'ground beef',
    'mince',
  ]),
  P('Sausages', 'sausage', 'meat', 'g', 'fridge', 7, undefined, [
    'crenvurști',
    'crenvursti',
    'cârnați',
    'colbasă',
    'колбаса',
    'сосиски',
  ]),
  P('Bacon', 'bacon', 'meat', 'g', 'fridge', 7, undefined, ['slănină', 'бекон']),
  P('Ham', 'bacon', 'meat', 'g', 'fridge', 7, undefined, ['șuncă', 'sunca', 'ветчина']),
  P('Salmon', 'fish', 'fish', 'g', 'fridge', 2, undefined, ['somon', 'лосось']),
  P('Fish fillet', 'fish', 'fish', 'g', 'fridge', 2, undefined, ['pește', 'peste', 'рыба', 'fish']),
  P('Shrimp', 'shrimp', 'fish', 'g', 'freezer', 90, undefined, [
    'creveți',
    'creveti',
    'креветки',
    'prawns',
  ]),
  P('Tuna (canned)', 'can-fish', 'fish', 'g', 'pantry', 730, 160, ['ton', 'тунец', 'tuna']),
  // Dairy and eggs
  P('Milk', 'milk', 'dairy', 'ml', 'fridge', 7, [1000, 'ml'], ['lapte', 'молоко']),
  P('Eggs', 'egg', 'dairy', 'pcs', 'fridge', 21, 60, ['ouă', 'oua', 'яйца']),
  P('Cheese', 'cheese', 'dairy', 'g', 'fridge', 21, undefined, ['cașcaval', 'cascaval', 'сыр']),
  P('Feta', 'cheese', 'dairy', 'g', 'fridge', 14, undefined, ['brânză', 'branza', 'брынза']),
  P('Mozzarella', 'cheese', 'dairy', 'g', 'fridge', 7),
  P('Butter', 'butter', 'dairy', 'g', 'fridge', 30, undefined, ['unt', 'масло сливочное']),
  P('Yogurt', 'yogurt', 'dairy', 'pcs', 'fridge', 14, 150, ['iaurt', 'йогурт']),
  P('Sour cream', 'yogurt', 'dairy', 'g', 'fridge', 10, undefined, [
    'smântână',
    'smantana',
    'сметана',
  ]),
  P('Cream', 'cream', 'dairy', 'ml', 'fridge', 7, undefined, [
    'smântână lichidă',
    'сливки',
    'cooking cream',
  ]),
  P('Whipped cream', 'whipped-cream', 'dairy', 'g', 'fridge', 21, undefined, [
    'frișcă',
    'frisca',
    'взбитые сливки',
    'cream spray',
  ]),
  P('Sprinkles', 'sprinkles', 'snacks', 'g', 'pantry', 365, undefined, [
    'ornamente',
    'посыпка',
    'topping',
    'coffee topping',
  ]),
  P('Chocolate chips', 'chocolate-chips', 'snacks', 'g', 'pantry', 365, undefined, [
    'picături de ciocolată',
    'шоколадные капли',
  ]),
  P('Marshmallows', 'marshmallow', 'snacks', 'g', 'pantry', 180, undefined, [
    'bezele',
    'зефир маршмеллоу',
  ]),
  P('Cottage cheese', 'cottage', 'dairy', 'g', 'fridge', 5, undefined, [
    'brânză de vaci',
    'branza de vaci',
    'творог',
  ]),
  P('Kefir', 'kefir', 'dairy', 'ml', 'fridge', 7, [1000, 'ml'], ['chefir', 'кефир']),
  // Frozen
  P('Frozen vegetables', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, [
    'legume congelate',
    'замороженные овощи',
  ]),
  P('Mexican mix', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, [
    'amestec mexican',
    'мексиканская смесь',
    'mexican vegetables',
  ]),
  P('Frozen spinach', 'frozen', 'frozen', 'g', 'freezer', 240, undefined, ['spanac congelat']),
  P('Frozen berries', 'frozen', 'frozen', 'g', 'freezer', 180),
  P('Ice cream', 'ice-cream', 'frozen', 'g', 'freezer', 180, undefined, [
    'înghețată',
    'inghetata',
    'мороженое',
  ]),
  P('Dumplings', 'dumplings', 'frozen', 'g', 'freezer', 120, undefined, [
    'pelmeni',
    'colțunași',
    'coltunasi',
    'пельмени',
    'вареники',
  ]),
  // Pantry
  P('Rice', 'rice', 'pantry', 'g', 'pantry', 365, undefined, ['orez', 'рис']),
  P('Pasta', 'pasta', 'pantry', 'g', 'pantry', 365, undefined, ['paste', 'макароны', 'spaghetti']),
  P('Flour', 'flour', 'pantry', 'g', 'pantry', 180, undefined, ['făină', 'faina', 'мука']),
  P('Sugar', 'sugar', 'pantry', 'g', 'pantry', 730, undefined, ['zahăr', 'zahar', 'сахар']),
  P('Oats', 'oats', 'pantry', 'g', 'pantry', 180, undefined, [
    'fulgi de ovăz',
    'овсянка',
    'oatmeal',
  ]),
  P('Buckwheat', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['hrișcă', 'hrisca', 'гречка']),
  P('Lentils', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['linte', 'чечевица']),
  P('Corn grits', 'grain', 'pantry', 'g', 'pantry', 365, undefined, [
    'mălai',
    'malai',
    'кукурузная крупа',
    'polenta',
  ]),
  P('Canned beans', 'can-beans', 'pantry', 'g', 'pantry', 730, 400, ['fasole', 'фасоль', 'beans']),
  P('Canned tomatoes', 'can-tomato', 'pantry', 'g', 'pantry', 730, 400, [
    'roșii conservate',
    'rosii conservate',
    'whole peeled tomatoes',
    'помидоры в собственном соку',
  ]),
  P('Tomato paste', 'jar', 'pantry', 'g', 'pantry', 365, undefined, [
    'pastă de tomate',
    'pasta de tomate',
    'томатная паста',
  ]),
  P('Sunflower oil', 'oil', 'pantry', 'ml', 'pantry', 365, undefined, [
    'ulei',
    'масло подсолнечное',
    'oil',
  ]),
  P('Olive oil', 'olive-oil', 'pantry', 'ml', 'pantry', 365, undefined, [
    'ulei de măsline',
    'оливковое масло',
  ]),
  P('Honey', 'honey', 'pantry', 'g', 'pantry', 730, undefined, ['miere', 'мёд', 'мед']),
  P('Walnuts', 'nuts', 'pantry', 'g', 'pantry', 180, undefined, ['nuci', 'грецкие орехи', 'nuts']),
  P('Coffee', 'coffee-beans', 'pantry', 'g', 'pantry', 180, undefined, [
    'cafea',
    'кофе',
    'coffee beans',
    'boabe de cafea',
    'кофе в зернах',
    'ground coffee',
  ]),
  P('Tea', 'tea', 'pantry', 'pcs', 'pantry', 365, undefined, ['ceai', 'чай', 'tea bags']),
  P('Jam', 'jar', 'pantry', 'g', 'pantry', 365, undefined, ['gem', 'dulceață', 'варенье']),
  P('Breakfast cereal', 'cereal', 'pantry', 'g', 'pantry', 180, undefined, ['cereals', 'cereale']),
  // Spices and sauces
  P('Salt', 'salt', 'spices', 'g', 'pantry', 3650, undefined, ['sare', 'соль']),
  P('Black pepper', 'pepper-grinder', 'spices', 'g', 'pantry', 730, undefined, [
    'piper',
    'перец чёрный',
    'pepper',
  ]),
  P('Paprika', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['boia', 'паприка']),
  P('Ketchup', 'sauce', 'spices', 'ml', 'fridge', 90, undefined, ['кетчуп']),
  P('Mayonnaise', 'mayo', 'spices', 'ml', 'fridge', 60, undefined, [
    'maioneză',
    'maioneza',
    'майонез',
    'mayo',
  ]),
  P('Mustard', 'mustard', 'spices', 'ml', 'fridge', 90, undefined, ['muștar', 'mustar', 'горчица']),
  P('Soy sauce', 'soy-sauce', 'spices', 'ml', 'pantry', 365, undefined, [
    'sos de soia',
    'соевый соус',
  ]),
  P('Vinegar', 'vinegar', 'spices', 'ml', 'pantry', 730, undefined, ['oțet', 'otet', 'уксус']),
  // Drinks
  P(
    'Water',
    'water',
    'drinks',
    'ml',
    'pantry',
    365,
    [1500, 'ml'],
    ['apă', 'apa', 'вода', 'still water', 'apă plată'],
  ),
  P(
    'Sparkling water',
    'mineral-water',
    'drinks',
    'ml',
    'pantry',
    365,
    [1500, 'ml'],
    ['apă gazoasă', 'apa gazoasa', 'carbonated water', 'газированная вода'],
  ),
  P(
    'Mineral water',
    'mineral-water',
    'drinks',
    'ml',
    'pantry',
    365,
    [500, 'ml'],
    ['apă minerală', 'apa minerala', 'минеральная вода', 'borjomi', 'боржоми'],
  ),
  P(
    'Juice',
    'juice-box',
    'drinks',
    'ml',
    'pantry',
    270,
    [1000, 'ml'],
    ['suc', 'сок', 'nectar', 'nectar'],
  ),
  P(
    'Coca-Cola',
    'cola',
    'drinks',
    'ml',
    'pantry',
    180,
    [500, 'ml'],
    ['coca cola', 'cola', 'coke', 'кока-кола'],
  ),
  P('Pepsi', 'pepsi', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['пепси']),
  P('Sprite', 'sprite', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['спрайт']),
  P('Fanta', 'fanta', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['фанта']),
  P('Mirinda', 'mirinda', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['миринда']),
  P(
    'Dr Pepper',
    'dr-pepper',
    'drinks',
    'ml',
    'pantry',
    180,
    [500, 'ml'],
    ['dr. pepper', 'доктор пеппер'],
  ),
  P(
    '7UP',
    'seven-up',
    'drinks',
    'ml',
    'pantry',
    180,
    [500, 'ml'],
    ['7 up', 'seven up', 'севен ап'],
  ),
  P(
    'Soda',
    'soda',
    'drinks',
    'ml',
    'pantry',
    180,
    [500, 'ml'],
    ['fizzy drink', 'băutură carbogazoasă', 'газировка'],
  ),
  P(
    'Lemonade',
    'lemonade',
    'drinks',
    'ml',
    'fridge',
    5,
    [1000, 'ml'],
    ['limonadă', 'limonada', 'лимонад'],
  ),
  P(
    'Iced tea',
    'iced-tea',
    'drinks',
    'ml',
    'pantry',
    270,
    [500, 'ml'],
    ['ice tea', 'ceai rece', 'холодный чай', 'lipton', 'fuzetea'],
  ),
  P(
    'Energy drink',
    'energy-drink',
    'drinks',
    'ml',
    'pantry',
    365,
    [250, 'ml'],
    ['energizant', 'энергетик', 'red bull', 'burn'],
  ),
  P('Kvass', 'kvass', 'drinks', 'ml', 'pantry', 60, [1500, 'ml'], ['cvas', 'квас']),
  P('Compote', 'compote', 'drinks', 'ml', 'fridge', 4, undefined, ['compot', 'компот', 'kompot']),
  P(
    'Kefir drink',
    'kefir',
    'drinks',
    'ml',
    'fridge',
    7,
    [500, 'ml'],
    ['ayran', 'айран', 'tan', 'тан'],
  ),
  P('Wine', 'wine', 'drinks', 'ml', 'pantry', 730, [750, 'ml'], ['vin', 'вино']),
  P(
    'Sparkling wine',
    'champagne',
    'drinks',
    'ml',
    'pantry',
    730,
    [750, 'ml'],
    ['vin spumant', 'spumant', 'champagne', 'prosecco', 'шампанское', 'игристое'],
  ),
  P('Vodka', 'spirit', 'drinks', 'ml', 'pantry', 3650, [500, 'ml'], ['votcă', 'votca', 'водка']),
  P(
    'Divin',
    'whisky',
    'drinks',
    'ml',
    'pantry',
    3650,
    [500, 'ml'],
    ['brandy', 'cognac', 'coniac', 'коньяк', 'дивин'],
  ),
  P('Whisky', 'whisky', 'drinks', 'ml', 'pantry', 3650, [700, 'ml'], ['whiskey', 'виски']),
  P('Rum', 'whisky', 'drinks', 'ml', 'pantry', 3650, [700, 'ml'], ['rom', 'ром']),
  P('Gin', 'spirit', 'drinks', 'ml', 'pantry', 3650, [700, 'ml'], ['джин']),
  P('Tequila', 'spirit', 'drinks', 'ml', 'pantry', 3650, [700, 'ml'], ['текила']),
  P(
    'Liqueur',
    'whisky',
    'drinks',
    'ml',
    'pantry',
    1095,
    [500, 'ml'],
    ['lichior', 'ликёр', 'ликер'],
  ),
  P(
    'Vermouth',
    'wine',
    'drinks',
    'ml',
    'pantry',
    1095,
    [1000, 'ml'],
    ['vermut', 'вермут', 'martini'],
  ),
  P(
    'Tonic water',
    'tonic',
    'drinks',
    'ml',
    'pantry',
    365,
    [330, 'ml'],
    ['tonic', 'apă tonică', 'тоник', 'schweppes'],
  ),
  P('Syrup', 'syrup', 'drinks', 'ml', 'pantry', 730, undefined, ['sirop', 'сироп']),
  P('Fruit purée', 'puree', 'pantry', 'g', 'fridge', 5, undefined, [
    'puree',
    'piure',
    'пюре',
    'fruit puree',
  ]),
  P('Ice cubes', 'ice', 'frozen', 'pcs', 'freezer', 365, 25, [
    'cuburi de gheață',
    'gheata',
    'лёд',
    'лед',
    'ice',
  ]),
  P('Beer', 'beer', 'drinks', 'ml', 'pantry', 180, [500, 'ml'], ['bere', 'пиво']),
  // Snacks
  P('Chocolate', 'chocolate', 'snacks', 'g', 'pantry', 180, undefined, [
    'ciocolată',
    'ciocolata',
    'шоколад',
  ]),
  P('Cookies', 'cookie', 'snacks', 'g', 'pantry', 90, undefined, [
    'biscuiți',
    'biscuiti',
    'печенье',
    'biscuits',
  ]),
  P('Chips', 'chips', 'snacks', 'g', 'pantry', 90, undefined, ['chipsuri', 'чипсы', 'crisps']),
  P('Popcorn', 'popcorn', 'snacks', 'g', 'pantry', 180, undefined, ['floricele', 'попкорн']),
  P('Croutons', 'croutons', 'snacks', 'g', 'pantry', 180, undefined, [
    'flint',
    'pesmeți',
    'pesmeti',
    'сухарики',
    'кириешки',
  ]),
  P('Rice cakes', 'cookie', 'snacks', 'pcs', 'pantry', 180, 9, ['galete de orez', 'хлебцы']),
  P('Granola bars', 'chocolate', 'snacks', 'pcs', 'pantry', 180, 40, [
    'batoane cereale',
    'батончики',
  ]),
  P('Hummus', 'jar', 'snacks', 'g', 'fridge', 7, undefined, ['хумус']),
  // Household
  P('Toilet paper', 'roll', 'household', 'pcs', 'other', undefined, undefined, [
    'hârtie igienică',
    'туалетная бумага',
  ]),
  P('Paper towels', 'roll', 'household', 'pcs', 'other'),
  P('Dish soap', 'detergent', 'household', 'ml', 'other', undefined, undefined, [
    'detergent de vase',
    'fairy',
  ]),
  P('Laundry detergent', 'detergent', 'household', 'ml', 'other'),
  P('Trash bags', 'trash-bag', 'household', 'pcs', 'other', undefined, undefined, [
    'saci de gunoi',
    'мешки для мусора',
  ]),
  P('Aluminium foil', 'roll', 'household', 'pcs', 'other', undefined, undefined, [
    'folie de aluminiu',
    'фольга',
  ]),
  P('Cling film', 'roll', 'household', 'pcs', 'other', undefined, undefined, [
    'folie alimentară',
    'пищевая плёнка',
  ]),
  P('Baking paper', 'roll', 'household', 'pcs', 'other', undefined, undefined, [
    'hârtie de copt',
    'пергамент',
  ]),
  P('Napkins', 'box', 'household', 'pcs', 'other', undefined, undefined, [
    'șervețele',
    'servetele',
    'салфетки',
  ]),
  P('Dishwasher tablets', 'box', 'household', 'pcs', 'other', undefined, undefined, [
    'tablete vase',
  ]),
  P('Sponges', 'sponge', 'household', 'pcs', 'other', undefined, undefined, ['bureți', 'губки']),
  P('Hand soap', 'detergent', 'household', 'ml', 'other', undefined, undefined, [
    'săpun',
    'sapun',
    'мыло',
  ]),

  // More produce
  P('Radishes', 'radish', 'produce', 'g', 'fridge', 7, undefined, ['ridichi', 'редис']),
  P('Green onions', 'herbs', 'produce', 'pcs', 'fridge', 5, 50, ['ceapă verde', 'зелёный лук']),
  P('Leek', 'herbs', 'produce', 'pcs', 'fridge', 14, 300, ['praz', 'лук-порей']),
  P('Celery', 'herbs', 'produce', 'pcs', 'fridge', 14, 400, ['țelină', 'telina', 'сельдерей']),
  P('Cilantro', 'herbs', 'produce', 'pcs', 'fridge', 5, 30, ['coriandru', 'кинза']),
  P('Mint', 'herbs', 'produce', 'pcs', 'fridge', 5, 20, ['mentă', 'menta', 'мята']),
  P('Limes', 'lime', 'produce', 'pcs', 'fridge', 14, 60, ['lime', 'lămâie verde', 'лайм']),
  P('Passion fruit', 'lime', 'produce', 'pcs', 'fridge', 7, 40, [
    'maracuya',
    'maracuja',
    'fructul pasiunii',
    'маракуйя',
  ]),
  P('Ginger root', 'potato', 'produce', 'g', 'fridge', 30, undefined, ['ghimbir', 'имбирь']),
  P('Pumpkin', 'pumpkin', 'produce', 'g', 'pantry', 60, undefined, ['dovleac', 'тыква']),
  P('Sweet potatoes', 'potato', 'produce', 'g', 'pantry', 21, undefined, [
    'cartofi dulci',
    'батат',
  ]),
  P('Plums', 'plum', 'produce', 'g', 'fridge', 5, undefined, ['prune', 'сливы']),
  P('Peaches', 'peach', 'produce', 'pcs', 'fridge', 5, 150, ['piersici', 'персики']),
  P('Apricots', 'peach', 'produce', 'g', 'fridge', 5, undefined, ['caise', 'абрикосы']),
  P('Kiwi', 'kiwi', 'produce', 'pcs', 'fridge', 14, 80),
  P('Pomegranate', 'pomegranate', 'produce', 'pcs', 'fridge', 30, 300, ['rodie', 'гранат']),
  P('Blueberries', 'grapes', 'produce', 'g', 'fridge', 7, undefined, ['afine', 'черника']),
  P('Raspberries', 'strawberry', 'produce', 'g', 'fridge', 3, undefined, [
    'zmeură',
    'zmeura',
    'малина',
  ]),

  // More meat and fish
  P('Turkey', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['curcan', 'индейка']),
  P('Lamb', 'steak', 'meat', 'g', 'fridge', 3, undefined, ['miel', 'баранина']),
  P('Chicken wings', 'chicken', 'meat', 'g', 'fridge', 2, undefined, ['aripioare', 'крылышки']),
  P('Chicken liver', 'mince', 'meat', 'g', 'fridge', 2, undefined, ['ficat', 'печень']),
  P('Salami', 'sausage', 'meat', 'g', 'fridge', 21, undefined, ['salam', 'салями']),
  P('Smoked meat', 'bacon', 'meat', 'g', 'fridge', 14, undefined, [
    'pastramă',
    'pastrama',
    'копчёности',
  ]),
  P('Herring', 'fish', 'fish', 'g', 'fridge', 5, undefined, [
    'scrumbie',
    'hering',
    'сельдь',
    'селёдка',
  ]),
  P('Canned sardines', 'can-fish', 'fish', 'g', 'pantry', 730, 120, ['sardine', 'сардины']),
  P('Crab sticks', 'fish', 'fish', 'g', 'fridge', 10, undefined, [
    'bețișoare de crab',
    'крабовые палочки',
  ]),

  // More dairy
  P('Parmesan', 'cheese', 'dairy', 'g', 'fridge', 60),
  P('Cream cheese', 'cottage', 'dairy', 'g', 'fridge', 14, undefined, [
    'brânză cremă',
    'сливочный сыр',
  ]),
  P('Mascarpone', 'cottage', 'dairy', 'g', 'fridge', 10),
  P('Telemea', 'cheese', 'dairy', 'g', 'fridge', 21, undefined, ['brânză telemea']),
  P(
    'Oat milk',
    'milk-carton',
    'drinks',
    'ml',
    'pantry',
    180,
    [1000, 'ml'],
    ['lapte de ovăz', 'овсяное молоко'],
  ),

  // More pantry
  P('Bulgur', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['булгур']),
  P('Couscous', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['кускус']),
  P('Quinoa', 'grain', 'pantry', 'g', 'pantry', 365, undefined, ['киноа']),
  P('Semolina', 'flour', 'pantry', 'g', 'pantry', 365, undefined, ['griș', 'gris', 'манка']),
  P('Breadcrumbs', 'flour', 'pantry', 'g', 'pantry', 180, undefined, [
    'pesmet',
    'панировочные сухари',
  ]),
  P('Canned chickpeas', 'can-beans', 'pantry', 'g', 'pantry', 730, 400, [
    'năut',
    'naut',
    'нут',
    'chickpeas',
  ]),
  P('Canned corn', 'can-corn', 'pantry', 'g', 'pantry', 730, 340, [
    'porumb conservat',
    'кукуруза консервированная',
  ]),
  P('Canned peas', 'can-peas', 'pantry', 'g', 'pantry', 730, 400, ['mazăre', 'mazare', 'горошек']),
  P('Olives', 'jar', 'pantry', 'g', 'pantry', 365, undefined, [
    'măsline',
    'masline',
    'оливки',
    'маслины',
  ]),
  P('Pickles', 'pickles', 'pantry', 'pcs', 'pantry', 365, 60, [
    'castraveți murați',
    'castraveti murati',
    'солёные огурцы',
    'маринованные огурцы',
    'gherkins',
  ]),
  P('Pickled tomatoes', 'jar', 'pantry', 'pcs', 'pantry', 365, 90, [
    'roșii murate',
    'rosii murate',
    'солёные помидоры',
  ]),
  P('Cake', 'cake', 'snacks', 'pcs', 'fridge', 4, 120, ['tort', 'торт']),
  P('Pastries', 'cake', 'snacks', 'pcs', 'fridge', 3, 90, ['prăjituri', 'prajituri', 'пирожные']),
  P('Plăcintă', 'cake', 'bakery', 'pcs', 'fridge', 3, 150, [
    'placinta',
    'plăcinte',
    'placinte',
    'пирог',
    'pie',
  ]),
  P('Pizza', 'pizza', 'meals', 'pcs', 'fridge', 3, 110, ['пицца']),
  P('Sauerkraut', 'jar', 'pantry', 'g', 'fridge', 60, undefined, [
    'varză murată',
    'varza murata',
    'квашеная капуста',
  ]),
  P('Coconut milk', 'can', 'pantry', 'ml', 'pantry', 730, [400, 'ml']),
  // More cans and jars
  P('Chopped tomatoes', 'can-tomato', 'pantry', 'g', 'pantry', 730, 400, [
    'diced tomatoes',
    'roșii tăiate',
    'rosii taiate',
    'roșii cuburi',
    'помидоры резаные',
  ]),
  P('Tomato sauce (canned)', 'can-tomato', 'pantry', 'g', 'pantry', 730, 400, [
    'passata',
    'pasata',
    'sos de roșii',
    'sos de rosii',
    'томатный соус',
  ]),
  P('Canned red beans', 'can-beans', 'pantry', 'g', 'pantry', 730, 400, [
    'fasole roșie',
    'fasole rosie',
    'kidney beans',
    'красная фасоль',
  ]),
  P('Beans in tomato sauce', 'can-beans', 'pantry', 'g', 'pantry', 730, 400, [
    'baked beans',
    'fasole în sos tomat',
    'фасоль в томате',
  ]),
  P('Canned lentils', 'can-beans', 'pantry', 'g', 'pantry', 730, 400, [
    'linte conservată',
    'чечевица консервированная',
  ]),
  P('Canned mushrooms', 'can-mushroom', 'pantry', 'g', 'pantry', 730, 400, [
    'ciuperci conservate',
    'champignons in jar',
    'консервированные грибы',
  ]),
  P('Canned pineapple', 'can-fruit', 'pantry', 'g', 'pantry', 730, 580, [
    'ananas conservat',
    'ананасы консервированные',
  ]),
  P('Canned peaches', 'can-fruit', 'pantry', 'g', 'pantry', 730, 820, [
    'piersici conservate',
    'персики консервированные',
  ]),
  P('Canned salmon', 'can-fish', 'fish', 'g', 'pantry', 730, 240, [
    'somon conservat',
    'горбуша консервированная',
    'pink salmon',
  ]),
  P('Mackerel (canned)', 'can-fish', 'fish', 'g', 'pantry', 730, 240, [
    'scrumbie',
    'scrumbie conservată',
    'скумбрия',
    'mackerel',
  ]),
  P('Sprats', 'can-fish', 'fish', 'g', 'pantry', 730, 160, ['șprot', 'sprot', 'шпроты']),
  P('Canned meat', 'can-meat', 'meat', 'g', 'pantry', 1095, 325, [
    'conservă de carne',
    'conserva de carne',
    'тушёнка',
    'тушенка',
    'stewed meat',
  ]),
  P('Liver pâté', 'pate', 'meat', 'g', 'pantry', 730, 100, [
    'pate',
    'pateu',
    'pateu de ficat',
    'паштет',
  ]),
  P('Zacuscă', 'jar-spread', 'pantry', 'g', 'pantry', 730, 300, ['zacusca', 'закуска']),
  P('Eggplant caviar', 'jar-spread', 'pantry', 'g', 'pantry', 730, 450, [
    'icre de vinete',
    'baclajan caviar',
    'кабачковая икра',
    'баклажанная икра',
    'ikra',
  ]),
  P('Lecho', 'jar-spread', 'pantry', 'g', 'pantry', 730, 450, ['lecio', 'лечо']),
  P('Ajvar', 'jar-spread', 'pantry', 'g', 'pantry', 730, 350, ['айвар']),
  // Sports nutrition: shakes, bars, supplements.
  P('Protein powder', 'protein-powder', 'pantry', 'g', 'pantry', 540, undefined, [
    'protein',
    'whey',
    'whey protein',
    'proteina',
    'протеин',
    'сывороточный протеин',
  ]),
  P('Protein bar', 'protein-bar', 'snacks', 'pcs', 'pantry', 270, 60, [
    'baton proteic',
    'протеиновый батончик',
  ]),
  P('Mass gainer', 'mass-gainer', 'pantry', 'g', 'pantry', 540, undefined, ['gainer', 'гейнер']),
  P('Creatine', 'creatine', 'pantry', 'g', 'pantry', 730, undefined, [
    'creatina',
    'creatine monohydrate',
    'креатин',
  ]),
  P('Protein pudding', 'protein-pudding', 'dairy', 'pcs', 'fridge', 30, 200, [
    'budinca proteica',
    'протеиновый пудинг',
  ]),
  P('Skyr', 'skyr', 'dairy', 'g', 'fridge', 21, undefined, ['скир']),
  P('Peanut butter', 'jar', 'pantry', 'g', 'pantry', 180, undefined, [
    'unt de arahide',
    'арахисовая паста',
  ]),
  P('Chocolate spread', 'jar', 'pantry', 'g', 'pantry', 180, undefined, [
    'nutella',
    'cremă de ciocolată',
  ]),
  P('Sunflower seeds', 'seeds', 'pantry', 'g', 'pantry', 180, undefined, [
    'semințe',
    'seminte',
    'семечки',
  ]),
  P('Almonds', 'nuts', 'pantry', 'g', 'pantry', 180, undefined, ['migdale', 'миндаль']),
  P('Raisins', 'dried-fruit', 'pantry', 'g', 'pantry', 365, undefined, ['stafide', 'изюм']),
  P('Dried apricots', 'dried-fruit', 'pantry', 'g', 'pantry', 365, undefined, [
    'caise uscate',
    'курага',
  ]),
  P('Prunes', 'dried-fruit', 'pantry', 'g', 'pantry', 365, undefined, [
    'prune uscate',
    'чернослив',
  ]),
  P('Muesli', 'oats', 'pantry', 'g', 'pantry', 180, undefined, ['мюсли']),
  P('Crackers', 'cookie', 'snacks', 'g', 'pantry', 120, undefined, ['crackers', 'крекеры']),
  P('Instant coffee', 'coffee', 'pantry', 'g', 'pantry', 365, undefined, [
    'cafea solubilă',
    'растворимый кофе',
  ]),

  // Spices and seasonings (kept by level)
  P('Oregano', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['oregano', 'орегано']),
  P('Dried basil', 'herbs', 'spices', 'g', 'pantry', 730, undefined, [
    'busuioc uscat',
    'базилик сушёный',
  ]),
  P('Thyme', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['cimbru', 'тимьян', 'чабрец']),
  P('Rosemary', 'herbs', 'spices', 'g', 'pantry', 730, undefined, ['rozmarin', 'розмарин']),
  P('Bay leaves', 'bay-leaf', 'spices', 'g', 'pantry', 730, undefined, [
    'foi de dafin',
    'лавровый лист',
  ]),
  P('Dried dill', 'herbs', 'spices', 'g', 'pantry', 730, undefined, [
    'mărar uscat',
    'укроп сушёный',
  ]),
  P('Mixed herbs', 'herbs', 'spices', 'g', 'pantry', 730, undefined, [
    'herbes de provence',
    'ierburi provensale',
    'italian seasoning',
    'прованские травы',
  ]),
  P('Cumin', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['chimion', 'кумин', 'зира']),
  P('Ground coriander', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, [
    'coriandru măcinat',
    'кориандр',
  ]),
  P('Cinnamon', 'cinnamon', 'spices', 'g', 'pantry', 730, undefined, [
    'scorțișoară',
    'scortisoara',
    'корица',
  ]),
  P('Turmeric', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['turmeric', 'куркума']),
  P('Curry powder', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['curry', 'карри']),
  P('Chili flakes', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, [
    'fulgi de chili',
    'ardei iute uscat',
    'хлопья чили',
  ]),
  P('Smoked paprika', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['boia afumată']),
  P('Garlic powder', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, [
    'usturoi granulat',
    'чесночный порошок',
  ]),
  P('Onion powder', 'spice-jar', 'spices', 'g', 'pantry', 730),
  P('Ground ginger', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, ['ghimbir măcinat']),
  P('Nutmeg', 'spice', 'spices', 'g', 'pantry', 730, undefined, [
    'nucșoară',
    'nucsoara',
    'мускатный орех',
  ]),
  P('Cloves', 'spice', 'spices', 'g', 'pantry', 730, undefined, [
    'cuișoare',
    'cuisoare',
    'гвоздика',
  ]),
  P('Allspice', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['ienibahar', 'душистый перец']),
  P('Cardamom', 'spice', 'spices', 'g', 'pantry', 730, undefined, ['cardamom', 'кардамон']),
  P('Vegeta', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, [
    'condiment universal',
    'приправа универсальная',
    'вегета',
  ]),
  P('Khmeli-suneli', 'spice-jar', 'spices', 'g', 'pantry', 730, undefined, [
    'хмели-сунели',
    'hmeli suneli',
  ]),
  P('Vanilla', 'spice', 'spices', 'g', 'pantry', 730, undefined, [
    'vanilie',
    'ваниль',
    'vanilla extract',
  ]),
  P('Hot sauce', 'sauce', 'spices', 'ml', 'fridge', 365, undefined, [
    'sos iute',
    'острый соус',
    'tabasco',
  ]),
  P('Adjika', 'sauce', 'spices', 'ml', 'fridge', 60, undefined, ['ajica', 'аджика']),
  P('Horseradish', 'jar', 'spices', 'g', 'fridge', 60, undefined, ['hrean', 'хрен']),
  P('BBQ sauce', 'sauce', 'spices', 'ml', 'fridge', 90),
  P('Pesto', 'jar', 'spices', 'g', 'fridge', 10),
  P('Tomato sauce', 'sauce', 'spices', 'ml', 'pantry', 365, undefined, [
    'sos de roșii',
    'sos de rosii',
    'томатный соус',
    'passata',
  ]),
  P('Balsamic vinegar', 'vinegar', 'spices', 'ml', 'pantry', 730, undefined, [
    'oțet balsamic',
    'бальзамический уксус',
  ]),
  P('Apple cider vinegar', 'vinegar', 'spices', 'ml', 'pantry', 730, undefined, [
    'oțet de mere',
    'яблочный уксус',
  ]),

  // Baking (kept by level)
  P('Baking soda', 'box', 'spices', 'g', 'pantry', 730, undefined, ['bicarbonat', 'сода']),
  P('Baking powder', 'box', 'spices', 'g', 'pantry', 365, undefined, [
    'praf de copt',
    'разрыхлитель',
  ]),
  P('Dry yeast', 'box', 'spices', 'g', 'pantry', 365, undefined, ['drojdie', 'дрожжи']),
  P('Cocoa powder', 'box', 'spices', 'g', 'pantry', 730, undefined, ['cacao', 'какао']),
  P('Corn starch', 'flour', 'spices', 'g', 'pantry', 730, undefined, ['amidon', 'крахмал']),
  P('Vanilla sugar', 'sugar', 'spices', 'g', 'pantry', 730, undefined, [
    'zahăr vanilat',
    'ванильный сахар',
  ]),
  P('Powdered sugar', 'sugar', 'spices', 'g', 'pantry', 730, undefined, [
    'zahăr pudră',
    'zahar pudra',
    'сахарная пудра',
  ]),

  // Frozen extras
  P('Frozen pizza', 'pizza', 'frozen', 'pcs', 'freezer', 180, 400),
  P('Fish sticks', 'fish', 'frozen', 'g', 'freezer', 180, undefined, [
    'bețișoare de pește',
    'рыбные палочки',
  ]),
  P('French fries', 'frozen', 'frozen', 'g', 'freezer', 180, undefined, [
    'cartofi pai',
    'картофель фри',
  ]),
];

/** Units and kinds for the foods where people count or choose that way. */
const EXTRA: Record<string, Pick<Preset, 'units' | 'variants'>> = {
  Bread: {
    units: [
      { name: 'loaf', plural: 'loaves', size: 20, sizes: [12, 16, 20, 24, 30] },
      { name: 'slice', size: 1 },
    ],
    variants: ['White', 'Brown', 'Rye', 'Whole grain', 'Seeded', 'Toast', 'Black', 'Bran'],
  },
  Baguette: { units: [{ name: 'slice', size: 0.1 }] },
  Honey: {
    units: [
      { name: 'jar', size: 400, sizes: [250, 400, 500, 750, 1000] },
      { name: 'tbsp', plural: 'tbsp', size: 21 },
      { name: 'tsp', plural: 'tsp', size: 7 },
    ],
  },
  Flour: {
    units: [
      { name: 'bag', size: 1000, sizes: [1000, 2000, 5000] },
      { name: 'cup', size: 130 },
      { name: 'tbsp', plural: 'tbsp', size: 8 },
    ],
  },
  Cheese: {
    units: [
      { name: 'slice', size: 20 },
      { name: 'square', size: 18 },
      { name: 'pack', size: 200, sizes: [100, 150, 200, 250, 400, 500] },
    ],
    variants: ['Gouda', 'Cheddar', 'Edam', 'Maasdam', 'Processed', 'Smoked'],
  },
  Butter: { units: [{ name: 'pack', size: 200, sizes: [180, 200, 250] }] },
  Pasta: {
    units: [{ name: 'pack', size: 500, sizes: [400, 500, 1000] }],
    variants: [
      'Spaghetti',
      'Penne',
      'Fusilli',
      'Farfalle',
      'Ravioli',
      'Cannelloni',
      'Lasagne',
      'Tagliatelle',
      'Linguine',
      'Rigatoni',
      'Conchiglie',
      'Orzo',
      'Whole wheat',
      'Gluten-free',
    ],
  },
  Rice: {
    units: [{ name: 'pack', size: 1000, sizes: [500, 800, 900, 1000] }],
    variants: [
      'Long grain',
      'Round',
      'Basmati',
      'Jasmine',
      'Sushi rice',
      'Brown',
      'Parboiled',
      'Arborio',
      'Wild',
      'Black',
    ],
  },
  Buckwheat: { units: [{ name: 'pack', size: 800, sizes: [400, 800, 900, 1000] }] },
  Sugar: {
    units: [
      { name: 'bag', size: 1000, sizes: [500, 1000, 2000] },
      { name: 'cup', size: 200 },
      { name: 'tbsp', plural: 'tbsp', size: 12 },
    ],
  },
  Eggs: {
    units: [
      { name: 'pack', size: 10, sizes: [6, 10, 12, 15, 20, 30] },
      { name: 'dozen', plural: 'dozen', size: 12 },
    ],
  },
  Chocolate: {
    units: [{ name: 'bar', size: 100, sizes: [50, 90, 100, 200, 300] }],
    variants: ['Milk', 'Dark', 'White'],
  },
  Milk: {
    units: [{ name: 'bottle', size: 1000, sizes: [500, 900, 1000, 1500, 2000] }],
    variants: ['1.5%', '2.5%', '3.2%', '3.5%', 'Barista', 'Lactose-free', 'Oat', 'Almond'],
  },
  Cream: {
    units: [{ name: 'pack', size: 200, sizes: [200, 250, 500, 1000] }],
    variants: ['10%', '20%', '33% (for whipping)'],
  },
  'Whipped cream': { units: [{ name: 'can', size: 250, sizes: [180, 250, 500] }] },
  Sprinkles: {
    units: [{ name: 'pack', size: 50, sizes: [30, 50, 100] }],
    variants: ['Chocolate', 'Cinnamon sugar', 'Colourful'],
  },
  Yogurt: { variants: ['Plain', 'Greek', 'Fruit'] },
  Sausages: {
    units: [{ name: 'pack', size: 400, sizes: [300, 400, 500, 1000] }],
    variants: ['Boiled', 'Smoked', 'Hot dogs'],
  },
  'Minced meat': {
    units: [{ name: 'pack', size: 500, sizes: [400, 500, 800, 1000] }],
    variants: ['Beef', 'Pork', 'Mixed', 'Chicken'],
  },
  'Beef steak': { variants: ['Ribeye', 'Sirloin', 'Tenderloin', 'T-bone'] },
  Tea: {
    variants: [
      'Black',
      'Green',
      'Earl Grey (bergamot)',
      'Green, 1001 Nights',
      'Jasmine',
      'Chamomile',
      'Mint',
      'Herbal',
      'Fruit',
      'Hibiscus',
      'Rooibos',
      'Ginger-lemon',
    ],
  },
  Juice: {
    units: [
      { name: 'box', plural: 'boxes', size: 1000, sizes: [200, 250, 500, 950, 1000, 2000] },
      { name: 'bottle', size: 500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: [
      'Apple',
      'Orange',
      'Mango-peach',
      'Multivitamin',
      'Multifruit',
      'Peach',
      'Peach-banana',
      'Banana',
      'Cherry',
      'Grape',
      'Pineapple',
      'Pomegranate',
      'Grapefruit',
      'Tomato',
      'Carrot',
    ],
  },
  Water: {
    units: [
      { name: 'bottle', size: 1500, sizes: [330, 500, 1000, 1500, 2000] },
      { name: 'jug', size: 5000, sizes: [5000, 6000, 10000, 19000] },
    ],
    variants: ['Om', 'Gura Căinarului', 'Dorna', 'Izvorul Alb', 'Borsec'],
  },
  'Sparkling water': {
    units: [{ name: 'bottle', size: 1500, sizes: [330, 500, 1000, 1500, 2000] }],
    variants: [
      'Lightly sparkling',
      'Sparkling',
      'Om',
      'Gura Căinarului',
      'Dorna',
      'Borsec',
      'Borjomi',
    ],
  },
  'Mineral water': {
    units: [{ name: 'bottle', size: 500, sizes: [330, 500, 750, 1000, 1250, 1500] }],
    variants: ['Borjomi', 'Essentuki', 'Narzan', 'Borsec', 'Om', 'Gura Căinarului', 'Dorna'],
  },
  'Coca-Cola': {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Classic', 'Zero', 'Cherry', 'Lime', 'Vanilla'],
  },
  Pepsi: {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Classic', 'Zero', 'Lime'],
  },
  Sprite: {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Classic', 'Zero'],
  },
  Fanta: {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Orange', 'Lemon', 'Exotic', 'Pineapple', 'Zero'],
  },
  Soda: {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
  },
  'Iced tea': {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Lemon', 'Peach', 'Green tea'],
  },
  'Energy drink': { units: [{ name: 'can', size: 250, sizes: [250, 330, 449, 500] }] },
  Lemonade: { variants: ['Lemon', 'Mint', 'Strawberry'] },
  'Sunflower oil': {
    units: [
      { name: 'bottle', size: 1000, sizes: [250, 500, 750, 1000, 2000, 3000, 5000] },
      { name: 'dispenser', size: 250, sizes: [100, 200, 250, 500] },
    ],
    variants: ['Refined', 'Unrefined'],
  },
  'Olive oil': {
    units: [
      { name: 'bottle', size: 1000, sizes: [250, 500, 750, 1000, 2000, 3000, 5000] },
      { name: 'dispenser', size: 250, sizes: [100, 200, 250, 500] },
    ],
    variants: ['Extra virgin', 'Refined'],
  },
  Wine: {
    units: [
      { name: 'bottle', size: 750, sizes: [187, 375, 750, 1000, 1500, 3000] },
      { name: 'glass', plural: 'glasses', size: 150 },
    ],
    variants: ['Red dry', 'White dry', 'Rosé', 'Red semi-sweet', 'White semi-sweet'],
  },
  'Sparkling wine': {
    units: [
      { name: 'bottle', size: 750, sizes: [200, 375, 750, 1500] },
      { name: 'glass', plural: 'glasses', size: 150 },
    ],
    variants: ['Brut', 'Semi-dry', 'Semi-sweet', 'Prosecco'],
  },
  Vodka: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: [
      'Finlandia',
      'Absolut',
      'Nemiroff',
      'Khortytsa',
      'Green Mark',
      'Russian Standard',
      'Beluga',
    ],
  },
  Divin: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: ['3 years', '5 years', '10 years'],
  },
  Whisky: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: ['Jameson', "Jack Daniel's", 'Johnnie Walker', 'Ballantine’s'],
  },
  Rum: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: ['White', 'Dark', 'Spiced'],
  },
  Gin: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
  },
  Tequila: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: ['Silver', 'Gold'],
  },
  Liqueur: {
    units: [
      { name: 'bottle', size: 500, sizes: [50, 100, 200, 250, 350, 500, 700, 750, 1000] },
      { name: 'shot', size: 50 },
    ],
    variants: ['Coffee', 'Amaretto', 'Cream', 'Blue Curaçao', 'Triple sec'],
  },
  Vermouth: {
    units: [{ name: 'bottle', size: 1000, sizes: [500, 750, 1000] }],
    variants: ['Bianco', 'Rosso', 'Extra dry'],
  },
  'Tonic water': {
    units: [
      { name: 'can', size: 330, sizes: [250, 330] },
      { name: 'bottle', size: 1000, sizes: [250, 500, 1000, 1500] },
    ],
  },
  Syrup: {
    units: [
      { name: 'bottle', size: 700, sizes: [250, 500, 700, 1000] },
      { name: 'pump', size: 10 },
    ],
    variants: [
      'Vanilla',
      'Caramel',
      'Salted caramel',
      'Hazelnut',
      'Irish cream',
      'Coconut',
      'Maracuya',
      'Grenadine',
      'Mint',
      'Strawberry',
      'Chocolate',
      'Cherry',
    ],
  },
  'Fruit purée': {
    units: [{ name: 'pack', size: 500, sizes: [250, 500, 1000] }],
    variants: ['Mango', 'Maracuya', 'Strawberry', 'Raspberry', 'Peach'],
  },
  'Ice cubes': {
    units: [
      { name: 'pack', size: 6, sizes: [3, 4, 5, 6, 8, 10, 12, 20] },
      { name: 'tray', size: 12, sizes: [6, 8, 12, 14, 16] },
      { name: 'cube', size: 1 },
    ],
  },
  Compote: { variants: ['Cherry', 'Apple', 'Mixed fruit'] },
  Apples: { variants: ['Golden', 'Red', 'Green'] },
  'Sour cream': { units: [{ name: 'pack', size: 400 }] },
  'Cottage cheese': { units: [{ name: 'pack', size: 400 }] },
  Coffee: {
    units: [
      { name: 'bag', size: 1000, sizes: [250, 500, 1000] },
      { name: 'shot', size: 10 },
    ],
    variants: ['Beans', 'Ground', 'Capsules'],
  },
  'Tuna (canned)': {
    units: [{ name: 'can', size: 160, sizes: [80, 120, 160, 185, 240] }],
    variants: ['In oil', 'In water', 'Chunks', 'Salad'],
  },
  'Canned beans': {
    units: [{ name: 'can', size: 400, sizes: [240, 400, 425, 800] }],
    variants: ['White', 'Red', 'Mixed'],
  },
  'Chopped tomatoes': {
    units: [{ name: 'can', size: 400, sizes: [400, 500, 680, 800] }],
    variants: ['Plain', 'With basil', 'With garlic', 'With chili'],
  },
  'Canned corn': {
    units: [{ name: 'can', size: 340, sizes: [150, 212, 340, 425, 1000] }],
    variants: ['Sweet', 'Baby corn'],
  },
  Sprats: {
    units: [{ name: 'can', size: 160, sizes: [80, 120, 160, 185, 240] }],
    variants: ['In oil', 'Smoked'],
  },
  'Canned meat': {
    units: [{ name: 'can', size: 325, sizes: [325, 338, 500, 525] }],
    variants: ['Beef', 'Pork', 'Chicken'],
  },
  Zacuscă: {
    units: [{ name: 'jar', size: 300, sizes: [300, 450, 500, 700] }],
    variants: ['Eggplant', 'Pepper', 'Mushroom'],
  },
  // Cans and jars are weighed; the can is the package (2 cans of 340 g).
  'Canned tomatoes': { units: [{ name: 'can', size: 400, sizes: [400, 500, 680, 800] }] },
  'Canned sardines': { units: [{ name: 'can', size: 120, sizes: [80, 120, 160, 185, 240] }] },
  'Canned chickpeas': { units: [{ name: 'can', size: 400, sizes: [240, 400, 425, 800] }] },
  'Canned peas': { units: [{ name: 'can', size: 400, sizes: [200, 400, 425, 800] }] },
  'Tomato sauce (canned)': { units: [{ name: 'can', size: 400, sizes: [400, 500, 680, 800] }] },
  'Canned red beans': { units: [{ name: 'can', size: 400, sizes: [240, 400, 425, 800] }] },
  'Beans in tomato sauce': { units: [{ name: 'can', size: 400, sizes: [240, 400, 425, 800] }] },
  'Canned lentils': { units: [{ name: 'can', size: 400, sizes: [240, 400, 425, 800] }] },
  'Canned mushrooms': { units: [{ name: 'can', size: 400, sizes: [280, 400, 500] }] },
  'Canned pineapple': { units: [{ name: 'can', size: 580, sizes: [425, 580, 820] }] },
  'Canned peaches': { units: [{ name: 'can', size: 820, sizes: [425, 580, 820] }] },
  'Canned salmon': { units: [{ name: 'can', size: 240, sizes: [80, 120, 160, 185, 240] }] },
  'Mackerel (canned)': { units: [{ name: 'can', size: 240, sizes: [80, 120, 160, 185, 240] }] },
  'Liver pâté': { units: [{ name: 'can', size: 100, sizes: [80, 100, 130, 250] }] },
  'Eggplant caviar': { units: [{ name: 'jar', size: 450, sizes: [300, 450, 500, 700] }] },
  Lecho: { units: [{ name: 'jar', size: 450, sizes: [300, 450, 500, 700] }] },
  Ajvar: { units: [{ name: 'jar', size: 350, sizes: [300, 350, 450, 500, 700] }] },
  // Counted in what's inside: the jar or the whole cake is a unit, sized when added.
  'Coconut milk': { units: [{ name: 'can', size: 400, sizes: [165, 200, 400] }] },
  Pickles: {
    units: [
      { name: 'jar', size: 12, sizes: [6, 8, 10, 12, 14, 16, 20] },
      { name: 'pickle', size: 1 },
    ],
  },
  'Pickled tomatoes': { units: [{ name: 'jar', size: 10, sizes: [6, 8, 10, 12, 15] }] },
  Cake: {
    units: [
      { name: 'cake', size: 8, sizes: [6, 8, 10, 12, 16] },
      { name: 'piece', size: 1 },
    ],
    variants: ['Honey cake', 'Napoleon', 'Chocolate', 'Cheesecake'],
  },
  Pastries: {
    units: [
      { name: 'box', plural: 'boxes', size: 6, sizes: [2, 4, 6, 9, 12] },
      { name: 'piece', size: 1 },
    ],
  },
  Plăcintă: {
    units: [
      { name: 'tray', size: 8, sizes: [1, 4, 6, 8, 12] },
      { name: 'piece', size: 1 },
    ],
    variants: ['Cheese', 'Potato', 'Cabbage', 'Pumpkin', 'Cherry'],
  },
  Pizza: {
    units: [
      { name: 'pizza', size: 8, sizes: [4, 6, 8, 12] },
      { name: 'slice', size: 1 },
    ],
    variants: ['Margherita', 'Pepperoni', 'Four cheeses'],
  },
  Mirinda: {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Orange', 'Lemon', 'Apple'],
  },
  'Dr Pepper': {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Classic', 'Zero', 'Cherry'],
  },
  '7UP': {
    units: [
      { name: 'can', size: 330, sizes: [250, 330, 450, 500] },
      { name: 'bottle', size: 1500, sizes: [250, 330, 500, 1000, 1250, 1500, 2000, 2500] },
    ],
    variants: ['Classic', 'Free'],
  },
  'Protein powder': {
    units: [
      { name: 'scoop', size: 30 },
      { name: 'tub', size: 1000, sizes: [454, 908, 1000, 2000, 2270] },
    ],
    variants: [
      'Whey, vanilla',
      'Whey, chocolate',
      'Whey, unflavoured',
      'Whey isolate',
      'Casein',
      'Vegan (pea)',
      'Egg white',
    ],
  },
  'Protein bar': { variants: ['Chocolate', 'Peanut', 'Cookies & cream', 'Low sugar'] },
  'Mass gainer': {
    units: [
      { name: 'scoop', size: 100 },
      { name: 'bag', size: 3000, sizes: [1000, 3000, 5000] },
    ],
  },
  Creatine: {
    units: [
      { name: 'scoop', size: 5 },
      { name: 'tub', size: 300, sizes: [250, 300, 500, 1000] },
    ],
  },
  Skyr: { units: [{ name: 'cup', size: 150, sizes: [140, 150, 400, 450] }] },
};

/** Drawings of things that, once opened, belong in the fridge. */
const FRIDGE_ONCE_OPEN = new Set<string>([
  'can',
  'can-fish',
  'can-tomato',
  'can-corn',
  'can-beans',
  'can-peas',
  'can-fruit',
  'can-meat',
  'can-mushroom',
  'pate',
  'pickles',
  'jar-spread',
  'jar',
  'juice',
  'juice-box',
]);

/**
 * Days a package keeps once opened, by kind, for items that don't say. Not for the pantry: an
 * opened bag of rice or bottle of oil keeps for months (cans and jars carry their own days).
 */
export const OPENED_BY_CATEGORY: Partial<Record<Category, number>> = {
  dairy: 5,
  meat: 3,
  fish: 2,
  drinks: 5,
  snacks: 14,
  bakery: 4,
  meals: 3,
  produce: 4,
};

export const PRESETS: readonly Preset[] = RAW_PRESETS.map((preset) => ({
  ...preset,
  ...(preset.location === 'pantry' &&
  FRIDGE_ONCE_OPEN.has(preset.icon) &&
  preset.category !== 'spices'
    ? { openedLocation: 'fridge' as const }
    : {}),
  ...(EXTRA[preset.name] ?? {}),
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
  if (
    base.endsWith('oes') ||
    base.endsWith('ches') ||
    base.endsWith('shes') ||
    base.endsWith('xes')
  )
    forms.add(base.slice(0, -2));
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
  {
    match: /\b(spice|seasoning|powder|ground|dried|condiment|condimente|mix|приправ)/,
    preset: { icon: 'spice', category: 'spices', unit: 'g', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(herb|leaves|leaf|frunze|травы)/,
    preset: { icon: 'herbs', category: 'spices', unit: 'g', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(sauce|ketchup|dressing|sos|соус)/,
    preset: { icon: 'sauce', category: 'spices', unit: 'ml', location: 'fridge', track: 'level' },
  },
  {
    match: /\b(oil|ulei|масло)\b/,
    preset: { icon: 'oil', category: 'pantry', unit: 'ml', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(vinegar|otet|уксус)/,
    preset: { icon: 'sauce', category: 'spices', unit: 'ml', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(juice|suc|сок|nectar)\b/,
    preset: {
      icon: 'juice',
      category: 'drinks',
      unit: 'ml',
      location: 'pantry',
      shelfLifeDays: 270,
    },
  },
  {
    match: /\b(cola|pepsi|sprite|fanta|schweppes|tonic|soda|lemonade|limonad\w*|газировк\w*)\b/,
    preset: {
      icon: 'soda',
      category: 'drinks',
      unit: 'ml',
      location: 'pantry',
      shelfLifeDays: 180,
    },
  },
  {
    match: /\b(water|apa|вода)\b/,
    preset: { icon: 'water', category: 'drinks', unit: 'ml', location: 'pantry' },
  },
  {
    match: /\b(beer|bere|пиво)\b/,
    preset: { icon: 'beer', category: 'drinks', unit: 'ml', location: 'pantry' },
  },
  {
    match: /\b(wine|vin|вино)\b/,
    preset: { icon: 'wine', category: 'drinks', unit: 'ml', location: 'pantry' },
  },
  {
    match: /\b(tea|ceai|чай)\b/,
    preset: { icon: 'tea', category: 'pantry', unit: 'pcs', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(coffee|cafea|кофе)\b/,
    preset: { icon: 'coffee', category: 'pantry', unit: 'g', location: 'pantry', track: 'level' },
  },
  {
    match: /\b(cheese|branza|cascaval|сыр)/,
    preset: { icon: 'cheese', category: 'dairy', unit: 'g', location: 'fridge', shelfLifeDays: 14 },
  },
  {
    match: /\b(yogh?urt|iaurt|йогурт)/,
    preset: {
      icon: 'yogurt',
      category: 'dairy',
      unit: 'pcs',
      location: 'fridge',
      shelfLifeDays: 14,
    },
  },
  {
    match: /\b(milk|lapte|молоко)\b/,
    preset: { icon: 'milk', category: 'dairy', unit: 'ml', location: 'fridge', shelfLifeDays: 7 },
  },
  {
    match: /\b(chocolate|ciocolat|шоколад)/,
    preset: { icon: 'chocolate', category: 'snacks', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(cookie|biscuit|печенье)/,
    preset: { icon: 'cookie', category: 'snacks', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(cake|tort|prajitur|торт)/,
    preset: { icon: 'cake', category: 'snacks', unit: 'pcs', location: 'fridge', shelfLifeDays: 3 },
  },
  {
    match: /\b(frozen|congelat|заморож)/,
    preset: {
      icon: 'frozen',
      category: 'frozen',
      unit: 'g',
      location: 'freezer',
      shelfLifeDays: 180,
    },
  },
  {
    match: /\b(chicken|pui|куриц)/,
    preset: { icon: 'chicken', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 2 },
  },
  {
    match: /\b(meat|carne|pork|porc|beef|vita|lamb|miel|мясо)/,
    preset: { icon: 'steak', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 3 },
  },
  {
    match: /\b(sausage|salam|carnati|колбас)/,
    preset: { icon: 'sausage', category: 'meat', unit: 'g', location: 'fridge', shelfLifeDays: 7 },
  },
  {
    match: /\b(fish|peste|рыба)/,
    preset: { icon: 'fish', category: 'fish', unit: 'g', location: 'fridge', shelfLifeDays: 2 },
  },
  {
    match: /\b(rice|orez|рис)\b/,
    preset: { icon: 'rice', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(pasta|paste|spaghetti|macaroni|penne|fusilli)/,
    preset: { icon: 'pasta', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(flour|faina|мука)/,
    preset: { icon: 'flour', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(sugar|zahar|сахар)/,
    preset: { icon: 'sugar', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(nut|nuci|seed|seminte|almond|орех)/,
    preset: { icon: 'nuts', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(tuna|ton|sardin\w*|sprat\w*|mackerel|scrumbi\w*|шпрот\w*|скумбри\w*)\b/,
    preset: {
      icon: 'can-fish',
      category: 'fish',
      unit: 'pcs',
      location: 'pantry',
      shelfLifeDays: 730,
    },
  },
  {
    match: /\b(pate|pateu|паштет)\b/,
    preset: { icon: 'pate', category: 'meat', unit: 'pcs', location: 'pantry', shelfLifeDays: 730 },
  },
  {
    match: /\b(can|canned|conserv|консерв)/,
    preset: {
      icon: 'can',
      category: 'pantry',
      unit: 'pcs',
      location: 'pantry',
      shelfLifeDays: 730,
    },
  },
  {
    match: /\b(jam|gem|dulceata|pickle|murat|olive|masline|варенье)/,
    preset: { icon: 'jar', category: 'pantry', unit: 'g', location: 'pantry' },
  },
  {
    match: /\b(bread|paine|bun|chifl|хлеб)/,
    preset: {
      icon: 'bread',
      category: 'bakery',
      unit: 'pcs',
      location: 'pantry',
      shelfLifeDays: 4,
    },
  },
  {
    match: /\b(soap|sapun|detergent|clean|spray|мыло)/,
    preset: {
      icon: 'detergent',
      category: 'household',
      unit: 'pcs',
      location: 'other',
      track: 'level',
    },
  },
  {
    match: /\b(paper|hartie|napkin|servet|foil|folie|бумаг)/,
    preset: { icon: 'roll', category: 'household', unit: 'pcs', location: 'other', track: 'level' },
  },
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

/**
 * Bump when the catalog learns something existing kitchens should get (package units, types,
 * keeping times): each kitchen is brought up to it once, on its next request.
 */
/**
 * A picture per kind where one exists: Coca-Cola Zero is a black can, Penne are tubes, a Borjomi
 * bottle is green glass. Kinds without one show the item's own icon.
 */
export const VARIANT_ICONS: Record<string, Record<string, string>> = {
  Bread: {
    brown: 'bread-brown',
    rye: 'bread-rye',
    'whole grain': 'bread-whole-grain',
    bran: 'bread-whole-grain',
    seeded: 'bread-seeded',
    toast: 'bread-toast',
    black: 'bread-black',
  },
  Pasta: {
    penne: 'penne',
    fusilli: 'fusilli',
    farfalle: 'farfalle',
    ravioli: 'ravioli',
    cannelloni: 'cannelloni',
    lasagne: 'lasagne',
    tagliatelle: 'tagliatelle',
    linguine: 'tagliatelle',
    rigatoni: 'rigatoni',
    conchiglie: 'conchiglie',
  },
  Rice: {
    round: 'rice-sushi',
    'sushi rice': 'rice-sushi',
    arborio: 'rice-sushi',
    basmati: 'rice-basmati',
    jasmine: 'rice-basmati',
    brown: 'rice-brown',
    parboiled: 'rice-parboiled',
    wild: 'rice-wild',
    black: 'rice-wild',
  },
  Milk: {
    '1.5%': 'milk-light',
    '2.5%': 'milk-semi',
    '3.2%': 'milk-whole',
    '3.5%': 'milk-whole',
    barista: 'milk-barista',
    'lactose-free': 'milk-lactose-free',
    oat: 'milk-oat',
    almond: 'milk-almond',
  },
  Tea: {
    black: 'tea-black',
    green: 'tea-green',
    'earl grey (bergamot)': 'tea-earl-grey',
    'green, 1001 nights': 'tea-green',
    jasmine: 'tea-jasmine',
    chamomile: 'tea-chamomile',
    mint: 'tea-mint',
    herbal: 'tea-herbal',
    fruit: 'tea-fruit',
    hibiscus: 'tea-fruit',
    rooibos: 'tea-black',
    'ginger-lemon': 'tea-herbal',
  },
  Juice: {
    apple: 'juice-apple',
    orange: 'juice-orange',
    'mango-peach': 'juice-mango',
    multivitamin: 'juice-multifruit',
    multifruit: 'juice-multifruit',
    peach: 'juice-peach',
    'peach-banana': 'juice-banana',
    banana: 'juice-banana',
    cherry: 'juice-cherry',
    grape: 'juice-grape',
    pineapple: 'juice-pineapple',
    pomegranate: 'juice-pomegranate',
    tomato: 'juice-tomato',
  },
  Water: {
    om: 'water-om',
    'gura căinarului': 'water-gura-cainarului',
    dorna: 'water-dorna',
    'izvorul alb': 'water-izvorul-alb',
    borsec: 'water-borsec',
  },
  'Sparkling water': {
    om: 'water-om',
    'gura căinarului': 'water-gura-cainarului',
    dorna: 'water-dorna',
    borsec: 'water-borsec',
    borjomi: 'water-borjomi',
  },
  'Mineral water': {
    borjomi: 'water-borjomi',
    borsec: 'water-borsec',
    om: 'water-om',
    'gura căinarului': 'water-gura-cainarului',
    dorna: 'water-dorna',
  },
  'Coca-Cola': {
    classic: 'cola',
    zero: 'cola-zero',
    cherry: 'cola-cherry',
    lime: 'cola-lime',
    vanilla: 'cola-vanilla',
  },
  Pepsi: { classic: 'pepsi', zero: 'pepsi-zero', lime: 'pepsi' },
  Sprite: { classic: 'sprite', zero: 'sprite' },
  Fanta: {
    orange: 'fanta',
    lemon: 'fanta-lemon',
    exotic: 'fanta-exotic',
    pineapple: 'fanta-exotic',
    zero: 'fanta',
  },
  Syrup: {
    vanilla: 'syrup-vanilla',
    caramel: 'syrup-caramel',
    'salted caramel': 'syrup-salted-caramel',
    hazelnut: 'syrup-hazelnut',
    'irish cream': 'syrup-irish-cream',
    coconut: 'syrup-coconut',
    maracuya: 'syrup-maracuya',
    grenadine: 'syrup-grenadine',
    mint: 'syrup-mint',
    strawberry: 'syrup-strawberry',
    chocolate: 'syrup-chocolate',
    cherry: 'syrup-grenadine',
  },
};

/** The picture for an item of a kind: the kind's own, else the item's. */
export function kindIcon<T extends string>(
  product: { name: string; icon: T },
  variant: string | null | undefined,
): T | FoodIcon {
  return (
    (variant && (VARIANT_ICONS[product.name]?.[variant.toLowerCase()] as FoodIcon | undefined)) ||
    product.icon
  );
}

/** An item's kinds and their pictures (keys in lower case), by the item's catalog name. */
export function variantIconsFor(name: string): Record<string, string> {
  return VARIANT_ICONS[name] ?? {};
}

export const CATALOG_VERSION = 2;
