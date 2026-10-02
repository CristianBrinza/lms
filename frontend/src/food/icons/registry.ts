import type { SVGProps } from 'react';

/**
 * Every food and kitchenware icon is its own file in ./svg, named by the API's icon key
 * (tomato.svg, bell-pepper.svg, big-pot.svg…). They are read here as raw markup at build time
 * and drawn inline by <Icon>, so the ink outline (var(--color-ink-900)) follows the theme.
 *
 * To add an icon: draw a 48×48 file in ./svg with the same root attributes as the others, add
 * its key to the backend list (FOOD_ICONS in presets.ts or TOOL_ICONS in kitchenware.ts) and to
 * the matching list below. icons.test.ts checks the three stay in step.
 */

const FILES = import.meta.glob<string>('./svg/*.svg', { query: '?raw', import: 'default', eager: true });

export interface IconArt {
  /** The root <svg> attributes, as React props (viewBox, fill, stroke…). */
  attrs: SVGProps<SVGSVGElement>;
  /** Everything inside the root <svg>. */
  inner: string;
}

const camel = (attr: string) => attr.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function parse(markup: string): IconArt | null {
  const match = /<svg\b([^>]*)>([\s\S]*)<\/svg>/.exec(markup);
  if (!match) return null;
  const attrs: Record<string, string> = {};
  for (const [, name, value] of match[1]!.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (name !== 'xmlns') attrs[camel(name!)] = value!;
  }
  return { attrs: attrs as SVGProps<SVGSVGElement>, inner: match[2]!.trim() };
}

export const ICON_ART: Record<string, IconArt> = {};
for (const [path, markup] of Object.entries(FILES)) {
  const art = parse(markup);
  if (art) ICON_ART[path.slice(path.lastIndexOf('/') + 1, -'.svg'.length)] = art;
}

/** Every icon there is a file for, sorted. */
export const ICON_NAMES = Object.keys(ICON_ART).sort();

/**
 * The icons a food item or recipe can have, in picker order (the backend's FOOD_ICONS, grouped
 * the same way). Kitchenware-only drawings are not in here: the food API would refuse them.
 */
export const FOOD_ICON_KEYS = [
  // produce
  'tomato', 'cucumber', 'carrot', 'potato', 'onion', 'garlic', 'bell-pepper', 'chili', 'lettuce', 'cabbage',
  'broccoli', 'mushroom', 'eggplant', 'zucchini', 'corn', 'avocado', 'lemon', 'apple', 'banana', 'orange',
  'strawberry', 'grapes', 'pear', 'watermelon', 'cherry', 'herbs', 'kiwi', 'pumpkin', 'peach', 'plum',
  'pomegranate', 'beetroot', 'radish', 'seedling', 'herb-pot',
  // bakery
  'bread', 'baguette', 'croissant',
  // meat, fish
  'steak', 'chicken', 'mince', 'sausage', 'bacon', 'fish', 'shrimp',
  // dairy
  'milk', 'milk-carton', 'kefir', 'cream', 'whipped-cream', 'egg', 'cheese', 'butter', 'yogurt', 'cottage',
  // frozen
  'frozen', 'ice-cream', 'dumplings',
  // pantry
  'rice', 'pasta', 'flour', 'sugar', 'oats', 'cereal', 'grain', 'can', 'oil', 'olive-oil', 'vinegar', 'honey', 'nuts',
  'dried-fruit', 'seeds', 'coffee', 'coffee-beans', 'tea', 'jar',
  // cans and jars
  'can-fish', 'can-tomato', 'can-corn', 'can-beans', 'can-peas', 'can-fruit', 'can-meat', 'can-mushroom', 'pate', 'pickles', 'jar-spread',
  // spices and sauces
  'salt', 'spice', 'spice-jar', 'pepper-grinder', 'cinnamon', 'bay-leaf', 'sauce', 'soy-sauce', 'mayo', 'mustard',
  // drinks
  'water', 'juice', 'soda', 'wine', 'beer', 'soda-can', 'juice-box', 'mineral-water', 'spirit', 'syrup', 'cocktail', 'ice', 'puree', 'lime',
  'lemonade', 'compote', 'iced-tea', 'tonic', 'energy-drink', 'kvass', 'whisky', 'champagne', 'tea-cup', 'espresso', 'cappuccino', 'latte',
  // snacks
  'chocolate', 'chocolate-chips', 'marshmallow', 'sprinkles', 'cookie', 'chips', 'popcorn', 'croutons',
  // dishes (recipes and leftovers)
  'pot', 'bowl', 'soup', 'salad', 'pizza', 'sandwich', 'cake', 'pancakes', 'omelette', 'spaghetti', 'container',
  // household and fallback
  'roll', 'detergent', 'sponge', 'trash-bag', 'box', 'basket',
];

/** The icons a piece of kitchenware can have (the backend's TOOL_ICONS). */
export const TOOL_ICON_KEYS = [
  'pot', 'big-pot', 'saucepan', 'pan', 'wok', 'tray', 'baking-dish', 'bowl', 'board', 'knife', 'colander', 'whisk', 'grater',
  'ladle', 'spatula', 'blender', 'mixer', 'kettle', 'toaster', 'oven', 'shaker', 'jigger', 'glass', 'wine-glass', 'mug', 'plate',
  'cutlery', 'lunchbox', 'ice-tray', 'pen', 'scissors', 'box',
];
