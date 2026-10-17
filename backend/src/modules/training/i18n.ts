import { LOCALES, type Locale, type Translations } from '../../lib/i18n';
import type { Focus } from './schemas';

/**
 * What Training's server writes for people to read, in English, Romanian and Russian: the
 * progression hints, generated workout titles, the energy and health observations. Plus the helpers
 * that keep a record's translations in step with its text.
 */

const INTL: Record<Locale, string> = { en: 'en-GB', ro: 'ro-MD', ru: 'ru-RU' };

/** A number as the language writes it (1,5 in Romanian and Russian; 8,000 · 8.000 · 8 000). */
export const num = (value: number, locale: Locale, digits?: { min?: number; max?: number }) =>
  new Intl.NumberFormat(INTL[locale], {
    minimumFractionDigits: digits?.min ?? 0,
    maximumFractionDigits: digits?.max ?? 2,
  }).format(value);

const units = {
  en: { kg: 'kg', km: 'km', s: 's', min: 'min', kcal: 'kcal', g: 'g', bpm: 'bpm' },
  ro: { kg: 'kg', km: 'km', s: 's', min: 'min', kcal: 'kcal', g: 'g', bpm: 'bpm' },
  ru: { kg: 'кг', km: 'км', s: 'с', min: 'мин', kcal: 'ккал', g: 'г', bpm: 'уд/мин' },
} satisfies Record<Locale, Record<string, string>>;

export const unit = (locale: Locale) => units[locale];

// ---------------------------------------------------------------- the progression hint

const suggestText = {
  en: { last: (list: string) => `Last time ${list}`, at: (kg: string) => ` at ${kg}`, next: ' · next: ' },
  ro: {
    last: (list: string) => `Data trecută: ${list}`,
    at: (kg: string) => ` cu ${kg}`,
    next: ' · acum: ',
  },
  ru: {
    last: (list: string) => `В прошлый раз: ${list}`,
    at: (kg: string) => ` с весом ${kg}`,
    next: ' · сейчас: ',
  },
} satisfies Record<Locale, unknown>;

/** "Last time 10, 10, 9 at 8 kg · next: 10 kg" in the language asked for. */
export function lastTimeText(
  locale: Locale,
  parts: { list: string; weight?: number | null; next?: string },
): string {
  const t = suggestText[locale];
  const at = parts.weight ? t.at(`${num(parts.weight, locale)} ${units[locale].kg}`) : '';
  return `${t.last(parts.list)}${at}${parts.next ? `${t.next}${parts.next}` : ''}`;
}

export const kgText = (kg: number, locale: Locale) => `${num(kg, locale)} ${units[locale].kg}`;
export const secondsText = (s: number, locale: Locale) => `${num(s, locale)} ${units[locale].s}`;
/** "3.2 km in 18 min" / "3,2 km în 18 min" / "3,2 км за 18 мин". */
export function distanceText(metres: number, seconds: number | null | undefined, locale: Locale) {
  const km = `${num(metres / 1000, locale, { min: 1, max: 1 })} ${units[locale].km}`;
  if (!seconds) return km;
  const mins = `${Math.round(seconds / 60)} ${units[locale].min}`;
  return { en: `${km} in ${mins}`, ro: `${km} în ${mins}`, ru: `${km} за ${mins}` }[locale];
}

// ---------------------------------------------------------------- workout titles

/** A workout with no title of its own. */
export const WORKOUT = { en: 'Workout', ro: 'Antrenament', ru: 'Тренировка' } satisfies Record<
  Locale,
  string
>;

const FOCUS_TITLE: Record<Locale, Record<Focus, string>> = {
  en: {
    full: 'Full body',
    upper: 'Upper body',
    lower: 'Legs and glutes',
    core: 'Core',
    cardio: 'Cardio',
    mobility: 'Mobility',
  },
  ro: {
    full: 'Tot corpul',
    upper: 'Partea de sus',
    lower: 'Picioare și fesieri',
    core: 'Trunchi',
    cardio: 'Cardio',
    mobility: 'Mobilitate',
  },
  ru: {
    full: 'Всё тело',
    upper: 'Верх тела',
    lower: 'Ноги и ягодицы',
    core: 'Кор',
    cardio: 'Кардио',
    mobility: 'Мобильность',
  },
};
const CIRCUIT: Record<Locale, string> = { en: ' circuit', ro: ' în circuit', ru: ' по кругу' };

