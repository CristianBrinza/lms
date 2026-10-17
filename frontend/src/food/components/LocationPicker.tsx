import { Chips } from '@/components/ui';
import { LOCATION_OPTIONS } from '../places';
import type { Location } from '../types';
import { foodUiT } from './components.i18n';

/** Where it is kept: fridge, freezer, pantry or elsewhere. */
export function LocationPicker({
  value,
  onChange,
  label,
}: {
  value: Location;
  onChange: (value: Location) => void;
  label?: string;
}) {
  const shown = label ?? foodUiT().keptIn;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{shown}</span>
      <Chips
        label={shown}
        value={value}
        onChange={onChange}
        tone="sheet"
        options={LOCATION_OPTIONS}
      />
    </div>
  );
}
