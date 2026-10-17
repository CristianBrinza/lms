import { messages } from '@/i18n';

type AreaId = 'shopping' | 'training' | 'food' | 'house' | 'travel' | 'watching';
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
  },
  soon: 'Скоро',
  building: (name: string) => `${name}: в разработке`,
  buildingDetail: 'Экран появится в одном из следующих обновлений.',
  yourAreas: 'Ваши разделы',
};

/** A plain lookup: the registry reads it outside components. */
export const areasT = messages({ en, ro, ru });
export type { AreaId };
