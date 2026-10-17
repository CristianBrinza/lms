import { formatNumber, messages, plural } from '@/i18n';

/** The progress screen: totals for a range, streaks, the calendar, muscles, exercises done most. */

type Range = 'week' | 'month' | 'quarter' | 'year';

const en = {
  title: 'Progress',
  you: 'You',
  range: {
    label: 'Range',
    /** The range as a heading. */
    long: {
      week: 'This week',
      month: 'Last 30 days',
      quarter: 'Last 3 months',
      year: 'Last 12 months',
    } as Record<Range, string>,
    /** The range in the subtitle, after the person's name. */
    inline: {
      week: 'this week',
      month: 'last 30 days',
      quarter: 'last 3 months',
      year: 'last 12 months',
    } as Record<Range, string>,
    chip: { week: 'Week', month: 'Month', quarter: '3 months', year: 'Year' } as Record<
      Range,
      string
    >,
  },
  loadFailed: 'Couldn’t load the progress',
  tryAgain: 'Try again',
  nothingMine: 'Nothing logged here yet.',
  nothingTheirs: (name: string | null) =>
    name ? `${name} logged nothing here yet.` : 'They logged nothing here yet.',
  startWorkout: 'Start a workout',
  card: {
    streaks: 'Streaks',
    days: 'Days trained',
    minutes: 'Minutes per week',
    muscles: 'This week’s muscles',
    musclesAside: '1 set main · ½ helper',
    top: 'Done most',
  },
  minutesChart: 'Minutes trained per week',
  weekOf: (day: string) => `Week of ${day}`,
  /** For the small tiles: 203 minutes → "3h 23m". */
  hoursMinutes: (h: number, m: number) => `${h}h ${m}m`,
  hoursOnly: (h: number) => `${h} h`,
  minutesOnly: (m: number) => `${m} min`,
  tile: {
    daysTrained: (n: number) => plural(n, { one: 'day trained', other: 'days trained' }),
    workouts: (n: number) => plural(n, { one: 'workout', other: 'workouts' }),
    trained: 'trained',
    sets: 'sets',
    reps: 'reps',
    distance: 'distance',
  },
  streak: {
    now: (n: number) => plural(n, { one: 'day in a row now', other: 'days in a row now' }),
    start: 'Train today to start a streak',
    best: (n: number) => plural(n, { one: 'day, the best run', other: 'days, the best run' }),
    weeks: (n: number) => plural(n, { one: 'week in a row', other: 'weeks in a row' }),
  },
  /** A rest day in the calendar: "Tue 6 Oct: rest". */
  rest: (when: string) => `${when}: rest`,
  muscles: {
    empty:
      'Nothing yet this week. Each set counts 1 for the muscle it works most and ½ for each helper.',
    list: 'Sets per muscle this week',
    /** Read after the number: " sets, could use more". */
    sets: (n: number): string => (n === 1 ? ' set' : ' sets'),
    low: ', could use more',
    needMore: (muscles: string) => `Could use more: ${muscles}`,
  },
  topEmpty: 'No exercises logged in this range.',
};

const ro: typeof en = {
  title: 'Progres',
  you: 'Tu',
  range: {
    label: 'Perioadă',
    long: {
      week: 'Săptămâna asta',
      month: 'Ultimele 30 de zile',
      quarter: 'Ultimele 3 luni',
      year: 'Ultimele 12 luni',
    },
    inline: {
      week: 'săptămâna asta',
      month: 'ultimele 30 de zile',
      quarter: 'ultimele 3 luni',
      year: 'ultimele 12 luni',
    },
    chip: { week: 'Săptămână', month: 'Lună', quarter: '3 luni', year: 'An' },
  },
  loadFailed: 'Progresul nu s-a încărcat',
  tryAgain: 'Încearcă din nou',
  nothingMine: 'Încă nu ai notat nimic aici.',
  nothingTheirs: (name) =>
    name ? `${name} încă n-a notat nimic aici.` : 'Încă nu e nimic notat aici.',
  startWorkout: 'Începe un antrenament',
  card: {
    streaks: 'Zile la rând',
    days: 'Zile cu antrenament',
    minutes: 'Minute pe săptămână',
    muscles: 'Mușchii săptămânii',
    musclesAside: 'principal 1 · ajutător ½',
    top: 'Cele mai frecvente',
  },
  minutesChart: 'Minute de antrenament pe săptămână',
  weekOf: (day) => `Săptămâna din ${day}`,
  hoursMinutes: (h, m) => `${formatNumber(h + m / 60, { maximumFractionDigits: 1 })} h`,
  hoursOnly: (h) => `${h} h`,
  minutesOnly: (m) => `${m} min`,
  tile: {
    daysTrained: (n) => plural(n, { one: 'zi de antrenament', other: 'zile de antrenament' }),
    workouts: (n) => plural(n, { one: 'antrenament', other: 'antrenamente' }),
    trained: 'timp',
    sets: 'serii',
    reps: 'repetări',
    distance: 'distanță',
  },
  streak: {
    now: (n) => plural(n, { one: 'zi la rând acum', other: 'zile la rând acum' }),
    start: 'Antrenează-te azi și pornește un șir',
    best: (n) => plural(n, { one: 'zi, cel mai lung șir', other: 'zile, cel mai lung șir' }),
    weeks: (n) => plural(n, { one: 'săptămână la rând', other: 'săptămâni la rând' }),
  },
  rest: (when) => `${when}: pauză`,
  muscles: {
    empty:
      'Încă nimic săptămâna asta. Fiecare serie contează 1 pentru mușchiul lucrat cel mai mult și ½ pentru fiecare mușchi ajutător.',
    list: 'Serii pe mușchi săptămâna asta',
    sets: (n) => (n === 1 ? ' serie' : ' serii'),
    low: ', ar mai trebui',
    needMore: (muscles) => `Ar mai trebui: ${muscles}`,
  },
  topEmpty: 'Niciun exercițiu notat în perioada asta.',
};

