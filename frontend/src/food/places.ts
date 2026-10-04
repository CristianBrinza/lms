import {
  BathroomIcon,
  CountertopIcon,
  FreezerIcon,
  FridgeIcon,
  GardenIcon,
  PantryIcon,
  StorageIcon,
} from '@/components/ui/icons';

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

export const LOCATION_OPTIONS = [
  { value: 'fridge' as const, label: 'Fridge', icon: FridgeIcon },
  { value: 'freezer' as const, label: 'Freezer', icon: FreezerIcon },
  { value: 'pantry' as const, label: 'Shelf', icon: PantryIcon },
  { value: 'garden' as const, label: 'Garden', icon: GardenIcon },
  { value: 'bathroom' as const, label: 'Bathroom', icon: BathroomIcon },
  { value: 'storage' as const, label: 'Storage', icon: StorageIcon },
  { value: 'other' as const, label: 'Other', icon: CountertopIcon },
];