/** "Full body · 20 min circuit": what a made-up workout is called. */
export const generatedTitle = (focus: Focus, minutes: number, circuit: boolean, locale: Locale) =>
  `${FOCUS_TITLE[locale][focus]} · ${minutes} ${units[locale].min}${circuit ? CIRCUIT[locale] : ''}`;

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A made-up workout's title, recognised in any language, in all three; null for any other title. */
export function generatedTitleTranslations(title: string): Translations | null {
  for (const locale of LOCALES) {
    for (const focus of Object.keys(FOCUS_TITLE[locale]) as Focus[]) {
      const match = new RegExp(
        `^${escape(FOCUS_TITLE[locale][focus])} · (\\d+) ${escape(units[locale].min)}(${escape(CIRCUIT[locale])})?$`,
      ).exec(title);
      if (!match) continue;
      const minutes = Number(match[1]);
      const circuit = Boolean(match[2]);
      return Object.fromEntries(
        LOCALES.map((l) => [l, { title: generatedTitle(focus, minutes, circuit, l) }]),
      );
    }
  }
  return null;
}

// ---------------------------------------------------------------- energy

export const energyText = {
  en: {
    keep: 'Keeping weight: about what a day burns',
    lose: (rate: string, kcal: number, held: boolean) =>
      `Losing ${rate} kg a week: ${kcal} kcal under what a day burns${held ? ', held at a safe minimum' : ''}`,
    gain: (rate: string, kcal: number) =>
      `Gaining ${rate} kg a week: ${kcal} kcal over what a day burns`,
    noGoal: 'No goal set: about what a day burns',
    left: (left: number, target: number) => `${left} kcal left today of ${target}`,
    over: (over: number, target: number) => `${over} kcal over today’s ${target}`,
    protein: (eaten: number, target: number) => `Protein ${eaten} of ${target} g so far`,
    week: (kcal: number, under: boolean, goal: 'lose' | 'gain' | 'keep') =>
      `This week: ${kcal} kcal a day ${under ? 'under' : 'over'} what was burned (aiming for ${{ lose: 'a deficit', gain: 'a surplus', keep: 'balance' }[goal]})`,
    noWeight: 'No weight yet: numbers use 70 kg. Add today’s weight below.',
    measured: (kcal: number) => `Measured from your meals and weight: a day burns about ${kcal} kcal`,
  },
  ro: {
    keep: 'Menținerea greutății: cam cât arde o zi',
    lose: (rate: string, kcal: number, held: boolean) =>
      `Slăbire cu ${rate} kg pe săptămână: cu ${kcal} kcal sub cât arde o zi${held ? ', fără a coborî sub un minim sigur' : ''}`,
    gain: (rate: string, kcal: number) =>
      `Creștere cu ${rate} kg pe săptămână: cu ${kcal} kcal peste cât arde o zi`,
    noGoal: 'Fără obiectiv: cam cât arde o zi',
    left: (left: number, target: number) => `Azi au mai rămas ${left} kcal din ${target}`,
    over: (over: number, target: number) => `Azi: cu ${over} kcal peste ținta de ${target}`,
    protein: (eaten: number, target: number) => `Proteine: ${eaten} din ${target} g până acum`,
    week: (kcal: number, under: boolean, goal: 'lose' | 'gain' | 'keep') =>
      `Săptămâna aceasta: cu ${kcal} kcal pe zi ${under ? 'sub' : 'peste'} cât s-a ars (obiectiv: ${{ lose: 'deficit', gain: 'surplus', keep: 'echilibru' }[goal]})`,
    noWeight: 'Încă nu ai greutatea: calculăm cu 70 kg. Adaugă greutatea de azi mai jos.',
    measured: (kcal: number) => `Măsurat din mesele și greutatea ta: o zi arde cam ${kcal} kcal`,
  },
  ru: {
    keep: 'Поддержание веса: примерно дневной расход',
    lose: (rate: string, kcal: number, held: boolean) =>
      `Снижение на ${rate} кг в неделю: на ${kcal} ккал меньше дневного расхода${held ? ', но не ниже безопасного минимума' : ''}`,
    gain: (rate: string, kcal: number) =>
      `Набор ${rate} кг в неделю: на ${kcal} ккал больше дневного расхода`,
    noGoal: 'Цель не задана: примерно дневной расход',
    left: (left: number, target: number) => `Сегодня осталось ${left} ккал из ${target}`,
    over: (over: number, target: number) => `Сегодня на ${over} ккал больше нормы ${target}`,
    protein: (eaten: number, target: number) => `Белок: пока ${eaten} из ${target} г`,
    week: (kcal: number, under: boolean, goal: 'lose' | 'gain' | 'keep') =>
      `На этой неделе: на ${kcal} ккал в день ${under ? 'меньше' : 'больше'}, чем потрачено (цель: ${{ lose: 'дефицит', gain: 'профицит', keep: 'баланс' }[goal]})`,
    noWeight: 'Вес ещё не указан: считаем для 70 кг. Добавь сегодняшний вес ниже.',
    measured: (kcal: number) => `По твоему питанию и весу: за день тратится около ${kcal} ккал`,
  },
} satisfies Record<Locale, unknown>;

// ---------------------------------------------------------------- health