const ru: typeof en = {
  title: 'Прогресс',
  you: 'Вы',
  range: {
    label: 'Период',
    long: {
      week: 'Эта неделя',
      month: 'Последние 30 дней',
      quarter: 'Последние 3 месяца',
      year: 'Последние 12 месяцев',
    },
    inline: {
      week: 'эта неделя',
      month: 'последние 30 дней',
      quarter: 'последние 3 месяца',
      year: 'последние 12 месяцев',
    },
    chip: { week: 'Неделя', month: 'Месяц', quarter: '3 месяца', year: 'Год' },
  },
  loadFailed: 'Не удалось загрузить прогресс',
  tryAgain: 'Попробовать снова',
  nothingMine: 'Здесь пока ничего не записано.',
  nothingTheirs: (name) =>
    name ? `${name}: здесь пока ничего не записано.` : 'Здесь пока ничего не записано.',
  startWorkout: 'Начать тренировку',
  card: {
    streaks: 'Серии',
    days: 'Дни тренировок',
    minutes: 'Минуты по неделям',
    muscles: 'Мышцы за неделю',
    musclesAside: 'основная 1 · вспомогательная ½',
    top: 'Чаще всего',
  },
  minutesChart: 'Минуты тренировок по неделям',
  weekOf: (day) => `Неделя с ${day}`,
  hoursMinutes: (h, m) => `${formatNumber(h + m / 60, { maximumFractionDigits: 1 })} ч`,
  hoursOnly: (h) => `${h} ч`,
  minutesOnly: (m) => `${m} мин`,
  tile: {
    daysTrained: (n) =>
      plural(n, {
        one: 'день с тренировкой',
        few: 'дня с тренировками',
        many: 'дней с тренировками',
        other: 'дня с тренировками',
      }),
    workouts: (n) =>
      plural(n, { one: 'тренировка', few: 'тренировки', many: 'тренировок', other: 'тренировки' }),
    trained: 'время',
    sets: 'подходы',
    reps: 'повторения',
    distance: 'дистанция',
  },
  streak: {
    now: (n) =>
      plural(n, {
        one: 'день подряд сейчас',
        few: 'дня подряд сейчас',
        many: 'дней подряд сейчас',
        other: 'дня подряд сейчас',
      }),
    start: 'Потренируйтесь сегодня, чтобы начать серию',
    best: (n) =>
      plural(n, {
        one: 'день, лучшая серия',
        few: 'дня, лучшая серия',
        many: 'дней, лучшая серия',
        other: 'дня, лучшая серия',
      }),
    weeks: (n) =>
      plural(n, {
        one: 'неделя подряд',
        few: 'недели подряд',
        many: 'недель подряд',
        other: 'недели подряд',
      }),
  },
  rest: (when) => `${when}: отдых`,
  muscles: {
    empty:
      'На этой неделе пока ничего. Каждый подход считается за 1 для основной мышцы и за ½ для каждой вспомогательной.',
    list: 'Подходы на мышцу за эту неделю',
    sets: (n) =>
      ` ${plural(n, { one: 'подход', few: 'подхода', many: 'подходов', other: 'подхода' })}`,
    low: ', стоит добавить',
    needMore: (muscles) => `Стоит добавить: ${muscles}`,
  },
  topEmpty: 'За этот период упражнений нет.',
};

export const progressT = messages({ en, ro, ru });
export const useProgressT = progressT;
