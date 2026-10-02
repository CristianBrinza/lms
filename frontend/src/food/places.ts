import { CountertopIcon, FreezerIcon, FridgeIcon, PantryIcon } from '@/components/ui/icons';

/** The places food is kept, with their icons. */

export const LOCATION_ICON = { fridge: FridgeIcon, freezer: FreezerIcon, pantry: PantryIcon, other: CountertopIcon } as const;

export const LOCATION_OPTIONS = [
  { value: 'fridge' as const, label: 'Fridge', icon: FridgeIcon },
  { value: 'freezer' as const, label: 'Freezer', icon: FreezerIcon },
  { value: 'pantry' as const, label: 'Pantry', icon: PantryIcon },
  { value: 'other' as const, label: 'Other', icon: CountertopIcon },
];

