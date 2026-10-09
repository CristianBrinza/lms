import {
  BackpackIcon,
  BusIcon,
  CableIcon,
  HeadphonesIcon,
  PlugIcon,
  PowerBankIcon,
  CarIcon,
  FlightIcon,
  LuggageIcon,
  TrainIcon,
  type IconComponent,
} from '@/components/ui/icons';
import { addDays, daysBetween, localDate, parseDay } from '@/food/format';
import type {
  Bag,
  BagKind,
  GearKind,
  Kind,
  Money,
  Quantity,
  Rules,
  Scope,
  Transport,
} from './types';

export const SCOPE_LABEL: Record<Scope, string> = {
  national: 'In Moldova',
  international: 'Abroad',
};

export const KIND_LABEL: Record<Kind, string> = {
  vacation: 'Holiday',
  family: 'Visiting family',
  day: 'Day trip',
  event: 'Event',
  work: 'Work',
  other: 'Other',
};

export const TRANSPORT_LABEL: Record<Transport, string> = {
  car: 'Car',
  bus: 'Bus',
  train: 'Train',
  plane: 'Plane',
  other: 'Other',
};

export const TRANSPORT_ICON: Record<Transport, IconComponent> = {
  car: CarIcon,
  bus: BusIcon,
  train: TrainIcon,
  plane: FlightIcon,
  other: LuggageIcon,
};

export const BAG_LABEL: Record<BagKind, string> = {
  backpack: 'Backpack',
  handbag: 'Handbag',
  'carry-on': 'Cabin bag',
  suitcase: 'Suitcase',
  duffel: 'Duffel bag',
  other: 'Other',
};

export const BAG_ICON = (kind: BagKind): IconComponent =>
  kind === 'backpack' ? BackpackIcon : LuggageIcon;

export const QUANTITY_LABEL: Record<Quantity, string> = {
  one: 'One',
  person: 'One each',
  day: 'One a day',
  person_day: 'One each a day',
};

export interface TripShape {
  scope: Scope;
  kind: Kind;
  transport: Transport;
  days: number;
  people: number;
}

/** The same rules as the API (backend/src/modules/travel/catalog.ts), for the live preview. */
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

/** "Only abroad · nights away · by car", or "Every trip". */
export function rulesLabel(rules: Rules): string {
  const parts = [
    rules.scope ? (rules.scope === 'international' ? 'abroad' : 'in Moldova') : null,
    rules.overnight === true ? 'nights away' : rules.overnight === false ? 'day trips' : null,
    rules.transport?.length
      ? `by ${rules.transport.map((t) => TRANSPORT_LABEL[t].toLowerCase()).join(' or ')}`
      : null,
    rules.kinds?.length ? rules.kinds.map((k) => KIND_LABEL[k].toLowerCase()).join(' or ') : null,
    rules.minDays ? `${rules.minDays}+ days` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Every trip';
}

/** Cabin limits people fly with from Chișinău (cm, any orientation). */
const CABIN_LIMITS: Array<{ name: string; size: [number, number, number] }> = [
  { name: 'Wizz Air free bag', size: [40, 30, 20] },
  { name: 'Ryanair free bag', size: [40, 25, 20] },
  { name: 'Cabin trolley', size: [55, 40, 23] },
];

/** Which cabin limits a bag fits ("Wizz Air free bag"), from its measurements. */
export function bagFits(bag: Pick<Bag, 'lengthCm' | 'widthCm' | 'heightCm'>): string[] {
  if (!bag.lengthCm || !bag.widthCm || !bag.heightCm) return [];
  const dims = [bag.lengthCm, bag.widthCm, bag.heightCm].sort((a, b) => b - a);
  return CABIN_LIMITS.filter(({ size }) => {
    const limit = [...size].sort((a, b) => b - a);
    return dims.every((d, i) => d <= limit[i]!);
  }).map((l) => l.name);
}

export const bagSize = (bag: Pick<Bag, 'lengthCm' | 'widthCm' | 'heightCm'>) =>
  bag.lengthCm && bag.widthCm && bag.heightCm
    ? `${bag.lengthCm}×${bag.widthCm}×${bag.heightCm} cm`
    : null;

const short = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** "Sat 18 Oct" or "18 – 25 Oct". */
export function tripDates(start: string, end: string): string {
  if (start === end) return short.format(parseDay(start));
  const [a, b] = [parseDay(start), parseDay(end)];
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${dayMonth.format(b)}`;
  return `${dayMonth.format(a)} – ${dayMonth.format(b)}`;
}

/** "In 8 days", "Tomorrow", "Today", "On the way", "Back 3 days ago". */
export function tripWhen(start: string, end: string, today: string): string {
  const until = daysBetween(today, start);
  if (until > 1) return `In ${until} days`;
  if (until === 1) return 'Tomorrow';
  if (until === 0) return 'Today';
  if (daysBetween(today, end) >= 0) return 'On the way';
  const ago = daysBetween(end, today);
  return ago === 1 ? 'Back yesterday' : `Back ${ago} days ago`;
}

/** Tomorrow, for a new trip's first guess. */
export const tomorrow = () => addDays(localDate(), 1);

const dueDay = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** "by Sat 17 Oct, 05:30". */
export function dueLabel(dueAt: string): string {
  return `by ${dueDay.format(parseDay(dueAt.slice(0, 10)))}, ${dueAt.slice(11, 16)}`;
}

/** Late (past due), soon (within a day) or later, against the local clock. */
export function dueState(dueAt: string, now = new Date()): 'late' | 'soon' | 'later' {
  const at = new Date(`${dueAt}:00`).getTime();
  if (at < now.getTime()) return 'late';
  return at - now.getTime() < 86_400_000 ? 'soon' : 'later';
}

/** Deadlines offered on the packing list, in hours before leaving. */
export const DUE_OPTIONS: Array<{ hours: number | null; label: string }> = [
  { hours: null, label: 'No deadline' },
  { hours: 3, label: '3 hours before leaving' },
  { hours: 12, label: 'The evening before' },
  { hours: 24, label: 'A day before' },
  { hours: 48, label: 'Two days before' },
  { hours: 72, label: 'Three days before' },
  { hours: 168, label: 'A week before' },
  { hours: 336, label: 'Two weeks before' },
  { hours: 720, label: 'A month before' },
];

export const dueText = (hours: number | null) =>
  DUE_OPTIONS.find((o) => o.hours === hours)?.label ??
  (hours === null ? 'No deadline' : `${hours} h before leaving`);

/** "2 000 MDL + 300 EUR". */
export function moneyTotal(money: Money[]): string {
  const sums = new Map<string, number>();
  for (const m of money) if (m.amount) sums.set(m.currency, (sums.get(m.currency) ?? 0) + m.amount);
  return [...sums]
    .map(([c, n]) => `${n.toLocaleString('en-GB').replace(/,/g, ' ')} ${c}`)
    .join(' + ');
}

export const GEAR_LABEL: Record<GearKind, string> = {
  'power-bank': 'Power bank',
  charger: 'Charger',
  cable: 'Cable',
  adapter: 'Adapter',
  headphones: 'Headphones',
  other: 'Other',
};

export const GEAR_ICON: Record<GearKind, IconComponent> = {
  'power-bank': PowerBankIcon,
  charger: PlugIcon,
  cable: CableIcon,
  adapter: PlugIcon,
  headphones: HeadphonesIcon,
  other: LuggageIcon,
};
