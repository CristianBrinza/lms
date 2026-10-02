import { Chips } from '@/components/ui';
import { LOCATION_OPTIONS } from '../places';
import type { Location } from '../types';

/** Where it is kept: fridge, freezer, pantry or elsewhere. */
export function LocationPicker({ value, onChange, label = 'Kept in' }: { value: Location; onChange: (value: Location) => void; label?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <Chips label={label} value={value} onChange={onChange} tone="sheet" options={LOCATION_OPTIONS} />
    </div>
  );
}
