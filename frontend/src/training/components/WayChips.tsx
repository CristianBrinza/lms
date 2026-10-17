import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { kg } from '../format';
import { useTrainingT } from '../i18n';
import type { ExerciseOption } from '../types';

/**
 * How it's done: the exercise's variations and the pieces of its equipment (the bar's grips, each
 * band with its kg), plus "Any". A band chosen brings its resistance as the weight.
 */
export function WayChips({
  options,
  value,
  onChange,
  label,
  tone = 'light',
}: {
  options: ExerciseOption[];
  value: string | undefined | null;
  onChange: (name: string | undefined, option: ExerciseOption | null) => void;
  label?: string;
  tone?: 'light' | 'dark';
}) {
  const t = useTrainingT();
  if (!options.length) return null;
  const chip = (active: boolean) =>
    cx(
      'press h-10 shrink-0 rounded-full px-3.5 text-sm font-semibold transition-colors',
      tone === 'dark'
        ? active
          ? 'bg-butter-300 text-ink-900'
          : 'bg-white/10 text-white hover:bg-white/15'
        : active
          ? 'bg-ink-900 text-white'
          : 'bg-white text-ink-800 ring-1 ring-inset ring-ink-200 hover:bg-lav-50',
    );
  return (
    <div role="radiogroup" aria-label={label ?? t.how} className="flex flex-wrap gap-1.5">
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        className={chip(!value)}
        onClick={() => onChange(undefined, null)}
      >
        {t.any}
      </button>
      {options.map((o) => (
        <button
          key={`${o.from}-${o.name}`}
          type="button"
          role="radio"
          aria-checked={value === o.name}
          title={
            o.equipment ? t.wayOf(tr(o, 'equipment') ?? o.equipment, tr(o, 'name')) : tr(o, 'name')
          }
          className={chip(value === o.name)}
          onClick={() => onChange(o.name, o)}
        >
          {tr(o, 'name')}
          {o.kg !== null ? <span className="tabular ml-1 opacity-70">{kg(o.kg)}</span> : null}
        </button>
      ))}
    </div>
  );
}
