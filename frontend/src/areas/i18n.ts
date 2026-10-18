import { messages } from '@/i18n';

type AreaId =
  | 'shopping'
  | 'training'
  | 'food'
  | 'house'
  | 'travel'
  | 'watching'
  | 'drinks'
  | 'closet';
type AreaWords = Record<AreaId, { name: string; summary: string }>;

/** The life areas' names and lines, and the tile's own words. */
const en = {
  areas: {
    shopping: { name: 'Shopping', summary: 'Groceries and the house, store by store.' },
    training: { name: 'Training', summary: 'Workouts and how they add up, week by week.' },
    food: { name: 'Food', summary: 'Meals, groceries and what’s for dinner.' },
    house: { name: 'House', summary: 'Bathroom, cleaning, paper, pets.' },
    travel: { name: 'Travel', summary: 'Trips, bags and what to pack.' },
    watching: { name: 'Watching', summary: 'Shows and films, episode by episode.' },
    drinks: { name: 'Drinks', summary: 'The cellar, and every glass worth remembering.' },
    closet: { name: 'Virtual Closet', summary: 'Every piece, where it lives, how to care for it.' },
  } as AreaWords,
  soon: 'Soon',
  building: (name: string) => `${name} is being built`,
  buildingDetail: 'Its screen arrives in a coming update.',
  yourAreas: 'Your areas',
};

const ro: typeof en = {
  areas: {
    shopping: { name: 'Cumpărături', summary: 'Alimente și cele pentru casă, pe magazine.' },
    training: {
      name: 'Antrenament',
      summary: 'Antrenamentele și progresul, săptămână de săptămână.',
    },
    food: { name: 'Mâncare', summary: 'Mese, alimente și ce e la cină.' },
    house: { name: 'Casă', summary: 'Baie, curățenie, hârtie, animale.' },
    travel: { name: 'Călătorii', summary: 'Excursii, bagaje și ce să iei cu tine.' },
    watching: { name: 'Filme și seriale', summary: 'Ce ai văzut, episod cu episod.' },
    drinks: { name: 'Băuturi', summary: 'Colecția și fiecare pahar care merită ținut minte.' },
    closet: { name: 'Dulap virtual', summary: 'Fiecare lucru, unde stă și cum se îngrijește.' },
  },
  soon: 'În curând',
  building: (name: string) => `${name}: în lucru`,
  buildingDetail: 'Ecranul vine într-una din actualizările următoare.',
  yourAreas: 'Secțiunile tale',
};

const ru: typeof en = {
  areas: {
    shopping: { name: 'Покупки', summary: 'Продукты и всё для дома, по магазинам.' },
    training: { name: 'Тренировки', summary: 'Тренировки и прогресс, неделя за неделей.' },
    food: { name: 'Еда', summary: 'Блюда, продукты и что на ужин.' },
    house: { name: 'Дом', summary: 'Ванная, уборка, бумага, питомцы.' },
    travel: { name: 'Поездки', summary: 'Даты, сумки и что взять с собой.' },
    watching: { name: 'Кино и сериалы', summary: 'Что вы смотрели, серия за серией.' },
    drinks: { name: 'Напитки', summary: 'Коллекция и каждый бокал, который стоит запомнить.' },
    closet: { name: 'Виртуальный шкаф', summary: 'Каждая вещь, где она лежит и как за ней ухаживать.' },
  },
  soon: 'Скоро',
  building: (name: string) => `${name}: в разработке`,
  buildingDetail: 'Экран появится в одном из следующих обновлений.',
  yourAreas: 'Ваши разделы',
};

/** A plain lookup: the registry reads it outside components. */
export const areasT = messages({ en, ro, ru });
export type { AreaId };
