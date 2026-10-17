import { messages, plural } from '@/i18n';
import type { Category, Location, Slot } from './types';

/**
 * The words food is read in: places, kinds of things, meals of the day, how long it keeps, and
 * the units and packages amounts are counted in. format.ts reads them; the screens use format.ts.
 */

type Forms = { one: string; few?: string; many?: string; other: string };

/** A unit or package in each language: English singular and plural, Romanian and Russian forms. */
interface UnitWords {
  en: [one: string, many: string];
  ro: Forms;
  ru: Forms;
}

const same = (word: string): Forms => ({ one: word, other: word });
const ru3 = (one: string, few: string, many: string): Forms => ({ one, few, many, other: few });
const ro3 = (one: string, few: string): Forms => ({ one, few, other: `de ${few}` });

/**
 * Every unit the API and the catalog use, by the name stored (English). A name people typed
 * themselves ("bucket") isn't here: it reads as it was written.
 */
export const UNIT_WORDS: Record<string, UnitWords> = {
  pcs: { en: ['pc', 'pcs'], ro: same('buc.'), ru: same('шт.') },
  g: { en: ['g', 'g'], ro: same('g'), ru: same('г') },
  kg: { en: ['kg', 'kg'], ro: same('kg'), ru: same('кг') },
  ml: { en: ['ml', 'ml'], ro: same('ml'), ru: same('мл') },
  l: { en: ['l', 'l'], ro: same('l'), ru: same('л') },
  tsp: { en: ['tsp', 'tsp'], ro: ro3('linguriță', 'lingurițe'), ru: same('ч. л.') },
  tbsp: { en: ['tbsp', 'tbsp'], ro: ro3('lingură', 'linguri'), ru: same('ст. л.') },
  cup: { en: ['cup', 'cups'], ro: ro3('cană', 'căni'), ru: ru3('стакан', 'стакана', 'стаканов') },
  slice: {
    en: ['slice', 'slices'],
    ro: ro3('felie', 'felii'),
    ru: ru3('ломтик', 'ломтика', 'ломтиков'),
  },
  can: { en: ['can', 'cans'], ro: ro3('conservă', 'conserve'), ru: ru3('банка', 'банки', 'банок') },
  bottle: {
    en: ['bottle', 'bottles'],
    ro: ro3('sticlă', 'sticle'),
    ru: ru3('бутылка', 'бутылки', 'бутылок'),
  },
  pack: {
    en: ['pack', 'packs'],
    ro: ro3('pachet', 'pachete'),
    ru: ru3('упаковка', 'упаковки', 'упаковок'),
  },
  jar: { en: ['jar', 'jars'], ro: ro3('borcan', 'borcane'), ru: ru3('банка', 'банки', 'банок') },
  bag: { en: ['bag', 'bags'], ro: ro3('pungă', 'pungi'), ru: ru3('пакет', 'пакета', 'пакетов') },
  box: {
    en: ['box', 'boxes'],
    ro: ro3('cutie', 'cutii'),
    ru: ru3('коробка', 'коробки', 'коробок'),
  },
  tub: { en: ['tub', 'tubs'], ro: ro3('cutie', 'cutii'), ru: ru3('банка', 'банки', 'банок') },
  tray: { en: ['tray', 'trays'], ro: ro3('tavă', 'tăvi'), ru: ru3('лоток', 'лотка', 'лотков') },
  piece: {
    en: ['piece', 'pieces'],
    ro: ro3('bucată', 'bucăți'),
    ru: ru3('кусок', 'куска', 'кусков'),
  },
  square: {
    en: ['square', 'squares'],
    ro: ro3('pătrățel', 'pătrățele'),
    ru: ru3('квадратик', 'квадратика', 'квадратиков'),
  },
  cube: { en: ['cube', 'cubes'], ro: ro3('cub', 'cuburi'), ru: ru3('кубик', 'кубика', 'кубиков') },
  scoop: {
    en: ['scoop', 'scoops'],
    ro: ro3('măsură', 'măsuri'),
    ru: ru3('мерная ложка', 'мерные ложки', 'мерных ложек'),
  },
  shot: { en: ['shot', 'shots'], ro: ro3('shot', 'shoturi'), ru: ru3('шот', 'шота', 'шотов') },
  glass: {
    en: ['glass', 'glasses'],
    ro: ro3('pahar', 'pahare'),
    ru: ru3('бокал', 'бокала', 'бокалов'),
  },
  pump: {
    en: ['pump', 'pumps'],
    ro: ro3('apăsare', 'apăsări'),
    ru: ru3('нажатие', 'нажатия', 'нажатий'),
  },
  jug: { en: ['jug', 'jugs'], ro: ro3('bidon', 'bidoane'), ru: ru3('бутыль', 'бутыли', 'бутылей') },
  dispenser: {
    en: ['dispenser', 'dispensers'],
    ro: ro3('dozator', 'dozatoare'),
    ru: ru3('дозатор', 'дозатора', 'дозаторов'),
  },
  container: {
    en: ['container', 'containers'],
    ro: ro3('recipient', 'recipiente'),
    ru: ru3('ёмкость', 'ёмкости', 'ёмкостей'),
  },
  bar: {
    en: ['bar', 'bars'],
    ro: ro3('tabletă', 'tablete'),
    ru: ru3('плитка', 'плитки', 'плиток'),
  },
  roll: { en: ['roll', 'rolls'], ro: ro3('rolă', 'role'), ru: ru3('рулон', 'рулона', 'рулонов') },
  loaf: {
    en: ['loaf', 'loaves'],
    ro: ro3('pâine', 'pâini'),
    ru: ru3('буханка', 'буханки', 'буханок'),
  },
  pickle: {
    en: ['pickle', 'pickles'],
    ro: ro3('castravete', 'castraveți'),
    ru: ru3('огурец', 'огурца', 'огурцов'),
  },
  dozen: {
    en: ['dozen', 'dozen'],
    ro: ro3('duzină', 'duzine'),
    ru: ru3('десяток', 'десятка', 'десятков'),
  },
  cake: { en: ['cake', 'cakes'], ro: ro3('tort', 'torturi'), ru: ru3('торт', 'торта', 'тортов') },
  pizza: { en: ['pizza', 'pizzas'], ro: ro3('pizza', 'pizza'), ru: ru3('пицца', 'пиццы', 'пицц') },
};

