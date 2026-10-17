import type { Category, SheetKind, WineColor } from './api';

/**
 * The tasting sheet's vocabulary: the scales the API accepts (WSET's Systematic Approach to
 * Tasting for wine and spirits, BJCP's score sheet for beer) and the aroma chips, grouped. Ids
 * only; the words are in i18n.ts. Keep the scales in step with backend/src/modules/drinks/schemas.ts.
 */

export const WINE_COLORS: WineColor[] = ['white', 'rose', 'red', 'orange'];

const LEVEL5 = ['low', 'medium-minus', 'medium', 'medium-plus', 'high'];
const INTENSITY5 = ['light', 'medium-minus', 'medium', 'medium-plus', 'pronounced'];

export const WINE_SCALES = {
  clarity: ['clear', 'hazy'],
  appearanceIntensity: ['pale', 'medium', 'deep'],
  appearanceOther: ['legs', 'tears', 'deposit', 'sediment', 'bubbles'],
  condition: ['clean', 'unclean'],
  noseIntensity: INTENSITY5,
  development: ['youthful', 'developing', 'fully-developed', 'tired'],
  sweetness: ['dry', 'off-dry', 'medium-dry', 'medium-sweet', 'sweet', 'luscious'],
  acidity: LEVEL5,
  tannin: LEVEL5,
  alcohol: ['low', 'medium', 'high'],
  body: ['light', 'medium-minus', 'medium', 'medium-plus', 'full'],
  mousse: ['delicate', 'creamy', 'aggressive'],
  flavourIntensity: INTENSITY5,
  finish: ['short', 'medium-minus', 'medium', 'medium-plus', 'long'],
  quality: ['faulty', 'poor', 'acceptable', 'good', 'very-good', 'outstanding'],
  readiness: ['too-young', 'can-drink-has-potential', 'drink-now', 'too-old'],
};

/** Wine colours by its colour (WSET's lists), with a swatch for each. */
export const WINE_COLOURS: Record<WineColor, string[]> = {
  white: ['lemon-green', 'lemon', 'gold', 'amber', 'brown'],
  rose: ['pink', 'salmon', 'orange'],
  red: ['purple', 'ruby', 'garnet', 'tawny', 'brown'],
  orange: ['gold', 'amber', 'orange', 'brown'],
};

export const SPIRIT_SCALES = {
  appearanceIntensity: ['water-white', 'pale', 'medium', 'deep', 'opaque'],
  colour: ['clear', 'lemon', 'gold', 'amber', 'copper', 'brown', 'other'],
  noseIntensity: ['neutral', 'light', 'medium', 'pronounced'],
  sweetness: ['dry', 'off-dry', 'medium', 'sweet'],
  texture: ['smooth', 'silky', 'oily', 'warming', 'mouthfilling', 'thin', 'harsh'],
  finish: ['short', 'medium', 'long'],
  complexity: ['neutral', 'simple', 'some', 'very'],
  quality: WINE_SCALES.quality,
};

/** The glass's colour behind each colour word, for the swatches (not app colours: the drink's). */
export const SWATCH: Record<string, string> = {
  'lemon-green': '#e9ecb0',
  lemon: '#f3e7a1',
  gold: '#e8c35d',
  amber: '#c9822b',
  brown: '#7a4a24',
  pink: '#f4b6c2',
  salmon: '#f2a48a',
  orange: '#e98b4a',
  purple: '#5b1f4f',
  ruby: '#8f1a2c',
  garnet: '#7d2230',
  tawny: '#9a5634',
  clear: '#eef3f6',
  copper: '#b5652d',
  other: '#c8c8d3',
  'water-white': '#f4f7f9',
  pale: '#f1e2a8',
  medium: '#d9a24a',
  deep: '#8c4b1d',
  opaque: '#3a2014',
};

export interface AromaGroup {
  id: string;
  /** Primary, secondary or tertiary (wine); null for spirits and beer. */
  stage: 'primary' | 'secondary' | 'tertiary' | null;
  aromas: string[];
}

