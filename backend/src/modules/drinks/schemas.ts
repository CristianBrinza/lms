import { z } from 'zod';
import { dateField, priceField } from '../food/schemas';

/**
 * Drinks: what a drink, a tasting and a tasting sheet may hold. The kinds and scales are fixed
 * (the app draws them); the descriptors (aromas, flavours, off-flavours) are words, so Claude can
 * note one the app's chips don't have.
 */

export const CATEGORIES = [
  'wine',
  'sparkling',
  'fortified',
  'brandy',
  'whisky',
  'rum',
  'vodka',
  'gin',
  'agave',
  'liqueur',
  'beer',
  'cider',
  'sake',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLORS = ['white', 'rose', 'red', 'orange'] as const;
export const PHOTO_KINDS = ['front', 'back', 'other'] as const;

/** Which tasting sheet fits a kind of drink. */
export function sheetKind(category: Category): 'wine' | 'spirit' | 'beer' {
  if (category === 'beer' || category === 'cider') return 'beer';
  if (category === 'wine' || category === 'sparkling' || category === 'fortified' || category === 'sake')
    return 'wine';
  return 'spirit';
}

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const words = (max: number, each = 60) =>
  z
    .array(z.string().trim().min(1).max(each))
    .max(max)
    .transform((list) => [...new Set(list)]);

export const countryField = z
  .string()
  .trim()
  .toUpperCase()
  .refine((value) => value === '' || /^[A-Z]{2}$/.test(value), 'A country code like MD, FR or US');

const currencyField = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'A currency like MDL, EUR or USD');

const drinkFields = {
  category: z
    .enum(CATEGORIES)
    .describe(
      'wine, sparkling (champagne, cava, prosecco), fortified (port, sherry, madeira), brandy (cognac, armagnac, divin), whisky, rum, vodka, gin, agave (tequila, mezcal), liqueur, beer, cider, sake, other',
    ),
  name: z
    .string()
    .trim()
    .min(1, 'Say which drink')
    .max(160, 'Keep it under 160 characters')
    .describe('The full name as on the label: "Jack Daniel’s Tennessee Honey", "Purcari Rară Neagră 2019"'),
  producer: text(120).optional().describe('Producer, winery, distillery or brand'),
  line: text(120)
    .optional()
    .describe('The family its versions share ("Jack Daniel’s", "Château Purcari Negru de Purcari")'),
  variant: text(120).optional().describe('This version within the line ("Tennessee Honey", "Old No. 7")'),
  vintage: z.number().int().min(1800).max(2100).nullable().optional().describe('Year of the vintage'),
  producedOn: dateField.nullable().optional().describe('Bottled or produced on, when the label gives a day'),
  ageYears: z.number().int().min(0).max(100).nullable().optional().describe('Age statement, years (12 for a 12-year-old)'),
  abv: z.number().min(0).max(100).nullable().optional().describe('Alcohol, % vol'),
  volumeMl: z.number().int().min(1).max(30000).nullable().optional().describe('Bottle size, ml'),
  country: countryField.optional().describe('ISO country code of origin: MD, FR, IT, GB, US…'),
  region: text(120).optional(),
  appellation: text(120).optional().describe('Appellation or sub-region (Valul lui Traian, Champagne AOC)'),
  grapes: words(20).optional().describe('Grape varieties, for wine'),
  color: z.enum(COLORS).or(z.literal('')).optional().describe('Wine’s colour: white, rose, red, orange'),
  style: text(80)
    .optional()
    .describe('Style words by kind: Brut, Extra Brut (sparkling); VS, VSOP, XO (cognac); Single malt; IPA'),
  cask: text(120).optional().describe('Cask or finish (Sherry cask, Port finish)'),
  labelText: text(4000).optional().describe('The back label’s description, as written'),
  tags: words(20, 40).optional(),
  notes: text(4000).optional(),
  price: priceField.nullable().optional().describe('What was paid for one bottle'),
  currency: currencyField.optional().describe('Default: the kitchen’s currency'),
  boughtAt: text(120).optional().describe('Where it was bought (shop, duty free, the winery)'),
  stock: z.number().int().min(0).max(9999).optional().describe('Bottles at home now'),
  location: text(80).optional().describe('Where they are kept (wine rack, cellar, kitchen)'),
  opened: z.boolean().optional().describe('A bottle is open'),
  boughtOn: dateField.nullable().optional(),
  wanted: z.boolean().optional().describe('On the want-to-try list'),
};

export const DrinkInput = z
  .object({
    ...drinkFields,
    // A new version takes its kind from the one it starts from.
    category: drinkFields.category.optional(),
    fromId: z
      .uuid()
      .optional()
      .describe(
        'Start from another version of the same family: its facts are copied, the rest given here wins',
      ),
  })
  .refine((body) => body.category !== undefined || body.fromId !== undefined, {
    message: 'Pick what kind of drink it is',
    path: ['category'],
  });
