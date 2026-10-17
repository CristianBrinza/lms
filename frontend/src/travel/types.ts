import type { Translations } from '@/i18n';
import type { Person } from '@/training/types';

export type Scope = 'national' | 'international';
export type Kind = 'vacation' | 'family' | 'day' | 'event' | 'work' | 'other';
export type Transport = 'car' | 'bus' | 'train' | 'plane' | 'other';
export type BagKind = 'backpack' | 'handbag' | 'carry-on' | 'suitcase' | 'duffel' | 'other';
export type Quantity = 'one' | 'person' | 'day' | 'person_day';

export interface Rules {
  scope?: Scope;
  overnight?: boolean;
  transport?: Transport[];
  kinds?: Kind[];
  minDays?: number;
}

export interface Bag {
  id: string;
  name: string;
  kind: BagKind;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  litres: number | null;
  note: string;
  /** The name and note in other languages. */
  translations: Translations;
}

export interface PackingItem {
  id: string;
  name: string;
  group: string;
  quantity: Quantity;
  rules: Rules;
  /** Done by so many hours before leaving; null: whenever. */
  dueHours: number | null;
  preset: string | null;
  /** The name in other languages. */
  translations: Translations;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  scope: Scope;
  kind: Kind;
  transport: Transport;
  startDate: string;
  endDate: string;
  departTime: string | null;
  arriveDate: string | null;
  arriveTime: string | null;
  backDate: string | null;
  backTime: string | null;
  returnTime: string | null;
  money: Money[];
  gear: Array<{ gearId: string; count: number }>;
  days: number;
  people: string[];
  guests: number;
  travellers: number;
  bagIds: string[];
  overrides: Record<string, boolean>;
  note: string;
  /** The name, destination and note in other languages. */
  translations: Translations;
  packed: { done: number; total: number };
}

export interface TripCheck {
  id: string;
  itemId: string | null;
  name: string;
  group: string;
  quantity: number;
  checked: boolean;
  /** Local YYYY-MM-DDTHH:MM. */
  dueAt: string | null;
  toBuy: boolean;
  listedAt: string | null;
  /** Its packing-list item's name in other languages. */
  translations: Translations;
}

export type GearKind = 'power-bank' | 'charger' | 'cable' | 'adapter' | 'headphones' | 'other';

/** Power banks, chargers, cables: with their connectors and how many the household has. */
export interface Gear {
  id: string;
  name: string;
  kind: GearKind;
  connectors: string[];
  count: number;
  note: string;
  /** The name and note in other languages. */
  translations: Translations;
}

export interface TravelHome {
  trips: Trip[];
  bags: Bag[];
  gear: Gear[];
  items: PackingItem[];
  people: Person[];
  options: { groups: string[]; connectors: string[] };
}

export type TripInput = Omit<Trip, 'id' | 'days' | 'travellers' | 'packed'>;
export type BagInput = Omit<Bag, 'id' | 'litres'>;
export type ItemInput = Omit<PackingItem, 'id' | 'preset'>;

/** Cash or a card for a trip: how much, in which currency, and whether it's ready. */
export interface Money {
  id: string;
  kind: 'cash' | 'card';
  label: string;
  currency: string;
  amount: number | null;
  ready: boolean;
}

export type GearInput = Omit<Gear, 'id'>;
