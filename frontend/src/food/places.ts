import {
  CountertopIcon,
  FreezerIcon,
  FridgeIcon,
  GardenIcon,
  PantryIcon,
} from '@/components/ui/icons';

/** The places food is kept, with their icons: fridge, freezer, shelf, the balcony garden, elsewhere. */

export const LOCATION_ICON = {
  fridge: FridgeIcon,
  freezer: FreezerIcon,
  pantry: PantryIcon,
  garden: GardenIcon,
  other: CountertopIcon,
} as const;

export const LOCATION_OPTIONS = [
  { value: 'fridge' as const, label: 'Fridge', icon: FridgeIcon },
  { value: 'freezer' as const, label: 'Freezer', icon: FreezerIcon },
  { value: 'pantry' as const, label: 'Shelf', icon: PantryIcon },
  { value: 'garden' as const, label: 'Garden', icon: GardenIcon },
  { value: 'other' as const, label: 'Other', icon: CountertopIcon },
];
