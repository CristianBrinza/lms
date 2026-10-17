import {
  BathroomIcon,
  CountertopIcon,
  FreezerIcon,
  FridgeIcon,
  GardenIcon,
  PantryIcon,
  StorageIcon,
} from '@/components/ui/icons';
import { LOCATION_LABEL } from './format';
import type { Location } from './types';

/** The places food is kept, with their icons: fridge, freezer, shelf, the balcony garden, elsewhere. */

export const LOCATION_ICON = {
  fridge: FridgeIcon,
  freezer: FreezerIcon,
  pantry: PantryIcon,
  garden: GardenIcon,
  bathroom: BathroomIcon,
  storage: StorageIcon,
  other: CountertopIcon,
} as const;

/** Chips' options; each label is read in the current language when it is shown. */
export const LOCATION_OPTIONS = (Object.keys(LOCATION_ICON) as Location[]).map((value) => ({
  value,
  get label() {
    return LOCATION_LABEL[value];
  },
  icon: LOCATION_ICON[value],
}));