export type DrinkInput = z.infer<typeof DrinkInput>;

export const DrinkPatch = z
  .object(drinkFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type DrinkPatch = z.infer<typeof DrinkPatch>;

export const StockInput = z
  .object({
    stock: z.number().int().min(0).max(9999).optional().describe('Bottles at home now'),
    delta: z.number().int().min(-9999).max(9999).optional().describe('+1 a bottle bought, −1 one finished'),
    location: text(80).optional(),
    opened: z.boolean().optional(),
    boughtOn: dateField.nullable().optional(),
    wanted: z.boolean().optional(),
    price: priceField.nullable().optional().describe('What the new bottle cost'),
    boughtAt: text(120).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type StockInput = z.infer<typeof StockInput>;

// ---------------------------------------------------------------- the tasting sheet

const LEVEL5 = ['low', 'medium-minus', 'medium', 'medium-plus', 'high'] as const;
const descriptors = words(80, 40);

export const WINE_SCALES = {
  clarity: ['clear', 'hazy'],
  appearanceIntensity: ['pale', 'medium', 'deep'],
  colour: [
    'lemon-green',
    'lemon',
    'gold',
    'amber',
    'brown',
    'pink',
    'salmon',
    'orange',
    'purple',
    'ruby',
    'garnet',
    'tawny',
  ],
  appearanceOther: ['legs', 'deposit', 'bubbles', 'tears', 'sediment'],
  condition: ['clean', 'unclean'],
  noseIntensity: ['light', 'medium-minus', 'medium', 'medium-plus', 'pronounced'],
  development: ['youthful', 'developing', 'fully-developed', 'tired'],
  sweetness: ['dry', 'off-dry', 'medium-dry', 'medium-sweet', 'sweet', 'luscious'],
  acidity: LEVEL5,
  tannin: LEVEL5,
  alcohol: ['low', 'medium', 'high'],
  body: ['light', 'medium-minus', 'medium', 'medium-plus', 'full'],
  mousse: ['delicate', 'creamy', 'aggressive'],
  flavourIntensity: ['light', 'medium-minus', 'medium', 'medium-plus', 'pronounced'],
  finish: ['short', 'medium-minus', 'medium', 'medium-plus', 'long'],
  quality: ['faulty', 'poor', 'acceptable', 'good', 'very-good', 'outstanding'],
  readiness: ['too-young', 'can-drink-has-potential', 'drink-now', 'too-old'],
} as const;

export const SPIRIT_SCALES = {
  appearanceIntensity: ['water-white', 'pale', 'medium', 'deep', 'opaque'],
  colour: ['clear', 'lemon', 'gold', 'amber', 'copper', 'brown', 'other'],
  noseIntensity: ['neutral', 'light', 'medium', 'pronounced'],
  sweetness: ['dry', 'off-dry', 'medium', 'sweet'],
  texture: ['smooth', 'silky', 'oily', 'warming', 'harsh', 'thin', 'mouthfilling'],
  finish: ['short', 'medium', 'long'],
  complexity: ['neutral', 'simple', 'some', 'very'],
  quality: WINE_SCALES.quality,
} as const;

/** BJCP's weights: the five parts add up to 50. */
export const BEER_MAX = { aroma: 12, appearance: 3, flavour: 20, mouthfeel: 5, overall: 10 } as const;

const pick = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values).optional();

export const WineSheet = z.object({
  v: z.literal(1),
  kind: z.literal('wine'),
  appearance: z
    .object({
      clarity: pick(WINE_SCALES.clarity),
      intensity: pick(WINE_SCALES.appearanceIntensity),
      colour: pick(WINE_SCALES.colour),
      other: z.array(z.enum(WINE_SCALES.appearanceOther)).max(5).optional(),
    })
    .optional(),
  nose: z
    .object({
      condition: pick(WINE_SCALES.condition),
      intensity: pick(WINE_SCALES.noseIntensity),
      aromas: descriptors.optional(),
      development: pick(WINE_SCALES.development),
    })
    .optional(),
  palate: z
    .object({
      sweetness: pick(WINE_SCALES.sweetness),
      acidity: pick(WINE_SCALES.acidity),
      tannin: pick(WINE_SCALES.tannin),
      alcohol: pick(WINE_SCALES.alcohol),
      body: pick(WINE_SCALES.body),
      mousse: pick(WINE_SCALES.mousse),
      intensity: pick(WINE_SCALES.flavourIntensity),
      flavours: descriptors.optional(),
      finish: pick(WINE_SCALES.finish),
    })
    .optional(),
  conclusions: z
    .object({
      quality: pick(WINE_SCALES.quality),
      readiness: pick(WINE_SCALES.readiness),
      // BLIC: what made the quality call.
      balance: z.boolean().optional(),
      length: z.boolean().optional(),
      intensity: z.boolean().optional(),
      complexity: z.boolean().optional(),
    })
    .optional(),
});

export const SpiritSheet = z.object({
  v: z.literal(1),
  kind: z.literal('spirit'),
  appearance: z
    .object({
      intensity: pick(SPIRIT_SCALES.appearanceIntensity),
      colour: pick(SPIRIT_SCALES.colour),
    })
    .optional(),
  nose: z
    .object({ intensity: pick(SPIRIT_SCALES.noseIntensity), aromas: descriptors.optional() })
    .optional(),
  palate: z
    .object({
      sweetness: pick(SPIRIT_SCALES.sweetness),
      texture: z.array(z.enum(SPIRIT_SCALES.texture)).max(7).optional(),
      flavours: descriptors.optional(),
      finish: pick(SPIRIT_SCALES.finish),
      complexity: pick(SPIRIT_SCALES.complexity),
    })
    .optional(),
  conclusions: z.object({ quality: pick(SPIRIT_SCALES.quality) }).optional(),
});

const beerScore = (max: number) => z.number().min(0).max(max).multipleOf(0.5).optional();

export const BeerSheet = z.object({
  v: z.literal(1),
  kind: z.literal('beer'),
  scores: z
    .object({
      aroma: beerScore(BEER_MAX.aroma),
      appearance: beerScore(BEER_MAX.appearance),
      flavour: beerScore(BEER_MAX.flavour),
      mouthfeel: beerScore(BEER_MAX.mouthfeel),
      overall: beerScore(BEER_MAX.overall),
    })
    .optional(),
  aromas: descriptors.optional(),
  offFlavours: descriptors.optional(),
});

export const TastingSheet = z
  .discriminatedUnion('kind', [WineSheet, SpiritSheet, BeerSheet])
  .describe(
    'The structured tasting sheet, versioned (v: 1). kind "wine" (also sparkling, fortified, sake): appearance {clarity, intensity, colour, other[]}, nose {condition, intensity, aromas[], development}, palate {sweetness, acidity, tannin, alcohol, body, mousse, intensity, flavours[], finish}, conclusions {quality, readiness, balance, length, intensity, complexity}. kind "spirit": appearance {intensity, colour}, nose {intensity, aromas[]}, palate {sweetness, texture[], flavours[], finish, complexity}, conclusions {quality}. kind "beer" (also cider): scores {aroma 0–12, appearance 0–3, flavour 0–20, mouthfeel 0–5, overall 0–10}, aromas[], offFlavours[]. Levels use medium-minus / medium-plus; aromas are short English words (apple, vanilla, peat smoke).',
  );
export type TastingSheet = z.infer<typeof TastingSheet>;

const tastingFields = {
  tastedOn: dateField.optional().describe('YYYY-MM-DD; default today'),
  place: text(160).optional().describe('Where: a restaurant, a friend’s home, a winery'),
  occasion: text(160).optional(),
  country: countryField.optional().describe('ISO code of the country it was tasted in'),
  withPeople: z.array(z.uuid()).max(20).optional().describe('Household members who were there (user ids)'),
  withOthers: text(300).optional().describe('Anyone else who was there, as words'),
  rating: z
    .number()
    .int()
    .min(1)
    .max(10)
    .nullable()
    .optional()
    .describe('Half stars: 1 = ½ star … 10 = 5 stars'),
  score: z.number().int().min(0).max(100).nullable().optional().describe('An optional 100-point score'),
  buyAgain: z.boolean().nullable().optional(),
  comment: text(4000).optional(),
  pairing: text(300).optional().describe('What it was had with'),
  mode: z.enum(['quick', 'full']).optional(),
  sheet: TastingSheet.nullable().optional(),
};

export const TastingInput = z.object({
  ...tastingFields,
  personId: z.uuid().optional().describe('Whose tasting (a household member); default the caller'),
});
export type TastingInput = z.infer<typeof TastingInput>;

export const TastingPatch = z
  .object(tastingFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type TastingPatch = z.infer<typeof TastingPatch>;

export const PhotoInput = z.object({
  image: z
    .string()
    .min(16)
    .max(17_000_000, 'That photo is too large')
    .describe('A data URL (data:image/jpeg;base64,…) or plain base64: JPEG, PNG, WebP or HEIC, up to 12 MB'),
  kind: z.enum(PHOTO_KINDS).optional().describe('front (default), back (the back label), other'),
  tastingId: z.uuid().optional().describe('A photo of that tasting rather than of the bottle'),
});
export type PhotoInput = z.infer<typeof PhotoInput>;

export const PhotoPatch = z
  .object({ kind: z.enum(PHOTO_KINDS).optional(), cover: z.literal(true).optional() })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

export const ListQuery = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
  country: countryField.optional(),
  shelf: z.enum(['cellar', 'tried', 'wanted']).optional(),
  tag: z.string().trim().max(40).optional(),
  minRating: z.coerce.number().int().min(1).max(10).optional(),
  sort: z.enum(['recent', 'rating', 'name', 'vintage']).optional(),
});
export type ListQuery = z.infer<typeof ListQuery>;
