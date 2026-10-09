import { AddIcon, RemoveIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { GEAR_ICON } from './format';
import type { Gear } from './types';

type Taken = Array<{ gearId: string; count: number }>;

/** Which gear a trip takes, and how many of each (up to what the household has). */
export function GearPicker({
  gear,
  value,
  onChange,
}: {
  gear: Gear[];
  value: Taken;
  onChange: (next: Taken) => void;
}) {
  if (!gear.length) return null;
  const countOf = (id: string) => value.find((g) => g.gearId === id)?.count ?? 0;
  const set = (id: string, count: number) =>
    onChange(
      count <= 0
        ? value.filter((g) => g.gearId !== id)
        : countOf(id)
          ? value.map((g) => (g.gearId === id ? { ...g, count } : g))
          : [...value, { gearId: id, count }],
    );
  return (
    <ul className="flex flex-col gap-1.5">
      {gear.map((g) => {
        const Icon = GEAR_ICON[g.kind];
        const n = countOf(g.id);
        const max = Math.max(1, g.count);
        return (
          <li
            key={g.id}
            className={cx(
              'flex items-center gap-3 rounded-[1.125rem] py-1.5 pl-3 pr-1.5 transition-colors',
              n ? 'bg-cyan-100' : 'bg-ink-50',
            )}
          >
            <Icon fontSize="inherit" className="shrink-0 text-[1.3rem] text-cyan-800" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.9375rem] font-semibold">{g.name}</span>
              <span className="block truncate text-xs text-ink-600">
                {[g.connectors.join(', '), `${g.count} at home`].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={`One fewer ${g.name}`}
                disabled={!n}
                onClick={() => set(g.id, n - 1)}
                className="press grid size-9 place-items-center rounded-full bg-white text-[1.1rem] shadow-xs disabled:opacity-40"
              >
                <RemoveIcon fontSize="inherit" />
              </button>
              <span className="tabular w-7 text-center font-bold" aria-label={`${n} taken`}>
                {n}
              </span>
              <button
                type="button"
                aria-label={`One more ${g.name}`}
                disabled={n >= max}
                onClick={() => set(g.id, n + 1)}
                className="press grid size-9 place-items-center rounded-full bg-white text-[1.1rem] shadow-xs disabled:opacity-40"
              >
                <AddIcon fontSize="inherit" />
              </button>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
