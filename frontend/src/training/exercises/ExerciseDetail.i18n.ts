import { daysBetween, localDate, parseDay } from '@/food/format';
import { intlLocale, messages } from '@/i18n';

/** One exercise's sheet and panel: what it is, what it needs, how to do it, the bests and days. */

const en = {
  exercise: 'Exercise',
  close: 'Close',
  pinned: 'Pinned',
  unpinned: 'Unpinned',
  keptAtHand: 'Kept at hand for quick logging',
  hiddenToast: (name: string) => `${name} hidden`,
  backToast: (name: string) => `${name} is back`,
  hiddenHint: 'It leaves the library and generated workouts',
  undo: 'Undo',
  loadError: 'Couldn’t load this exercise',
  tryAgain: 'Try again',
  hidden: 'Hidden',
  highImpact: 'High impact: jumps and landings',
  lowImpact: 'Low impact: no jumping',
  rest: (time: string) => `rest ${time}`,
  notAtHome: 'Not possible with what’s at home',
  logSet: 'Log a set',
  pinnedHint: 'Kept at hand for quick logging. Tap to unpin',
  pinHint: 'Keep at hand for quick logging',
  pin: 'Pin',
  edit: 'Edit',
  editName: (name: string) => `Edit ${name}`,
  /** Under the buttons when looking at someone else's training. */
  whoseNote: (name: string | null) => `Pins, bests and sets are ${name ?? 'their'}’s.`,
  muscles: 'Muscles',
  notSet: 'Not set',
  musclesKey: 'Dark: works it most · light: helps',
  equipment: 'Equipment',
  weightsAtHome: 'Weights at home',
  waysToDoIt: 'Ways to do it',
  howToDoIt: 'How to do it',
  yourBests: 'Your bests',
  theirBests: (name: string | null) => (name ? `${name}’s bests` : 'Their bests'),
  overTime: 'Over time',
  recentDays: 'Recent days',
  side: { left: 'L', right: 'R' },
  showAgain: 'Show again',
  hide: 'Hide from the library',
  noEquipment: 'No equipment needed.',
  or: 'or',
  atHome: 'At home',
  notHome: 'Not at home',
  oneRepEstimated: 'one rep, estimated',
  noSets: 'No sets yet. Log one and the bests start here.',
  chart: {
    time: 'Longest set per day',
    distance: 'Furthest per day',
    weight: 'Strongest set per day, as an estimated one-rep weight',
    reps: 'Most reps in a set per day',
  },
};

const ro: typeof en = {
  exercise: 'Exercițiu',
  close: 'Închide',
  pinned: 'Fixat',
  unpinned: 'Fixare anulată',
  keptAtHand: 'La îndemână pentru notare rapidă',
  hiddenToast: (name) => `Ascuns: ${name}`,
  backToast: (name) => `${name} a revenit în bibliotecă`,
  hiddenHint: 'Nu mai apare în bibliotecă și în antrenamentele generate',
  undo: 'Anulează',
  loadError: 'Exercițiul nu s-a încărcat',
  tryAgain: 'Încearcă din nou',
  hidden: 'Ascuns',
  highImpact: 'Cu sărituri și aterizări',
  lowImpact: 'Fără sărituri',
  rest: (time) => `pauză ${time}`,
  notAtHome: 'Nu se poate face cu ce e acasă',
  logSet: 'Notează o serie',
  pinnedHint: 'La îndemână pentru notare rapidă. Atinge ca să anulezi fixarea',
  pinHint: 'Ține-l la îndemână pentru notare rapidă',
  pin: 'Fixează',
  edit: 'Editează',
  editName: (name) => `Editează ${name}`,
  whoseNote: (name) =>
    name
      ? `Aici sunt fixările, recordurile și seriile pentru ${name}.`
      : 'Aici sunt fixările, recordurile și seriile acestei persoane.',
  muscles: 'Mușchi',
  notSet: 'Nespecificat',
  musclesKey: 'Închis: lucrează cel mai mult · deschis: ajută',
  equipment: 'Echipament',
  weightsAtHome: 'Greutăți acasă',
  waysToDoIt: 'Variante',
  howToDoIt: 'Cum se face',
  yourBests: 'Recordurile tale',
  theirBests: (name) => (name ? `Recorduri: ${name}` : 'Recordurile sale'),
  overTime: 'Evoluție',
  recentDays: 'Zilele recente',
  side: { left: 'S', right: 'D' },
  showAgain: 'Arată din nou',
  hide: 'Ascunde din bibliotecă',
  noEquipment: 'Nu e nevoie de echipament.',
  or: 'sau',
  atHome: 'Acasă',
  notHome: 'Nu e acasă',
  oneRepEstimated: 'o repetare, estimat',
  noSets: 'Încă nicio serie. Notează una și recordurile apar aici.',
  chart: {
    time: 'Cea mai lungă serie pe zi',
    distance: 'Cea mai lungă distanță pe zi',
    weight: 'Cea mai puternică serie pe zi, ca greutate estimată pentru o repetare',
    reps: 'Cele mai multe repetări într-o serie, pe zi',
  },
};

