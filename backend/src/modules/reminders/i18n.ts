import type { Locale } from '../../lib/i18n';

/** What the reminders say on the phone, in each person's language (users.locale). */

const plural = (locale: Locale, n: number, forms: Record<string, string>) => {
  const rule = new Intl.PluralRules(locale).select(n);
  return (forms[rule] ?? forms.other!).replace('#', String(n));
};

export interface ReminderWords {
  shoppingTitle: (count: number) => string;
  packTitle: string;
  useSoonTitle: string;
  pastDate: string;
  today: string;
  tomorrow: string;
  mealTitle: (meal: string, time: string) => string;
  mealToGo: string;
  mealIn: (minutes: number) => string;
  customTitle: string;
  customFallback: string;
  testTitle: string;
  testBody: string;
  /** The text of the custom reminder everyone starts with. */
  defaultCustom: string;
}

const en: ReminderWords = {
  shoppingTitle: (n) => `For tomorrow: ${n} ${n === 1 ? 'thing' : 'things'} to buy`,
  packTitle: 'Pack for tomorrow',
  useSoonTitle: 'Use soon',
  pastDate: 'past date',
  today: 'today',
  tomorrow: 'tomorrow',
  mealTitle: (meal, time) => `${meal} at ${time}`,
  mealToGo: 'Packed? It’s to take along.',
  mealIn: (minutes) => `In ${minutes} minutes. Tap to see what it needs.`,
  customTitle: 'LMS',
  customFallback: 'Reminder',
  testTitle: 'LMS reminders are on',
  testBody: 'This is how they will look.',
  defaultCustom: 'On the way home? Check the shopping list.',
};

const ro: ReminderWords = {
  shoppingTitle: (n) =>
    `Pentru mâine: ${plural('ro', n, { one: '# produs', few: '# produse', other: '# de produse' })} de cumpărat`,
  packTitle: 'La pachet pentru mâine',
  useSoonTitle: 'De consumat curând',
  pastDate: 'a expirat',
  today: 'azi',
  tomorrow: 'mâine',
  mealTitle: (meal, time) => `${meal} la ${time}`,
  mealToGo: 'Ai pus la pachet? E de luat cu tine.',
  mealIn: (minutes) =>
    `Peste ${plural('ro', minutes, { one: '# minut', few: '# minute', other: '# de minute' })}. Atinge ca să vezi ce trebuie.`,
  customTitle: 'LMS',
  customFallback: 'Memento',
  testTitle: 'Mementourile LMS sunt pornite',
  testBody: 'Așa o să arate.',
  defaultCustom: 'Spre casă? Verifică lista de cumpărături.',
};

const ru: ReminderWords = {
  shoppingTitle: (n) =>
    `На завтра: купить ${plural('ru', n, { one: '# товар', few: '# товара', many: '# товаров', other: '# товара' })}`,
  packTitle: 'Собрать с собой на завтра',
  useSoonTitle: 'Использовать поскорее',
  pastDate: 'просрочено',
  today: 'сегодня',
  tomorrow: 'завтра',
  mealTitle: (meal, time) => `${meal} в ${time}`,
  mealToGo: 'Собрали? Это нужно взять с собой.',
  mealIn: (minutes) =>
    `Через ${plural('ru', minutes, { one: '# минуту', few: '# минуты', many: '# минут', other: '# минуты' })}. Нажмите, чтобы посмотреть, что нужно.`,
  customTitle: 'LMS',
  customFallback: 'Напоминание',
  testTitle: 'Напоминания LMS включены',
  testBody: 'Вот так они будут выглядеть.',
  defaultCustom: 'Едете домой? Загляните в список покупок.',
};

export const REMINDER_WORDS: Record<Locale, ReminderWords> = { en, ro, ru };

export const reminderWords = (locale: Locale | null | undefined): ReminderWords =>
  REMINDER_WORDS[locale ?? 'en'] ?? en;

/** The default custom reminder's text in ro and ru, stored with it as its translations. */
export const DEFAULT_CUSTOM_TRANSLATIONS = {
  ro: { text: ro.defaultCustom },
  ru: { text: ru.defaultCustom },
};
