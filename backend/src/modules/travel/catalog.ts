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
  /** The name in Romanian and in Russian. */
  ro: string;
  ru: string;
  group: (typeof GROUPS)[number];
  quantity?: Quantity;
  rules?: Rules;
  /** Done by so many hours before leaving (a check-in, a vignette, a booking). */
  dueHours?: number;
}

/** A preset item's translations, as stored on the household's copy. */
export const presetTranslations = (item: Pick<PresetItem, 'ro' | 'ru'>) => ({
  ro: { name: item.ro },
  ru: { name: item.ru },
});

const night = { overnight: true } as const;

/**
 * Bump when the list learns new items (or new words for them): each household gets the new ones
 * once. 3: the names in Romanian and Russian.
 */
export const TRAVEL_CATALOG_VERSION = 3;

export const PRESET_ITEMS: readonly PresetItem[] = [
  // Documents
  {
    key: 'id-card',
    name: 'ID card',
    ro: 'Buletin de identitate',
    ru: 'Удостоверение личности',
    group: 'Documents',
    quantity: 'person',
  },
  {
    key: 'passport',
    name: 'Passport',
    ro: 'Pașaport',
    ru: 'Паспорт',
    group: 'Documents',
    quantity: 'person',
    rules: { scope: 'international' },
    dueHours: 720,
  },
  {
    key: 'driving-licence',
    name: 'Driving licence',
    ro: 'Permis de conducere',
    ru: 'Водительские права',
    group: 'Documents',
    rules: { transport: ['car'] },
  },
  {
    key: 'car-papers',
    name: 'Car papers and insurance',
    ro: 'Actele mașinii și asigurarea',
    ru: 'Документы на машину и страховка',
    group: 'Documents',
    rules: { transport: ['car'] },
  },
  {
    key: 'green-card',
    name: 'Green Card insurance',
    ro: 'Asigurare Carte Verde',
    ru: 'Страховка «Зелёная карта»',
    group: 'Documents',
    rules: { transport: ['car'], scope: 'international' },
    dueHours: 72,
  },
  {
    key: 'vignette',
    name: 'Road vignette (rovinieta) bought',
    ro: 'Rovinieta cumpărată',
    ru: 'Дорожная виньетка (ровиньета) куплена',
    group: 'Documents',
    rules: { transport: ['car'], scope: 'international' },
    dueHours: 24,
  },
  {
    key: 'tickets',
    name: 'Tickets or boarding passes',
    ro: 'Bilete sau carduri de îmbarcare',
    ru: 'Билеты или посадочные талоны',
    group: 'Documents',
    quantity: 'person',
    rules: { transport: ['bus', 'train', 'plane'] },
    dueHours: 168,
  },
  {
    key: 'online-check-in',
    name: 'Online check-in done',
    ro: 'Check-in online făcut',
    ru: 'Онлайн-регистрация пройдена',
    group: 'Documents',
    rules: { transport: ['plane'] },
    dueHours: 24,
  },
  {
    key: 'travel-insurance',
    name: 'Travel medical insurance',
    ro: 'Asigurare medicală de călătorie',
    ru: 'Медицинская страховка для поездки',
    group: 'Documents',
    quantity: 'person',
    rules: { scope: 'international' },
    dueHours: 72,
  },
  {
    key: 'bookings',
    name: 'Hotel bookings',
    ro: 'Rezervări la hotel',
    ru: 'Бронь отеля',
    group: 'Documents',
    rules: { ...night, kinds: ['vacation', 'work', 'event'] },
    dueHours: 336,
  },
  {
    key: 'event-tickets',
    name: 'Event tickets or reservation',
    ro: 'Bilete sau rezervare la eveniment',
    ru: 'Билеты или бронь на мероприятие',
    group: 'Documents',
    rules: { kinds: ['event'] },
    dueHours: 168,
  },
  // Money
  { key: 'bank-card', name: 'Bank card', ro: 'Card bancar', ru: 'Банковская карта', group: 'Money' },
  { key: 'cash', name: 'Some cash', ro: 'Niște bani cash', ru: 'Немного наличных', group: 'Money' },
  {
    key: 'foreign-cash',
    name: 'Cash in the local currency',
    ro: 'Bani cash în moneda locală',
    ru: 'Наличные в местной валюте',
    group: 'Money',
    rules: { scope: 'international' },
    dueHours: 48,
  },
  // Health
  {
    key: 'medicines',
    name: 'Your usual medicines',
    ro: 'Medicamentele pe care le iei de obicei',
    ru: 'Лекарства, которые вы обычно принимаете',
    group: 'Health',
  },
  { key: 'painkillers', name: 'Painkillers', ro: 'Analgezice', ru: 'Обезболивающее', group: 'Health' },
  { key: 'plasters', name: 'Plasters', ro: 'Plasturi', ru: 'Пластыри', group: 'Health' },
  {
    key: 'motion-sickness',
    name: 'Travel sickness pills',
    ro: 'Pastile contra răului de drum',
    ru: 'Таблетки от укачивания',
    group: 'Health',
    rules: { transport: ['car', 'bus'] },
  },
  {
    key: 'sunscreen',
    name: 'Sunscreen',
    ro: 'Cremă cu protecție solară',
    ru: 'Солнцезащитный крем',
    group: 'Health',
    rules: { kinds: ['vacation'] },
  },
  {
    key: 'hand-sanitiser',
    name: 'Hand sanitiser',
    ro: 'Dezinfectant pentru mâini',
    ru: 'Антисептик для рук',
    group: 'Health',
  },
  // Toiletries
  { key: 'wet-wipes', name: 'Wet wipes', ro: 'Șervețele umede', ru: 'Влажные салфетки', group: 'Toiletries' },
  {
    key: 'tissues',
    name: 'Tissues',
    ro: 'Șervețele de hârtie',
    ru: 'Бумажные платочки',
    group: 'Toiletries',
  },
  {
    key: 'toothbrush',
    name: 'Toothbrush',
    ro: 'Periuță de dinți',
    ru: 'Зубная щётка',
    group: 'Toiletries',
    quantity: 'person',
    rules: night,
  },
  { key: 'toothpaste', name: 'Toothpaste', ro: 'Pastă de dinți', ru: 'Зубная паста', group: 'Toiletries', rules: night },
  { key: 'shampoo', name: 'Shampoo', ro: 'Șampon', ru: 'Шампунь', group: 'Toiletries', rules: night },
  { key: 'shower-gel', name: 'Shower gel', ro: 'Gel de duș', ru: 'Гель для душа', group: 'Toiletries', rules: night },
  { key: 'deodorant', name: 'Deodorant', ro: 'Deodorant', ru: 'Дезодорант', group: 'Toiletries', rules: night },
  { key: 'razor', name: 'Razor', ro: 'Aparat de ras', ru: 'Бритва', group: 'Toiletries', rules: night },
  { key: 'hairbrush', name: 'Hairbrush', ro: 'Perie de păr', ru: 'Расчёска', group: 'Toiletries', rules: night },
  {
    key: 'liquids-bag',
    name: 'Liquids in 100 ml bottles, in a clear 1 L bag',
    ro: 'Lichide în flacoane de 100 ml, într-o pungă transparentă de 1 L',
    ru: 'Жидкости во флаконах по 100 мл, в прозрачном пакете на 1 л',
    group: 'Toiletries',
    rules: { transport: ['plane'] },
  },
  // Clothes
  {
    key: 'underwear',
    name: 'Underwear',
    ro: 'Lenjerie intimă',
    ru: 'Нижнее бельё',
    group: 'Clothes',
    quantity: 'person_day',
    rules: night,
  },
  { key: 'socks', name: 'Socks', ro: 'Șosete', ru: 'Носки', group: 'Clothes', quantity: 'person_day', rules: night },
  {
    key: 't-shirts',
    name: 'T-shirts',
    ro: 'Tricouri',
    ru: 'Футболки',
    group: 'Clothes',
    quantity: 'person_day',
    rules: night,
  },
  {
    key: 'trousers',
    name: 'Trousers or shorts',
    ro: 'Pantaloni lungi sau scurți',
    ru: 'Брюки или шорты',
    group: 'Clothes',
    quantity: 'person',
    rules: { minDays: 3 },
  },
  { key: 'pyjamas', name: 'Pyjamas', ro: 'Pijama', ru: 'Пижама', group: 'Clothes', quantity: 'person', rules: night },
  { key: 'jacket', name: 'Jacket', ro: 'Geacă', ru: 'Куртка', group: 'Clothes', quantity: 'person' },
  {
    key: 'shoes',
    name: 'Comfortable shoes',
    ro: 'Încălțăminte comodă',
    ru: 'Удобная обувь',
    group: 'Clothes',
    quantity: 'person',
  },
  {
    key: 'swimsuit',
    name: 'Swimsuit',
    ro: 'Costum de baie',
    ru: 'Купальник или плавки',
    group: 'Clothes',
    quantity: 'person',
    rules: { kinds: ['vacation'] },
  },
  {
    key: 'smart-outfit',
    name: 'A smart outfit',
    ro: 'O ținută elegantă',
    ru: 'Нарядная одежда',
    group: 'Clothes',
    quantity: 'person',
    rules: { kinds: ['event', 'work'] },
  },
  { key: 'sunglasses', name: 'Sunglasses', ro: 'Ochelari de soare', ru: 'Солнцезащитные очки', group: 'Clothes' },
  { key: 'umbrella', name: 'Umbrella', ro: 'Umbrelă', ru: 'Зонт', group: 'Clothes' },
  // Electronics
  {
    key: 'phone-charger',
    name: 'Phone charger',
    ro: 'Încărcător de telefon',
    ru: 'Зарядка для телефона',
    group: 'Electronics',
    rules: night,
  },
  { key: 'power-bank', name: 'Power bank', ro: 'Baterie externă', ru: 'Пауэрбанк', group: 'Electronics' },
  {
    key: 'headphones',
    name: 'Headphones',
    ro: 'Căști',
    ru: 'Наушники',
    group: 'Electronics',
    rules: { transport: ['bus', 'train', 'plane'] },
  },
  {
    key: 'plug-adapter',
    name: 'Plug adapter',
    ro: 'Adaptor de priză',
    ru: 'Переходник для розетки',
    group: 'Electronics',
    rules: { scope: 'international' },
  },
  {
    key: 'car-phone-holder',
    name: 'Phone holder and car charger',
    ro: 'Suport de telefon și încărcător auto',
    ru: 'Держатель для телефона и автозарядка',
    group: 'Electronics',
    rules: { transport: ['car'] },
  },
  // Food and drink
  {
    key: 'water',
    name: 'Water bottle',
    ro: 'O sticlă de apă',
    ru: 'Бутылка воды',
    group: 'Food and drink',
    quantity: 'person',
  },
  {
    key: 'snacks',
    name: 'Snacks for the road',
    ro: 'Gustări pentru drum',
    ru: 'Перекус в дорогу',
    group: 'Food and drink',
  },
  // Car
  {
    key: 'fuel',
    name: 'Full tank',
    ro: 'Rezervorul plin',
    ru: 'Полный бак',
    group: 'Car',
    rules: { transport: ['car'] },
    dueHours: 12,
  },
  {
    key: 'tyres',
    name: 'Tyre pressure checked',
    ro: 'Presiunea în roți verificată',
    ru: 'Давление в шинах проверено',
    group: 'Car',
    rules: { transport: ['car'] },
    dueHours: 24,
  },
  {
    key: 'car-kit',
    name: 'First aid kit, extinguisher, warning triangle',
    ro: 'Trusă medicală, extinctor, triunghi reflectorizant',
    ru: 'Аптечка, огнетушитель, знак аварийной остановки',
    group: 'Car',
    rules: { transport: ['car'] },
  },
  // For the trip
  {
    key: 'gift',
    name: 'A gift for the hosts',
    ro: 'Un cadou pentru gazde',
    ru: 'Подарок для хозяев',
    group: 'For the trip',
    rules: { kinds: ['family'] },
    dueHours: 24,
  },
  {
    key: 'laptop',
    name: 'Laptop and charger',
    ro: 'Laptop și încărcător',
    ru: 'Ноутбук и зарядка',
    group: 'For the trip',
    rules: { kinds: ['work'] },
  },
  // Before leaving home
  {
    key: 'stove',
    name: 'Stove and gas off',
    ro: 'Aragazul și gazul închise',
    ru: 'Плита и газ выключены',
    group: 'Before leaving home',
  },
  {
    key: 'windows',
    name: 'Windows closed',
    ro: 'Geamurile închise',
    ru: 'Окна закрыты',
    group: 'Before leaving home',
  },
  {
    key: 'trash',
    name: 'Trash taken out',
    ro: 'Gunoiul dus',
    ru: 'Мусор вынесен',
    group: 'Before leaving home',
    rules: night,
  },
  {
    key: 'unplug',
    name: 'Appliances unplugged',
    ro: 'Aparatele scoase din priză',
    ru: 'Приборы отключены от розетки',
    group: 'Before leaving home',
    rules: night,
  },
  {
    key: 'plants-pets',
    name: 'Plants watered, pets looked after',
    ro: 'Florile udate, animalele în grijă',
    ru: 'Цветы политы, о питомцах позаботились',
    group: 'Before leaving home',
    rules: night,
  },
  {
    key: 'keys',
    name: 'House keys',
    ro: 'Cheile de la casă',
    ru: 'Ключи от дома',
    group: 'Before leaving home',
  },
];
