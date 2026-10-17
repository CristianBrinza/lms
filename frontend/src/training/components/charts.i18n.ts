import { formatNumber, intlLocale, messages, plural } from '@/i18n';
import { parseDay } from '@/food/format';

/** The words Training's charts read out: summaries for assistive tech, the calendar's key. */

const en = {
  nothingYet: (label: string) => `${label}: nothing yet.`,
  line: {
    summary: (
      label: string,
      count: number,
      first: string,
      last: string,
      latest: string,
      best: string,
      bestDay: string,
    ) =>
      `${label}: ${plural(count, { one: '# day', other: '# days' })} from ${first} to ${last}. Latest ${latest}, best ${best} on ${bestDay}.`,
    latest: (value: string) => `Latest ${value}`,
  },
  bars: {
    summary: (label: string, count: number, total: string, most: string | null) =>
      `${label}: ${plural(count, { one: '# bar', other: '# bars' })}, ${total} in all${most ? `, most ${most}` : ''}.`,
  },
  heat: {
    summary: (trained: number, days: number, from: string, to: string) =>
      `Trained on ${trained} of ${plural(days, { one: '# day', other: '# days' })}, ${from} to ${to}.`,
    less: 'Less',
    more: 'More',
  },
};

const ro: typeof en = {
  nothingYet: (label) => `${label}: încă nimic.`,
  line: {
    summary: (label, count, first, last, latest, best, bestDay) =>
      `${label}: ${plural(count, { one: '# zi', few: '# zile', other: '# de zile' })}, de la ${first} până la ${last}. Ultima valoare ${latest}, cea mai bună ${best} pe ${bestDay}.`,
    latest: (value) => `Ultima ${value}`,
  },
  bars: {
    summary: (label, count, total, most) =>
      `${label}: ${plural(count, { one: '# coloană', few: '# coloane', other: '# de coloane' })}, ${total} în total${most ? `, cel mai mult ${most}` : ''}.`,
  },
  heat: {
    summary: (trained, days, from, to) =>
      `Antrenament în ${trained} din ${plural(days, { one: '# zi', few: '# zile', other: '# de zile' })}, ${from} – ${to}.`,
    less: 'Mai puțin',
    more: 'Mai mult',
  },
};

const ru: typeof en = {
  nothingYet: (label) => `${label}: пока ничего.`,
  line: {
    summary: (label, count, first, last, latest, best, bestDay) =>
      `${label}: ${plural(count, { one: '# день', few: '# дня', many: '# дней', other: '# дня' })}, с ${first} по ${last}. Последнее значение ${latest}, лучшее ${best}, ${bestDay}.`,
    latest: (value) => `Последнее ${value}`,
  },
  bars: {
    summary: (label, count, total, most) =>
      `${label}: ${plural(count, { one: '# столбец', few: '# столбца', many: '# столбцов', other: '# столбца' })}, всего ${total}${most ? `, больше всего ${most}` : ''}.`,
  },
  heat: {
    summary: (trained, days, from, to) =>
      `Тренировки в ${trained} из ${plural(days, { one: '# дня', few: '# дней', many: '# дней', other: '# дня' })}, ${from} – ${to}.`,
    less: 'Меньше',
    more: 'Больше',
  },
};

export const chartsT = messages({ en, ro, ru });
export const useChartsT = chartsT;

// ---------------------------------------------------------------- numbers and dates, in the current language

/**
 * Whole numbers grouped by plain spaces in every language, as Training always wrote them: "12 480".
 * Every group separator (comma, dot, no-break space) becomes a space; digits and the sign stay.
 */
export const wholeNumber = (n: number) => formatNumber(Math.round(n)).replace(/[^\d-]/g, ' ');

const formats = new Map<string, Intl.DateTimeFormat>();
function dateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const tag = `${intlLocale()}|${JSON.stringify(options)}`;
  let format = formats.get(tag);
  if (!format) {
    format = new Intl.DateTimeFormat(intlLocale(), options);
    formats.set(tag, format);
  }
  return format;
}

/** "6 Oct", "6 oct.", "6 окт." */
export const dayMonth = (day: string) =>
  dateFormat({ day: 'numeric', month: 'short' }).format(parseDay(day));

/** "Tue", "mar.", "вт" */
export const weekday = (day: string) => dateFormat({ weekday: 'short' }).format(parseDay(day));

/** "Oct", "oct.", "окт." */
export const monthShort = (day: string) => dateFormat({ month: 'short' }).format(parseDay(day));
