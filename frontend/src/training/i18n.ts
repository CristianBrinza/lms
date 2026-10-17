import { messages, plural } from '@/i18n';

/**
 * Training's shared words: the labels of muscles, categories and levels, and the units every
 * screen writes (reps, sets, s, min, km, kg). Screens keep their own copy in `<Screen>.i18n.ts`
 * next to them; what several screens say lives here.
 *
 * Glossary, kept the same on every screen:
 *   workout   antrenament        тренировка
 *   routine   rutină             программа
 *   exercise  exercițiu          упражнение
 *   equipment echipament         инвентарь
 *   set       serie              подход
 *   rep       repetare           повторение
 *   rest      pauză              отдых
 *   round     rundă              круг
 *   warm-up   încălzire          разминка
 *   cool-down revenire           заминка
 *   best      record personal    личный рекорд
 *   each side pe fiecare parte   на каждую сторону
 */

const en = {
  muscle: {
    chest: 'Chest',
    back: 'Back',
    shoulders: 'Shoulders',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Forearms',
    core: 'Abs',
    obliques: 'Obliques',
    glutes: 'Glutes',
    quads: 'Quads',
    hamstrings: 'Hamstrings',
    calves: 'Calves',
    hips: 'Hips',
    heart: 'Heart',
  },
  category: {
    strength: 'Strength',
    cardio: 'Cardio',
    core: 'Core',
    mobility: 'Mobility',
    stretch: 'Stretching',
  },
  focus: {
    full: 'Full body',
    upper: 'Upper body',
    lower: 'Legs',
    core: 'Core',
    cardio: 'Cardio',
    mobility: 'Mobility',
  },
  block: {
    warmup: 'Warm-up',
    main: 'Workout',
    cooldown: 'Cool-down',
  },
  status: {
    planned: 'Planned',
    active: 'Under way',
    done: 'Done',
    skipped: 'Skipped',
  },
  level: ['', 'Easy', 'Medium', 'Hard'] as string[],
  impact: { low: 'Low impact', high: 'High impact' },
  measure: { reps: 'Reps', time: 'Time', distance: 'Distance' },
  record: {
    reps: 'Most reps',
    weight: 'Heaviest',
    e1rm: 'Strongest set',
    seconds: 'Longest hold',
    distance: 'Furthest',
  },
  unit: {
    s: 's',
    min: 'min',
    h: 'h',
    m: 'm',
    km: 'km',
    kg: 'kg',
    kcal: 'kcal',
    perKm: '/km',
    bpm: 'bpm',
  },
  reps: (n: number) => plural(n, { one: '# rep', other: '# reps' }),
  sets: (n: number) => plural(n, { one: '# set', other: '# sets' }),
  rounds: (n: number) => plural(n, { one: '# round', other: '# rounds' }),
  exercises: (n: number) => plural(n, { one: '# exercise', other: '# exercises' }),
  workouts: (n: number) => plural(n, { one: '# workout', other: '# workouts' }),
  eachSide: 'each side',
  /** "3.2 km in 18:40" */
  inTime: (what: string, time: string) => `${what} in ${time}`,
  pairs: (count: number): string => (count === 1 ? 'a pair' : 'pairs'),
  count: {
    none: 'Not at home right now',
    one: 'One',
    many: (n: number) => `${n} of them`,
  },
  equipmentJoin: ' + ',
  any: 'Any',
  how: 'How',
  wayOf: (equipment: string, name: string) => `${equipment}: ${name}`,
  whoseTraining: 'Whose training',
  newBest: (kinds: string) => `New best · ${kinds}`,
  /** Spoken by the player. */
  speech: {
    seconds: (n: number) => plural(n, { one: '# second', other: '# seconds' }),
    minutes: (n: number) => plural(n, { one: '# minute', other: '# minutes' }),
    minutesSeconds: (m: string, s: string) => `${m} ${s}`,
    metres: (n: number) => plural(n, { one: '# metre', other: '# metres' }),
    kilometres: (n: number) => plural(n, { one: '# kilometre', other: '# kilometres' }),
    reps: (n: number) => plural(n, { one: '# rep', other: '# reps' }),
    side: (side: 'left' | 'right'): string => (side === 'left' ? 'left side' : 'right side'),
    switchSides: 'Switch sides.',
    rest: 'Rest',
    roundRest: 'Rest between rounds',
    next: (name: string) => `Next: ${name}.`,
  },
};

