import { messages } from '@/i18n';

/** "Make up a workout": the choices, what came out, and planning it. */

const en = {
  title: 'Make up a workout',
  /** "From what’s at home, for Ana · today" (who is null for yourself). */
  description: (who: string | null, day: string) =>
    `From what’s at home${who === null ? '' : `, for ${who}`} · ${day}`,
  them: 'them',
  today: 'today',
  about: (time: string) => `About ${time}`,
  howLong: 'How long',
  whatFor: 'What for',
  howHard: 'How hard',
  quiet: 'Quiet',
  quietHint: 'Leaves out jumping exercises',
  circuit: 'Circuit',
  circuitHint: 'Rounds through every exercise instead of sets in a row',
  create: 'Create workout',
  tryAnother: 'Try another',
  planIt: 'Plan it',
  startNow: 'Start now',
  plannedFor: (day: string) => `Planned for ${day}`,
};

const ro: typeof en = {
  title: 'Propune un antrenament',
  description: (who, day) => `Din ce e acasă${who === null ? '' : `, pentru ${who}`} · ${day}`,
  them: 'altcineva',
  today: 'azi',
  about: (time) => `Cam ${time}`,
  howLong: 'Cât durează',
  whatFor: 'Ce lucrăm',
  howHard: 'Cât de greu',
  quiet: 'Fără zgomot',
  quietHint: 'Fără exerciții cu sărituri',
  circuit: 'Circuit',
  circuitHint: 'Runde prin toate exercițiile, în loc de serii la rând',
  create: 'Creează antrenamentul',
  tryAnother: 'Altă variantă',
  planIt: 'Planifică',
  startNow: 'Începe acum',
  plannedFor: (day) => `Planificat pe ${day}`,
};

const ru: typeof en = {
  title: 'Подобрать тренировку',
  // A name after «для» would need its genitive, so the person stands on their own.
  description: (who, day) => `Из того, что есть дома${who === null ? '' : ` · ${who}`} · ${day}`,
  them: 'другой человек',
  today: 'сегодня',
  about: (time) => `Около ${time}`,
  howLong: 'Сколько по времени',
  whatFor: 'Что прорабатываем',
  howHard: 'Насколько тяжело',
  quiet: 'Тихо',
  quietHint: 'Без упражнений с прыжками',
  circuit: 'По кругу',
  circuitHint: 'Круги по всем упражнениям вместо подходов подряд',
  create: 'Создать тренировку',
  tryAnother: 'Другой вариант',
  planIt: 'Запланировать',
  startNow: 'Начать сейчас',
  plannedFor: (day) => `Запланирована на ${day}`,
};

export const useGenerateT = messages({ en, ro, ru });