export const WINE_AROMAS: AromaGroup[] = [
  { id: 'floral', stage: 'primary', aromas: ['acacia', 'honeysuckle', 'chamomile', 'elderflower', 'orange-blossom', 'rose', 'violet'] },
  { id: 'green-fruit', stage: 'primary', aromas: ['apple', 'pear', 'quince', 'gooseberry', 'grape'] },
  { id: 'citrus', stage: 'primary', aromas: ['lemon', 'lime', 'grapefruit', 'orange-peel'] },
  { id: 'stone-fruit', stage: 'primary', aromas: ['peach', 'apricot', 'nectarine'] },
  { id: 'tropical', stage: 'primary', aromas: ['pineapple', 'mango', 'banana', 'lychee', 'melon', 'passion-fruit'] },
  { id: 'red-fruit', stage: 'primary', aromas: ['strawberry', 'raspberry', 'red-cherry', 'redcurrant', 'cranberry', 'red-plum'] },
  { id: 'black-fruit', stage: 'primary', aromas: ['blackcurrant', 'blackberry', 'black-cherry', 'blueberry', 'black-plum'] },
  { id: 'dried-fruit', stage: 'primary', aromas: ['fig', 'prune', 'raisin', 'jam', 'baked-fruit'] },
  { id: 'herbaceous', stage: 'primary', aromas: ['green-pepper', 'grass', 'tomato-leaf', 'asparagus'] },
  { id: 'herbal', stage: 'primary', aromas: ['mint', 'eucalyptus', 'fennel', 'dill', 'lavender', 'thyme'] },
  { id: 'pungent-spice', stage: 'primary', aromas: ['black-pepper', 'white-pepper', 'liquorice'] },
  { id: 'mineral', stage: 'primary', aromas: ['flint', 'wet-stone', 'chalk', 'saline'] },
  { id: 'yeast', stage: 'secondary', aromas: ['brioche', 'bread', 'biscuit', 'pastry', 'yoghurt'] },
  { id: 'malolactic', stage: 'secondary', aromas: ['butter', 'cream', 'cheese'] },
  { id: 'oak', stage: 'secondary', aromas: ['vanilla', 'toast', 'clove', 'nutmeg', 'coconut', 'cedar', 'smoke', 'chocolate', 'coffee', 'resin'] },
  { id: 'oxidative', stage: 'tertiary', aromas: ['almond', 'hazelnut', 'walnut', 'marzipan', 'toffee', 'caramel'] },
  { id: 'fruit-development', stage: 'tertiary', aromas: ['dried-apricot', 'marmalade', 'stewed-plum', 'tar'] },
  { id: 'bottle-age', stage: 'tertiary', aromas: ['honey', 'petrol', 'hay', 'mushroom', 'forest-floor', 'wet-leaves', 'earth', 'leather', 'tobacco', 'game'] },
];

export const SPIRIT_AROMAS: AromaGroup[] = [
  { id: 'cereal', stage: null, aromas: ['malt', 'cereal', 'bread', 'biscuit', 'porridge'] },
  { id: 'fruity', stage: null, aromas: ['apple', 'pear', 'citrus', 'banana', 'tropical-fruit', 'red-fruit', 'dried-fruit'] },
  { id: 'floral', stage: null, aromas: ['floral', 'heather', 'rose', 'perfume'] },
  { id: 'herbal', stage: null, aromas: ['agave', 'juniper', 'herbs', 'aniseed', 'mint', 'black-pepper'] },
  { id: 'peaty', stage: null, aromas: ['peat', 'smoke', 'iodine', 'medicinal', 'bonfire'] },
  { id: 'feinty', stage: null, aromas: ['leather', 'tobacco', 'earth'] },
  { id: 'sulphury', stage: null, aromas: ['struck-match', 'rubber', 'cabbage'] },
  { id: 'woody', stage: null, aromas: ['oak', 'vanilla', 'caramel', 'toffee', 'toast', 'coconut', 'cinnamon', 'clove', 'nutmeg', 'cedar'] },
  { id: 'winey', stage: null, aromas: ['sherry', 'port', 'wine', 'raisin'] },
  { id: 'nutty', stage: null, aromas: ['almond', 'hazelnut', 'walnut', 'marzipan'] },
  { id: 'sweet', stage: null, aromas: ['honey', 'sugar-cane', 'molasses', 'chocolate', 'coffee'] },
];

export const BEER_AROMAS: AromaGroup[] = [
  { id: 'malt', stage: null, aromas: ['malt', 'bread', 'biscuit', 'caramel', 'toast', 'chocolate', 'coffee', 'honey'] },
  { id: 'hops', stage: null, aromas: ['citrus', 'tropical-fruit', 'pine', 'grass', 'floral', 'resin'] },
  { id: 'yeast', stage: null, aromas: ['banana', 'clove', 'red-fruit', 'spice', 'apple'] },
];