type Training = typeof en;

const ro: Training = {
  muscle: {
    chest: 'Piept',
    back: 'Spate',
    shoulders: 'Umeri',
    biceps: 'Biceps',
    triceps: 'Triceps',
    forearms: 'Antebrațe',
    core: 'Abdomen',
    obliques: 'Oblici',
    glutes: 'Fesieri',
    quads: 'Cvadricepși',
    hamstrings: 'Ischiogambieri',
    calves: 'Gambe',
    hips: 'Șolduri',
    heart: 'Inimă',
  },
  category: {
    strength: 'Forță',
    cardio: 'Cardio',
    core: 'Trunchi',
    mobility: 'Mobilitate',
    stretch: 'Întinderi',
  },
  focus: {
    full: 'Tot corpul',
    upper: 'Partea de sus',
    lower: 'Picioare',
    core: 'Trunchi',
    cardio: 'Cardio',
    mobility: 'Mobilitate',
  },
  block: {
    warmup: 'Încălzire',
    main: 'Antrenament',
    cooldown: 'Revenire',
  },
  status: {
    planned: 'Planificat',
    active: 'În desfășurare',
    done: 'Încheiat',
    skipped: 'Sărit',
  },
  level: ['', 'Ușor', 'Mediu', 'Greu'],
  impact: { low: 'Fără sărituri', high: 'Cu sărituri' },
  measure: { reps: 'Repetări', time: 'Timp', distance: 'Distanță' },
  record: {
    reps: 'Cele mai multe repetări',
    weight: 'Cea mai mare greutate',
    e1rm: 'Cea mai puternică serie',
    seconds: 'Cea mai lungă menținere',
    distance: 'Cea mai lungă distanță',
  },
  unit: {
    s: 's',
    min: 'min',
    h: 'h',
    m: 'm',
    km: 'km',
    kg: 'kg',
    kcal: 'kcal',
    perKm: '/km',
    bpm: 'bpm',
  },
  reps: (n) => plural(n, { one: '# repetare', few: '# repetări', other: '# de repetări' }),
  sets: (n) => plural(n, { one: '# serie', few: '# serii', other: '# de serii' }),
  rounds: (n) => plural(n, { one: '# rundă', few: '# runde', other: '# de runde' }),
  exercises: (n) => plural(n, { one: '# exercițiu', few: '# exerciții', other: '# de exerciții' }),
  workouts: (n) =>
    plural(n, { one: '# antrenament', few: '# antrenamente', other: '# de antrenamente' }),
  eachSide: 'pe fiecare parte',
  inTime: (what, time) => `${what} în ${time}`,
  pairs: (count) => (count === 1 ? 'o pereche' : 'perechi'),
  count: {
    none: 'Acum nu e acasă',
    one: 'Unul',
    many: (n) => plural(n, { one: '# bucată', few: '# bucăți', other: '# de bucăți' }),
  },
  equipmentJoin: ' + ',
  any: 'Oricum',
  how: 'Cum',
  wayOf: (equipment, name) => `${equipment}: ${name}`,
  whoseTraining: 'Al cui antrenament',
  newBest: (kinds) => `Record nou · ${kinds}`,
  speech: {
    seconds: (n) => plural(n, { one: 'o secundă', few: '# secunde', other: '# de secunde' }),
    minutes: (n) => plural(n, { one: 'un minut', few: '# minute', other: '# de minute' }),
    minutesSeconds: (m, s) => `${m} și ${s}`,
    metres: (n) => plural(n, { one: 'un metru', few: '# metri', other: '# de metri' }),
    kilometres: (n) =>
      plural(n, { one: 'un kilometru', few: '# kilometri', other: '# de kilometri' }),
    reps: (n) => plural(n, { one: 'o repetare', few: '# repetări', other: '# de repetări' }),
    side: (side) => (side === 'left' ? 'partea stângă' : 'partea dreaptă'),
    switchSides: 'Schimbă partea.',
    rest: 'Pauză',
    roundRest: 'Pauză între runde',
    next: (name) => `Urmează: ${name}.`,
  },
};

