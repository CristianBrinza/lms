import { z } from 'zod';
import { dateField, priceField } from '../food/schemas';
import { countryField } from '../drinks/schemas';

/**
 * The virtual closet: what a piece of clothing, a place it's kept, a look, a day worn and a
 * packing list may hold. Kinds and scales are fixed (the app draws them and names them in three
 * languages); names, brands, notes and tags are words.
 */

/** Category → its subcategories. Subcategory ids are unique across categories. */
export const CATEGORIES = {
  tops: ['tshirt', 'shirt', 'polo', 'tank', 'sweater', 'cardigan', 'hoodie', 'bodysuit'],
  bottoms: ['jeans', 'trousers', 'shorts', 'skirt', 'leggings', 'joggers'],
  dresses: ['casual_dress', 'evening_dress', 'jumpsuit'],
  outerwear: [
    'coat',
    'trench',
    'puffer',
    'leather_jacket',
    'blazer',
    'denim_jacket',
    'vest',
    'raincoat',
  ],
  formal: ['suit_jacket', 'suit_trousers', 'waistcoat', 'tuxedo'],
  shoes: [
    'sneakers',
    'boots',
    'ankle_boots',
    'heels',
    'flats',
    'sandals',
    'loafers',
    'slippers',
    'formal_shoes',
  ],
  bags: ['tote', 'shoulder_bag', 'crossbody', 'backpack', 'clutch', 'travel_bag'],
  accessories: [
    'scarf',
    'hat',
    'gloves',
    'belt',
    'sunglasses',
    'tie',
    'watch',
    'hair',
    'wallet',
    'socks',
  ],
  jewellery: ['necklace', 'earrings', 'ring', 'bracelet', 'brooch'],
  underwear: ['bra', 'briefs', 'hosiery', 'pyjamas', 'robe'],
  sport: ['sport_top', 'sport_leggings', 'sport_shorts', 'sport_jacket', 'sports_bra', 'tracksuit'],
  swimwear: ['swimsuit', 'trunks', 'coverup'],
  other: [],
} as const satisfies Record<string, readonly string[]>;
export type Category = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as [Category, ...Category[]];
export const SUBCATEGORY_IDS = Object.values(CATEGORIES).flat() as string[];

export const COLORS = [
  'black',
  'charcoal',
  'grey',
  'white',
  'cream',
  'beige',
  'camel',
  'brown',
  'navy',
  'blue',
  'light_blue',
  'teal',
  'green',
  'olive',
  'khaki',
  'yellow',
  'mustard',
  'orange',
  'red',
  'burgundy',
  'pink',
  'lilac',
  'purple',
  'gold',
  'silver',
  'multi',
] as const;

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

export const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'all_year'] as const;
export const OCCASIONS = [
  'casual',
  'work',
  'formal',
  'evening',
  'sport',
  'travel',
  'home',
  'beach',
] as const;
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
export type Status = (typeof STATUSES)[number];
/** In the closet now (or about to be back): the rest are wished for or gone. */
export const OWNED_STATUSES: Status[] = ['clean', 'to_wash', 'at_cleaners', 'lent'];
export const STORAGES = ['folded', 'hanging', 'drawer', 'box', 'laundry', 'worn', 'lent', 'vacuum'] as const;
export const PHOTO_KINDS = ['front', 'back', 'label', 'detail', 'tryon'] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number] | 'backdrop';

/** Places: rooms hold furniture, furniture holds sections. Shelves are numbered from the bottom. */
export const PLACE_KINDS = [
  'room',
  'furniture',
  'shelf',
  'rail',
  'drawer',
  'box',
  'vacuum_bag',
  'hook',
  'section',
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export const SIDES = ['left', 'middle', 'right'] as const;

export const BACKDROPS = ['paper', 'linen', 'soft', 'studio', 'photo'] as const;
export const SOFT_TONES = ['lav', 'mint', 'peach', 'pink', 'sky', 'butter'] as const;

const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);
const words = (max: number, each = 40) =>
  z
    .array(z.string().trim().min(1).max(each))
    .max(max)
    .transform((list) => [...new Set(list)]);
const set = <T extends readonly [string, ...string[]]>(values: T, max = values.length) =>
  z
    .array(z.enum(values))
    .max(max)
    .transform((list) => [...new Set(list)]);
const currencyField = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, 'A currency like MDL, EUR or USD');
const urlField = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => value === '' || /^https?:\/\/\S+$/i.test(value), 'Use a web address (https://…)');

// ---------------------------------------------------------------- care (ISO 3758 groups)