export const healthText = {
  en: {
    steps: (up: boolean, pct: number, perDay: string) =>
      `Steps ${up ? 'up' : 'down'} ${pct}% on the week before (${perDay} a day)`,
    shortSleep: (short: number, nights: number) =>
      `Under 7 hours’ sleep on ${short} of the last ${nights} nights`,
    goodSleep: '7 hours or more every night this week',
    restingHeart: (down: boolean, bpm: number) =>
      `Resting heart rate ${down ? 'down' : 'up'} ${bpm} bpm on the week before`,
    weight: (change: string, since: string) => `Weight ${change} kg since ${since}`,
    activeDays: (steps: string, days: number) => `${steps} steps or more on ${days} of the last 7 days`,
    from: (source: string) => `From ${source}`,
    app: 'the app',
  },
  ro: {
    steps: (up: boolean, pct: number, perDay: string) =>
      `Pașii ${up ? 'au crescut' : 'au scăzut'} cu ${pct}% față de săptămâna trecută (${perDay} pe zi)`,
    shortSleep: (short: number, nights: number) =>
      `Sub 7 ore de somn în ${short} din ultimele ${nights} nopți`,
    goodSleep: '7 ore sau mai mult în fiecare noapte săptămâna aceasta',
    restingHeart: (down: boolean, bpm: number) =>
      `Pulsul în repaus ${down ? 'a scăzut' : 'a crescut'} cu ${bpm} bpm față de săptămâna trecută`,
    weight: (change: string, since: string) => `Greutatea ${change} kg din ${since}`,
    activeDays: (steps: string, days: number) =>
      `${steps} de pași sau mai mult în ${days} din ultimele 7 zile`,
    from: (source: string) => `Din ${source}`,
    app: 'aplicație',
  },
  ru: {
    steps: (up: boolean, pct: number, perDay: string) =>
      `Шагов ${up ? 'больше' : 'меньше'} на ${pct}%, чем неделей раньше (${perDay} в день)`,
    shortSleep: (short: number, nights: number) =>
      `Меньше 7 часов сна в ${short} из последних ${nights} ночей`,
    goodSleep: '7 часов сна и больше каждую ночь на этой неделе',
    restingHeart: (down: boolean, bpm: number) =>
      `Пульс в покое ${down ? 'снизился' : 'вырос'} на ${bpm} уд/мин по сравнению с прошлой неделей`,
    weight: (change: string, since: string) => `Вес ${change} кг с ${since}`,
    activeDays: (steps: string, days: number) =>
      `${steps} шагов и больше в ${days} из последних 7 дней`,
    from: (source: string) => `Из ${source}`,
    app: 'приложения',
  },
} satisfies Record<Locale, unknown>;

// ---------------------------------------------------------------- record translations

type Entry = Record<string, string | string[]>;

/** Some fields of a record's translations, optionally under other names ({ name: 'exercise' }). */
export function pickTranslations(
  translations: Translations | null | undefined,
  fields: Record<string, string>,
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = translations?.[locale];
    if (!entry) continue;
    const kept: Entry = {};
    for (const [from, to] of Object.entries(fields)) if (entry[from] !== undefined) kept[to] = entry[from]!;
    if (Object.keys(kept).length) out[locale] = kept;
  }
  return out;
}

/** Only the name, for lists that show a record's name (a workout's exercises, the top exercises). */
export const nameTranslations = (translations: Translations | null | undefined) =>
  pickTranslations(translations, { name: 'name' });

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A record's translations after its own text changed: a renamed field drops its old translations
 * (they translated the old text); a list keeps the translations of the items still there, and an
 * item that is new shows as written. Translations sent with the change are merged on top after.
 */
export function rebaseTranslations(
  stored: Translations | null | undefined,
  before: Record<string, string | string[]>,
  after: Record<string, string | string[]>,
): Translations {
  const out: Translations = {};
  for (const locale of LOCALES) {
    const entry = stored?.[locale];
    if (!entry) continue;
    const kept: Entry = { ...entry };
    for (const field of Object.keys(after)) {
      const was = before[field];
      const now = after[field]!;
      if (same(was, now) || kept[field] === undefined) continue;
      const old = kept[field];
      if (Array.isArray(now) && Array.isArray(was) && Array.isArray(old)) {
        let found = false;
        const mapped = now.map((item) => {
          const at = was.indexOf(item);
          if (at >= 0 && old[at]) {
            found = true;
            return old[at]!;
          }
          return item;
        });
        if (found) kept[field] = mapped;
        else delete kept[field];
      } else delete kept[field];
    }
    if (Object.keys(kept).length) out[locale] = kept;
  }
  return out;
}

/** A record's text in a language: the translation, else as written. For texts the server composes. */
export function textIn(
  written: string,
  translations: Translations | null | undefined,
  field: string,
  locale: Locale,
): string {
  const value = translations?.[locale]?.[field];
  return typeof value === 'string' && value ? value : written;
}
