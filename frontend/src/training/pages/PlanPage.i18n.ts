import { messages } from '@/i18n';

/** The training calendar: the month, the day's workouts and the saved routines. */

const en = {
  title: 'Plan',
  everyone: 'Everyone',
  calendar: 'Calendar',
  days: 'Days',
  today: 'Today',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  /** Appended to a day's spoken label. */
  trained: ', trained',
  legend: {
    planned: 'planned',
    done: 'done',
    trained: 'trained that day',
  },
  day: {
    nothingPast: 'Nothing planned that day.',
    nothing: 'No workouts planned.',
    makeOne: 'Make one up',
    build: 'Build my own',
    /** The title of a workout built by hand; it can be renamed later. */
    myWorkout: 'My workout',
    start: (title: string) => `Start ${title}`,
  },
  routines: {
    title: 'Saved routines',
    empty:
      'A workout you like can be saved as a routine (from the workout) and planned again on any day in one tap.',
    tapToPlan: (day: string) => `Tap to plan on ${day}.`,
    needsEquipment: 'needs equipment',
    planned: (title: string, day: string) => `${title}: planned for ${day}`,
    open: 'Open',
    deleted: 'Routine deleted',
    deleteLabel: (name: string) => `Delete ${name}`,
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteHint: 'Workouts already planned from it stay as they are.',
    delete: 'Delete',
  },
};

const ro: typeof en = {
  title: 'Plan',
  everyone: 'Toți',
  calendar: 'Calendar',
  days: 'Zile',
  today: 'Azi',
  previousMonth: 'Luna precedentă',
  nextMonth: 'Luna următoare',
  trained: ', cu antrenament',
  legend: {
    planned: 'planificat',
    done: 'făcut',
    trained: 'zi cu antrenament',
  },
  day: {
    nothingPast: 'Nimic planificat în ziua aceea.',
    nothing: 'Niciun antrenament planificat.',
    makeOne: 'Propune unul',
    build: 'Îl fac eu',
    myWorkout: 'Antrenamentul meu',
    start: (title) => `Începe: ${title}`,
  },
  routines: {
    title: 'Rutine salvate',
    empty:
      'Un antrenament care îți place îl poți salva ca rutină (din antrenament) și îl planifici din nou în orice zi, dintr-o atingere.',
    tapToPlan: (day) => `Atinge una ca s-o planifici pe ${day}.`,
    needsEquipment: 'cere echipament',
    planned: (title, day) => `${title}: planificat pe ${day}`,
    open: 'Deschide',
    deleted: 'Rutina a fost ștearsă',
    deleteLabel: (name) => `Șterge ${name}`,
    deleteTitle: (name) => `Ștergi „${name}”?`,
    deleteHint: 'Antrenamentele deja planificate din ea rămân cum sunt.',
    delete: 'Șterge',
  },
};

const ru: typeof en = {
  title: 'План',
  everyone: 'Все',
  calendar: 'Календарь',
  days: 'Дни',
  today: 'Сегодня',
  previousMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
  trained: ', была тренировка',
  legend: {
    planned: 'запланирована',
    done: 'выполнена',
    trained: 'день с тренировкой',
  },
  day: {
    nothingPast: 'В этот день ничего не было запланировано.',
    nothing: 'Тренировок не запланировано.',
    makeOne: 'Подобрать',
    build: 'Собрать самому',
    myWorkout: 'Моя тренировка',
    start: (title) => `Начать: ${title}`,
  },
  routines: {
    title: 'Сохранённые программы',
    empty:
      'Понравившуюся тренировку можно сохранить как программу (на экране тренировки) и одним нажатием запланировать на любой день.',
    tapToPlan: (day) => `Нажмите, чтобы запланировать на ${day}.`,
    needsEquipment: 'нужен инвентарь',
    planned: (title, day) => `${title}: запланирована на ${day}`,
    open: 'Открыть',
    deleted: 'Программа удалена',
    deleteLabel: (name) => `Удалить ${name}`,
    deleteTitle: (name) => `Удалить «${name}»?`,
    deleteHint: 'Уже запланированные по ней тренировки останутся как есть.',
    delete: 'Удалить',
  },
};

export const usePlanT = messages({ en, ro, ru });
