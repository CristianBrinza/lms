import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui';
import { cx } from '@/lib/cx';
import type { KitchenPerson } from '../types';

/** Who eats: the household's people as picture pills, several at once. */
export function WhoEats({
  label,
  people,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  people: KitchenPerson[];
  value: string[];
  onChange: (next: string[]) => void;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] md:flex-wrap"
      >
        {people.map((person) => {
          const on = value.includes(person.id);
          return (
            <button
              key={person.id}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() =>
                onChange(on ? value.filter((id) => id !== person.id) : [...value, person.id])
              }
              className={cx(
                'press inline-flex h-10 shrink-0 items-center gap-2 rounded-pill pl-1 pr-3.5 text-sm font-semibold transition-colors disabled:opacity-45',
                on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
              )}
            >
              <Avatar person={person} size="sm" className="size-8 ring-0" />
              {person.name}
            </button>
          );
        })}
      </div>
      {hint ? <p className="text-sm text-ink-600">{hint}</p> : null}
    </div>
  );
}
