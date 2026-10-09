/**
 * Travel: what a trip is (where, how, how long, who, which bags) and the packing list a household
 * starts with. Each item says when it belongs on a trip (its rules) and how many to take; a
 * household edits its own copy of the list (library.ts), and every trip can switch items on or off.
 */

export const SCOPES = ['national', 'international'] as const;
export type Scope = (typeof SCOPES)[number];

/** What kind of trip: each brings its own things (a gift for the grandparents, event tickets). */
export const KINDS = ['vacation', 'family', 'day', 'event', 'work', 'other'] as const;
export type Kind = (typeof KINDS)[number];

export const TRANSPORTS = ['car', 'bus', 'train', 'plane', 'other'] as const;
export type Transport = (typeof TRANSPORTS)[number];

export const BAG_KINDS = [
  'backpack',
  'handbag',
  'carry-on',
  'suitcase',
  'duffel',
  'other',
] as const;
export type BagKind = (typeof BAG_KINDS)[number];

export const GEAR_KINDS = [
  'power-bank',
  'charger',
  'cable',
  'adapter',
  'headphones',
  'other',
] as const;
export type GearKind = (typeof GEAR_KINDS)[number];
export const CONNECTORS = [
  'MagSafe',
  'USB-C',
  'USB-A',
  'Lightning',
  'Micro-USB',
  'Wireless',
  'EU plug',
  'UK plug',
] as const;

/** The packing list's sections, in the order a list is read. */
export const GROUPS = [
  'Documents',
  'Money',
  'Health',
  'Toiletries',
  'Clothes',
  'Electronics',
  'Food and drink',
  'Car',
  'For the trip',
  'Before leaving home',
] as const;

/**
 * How many to take: one; one each; one a day; one each a day. A day counts up to a week (laundry
 * after that).
 */
export const QUANTITIES = ['one', 'person', 'day', 'person_day'] as const;
export type Quantity = (typeof QUANTITIES)[number];

/** When an item belongs on a trip; every rule given must hold, a missing rule means any. */
export interface Rules {
  scope?: Scope;
  /** True: only trips with a night away; false: only day trips. */
  overnight?: boolean;
  transport?: Transport[];
  kinds?: Kind[];
  /** At least this many days. */
  minDays?: number;
}

export interface TripShape {
  scope: Scope;
  kind: Kind;
  transport: Transport;
  days: number;
  people: number;
}

export function itemApplies(rules: Rules, trip: TripShape): boolean {
  return (
    (!rules.scope || rules.scope === trip.scope) &&
    (rules.overnight === undefined || rules.overnight === trip.days > 1) &&
    (!rules.transport?.length || rules.transport.includes(trip.transport)) &&
    (!rules.kinds?.length || rules.kinds.includes(trip.kind)) &&
    (!rules.minDays || trip.days >= rules.minDays)
  );
}

export function itemQuantity(quantity: Quantity, trip: TripShape): number {
  const days = Math.min(trip.days, 7);
  if (quantity === 'person') return trip.people;
  if (quantity === 'day') return days;
  if (quantity === 'person_day') return trip.people * days;
  return 1;
}

export interface PresetItem {
  key: string;
  name: string;
  group: (typeof GROUPS)[number];
  quantity?: Quantity;
  rules?: Rules;
  /** Done by so many hours before leaving (a check-in, a vignette, a booking). */
  dueHours?: number;
}

const night = { overnight: true } as const;

/** Bump when the list learns new items: each household gets the new ones once. */
export const TRAVEL_CATALOG_VERSION = 2;