export const BEER_OFF_FLAVOURS = [
  'diacetyl',
  'dms',
  'acetaldehyde',
  'oxidised',
  'light-struck',
  'acetic',
  'solvent',
  'phenolic',
  'astringent',
  'metallic',
  'sulphur',
  'infected',
];

export const BEER_PARTS = [
  { id: 'aroma', max: 12 },
  { id: 'appearance', max: 3 },
  { id: 'flavour', max: 20 },
  { id: 'mouthfeel', max: 5 },
  { id: 'overall', max: 10 },
] as const;

/** The few chips quick mode offers, by sheet. */
export const QUICK_AROMAS: Record<SheetKind, string[]> = {
  wine: ['apple', 'lemon', 'peach', 'pineapple', 'strawberry', 'red-cherry', 'blackcurrant', 'black-plum', 'rose', 'black-pepper', 'vanilla', 'toast', 'butter', 'honey', 'flint', 'earth', 'leather'],
  spirit: ['vanilla', 'caramel', 'honey', 'oak', 'smoke', 'peat', 'dried-fruit', 'citrus', 'apple', 'cinnamon', 'almond', 'chocolate', 'coffee', 'floral', 'malt', 'juniper', 'agave'],
  beer: ['malt', 'bread', 'caramel', 'citrus', 'tropical-fruit', 'pine', 'grass', 'floral', 'banana', 'clove', 'chocolate', 'coffee'],
};

export const AROMA_GROUPS: Record<SheetKind, AromaGroup[]> = {
  wine: WINE_AROMAS,
  spirit: SPIRIT_AROMAS,
  beer: BEER_AROMAS,
};

/** A kind's look: the tint of its card when it has no photo, and its bottle's shape. */
export const LOOK: Record<
  Category,
  { tint: string; ink: string; bottle: 'wine' | 'sparkling' | 'square' | 'tall' | 'beer' | 'round' }
> = {
  wine: { tint: 'bg-pink-100', ink: 'text-pink-800', bottle: 'wine' },
  sparkling: { tint: 'bg-butter-100', ink: 'text-butter-800', bottle: 'sparkling' },
  fortified: { tint: 'bg-peach-100', ink: 'text-peach-800', bottle: 'wine' },
  brandy: { tint: 'bg-peach-100', ink: 'text-peach-800', bottle: 'round' },
  whisky: { tint: 'bg-butter-100', ink: 'text-butter-800', bottle: 'square' },
  rum: { tint: 'bg-peach-100', ink: 'text-peach-800', bottle: 'square' },
  vodka: { tint: 'bg-sky-100', ink: 'text-sky-800', bottle: 'tall' },
  gin: { tint: 'bg-mint-100', ink: 'text-mint-800', bottle: 'square' },
  agave: { tint: 'bg-mint-100', ink: 'text-mint-800', bottle: 'round' },
  liqueur: { tint: 'bg-lav-100', ink: 'text-lav-800', bottle: 'round' },
  beer: { tint: 'bg-butter-100', ink: 'text-butter-800', bottle: 'beer' },
  cider: { tint: 'bg-mint-100', ink: 'text-mint-800', bottle: 'beer' },
  sake: { tint: 'bg-sky-100', ink: 'text-sky-800', bottle: 'tall' },
  other: { tint: 'bg-ink-100', ink: 'text-ink-600', bottle: 'round' },
};

/** Style words people often use, by kind, offered as one-tap suggestions. */
export const STYLE_HINTS: Partial<Record<Category, string[]>> = {
  sparkling: ['Brut Nature', 'Extra Brut', 'Brut', 'Extra Dry', 'Demi-Sec', 'Doux'],
  brandy: ['VS', 'VSOP', 'XO', 'XXO', 'Hors d’Âge'],
  whisky: ['Single malt', 'Blended', 'Bourbon', 'Rye', 'Single grain'],
  rum: ['White', 'Gold', 'Dark', 'Spiced', 'Agricole'],
  agave: ['Blanco', 'Reposado', 'Añejo', 'Extra Añejo', 'Mezcal'],
  fortified: ['Ruby', 'Tawny', 'Vintage', 'Fino', 'Oloroso', 'PX'],
  beer: ['Lager', 'Pilsner', 'IPA', 'Stout', 'Porter', 'Wheat', 'Sour'],
  gin: ['London Dry', 'Old Tom', 'Navy Strength'],
  wine: ['Dry', 'Semi-dry', 'Semi-sweet', 'Sweet'],
};
