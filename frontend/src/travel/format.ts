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
import {
  formatList,
  formatNumber,
  getLocale,
  intlLocale,
  LOCALES,
  type Translations,
} from '@/i18n';
import { useTravelT } from './i18n';
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

const t = useTravelT;

export const scopeLabel = (scope: Scope) => t().scopes[scope];
export const kindLabel = (kind: Kind) => t().kinds[kind];
export const transportLabel = (transport: Transport) => t().transports[transport];
export const bagLabel = (kind: BagKind) => t().bagKinds[kind];
export const gearLabel = (kind: GearKind) => t().gearKinds[kind];
export const quantityLabel = (quantity: Quantity) => t().quantities[quantity];
/** A packing-list section ("Documents", as the API names it) in the current language. */
export const groupLabel = (group: string) => t().groups[group] ?? group;
/** A connector: the standards as they are (USB-C), the words translated ("EU plug"). */
export const connectorLabel = (connector: string) => t().connectors[connector] ?? connector;

export const TRANSPORT_ICON: Record<Transport, IconComponent> = {
  car: CarIcon,
  bus: BusIcon,
  train: TrainIcon,
  plane: FlightIcon,
  other: LuggageIcon,
};

export const BAG_ICON = (kind: BagKind): IconComponent =>
  kind === 'backpack' ? BackpackIcon : LuggageIcon;

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

/** "abroad · nights away · by car or by bus", or "Every trip". */
export function rulesLabel(rules: Rules): string {
  const words = t().rules;
  const parts = [
    rules.scope ? (rules.scope === 'international' ? words.abroad : words.inMoldova) : null,
    rules.overnight === true ? words.nightsAway : rules.overnight === false ? words.dayTrips : null,
    rules.transport?.length
      ? formatList(
          rules.transport.map((x) => words.by[x]),
          'disjunction',
        )
      : null,
    rules.kinds?.length
      ? formatList(
          rules.kinds.map((k) => kindLabel(k).toLocaleLowerCase(intlLocale())),
          'disjunction',
        )
      : null,
    rules.minDays ? words.minDays(rules.minDays) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : words.everyTrip;
}

/** Cabin limits people fly with from Chișinău (cm, any orientation). */
const CABIN_LIMITS: Array<{ key: 'wizz' | 'ryanair' | 'trolley'; size: [number, number, number] }> =
  [
    { key: 'wizz', size: [40, 30, 20] },
    { key: 'ryanair', size: [40, 25, 20] },
    { key: 'trolley', size: [55, 40, 23] },
  ];

/** Which cabin limits a bag fits ("Wizz Air free bag"), from its measurements. */
export function bagFits(bag: Pick<Bag, 'lengthCm' | 'widthCm' | 'heightCm'>): string[] {
  if (!bag.lengthCm || !bag.widthCm || !bag.heightCm) return [];
  const dims = [bag.lengthCm, bag.widthCm, bag.heightCm].sort((a, b) => b - a);
  return CABIN_LIMITS.filter(({ size }) => {
    const limit = [...size].sort((a, b) => b - a);
    return dims.every((d, i) => d <= limit[i]!);
  }).map((l) => t().cabin[l.key]);
}

/** "Fits Wizz Air free bag" (or several, as a list). */
export const fitsLabel = (names: string[]) => t().fits(formatList(names));

export const bagSize = (bag: Pick<Bag, 'lengthCm' | 'widthCm' | 'heightCm'>) =>
  bag.lengthCm && bag.widthCm && bag.heightCm
    ? `${formatNumber(bag.lengthCm)}×${formatNumber(bag.widthCm)}×${formatNumber(bag.heightCm)} ${t().cm}`
    : null;

export const litresLabel = (litres: number) => t().litres(formatNumber(litres));

const shortDay = () =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: 'numeric', month: 'short' });
const dayMonth = () => new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' });

/** "Sat 18 Oct" or "18 – 25 Oct". */
export function tripDates(start: string, end: string): string {
  if (start === end) return shortDay().format(parseDay(start));
  const [a, b] = [parseDay(start), parseDay(end)];
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${dayMonth().format(b)}`;
  return `${dayMonth().format(a)} – ${dayMonth().format(b)}`;
}

/** "In 8 days", "Tomorrow", "Today", "On the way", "Back 3 days ago". */
export function tripWhen(start: string, end: string, today: string): string {
  const words = t().when;
  const until = daysBetween(today, start);
  if (until > 1) return words.inDays(until);
  if (until === 1) return words.tomorrow;
  if (until === 0) return words.today;
  if (daysBetween(today, end) >= 0) return words.onTheWay;
  const ago = daysBetween(end, today);
  return ago === 1 ? words.backYesterday : words.backAgo(ago);
}

/** Tomorrow, for a new trip's first guess. */
export const tomorrow = () => addDays(localDate(), 1);

/** "by Sat 17 Oct, 05:30". */
export function dueLabel(dueAt: string): string {
  return t().due.by(shortDay().format(parseDay(dueAt.slice(0, 10))), dueAt.slice(11, 16));
}

/** Late (past due), soon (within a day) or later, against the local clock. */
export function dueState(dueAt: string, now = new Date()): 'late' | 'soon' | 'later' {
  const at = new Date(`${dueAt}:00`).getTime();
  if (at < now.getTime()) return 'late';
  return at - now.getTime() < 86_400_000 ? 'soon' : 'later';
}

/** Deadlines offered on the packing list, in hours before leaving. */
const DUE_HOURS = [3, 12, 24, 48, 72, 168, 336, 720];

export const dueOptions = (): Array<{ hours: number | null; label: string }> => [
  { hours: null, label: t().due.none },
  ...DUE_HOURS.map((hours) => ({ hours, label: t().due.options[hours]! })),
];

export const dueText = (hours: number | null) =>
  hours === null ? t().due.none : (t().due.options[hours] ?? t().due.hours(hours));

/** An amount of money: "2 000" (spaces between thousands, in every language). */
export const amountText = (n: number) =>
  getLocale() === 'en' ? formatNumber(n).replace(/,/g, ' ') : formatNumber(n);

/** "2 000 MDL + 300 EUR". */
export function moneyTotal(money: Money[]): string {
  const sums = new Map<string, number>();
  for (const m of money) if (m.amount) sums.set(m.currency, (sums.get(m.currency) ?? 0) + m.amount);
  return [...sums].map(([c, n]) => `${amountText(n)} ${c}`).join(' + ');
}

export const GEAR_ICON: Record<GearKind, IconComponent> = {
  'power-bank': PowerBankIcon,
  charger: PlugIcon,
  cable: CableIcon,
  adapter: PlugIcon,
  headphones: HeadphonesIcon,
  other: LuggageIcon,
};

/**
 * What an editor sends as `translations`: what is filled in now, plus an empty text for each field
 * that was there before and is gone, so the API clears it (it merges per field).
 */
export function translationsPatch(
  before: Translations | null | undefined,
  after: Translations,
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry: Record<string, unknown> = { ...(after[locale] ?? {}) };
    for (const key of Object.keys(before?.[locale] ?? {})) if (!(key in entry)) entry[key] = '';
    if (Object.keys(entry).length) out[locale] = entry;
  }
  return out;
}
