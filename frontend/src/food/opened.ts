import { formatQty, LOCATION_LABEL, localDate, relativeDay } from './format';
import type { Opened } from './types';

/** What cooking opened, said plainly: "Canned corn: 320 g left in the fridge, use by Mon." */
export function openedText(opened: Opened[], today = localDate()): string {
  return opened
    .map((o) => `${o.name}: ${formatQty(o.left, o)} left in the ${LOCATION_LABEL[o.location].toLowerCase()}${o.expiresOn ? `, use by ${relativeDay(o.expiresOn, today).toLowerCase()}` : ''}`)
    .join('. ');
}
