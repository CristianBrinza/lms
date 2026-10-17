import { z } from 'zod';
import { Translations } from '../../lib/i18n';
import { dateField, idField } from '../food/schemas';
import {
  BAG_KINDS,
  CONNECTORS,
  GEAR_KINDS,
  GROUPS,
  KINDS,
  QUANTITIES,
  SCOPES,
  TRANSPORTS,
} from './catalog';

const text = (max: number) => z.string().trim().max(max);
const timeField = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'A time like 07:30')
  .describe('HH:MM, local');
const cm = z.number().positive().max(300).nullable().describe('Centimetres');

export const BagInput = z.object({
  name: text(80).min(1, 'Name it'),
  kind: z.enum(BAG_KINDS),
  lengthCm: cm.optional(),
  widthCm: cm.optional(),
  heightCm: cm.optional(),
  note: text(300).optional(),
  translations: Translations.optional(),
});
export type BagInput = z.infer<typeof BagInput>;
export const BagPatch = BagInput.partial();

export const GearInput = z.object({
  name: text(80).min(1, 'Name it'),
  kind: z.enum(GEAR_KINDS),
  connectors: z.array(z.enum(CONNECTORS)).max(8).optional().describe('MagSafe, USB-C, USB-A…'),
  count: z.number().int().min(0).max(99).optional().describe('How many the household has'),
  note: text(300).optional(),
  translations: Translations.optional(),
});
export type GearInput = z.infer<typeof GearInput>;
export const GearPatch = GearInput.partial();

export const TripGearField = z
  .array(z.object({ gearId: idField, count: z.number().int().min(1).max(99) }))
  .max(30)
  .describe('Gear to take, and how many of each');

export const RulesField = z
  .object({
    scope: z.enum(SCOPES).optional(),
    overnight: z.boolean().optional().describe('true: trips with a night away; false: day trips'),
    transport: z.array(z.enum(TRANSPORTS)).max(5).optional(),
    kinds: z.array(z.enum(KINDS)).max(6).optional(),
    minDays: z.number().int().min(1).max(60).optional(),
  })
  .describe('When it belongs on a trip; every rule given must hold');

export const ItemInput = z.object({
  name: text(80).min(1, 'Name it'),
  group: z.enum(GROUPS),
  quantity: z.enum(QUANTITIES).optional().describe('one, person (each), day, person_day'),
  rules: RulesField.optional(),
  dueHours: z
    .number()
    .int()
    .min(0)
    .max(2160)
    .nullable()
    .optional()
    .describe('Done by so many hours before leaving (24: the day before); null: no deadline'),
  translations: Translations.optional(),
});
export type ItemInput = z.infer<typeof ItemInput>;
export const ItemPatch = ItemInput.partial();

export const MoneyField = z
  .array(
    z.object({
      id: z.string().min(1).max(40),
      kind: z.enum(['cash', 'card']),
      label: text(60).describe('Cash, Revolut EUR card…'),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Z]{3}$/, 'A currency like MDL or EUR'),
      amount: z.number().min(0).max(10_000_000).nullable().describe('How much to have'),
      ready: z.boolean().describe('Cash taken, card topped up and checked'),
    }),
  )
  .max(20)
  .describe('Money for the trip: cash and cards, each with its currency and how much');
export type Money = z.infer<typeof MoneyField>;

export const TripInput = z
  .object({
    name: text(80).min(1, 'Name the trip'),
    destination: text(120).optional(),
    scope: z.enum(SCOPES),
    kind: z.enum(KINDS),
    transport: z.enum(TRANSPORTS),
    startDate: dateField,
    endDate: dateField,
    departTime: timeField.nullable().optional().describe('Leaving home (on startDate)'),
    arriveDate: dateField.nullable().optional().describe('Arriving there; default startDate'),
    arriveTime: timeField.nullable().optional(),
    backDate: dateField.nullable().optional().describe('Heading back; default endDate'),
    backTime: timeField.nullable().optional(),
    returnTime: timeField.nullable().optional().describe('Home again (on endDate)'),
    money: MoneyField.optional(),
    gear: TripGearField.optional(),
    people: z.array(idField).max(20).optional().describe('Household members going'),
    guests: z.number().int().min(0).max(50).optional().describe('Others going, not in LMS'),
    bagIds: z.array(idField).max(10).optional(),
    overrides: z
      .record(z.string(), z.boolean())
      .optional()
      .describe('Packing-list item id → on or off for this trip, against its rules'),
    note: text(1000).optional(),
    translations: Translations.optional(),
  })
  .refine((t) => t.endDate >= t.startDate, {
    message: 'The trip ends before it starts',
    path: ['endDate'],
  });
export type TripInput = z.infer<typeof TripInput>;

export const TripPatch = z
  .object({
    name: text(80).min(1),
    destination: text(120),
    scope: z.enum(SCOPES),
    kind: z.enum(KINDS),
    transport: z.enum(TRANSPORTS),
    startDate: dateField,
    endDate: dateField,
    departTime: timeField.nullable(),
    arriveDate: dateField.nullable(),
    arriveTime: timeField.nullable(),
    backDate: dateField.nullable(),
    backTime: timeField.nullable(),
    returnTime: timeField.nullable(),
    money: MoneyField,
    gear: TripGearField,
    people: z.array(idField).max(20),
    guests: z.number().int().min(0).max(50),
    bagIds: z.array(idField).max(10),
    overrides: z.record(z.string(), z.boolean()),
    note: text(1000),
    translations: Translations,
  })
  .partial();
export type TripPatch = z.infer<typeof TripPatch>;

export const CheckInput = z.object({
  name: text(80).min(1, 'Name it'),
  group: z.enum(GROUPS).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
});
export const CheckPatch = z
  .object({
    checked: z.boolean(),
    toBuy: z.boolean().describe('Not at home: to buy before the trip'),
    name: text(80).min(1),
    quantity: z.number().int().min(1).max(999),
  })
  .partial();