export const PRESET_ITEMS: readonly PresetItem[] = [
  // Documents
  { key: 'id-card', name: 'ID card', group: 'Documents', quantity: 'person' },
  {
    key: 'passport',
    name: 'Passport',
    group: 'Documents',
    quantity: 'person',
    rules: { scope: 'international' },
    dueHours: 720,
  },
  {
    key: 'driving-licence',
    name: 'Driving licence',
    group: 'Documents',
    rules: { transport: ['car'] },
  },
  {
    key: 'car-papers',
    name: 'Car papers and insurance',
    group: 'Documents',
    rules: { transport: ['car'] },
  },
  {
    key: 'green-card',
    name: 'Green Card insurance',
    group: 'Documents',
    rules: { transport: ['car'], scope: 'international' },
    dueHours: 72,
  },
  {
    key: 'vignette',
    name: 'Road vignette (rovinieta) bought',
    group: 'Documents',
    rules: { transport: ['car'], scope: 'international' },
    dueHours: 24,
  },
  {
    key: 'tickets',
    name: 'Tickets or boarding passes',
    group: 'Documents',
    quantity: 'person',
    rules: { transport: ['bus', 'train', 'plane'] },
    dueHours: 168,
  },
  {
    key: 'online-check-in',
    name: 'Online check-in done',
    group: 'Documents',
    rules: { transport: ['plane'] },
    dueHours: 24,
  },
  {
    key: 'travel-insurance',
    name: 'Travel medical insurance',
    group: 'Documents',
    quantity: 'person',
    rules: { scope: 'international' },
    dueHours: 72,
  },
  {
    key: 'bookings',
    name: 'Hotel bookings',
    group: 'Documents',
    rules: { ...night, kinds: ['vacation', 'work', 'event'] },
    dueHours: 336,
  },
  {
    key: 'event-tickets',
    name: 'Event tickets or reservation',
    group: 'Documents',
    rules: { kinds: ['event'] },
    dueHours: 168,
  },
  // Money
  { key: 'bank-card', name: 'Bank card', group: 'Money' },
  { key: 'cash', name: 'Some cash', group: 'Money' },
  {
    key: 'foreign-cash',
    name: 'Cash in the local currency',
    group: 'Money',
    rules: { scope: 'international' },
    dueHours: 48,
  },
  // Health
  { key: 'medicines', name: 'Your usual medicines', group: 'Health' },
  { key: 'painkillers', name: 'Painkillers', group: 'Health' },
  { key: 'plasters', name: 'Plasters', group: 'Health' },
  {
    key: 'motion-sickness',
    name: 'Travel sickness pills',
    group: 'Health',
    rules: { transport: ['car', 'bus'] },
  },
  { key: 'sunscreen', name: 'Sunscreen', group: 'Health', rules: { kinds: ['vacation'] } },
  { key: 'hand-sanitiser', name: 'Hand sanitiser', group: 'Health' },
  // Toiletries
  { key: 'wet-wipes', name: 'Wet wipes', group: 'Toiletries' },
  { key: 'tissues', name: 'Tissues', group: 'Toiletries' },
  { key: 'toothbrush', name: 'Toothbrush', group: 'Toiletries', quantity: 'person', rules: night },
  { key: 'toothpaste', name: 'Toothpaste', group: 'Toiletries', rules: night },
  { key: 'shampoo', name: 'Shampoo', group: 'Toiletries', rules: night },
  { key: 'shower-gel', name: 'Shower gel', group: 'Toiletries', rules: night },
  { key: 'deodorant', name: 'Deodorant', group: 'Toiletries', rules: night },
  { key: 'razor', name: 'Razor', group: 'Toiletries', rules: night },
  { key: 'hairbrush', name: 'Hairbrush', group: 'Toiletries', rules: night },
  {
    key: 'liquids-bag',
    name: 'Liquids in 100 ml bottles, in a clear 1 L bag',
    group: 'Toiletries',
    rules: { transport: ['plane'] },
  },
  // Clothes
  { key: 'underwear', name: 'Underwear', group: 'Clothes', quantity: 'person_day', rules: night },
  { key: 'socks', name: 'Socks', group: 'Clothes', quantity: 'person_day', rules: night },
  { key: 't-shirts', name: 'T-shirts', group: 'Clothes', quantity: 'person_day', rules: night },
  {
    key: 'trousers',
    name: 'Trousers or shorts',
    group: 'Clothes',
    quantity: 'person',
    rules: { minDays: 3 },
  },
  { key: 'pyjamas', name: 'Pyjamas', group: 'Clothes', quantity: 'person', rules: night },
  { key: 'jacket', name: 'Jacket', group: 'Clothes', quantity: 'person' },
  { key: 'shoes', name: 'Comfortable shoes', group: 'Clothes', quantity: 'person' },
  {
    key: 'swimsuit',
    name: 'Swimsuit',
    group: 'Clothes',
    quantity: 'person',
    rules: { kinds: ['vacation'] },
  },
  {
    key: 'smart-outfit',
    name: 'A smart outfit',
    group: 'Clothes',
    quantity: 'person',
    rules: { kinds: ['event', 'work'] },
  },
  { key: 'sunglasses', name: 'Sunglasses', group: 'Clothes' },
  { key: 'umbrella', name: 'Umbrella', group: 'Clothes' },
  // Electronics
  { key: 'phone-charger', name: 'Phone charger', group: 'Electronics', rules: night },
  { key: 'power-bank', name: 'Power bank', group: 'Electronics' },
  {
    key: 'headphones',
    name: 'Headphones',
    group: 'Electronics',
    rules: { transport: ['bus', 'train', 'plane'] },
  },
  {
    key: 'plug-adapter',
    name: 'Plug adapter',
    group: 'Electronics',
    rules: { scope: 'international' },
  },
  {
    key: 'car-phone-holder',
    name: 'Phone holder and car charger',
    group: 'Electronics',
    rules: { transport: ['car'] },
  },
  // Food and drink
  { key: 'water', name: 'Water bottle', group: 'Food and drink', quantity: 'person' },
  { key: 'snacks', name: 'Snacks for the road', group: 'Food and drink' },
  // Car
  { key: 'fuel', name: 'Full tank', group: 'Car', rules: { transport: ['car'] }, dueHours: 12 },
  {
    key: 'tyres',
    name: 'Tyre pressure checked',
    group: 'Car',
    rules: { transport: ['car'] },
    dueHours: 24,
  },
  {
    key: 'car-kit',
    name: 'First aid kit, extinguisher, warning triangle',
    group: 'Car',
    rules: { transport: ['car'] },
  },
  // For the trip
  {
    key: 'gift',
    name: 'A gift for the hosts',
    group: 'For the trip',
    rules: { kinds: ['family'] },
    dueHours: 24,
  },
  { key: 'laptop', name: 'Laptop and charger', group: 'For the trip', rules: { kinds: ['work'] } },
  // Before leaving home
  { key: 'stove', name: 'Stove and gas off', group: 'Before leaving home' },
  { key: 'windows', name: 'Windows closed', group: 'Before leaving home' },
  { key: 'trash', name: 'Trash taken out', group: 'Before leaving home', rules: night },
  { key: 'unplug', name: 'Appliances unplugged', group: 'Before leaving home', rules: night },
  {
    key: 'plants-pets',
    name: 'Plants watered, pets looked after',
    group: 'Before leaving home',
    rules: night,
  },
  { key: 'keys', name: 'House keys', group: 'Before leaving home' },
];