const ru: Training = {
  muscle: {
    chest: 'Грудь',
    back: 'Спина',
    shoulders: 'Плечи',
    biceps: 'Бицепс',
    triceps: 'Трицепс',
    forearms: 'Предплечья',
    core: 'Пресс',
    obliques: 'Косые мышцы',
    glutes: 'Ягодицы',
    quads: 'Квадрицепсы',
    hamstrings: 'Бицепс бедра',
    calves: 'Икры',
    hips: 'Таз',
    heart: 'Сердце',
  },
  category: {
    strength: 'Сила',
    cardio: 'Кардио',
    core: 'Кор',
    mobility: 'Мобильность',
    stretch: 'Растяжка',
  },
  focus: {
    full: 'Всё тело',
    upper: 'Верх тела',
    lower: 'Ноги',
    core: 'Кор',
    cardio: 'Кардио',
    mobility: 'Мобильность',
  },
  block: {
    warmup: 'Разминка',
    main: 'Тренировка',
    cooldown: 'Заминка',
  },
  status: {
    planned: 'Запланирована',
    active: 'Идёт',
    done: 'Выполнена',
    skipped: 'Пропущена',
  },
  level: ['', 'Легко', 'Средне', 'Тяжело'],
  impact: { low: 'Без прыжков', high: 'С прыжками' },
  measure: { reps: 'Повторения', time: 'Время', distance: 'Дистанция' },
  record: {
    reps: 'Больше всего повторений',
    weight: 'Самый большой вес',
    e1rm: 'Самый сильный подход',
    seconds: 'Самое долгое удержание',
    distance: 'Самая длинная дистанция',
  },
  unit: {
    s: 'с',
    min: 'мин',
    h: 'ч',
    m: 'м',
    km: 'км',
    kg: 'кг',
    kcal: 'ккал',
    perKm: '/км',
    bpm: 'уд/мин',
  },
  reps: (n) =>
    plural(n, {
      one: '# повторение',
      few: '# повторения',
      many: '# повторений',
      other: '# повторения',
    }),
  sets: (n) =>
    plural(n, { one: '# подход', few: '# подхода', many: '# подходов', other: '# подхода' }),
  rounds: (n) => plural(n, { one: '# круг', few: '# круга', many: '# кругов', other: '# круга' }),
  exercises: (n) =>
    plural(n, {
      one: '# упражнение',
      few: '# упражнения',
      many: '# упражнений',
      other: '# упражнения',
    }),
  workouts: (n) =>
    plural(n, {
      one: '# тренировка',
      few: '# тренировки',
      many: '# тренировок',
      other: '# тренировки',
    }),
  eachSide: 'на каждую сторону',
  inTime: (what, time) => `${what} за ${time}`,
  pairs: (count) => (count === 1 ? 'пара' : 'пары'),
  count: {
    none: 'Сейчас нет дома',
    one: 'Один',
    many: (n) => plural(n, { one: '# штука', few: '# штуки', many: '# штук', other: '# штуки' }),
  },
  equipmentJoin: ' + ',
  any: 'Любой',
  how: 'Как',
  wayOf: (equipment, name) => `${equipment}: ${name}`,
  whoseTraining: 'Чья тренировка',
  newBest: (kinds) => `Новый рекорд · ${kinds}`,
  speech: {
    seconds: (n) =>
      plural(n, { one: '# секунда', few: '# секунды', many: '# секунд', other: '# секунды' }),
    minutes: (n) =>
      plural(n, { one: '# минута', few: '# минуты', many: '# минут', other: '# минуты' }),
    minutesSeconds: (m, s) => `${m} ${s}`,
    metres: (n) => plural(n, { one: '# метр', few: '# метра', many: '# метров', other: '# метра' }),
    kilometres: (n) =>
      plural(n, {
        one: '# километр',
        few: '# километра',
        many: '# километров',
        other: '# километра',
      }),
    reps: (n) =>
      plural(n, {
        one: '# повторение',
        few: '# повторения',
        many: '# повторений',
        other: '# повторения',
      }),
    side: (side) => (side === 'left' ? 'левая сторона' : 'правая сторона'),
    switchSides: 'Смените сторону.',
    rest: 'Отдых',
    roundRest: 'Отдых между кругами',
    next: (name) => `Дальше: ${name}.`,
  },
};

/** A plain lookup (safe in helpers and toasts); useTrainingT is the same, named for components. */
export const trainingT = messages({ en, ro, ru });
export const useTrainingT = trainingT;
export type TrainingWords = Training;