export const WASH_TEMPS = [30, 40, 50, 60, 70, 95] as const;

export const CareInput = z
  .object({
    wash: z
      .object({
        method: z.enum(['machine', 'hand', 'none']).describe('machine, hand (hand wash only), none (do not wash)'),
        temp: z
          .literal([...WASH_TEMPS])
          .optional()
          .describe('The number in the tub: 30, 40, 50, 60, 70 or 95 °C'),
        gentle: z
          .union([z.literal(0), z.literal(1), z.literal(2)])
          .optional()
          .describe('Bars under the tub: 0 normal, 1 mild (permanent press), 2 very mild (wool, delicates)'),
      })
      .optional(),
    bleach: z
      .enum(['any', 'non_chlorine', 'none'])
      .optional()
      .describe('Triangle: any bleach, non-chlorine only (two lines), none (crossed)'),
    tumble: z
      .enum(['low', 'normal', 'none'])
      .optional()
      .describe('Square with a circle: low (one dot), normal (two dots), none (crossed)'),
    dry: set(['line', 'drip', 'flat', 'shade'] as const)
      .optional()
      .describe('Natural drying (square): line dry, drip dry, dry flat, in the shade (diagonal)'),
    iron: z
      .enum(['low', 'medium', 'high', 'none'])
      .optional()
      .describe('Iron: low 110 °C (one dot), medium 150 °C (two), high 200 °C (three), none (crossed)'),
    steam: z.boolean().optional().describe('false: no steam (the iron with crossed lines below)'),
    professional: z
      .object({
        method: z.enum(['P', 'F', 'W', 'none']).describe('Circle: P or F dry cleaning, W wet cleaning, none (crossed)'),
        gentle: z.boolean().optional().describe('A bar under the circle'),
      })
      .optional(),
  })
  .describe('Care symbols from the label, ISO 3758 groups. Leave out a group the label does not show.');
export type Care = z.infer<typeof CareInput>;

export const MaterialPart = z.object({
  material: z.enum(MATERIALS),
  percent: z.number().int().min(1).max(100).nullable().optional(),
});

// ---------------------------------------------------------------- items

const itemFields = {
  name: text(120).describe('What it is, as people say it: "Navy oxford shirt", "Black Chelsea boots"'),
  category: z.enum(CATEGORY_IDS).or(z.literal('')).describe(
    'tops, bottoms, dresses, outerwear, formal, shoes, bags, accessories, jewellery, underwear, sport, swimwear, other',
  ),
  subcategory: z
    .string()
    .trim()
    .refine((v) => v === '' || SUBCATEGORY_IDS.includes(v), 'Pick a kind from the list')
    .describe(`One of: ${SUBCATEGORY_IDS.join(', ')}`),
  colors: set(COLORS, 6).describe('Main colours first'),
  materials: z
    .array(MaterialPart)
    .max(8)
    .describe('From the label: [{material: "cotton", percent: 95}, {material: "elastane", percent: 5}]'),
  size: text(20).describe('As on the label: M, 42, 34, 10.5'),
  sizeSystem: z.enum(SIZE_SYSTEMS).or(z.literal('')),
  brand: text(80),
  price: priceField.nullable(),
  currency: currencyField.describe('Default: the household’s currency'),
  boughtOn: dateField.nullable(),
  store: text(120).describe('Where it was bought'),
  seasons: set(SEASONS),
  occasions: set(OCCASIONS),
  fit: z.enum(FITS).or(z.literal('')),
  condition: z.enum(CONDITIONS).or(z.literal('')),
  issues: set(ISSUES).describe('What is wrong with it, when anything is'),
  conditionNotes: text(500),
  tags: words(20),
  notes: text(4000),
  url: urlField,
  status: z.enum(STATUSES),
  lentTo: text(120).describe('Who has it, when status is lent'),
  favorite: z.boolean(),
  placeId: z.uuid().nullable().describe('Where it is kept (a place id from closet_places)'),
  storage: z.enum(STORAGES).or(z.literal('')).describe('How it is kept there'),
  care: CareInput.nullable(),
  storageAdvice: text(1000).describe('How to keep it, from its materials (moth protection, padded hanger…)'),
  madeIn: countryField.describe('ISO code of the country on the label'),
  labelText: text(4000).describe('Everything else the label says, as written'),
};

export const ItemInput = z
  .object(itemFields)
  .partial()
  .extend({
    ownerId: z.uuid().optional().describe('Whose closet (a household member); default the caller'),
  });
export type ItemInput = z.infer<typeof ItemInput>;

