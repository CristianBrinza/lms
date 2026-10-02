import { z } from 'zod';
import { CATEGORIES, FOOD_ICONS, LOCATIONS } from './presets';
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
export const unitField = z.enum(UNITS, { error: `Use one of: ${UNITS.join(', ')}` }).describe('pcs, g, kg, ml, l, tsp, tbsp or cup');
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

export const AddStockInput = z
  .object({
    ...productRef,
    quantity: quantityField,
    unit: unitField.optional().describe('Defaults to the product’s own unit'),
    location: locationField.optional(),
    expiresOn: dateField.nullable().optional().describe('YYYY-MM-DD; omit to use the product’s shelf life, null for none'),
    price: priceField.nullable().optional().describe('What was paid for this whole amount'),
    storeId: idField.nullable().optional(),
    note: noteField.optional(),
  })
  .refine(hasProductRef, { message: 'Say which item', path: ['name'] });
export type AddStockInput = z.infer<typeof AddStockInput>;

export const UseStockInput = z.object({
  productId: idField,
  quantity: quantityField,
  unit: unitField.optional(),
  lotId: idField.optional().describe('Take it from this piece/package; otherwise first-expiring first'),
  wasted: z.boolean().optional().describe('True when it was thrown away rather than eaten'),
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
