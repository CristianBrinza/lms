import { messages, tr } from '@/i18n';
import { formatQty, localDate, locationIn, relativeDayInline } from './format';
import type { Opened } from './types';

const openedT = messages({
  en: {
    line: (name: string, left: string, where: string, by: string | null) =>
      `${name}: ${left} left ${where}${by ? `, use by ${by}` : ''}`,
  },
  ro: {
    line: (name: string, left: string, where: string, by: string | null) =>
      `${name}: au rămas ${left} ${where}${by ? `, de folosit până ${by}` : ''}`,
  },
  ru: {
    line: (name: string, left: string, where: string, by: string | null) =>
      `${name}: осталось ${left} ${where}${by ? `, использовать до ${by}` : ''}`,
  },
});

/** What cooking opened, said plainly: "Canned corn: 320 g left in the fridge, use by Mon." */
export function openedText(opened: Opened[], today = localDate()): string {
  const t = openedT();
  return opened
    .map((o) =>
      t.line(
        tr(o, 'name'),
        formatQty(o.left, o),
        locationIn(o.location),
        o.expiresOn ? relativeDayInline(o.expiresOn, today) : null,
      ),
    )
    .join('. ');
}