export const ItemPatch = z
  .object(itemFields)
  .partial()
  .extend({ ownerId: z.uuid().optional() })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type ItemPatch = z.infer<typeof ItemPatch>;

export const BulkInput = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
  patch: z
    .object({
      status: itemFields.status,
      placeId: itemFields.placeId,
      storage: itemFields.storage,
      seasons: itemFields.seasons,
      favorite: itemFields.favorite,
      lentTo: itemFields.lentTo,
      category: itemFields.category,
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, 'Nothing to change'),
});

export const ListQuery = z.object({
  owner: z.string().trim().max(60).optional().describe('A person’s id, or "all" for the household'),
  q: z.string().trim().max(120).optional(),
  category: z.enum(CATEGORY_IDS).optional(),
  status: z.enum(STATUSES).optional(),
  color: z.enum(COLORS).optional(),
  season: z.enum(SEASONS).optional(),
  placeId: z.uuid().optional(),
  needsDetails: z
    .union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().describe('A page of this many'),
  cursor: z.string().max(80).optional().describe('The `next` of the page before'),
});
export type ListQuery = z.infer<typeof ListQuery>;

export const PhotoInput = z.object({
  image: z
    .string()
    .min(16)
    .max(17_000_000, 'That photo is too large')
    .describe('A data URL (data:image/jpeg;base64,…) or plain base64: JPEG, PNG, WebP or HEIC, up to 12 MB'),
  kind: z
    .enum(PHOTO_KINDS)
    .optional()
    .describe('front (default), back, label (the care label: kept with the item), detail, tryon (an AI try-on picture; never the cover)'),
  needsCutout: z
    .boolean()
    .optional()
    .describe('The background is still there. Default: true for front and back photos without transparency'),
  replaces: z
    .uuid()
    .optional()
    .describe('The photo this cut-out replaces: it takes its place, and the original is kept'),
  vector: z
    .boolean()
    .optional()
    .describe('image is an SVG drawing (data:image/svg+xml;base64,…, up to 2 MB, no scripts or external links); it is rasterized to a transparent PNG. Use with replaces'),
  rotates: z
    .uuid()
    .optional()
    .describe('The photo this one is a turned copy of: it takes its place and links, and the old file goes'),
});
export type PhotoInput = z.infer<typeof PhotoInput>;