const ru: typeof en = {
  exercise: 'Упражнение',
  close: 'Закрыть',
  pinned: 'Закреплено',
  unpinned: 'Откреплено',
  keptAtHand: 'Под рукой для быстрой записи',
  hiddenToast: (name) => `Скрыто: ${name}`,
  backToast: (name) => `${name} снова в библиотеке`,
  hiddenHint: 'Его не будет в библиотеке и в собранных тренировках',
  undo: 'Отменить',
  loadError: 'Не удалось загрузить упражнение',
  tryAgain: 'Повторить',
  hidden: 'Скрыто',
  highImpact: 'С прыжками и приземлениями',
  lowImpact: 'Без прыжков',
  rest: (time) => `отдых ${time}`,
  notAtHome: 'Не получится с тем, что есть дома',
  logSet: 'Записать подход',
  pinnedHint: 'Под рукой для быстрой записи. Нажмите, чтобы открепить',
  pinHint: 'Держать под рукой для быстрой записи',
  pin: 'Закрепить',
  edit: 'Изменить',
  editName: (name) => `Изменить: ${name}`,
  whoseNote: (name) =>
    name
      ? `Закрепления, рекорды и подходы здесь — ${name}.`
      : 'Закрепления, рекорды и подходы здесь — другого человека.',
  muscles: 'Мышцы',
  notSet: 'Не указаны',
  musclesKey: 'Тёмные: основная нагрузка · светлые: помогают',
  equipment: 'Инвентарь',
  weightsAtHome: 'Веса дома',
  waysToDoIt: 'Варианты',
  howToDoIt: 'Как выполнять',
  yourBests: 'Ваши рекорды',
  theirBests: (name) => (name ? `Рекорды: ${name}` : 'Рекорды'),
  overTime: 'Динамика',
  recentDays: 'Последние дни',
  side: { left: 'Л', right: 'П' },
  showAgain: 'Показать снова',
  hide: 'Скрыть из библиотеки',
  noEquipment: 'Инвентарь не нужен.',
  or: 'или',
  atHome: 'Дома',
  notHome: 'Нет дома',
  oneRepEstimated: 'одно повторение, расчёт',
  noSets: 'Подходов пока нет. Запишите первый, и рекорды появятся здесь.',
  chart: {
    time: 'Самый долгий подход за день',
    distance: 'Самая длинная дистанция за день',
    weight: 'Самый сильный подход за день, как расчётный вес на одно повторение',
    reps: 'Больше всего повторений в подходе за день',
  },
};

export const useExerciseDetailT = messages({ en, ro, ru });

const capitalise = (text: string) => text.charAt(0).toLocaleUpperCase(intlLocale()) + text.slice(1);

/** "5 Oct", "5 oct.", "5 окт." */
export const shortDate = (day: string) =>
  new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(parseDay(day));

/** "Today", "Yesterday", else "Mon 5 Oct", in the current language. */
export function dayLabel(day: string, today = localDate()): string {
  const diff = daysBetween(today, day);
  if (Math.abs(diff) <= 1)
    return capitalise(
      new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' }).format(diff, 'day'),
    );
  return capitalise(
    new Intl.DateTimeFormat(intlLocale(), {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(parseDay(day)),
  );
}
