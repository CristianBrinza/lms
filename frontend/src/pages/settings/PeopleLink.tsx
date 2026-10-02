import { ListRowLink } from '@/components/ui';
import { HealthIcon } from './icons';

/** The settings row that opens Food's kitchen people and their allergies (/food/people). */
export function PeopleLink() {
  return <ListRowLink to="/food/people" icon={HealthIcon} label="Kitchen people and allergies" detail="Allergies and foods people avoid" />;
}
