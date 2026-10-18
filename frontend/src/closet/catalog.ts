/**
 * The closet's fixed vocabulary, the same as the API's (backend/src/modules/closet/schemas.ts):
 * categories and their kinds, the named colours (with the swatch each is drawn in), materials,
 * seasons, occasions, sizes, conditions. Words for them live in i18n.ts.
 */

export const CATEGORIES = {
  tops: ['tshirt', 'shirt', 'polo', 'tank', 'sweater', 'cardigan', 'hoodie', 'bodysuit'],
  bottoms: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers'],
  dresses: ['casual_dress', 'evening_dress', 'jumpsuit'],
  outerwear: ['coat', 'trench', 'puffer', 'leather_jacket', 'blazer', 'denim_jacket', 'vest', 'raincoat'],
  formal: ['suit_jacket', 'suit_trousers', 'waistcoat', 'tuxedo'],
  shoes: ['sneakers', 'boots', 'ankle_boots', 'heels', 'flats', 'sandals', 'loafers', 'slippers', 'formal_shoes'],
  bags: ['tote', 'shoulder_bag', 'crossbody', 'backpack', 'clutch', 'travel_bag'],
  accessories: ['scarf', 'hat', 'gloves', 'belt', 'sunglasses', 'tie', 'watch', 'hair', 'wallet', 'socks'],
  jewellery: ['necklace', 'earrings', 'ring', 'bracelet', 'brooch'],
  underwear: ['bra', 'briefs', 'hosiery', 'pyjamas', 'robe'],
  sport: ['sport_top', 'sport_leggings', 'sport_shorts', 'sport_jacket', 'sports_bra', 'tracksuit'],
  swimwear: ['swimsuit', 'trunks', 'coverup'],
  other: [],
} as const satisfies Record<string, readonly string[]>;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as Category[];
export type Subcategory = (typeof CATEGORIES)[Category][number];

/** Each named colour and the swatch it's drawn as (a real fabric's colour, not a pure one). */
export const COLORS = {
  black: '#1c1c1f',
  charcoal: '#3d3f45',
  grey: '#9a9ca3',
  white: '#fbfbf8',
  cream: '#f1e9d6',
  beige: '#d9c6a5',
  camel: '#b98a55',
  brown: '#6e4a2f',
  navy: '#22304f',
  blue: '#3563b0',
  light_blue: '#a9c7e8',
  teal: '#22777a',
  green: '#3f7d4a',
  olive: '#6b6b3a',
  khaki: '#a99f74',
  yellow: '#efcf45',
  mustard: '#c99a2e',
  orange: '#e0782f',
  red: '#c3322f',
  burgundy: '#6d2233',
  pink: '#eaa3b9',
  lilac: '#bba7d9',
  purple: '#6a3f8f',
  gold: '#c8a24a',
  silver: '#c3c6cc',
  multi: 'conic-gradient(#c3322f, #efcf45, #3f7d4a, #3563b0, #6a3f8f, #c3322f)',
} as const;
export type ClosetColor = keyof typeof COLORS;
export const COLOR_IDS = Object.keys(COLORS) as ClosetColor[];

export const MATERIALS = [
  'cotton',
  'linen',
  'wool',
  'merino',
  'cashmere',
  'silk',
  'viscose',
  'lyocell',
  'polyester',
  'nylon',
  'acrylic',
  'elastane',
  'denim',
  'leather',
  'suede',
  'faux_leather',
  'down',
  'fleece',
  'velvet',
  'satin',
  'lace',
  'hemp',
  'other',
] as const;
export type Material = (typeof MATERIALS)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const;
export const OCCASIONS = ['casual', 'work', 'formal', 'evening', 'sport', 'travel', 'home', 'beach'] as const;
export const FITS = ['slim', 'regular', 'relaxed', 'oversized', 'cropped'] as const;
export const CONDITIONS = ['new_tags', 'like_new', 'good', 'worn', 'damaged'] as const;
export const ISSUES = ['tear', 'stain', 'paint', 'fading', 'pilling', 'missing_button', 'other'] as const;
export const SIZE_SYSTEMS = [
  'letter',
  'eu',
  'us',
  'uk',
  'it',
  'fr',
  'shoe_eu',
  'shoe_us',
  'shoe_uk',
  'one_size',
  'other',
] as const;
export const STATUSES = [
  'clean',
  'to_wash',
  'at_cleaners',
  'lent',
  'wishlist',
  'archived',
  'sold',
  'donated',
] as const;
/** In the closet (or coming back to it). */
export const OWNED = ['clean', 'to_wash', 'at_cleaners', 'lent'] as const;
export const STORAGES = ['folded', 'hanging', 'drawer', 'box', 'laundry', 'worn', 'lent'] as const;
export const SECTION_KINDS = ['shelf', 'rail', 'drawer', 'box', 'hook', 'section'] as const;

/** The size system a kind usually goes with, for the add flow's guess. */
export function sizeSystemFor(category: Category | ''): string {
  if (category === 'shoes') return 'shoe_eu';
  if (category === 'bags' || category === 'jewellery') return 'one_size';
  return 'letter';
}

// ---------------------------------------------------------------- colour naming

type Lab = [number, number, number];

function srgbToLinear(c: number) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function rgbToLab(r: number, g: number, b: number): Lab {
  const [lr, lg, lb] = [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const NAMED: [ClosetColor, Lab][] = COLOR_IDS.filter((c) => c !== 'multi' && c !== 'gold' && c !== 'silver').map(
  (c) => [c, rgbToLab(...hexToRgb(COLORS[c]))],
);

/** The closet's colour nearest to an RGB value (by distance in Lab, which follows the eye). */
export function nearestColor(r: number, g: number, b: number): ClosetColor {
  const lab = rgbToLab(r, g, b);
  let best: ClosetColor = 'grey';
  let distance = Infinity;
  for (const [name, ref] of NAMED) {
    const d = (lab[0] - ref[0]) ** 2 + (lab[1] - ref[1]) ** 2 + (lab[2] - ref[2]) ** 2;
    if (d < distance) {
      distance = d;
      best = name;
    }
  }
  return best;
}

/** Storage advice from the fabric, for the care section (the label's own advice wins). */
export const STORAGE_ADVICE: Partial<Record<Material, 'knit' | 'silk' | 'cotton' | 'denim' | 'leather' | 'down'>> = {
  wool: 'knit',
  merino: 'knit',
  cashmere: 'knit',
  silk: 'silk',
  satin: 'silk',
  cotton: 'cotton',
  linen: 'cotton',
  denim: 'denim',
  leather: 'leather',
  suede: 'leather',
  down: 'down',
};