export const PhotoPatch = z
  .object({
    kind: z.enum(PHOTO_KINDS).optional(),
    cover: z.literal(true).optional(),
    needsCutout: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');

// ---------------------------------------------------------------- places

const placeFields = {
  kind: z.enum(PLACE_KINDS).describe(
    'room; furniture (wardrobe, dresser, rack); inside furniture: shelf, rail (hanging), drawer, box, hook, section',
  ),
  name: text(80).describe('Rooms and furniture: "Bedroom", "Wardrobe". Sections may stay unnamed'),
  parentId: z.uuid().nullable().describe('The place it is in: furniture in a room, a shelf in furniture'),
  number: z.number().int().min(1).max(99).nullable().describe('Shelf 1 is the lowest; drawer 1 the top one'),
  side: z.enum(SIDES).or(z.literal('')),
  position: z.number().int().min(0).max(9999),
};

export const PlaceInput = z.object({
  ...placeFields,
  name: placeFields.name.optional(),
  parentId: placeFields.parentId.optional(),
  number: placeFields.number.optional(),
  side: placeFields.side.optional(),
  position: placeFields.position.optional(),
});
export type PlaceInput = z.infer<typeof PlaceInput>;

export const PlacePatch = z
  .object(placeFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type PlacePatch = z.infer<typeof PlacePatch>;

// ---------------------------------------------------------------- looks

export const CanvasItem = z.object({
  itemId: z.uuid(),
  photoId: z.uuid().nullable().optional().describe('Which of its photos; default its cover'),
  x: z.number().min(-1).max(2).describe('Centre, as a share of the canvas width'),
  y: z.number().min(-1).max(2).describe('Centre, as a share of the canvas height'),
  scale: z.number().min(0.05).max(6).describe('1 = a third of the canvas width'),
  rotation: z.number().min(-720).max(720).describe('Degrees'),
  z: z.number().int().min(0).max(999),
  flip: z.boolean().optional(),
  /** The piece's name and kind when the look was saved: shown if the piece is deleted later. */
  label: z.string().max(160).optional(),
  category: z.string().max(20).optional(),
});

export const Canvas = z.object({
  v: z.literal(1),
  items: z.array(CanvasItem).max(40),
});
export type Canvas = z.infer<typeof Canvas>;

export const Backdrop = z.object({
  kind: z.enum(BACKDROPS),
  tone: z.enum(SOFT_TONES).optional(),
  photoId: z.uuid().optional(),
});
export type Backdrop = z.infer<typeof Backdrop>;

const lookFields = {
  name: text(120),
  canvas: Canvas,
  backdrop: Backdrop,
  seasons: set(SEASONS),
  occasions: set(OCCASIONS),
  notes: text(2000),
};

export const LookInput = z.object({
  ...lookFields,
  name: lookFields.name.optional(),
  canvas: lookFields.canvas.optional(),
  backdrop: lookFields.backdrop.optional(),
  seasons: lookFields.seasons.optional(),
  occasions: lookFields.occasions.optional(),
  notes: lookFields.notes.optional(),
  itemIds: z.array(z.uuid()).max(40).optional().describe('Pieces laid out side by side when no canvas is given'),
  ownerId: z.uuid().optional(),
});
export type LookInput = z.infer<typeof LookInput>;

export const LookPatch = z
  .object(lookFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type LookPatch = z.infer<typeof LookPatch>;

// ---------------------------------------------------------------- the calendar

const wearFields = {
  wornOn: dateField.describe('YYYY-MM-DD; default today'),
  lookId: z.uuid().nullable(),
  itemIds: z.array(z.uuid()).max(40),
  note: text(500),
  planned: z.boolean().describe('Planned for that day, not worn yet: it doesn’t count as worn'),
};

export const WearInput = z
  .object({
    wornOn: wearFields.wornOn.optional(),
    lookId: wearFields.lookId.optional(),
    itemIds: wearFields.itemIds.optional(),
    note: wearFields.note.optional(),
    planned: wearFields.planned.optional(),
    ownerId: z.uuid().optional(),
  })
  .refine((body) => body.lookId || body.itemIds?.length, {
    message: 'Pick a look or the pieces worn',
    path: ['itemIds'],
  });
export type WearInput = z.infer<typeof WearInput>;

export const WearPatch = z
  .object(wearFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type WearPatch = z.infer<typeof WearPatch>;

export const WearQuery = z.object({
  owner: z.string().trim().max(60).optional(),
  from: dateField.optional(),
  to: dateField.optional(),
});

// ---------------------------------------------------------------- packing lists

const tripFields = {
  name: text(120).min(1, 'Name the trip'),
  destination: text(120),
  startsOn: dateField.nullable(),
  endsOn: dateField.nullable(),
  notes: text(2000),
};

export const TripInput = z.object({
  ...tripFields,
  destination: tripFields.destination.optional(),
  startsOn: tripFields.startsOn.optional(),
  endsOn: tripFields.endsOn.optional(),
  notes: tripFields.notes.optional(),
  itemIds: z.array(z.uuid()).max(200).optional(),
  lookIds: z.array(z.uuid()).max(40).optional(),
  ownerId: z.uuid().optional(),
});
export type TripInput = z.infer<typeof TripInput>;

export const TripPatch = z
  .object(tripFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to change');
export type TripPatch = z.infer<typeof TripPatch>;

export const TripItemsInput = z
  .object({
    itemIds: z.array(z.uuid()).max(200).optional(),
    lookIds: z.array(z.uuid()).max(40).optional(),
  })
  .refine((body) => body.itemIds?.length || body.lookIds?.length, 'Nothing to add');

export const PackedInput = z.object({ packed: z.boolean() });

export const WashedInput = z
  .object({
    ids: z.array(z.uuid()).max(500).optional(),
    all: z.boolean().optional(),
    owner: z.string().trim().max(60).optional(),
  })
  .refine((body) => body.all || body.ids?.length, 'Pick what was washed');

export const ExportQuery = z.object({
  owner: z.string().trim().max(60).optional(),
  format: z.enum(['json', 'csv']).optional(),
});


export const MANNEQUINS = ['male', 'female'] as const;
export type Mannequin = (typeof MANNEQUINS)[number];

export const TryonInput = z.object({
  photoId: z
    .uuid()
    .optional()
    .describe('The garment photo to dress (default: the cover, a front photo with its background removed)'),
  mannequin: z
    .enum(MANNEQUINS)
    .optional()
    .describe('male or female store mannequin for this try-on; the first pick is remembered for the owner'),
});
export type TryonInput = z.infer<typeof TryonInput>;

/** A person's mannequin choice for the try-on. */
export const MannequinInput = z.object({ mannequin: z.enum(MANNEQUINS).nullable() });