/** Units' names (singular and plural) back to the stored key: "slices" → slice, "loaves" → loaf. */
export const UNIT_KEY: Map<string, string> = new Map(
  Object.entries(UNIT_WORDS).flatMap(([key, words]) => [
    [key, key],
    [words.en[0], key],
    [words.en[1], key],
  ]),
);
UNIT_KEY.set('pc', 'pcs');

/** The Romanian or Russian form for a count (`#`-free forms, so plural() returns them as they are). */
export const unitForm = (forms: Forms, count: number) => plural(count, forms);

const days = {
  en: (n: number) => plural(n, { one: '# day', other: '# days' }),
  ro: (n: number) => plural(n, { one: '# zi', few: '# zile', other: '# de zile' }),
  ru: (n: number) => plural(n, { one: '# день', few: '# дня', many: '# дней', other: '# дня' }),
};

export const formatT = messages({
  en: {
    today: 'Today',
    tomorrow: 'Tomorrow',
    yesterday: 'Yesterday',
    todayInline: 'today',
    tomorrowInline: 'tomorrow',
    yesterdayInline: 'yesterday',
    noDate: 'No date',
    expiredYesterday: 'Expired yesterday',
    expiredAgo: (n: number) => `Expired ${days.en(n)} ago`,
    days: days.en,
    months: (n: number) => plural(n, { one: '# month', other: '# months' }),
    years: (n: number) => plural(n, { one: '# year', other: '# years' }),
    location: {
      fridge: 'Fridge',
      freezer: 'Freezer',
      pantry: 'Shelf',
      garden: 'Garden',
      bathroom: 'Bathroom',
      storage: 'Storage',
      other: 'Other',
    } satisfies Record<Location, string>,
    /** "in the fridge": where something is. */
    locationIn: {
      fridge: 'in the fridge',
      freezer: 'in the freezer',
      pantry: 'on the shelf',
      garden: 'in the garden',
      bathroom: 'in the bathroom',
      storage: 'in the storage',
      other: 'elsewhere',
    } satisfies Record<Location, string>,
    /** "to the fridge": where something goes. */
    locationTo: {
      fridge: 'to the fridge',
      freezer: 'to the freezer',
      pantry: 'to the shelf',
      garden: 'to the garden',
      bathroom: 'to the bathroom',
      storage: 'to the storage',
      other: 'elsewhere',
    } satisfies Record<Location, string>,
    category: {
      produce: 'Fruit & veg',
      bakery: 'Bakery',
      meat: 'Meat',
      fish: 'Fish',
      dairy: 'Dairy & eggs',
      frozen: 'Frozen',
      pantry: 'Pantry',
      spices: 'Spices & sauces',
      drinks: 'Drinks',
      snacks: 'Snacks',
      meals: 'Ready meals',
      bathroom: 'Bathroom',
      cleaning: 'Cleaning',
      laundry: 'Laundry',
      paper: 'Paper',
      pets: 'Pets',
      household: 'Household',
      other: 'Other',
    } satisfies Record<Category, string>,
    slot: {
      breakfast: 'Breakfast',
      lunch: 'Lunch',
      snack: 'Snack',
      dinner: 'Dinner',
    } satisfies Record<Slot, string>,
    /** "Jar of 400 g". */
    onePackage: (word: string, size: string) => `${word} of ${size}`,
    /** "2 bottles of 500 ml" (the count and word already together). */
    manyPackages: (counted: string, size: string) => `${counted} of ${size}`,
    /** A package row: "bottles of 1.5 l" (its count is the stepper beside it). */
    packageRow: (word: string, size: string) => `${word} of ${size}`,
    /** "3 l in 2 bottles". */
    totalIn: (total: string, counted: string) => `${total} in ${counted}`,
    /** Notes the server writes on pieces and in the kitchen's history, by key. */
    note: {
      nowByLevel: 'Now kept by level',
      itemRemoved: 'Item removed',
      removed: 'Removed',
      pouredOut: 'Poured out',
      pouredIn: 'Poured in',
      undone: 'Undone',
      reopened: (meal: string) => `Reopened ${meal}`,
      /** "Fridge → Freezer", then ", keeps until 12 Oct" when the date changed. */
      moved: (from: string, to: string, until?: string) =>
        `${from} → ${to}${until ? `, keeps until ${until}` : ''}`,
      level: { full: 'Full', low: 'Running low', out: 'Ran out' } as Record<string, string>,
      leftoversFrom: (meal: string, date: string) => `From ${meal}, ${date}`,
    },
  },
  ro: {
    today: 'Azi',
    tomorrow: 'Mâine',
    yesterday: 'Ieri',
    todayInline: 'azi',
    tomorrowInline: 'mâine',
    yesterdayInline: 'ieri',
    noDate: 'Fără dată',
    expiredYesterday: 'A expirat ieri',
    expiredAgo: (n: number) => `A expirat acum ${days.ro(n)}`,
    days: days.ro,
    months: (n: number) => plural(n, { one: '# lună', few: '# luni', other: '# de luni' }),
    years: (n: number) => plural(n, { one: '# an', few: '# ani', other: '# de ani' }),
    location: {
      fridge: 'Frigider',
      freezer: 'Congelator',
      pantry: 'Raft',
      garden: 'Grădină',
      bathroom: 'Baie',
      storage: 'Debara',
      other: 'Altundeva',
    },
    locationIn: {
      fridge: 'în frigider',
      freezer: 'în congelator',
      pantry: 'pe raft',
      garden: 'în grădină',
      bathroom: 'în baie',
      storage: 'în debara',
      other: 'altundeva',
    },
    locationTo: {
      fridge: 'în frigider',
      freezer: 'în congelator',
      pantry: 'pe raft',
      garden: 'în grădină',
      bathroom: 'în baie',
      storage: 'în debara',
      other: 'altundeva',
    },
    category: {
      produce: 'Fructe și legume',
      bakery: 'Panificație',
      meat: 'Carne',
      fish: 'Pește',
      dairy: 'Lactate și ouă',
      frozen: 'Congelate',
      pantry: 'Băcănie',
      spices: 'Condimente și sosuri',
      drinks: 'Băuturi',
      snacks: 'Gustări',
      meals: 'Mâncare gata',
      bathroom: 'Baie',
      cleaning: 'Curățenie',
      laundry: 'Spălat rufe',
      paper: 'Hârtie',
      pets: 'Animale',
      household: 'Casă',
      other: 'Altele',
    },
    slot: {
      breakfast: 'Mic dejun',
      lunch: 'Prânz',
      snack: 'Gustare',
      dinner: 'Cină',
    },
    onePackage: (word: string, size: string) => `${word} de ${size}`,
    manyPackages: (counted: string, size: string) => `${counted} de ${size}`,
    packageRow: (word: string, size: string) => `${word} de ${size}`,
    totalIn: (total: string, counted: string) => `${total} în ${counted}`,
    note: {
      nowByLevel: 'Acum se ține după nivel',
      itemRemoved: 'Produs șters',
      removed: 'Scos',
      pouredOut: 'Turnat în alt recipient',
      pouredIn: 'Completat',
      undone: 'Anulat',
      reopened: (meal: string) => `Redeschis: ${meal}`,
      moved: (from: string, to: string, until?: string) =>
        `${from} → ${to}${until ? `, ține până pe ${until}` : ''}`,
      level: { full: 'Plin', low: 'Pe terminate', out: 'S-a terminat' } as Record<string, string>,
      leftoversFrom: (meal: string, date: string) => `Rămas de la ${meal}, ${date}`,
    },
  },
  ru: {
    today: 'Сегодня',
    tomorrow: 'Завтра',
    yesterday: 'Вчера',
    todayInline: 'сегодня',
    tomorrowInline: 'завтра',
    yesterdayInline: 'вчера',
    noDate: 'Без даты',
    expiredYesterday: 'Истёк вчера',
    expiredAgo: (n: number) => `Истёк ${days.ru(n)} назад`,
    days: days.ru,
    months: (n: number) =>
      plural(n, { one: '# месяц', few: '# месяца', many: '# месяцев', other: '# месяца' }),
    years: (n: number) =>
      plural(n, { one: '# год', few: '# года', many: '# лет', other: '# года' }),
    location: {
      fridge: 'Холодильник',
      freezer: 'Морозилка',
      pantry: 'Полка',
      garden: 'Огород',
      bathroom: 'Ванная',
      storage: 'Кладовка',
      other: 'Другое место',
    },
    locationIn: {
      fridge: 'в холодильнике',
      freezer: 'в морозилке',
      pantry: 'на полке',
      garden: 'в огороде',
      bathroom: 'в ванной',
      storage: 'в кладовке',
      other: 'в другом месте',
    },
    locationTo: {
      fridge: 'в холодильник',
      freezer: 'в морозилку',
      pantry: 'на полку',
      garden: 'в огород',
      bathroom: 'в ванную',
      storage: 'в кладовку',
      other: 'в другое место',
    },
    category: {
      produce: 'Овощи и фрукты',
      bakery: 'Хлеб и выпечка',
      meat: 'Мясо',
      fish: 'Рыба',
      dairy: 'Молочное и яйца',
      frozen: 'Заморозка',
      pantry: 'Бакалея',
      spices: 'Специи и соусы',
      drinks: 'Напитки',
      snacks: 'Снеки',
      meals: 'Готовая еда',
      bathroom: 'Ванная',
      cleaning: 'Уборка',
      laundry: 'Стирка',
      paper: 'Бумага',
      pets: 'Питомцы',
      household: 'Для дома',
      other: 'Другое',
    },
    slot: {
      breakfast: 'Завтрак',
      lunch: 'Обед',
      snack: 'Перекус',
      dinner: 'Ужин',
    },
    onePackage: (word: string, size: string) => `${word} ${size}`,
    manyPackages: (counted: string, size: string) => `${counted} по ${size}`,
    packageRow: (word: string, size: string) => `${word} по ${size}`,
    totalIn: (total: string, counted: string) => `${counted}, всего ${total}`,
    note: {
      nowByLevel: 'Теперь учёт по уровню',
      itemRemoved: 'Продукт удалён',
      removed: 'Убрано',
      pouredOut: 'Перелито в другую тару',
      pouredIn: 'Долито',
      undone: 'Отменено',
      reopened: (meal: string) => `Снова открыто: ${meal}`,
      moved: (from: string, to: string, until?: string) =>
        `${from} → ${to}${until ? `, хранится до ${until}` : ''}`,
      level: { full: 'Полный', low: 'Заканчивается', out: 'Закончилось' } as Record<string, string>,
      leftoversFrom: (meal: string, date: string) => `Остатки: ${meal}, ${date}`,
    },
  },
});
