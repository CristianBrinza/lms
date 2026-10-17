import { ListRowLink } from '@/components/ui';
import { HealthIcon } from './icons';
import { settingsT } from './i18n';

/** The settings row that opens Food's kitchen people and their allergies (/food/people). */
export function PeopleLink() {
  const t = settingsT();
  return (
    <ListRowLink to="/food/people" icon={HealthIcon} label={t.people} detail={t.peopleDetail} />
  );
}
