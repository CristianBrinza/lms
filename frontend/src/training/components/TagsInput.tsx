import { useState } from 'react';
import { AddIcon, CloseIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';

/**
 * A short list of names as chips: × takes one off, the field adds one (Enter or +). Suggestions
 * not yet in the list sit underneath, one tap each.
 */
export function TagsInput({
  label,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 20,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [text, setText] = useState('');
  const has = (name: string) => value.some((v) => v.toLowerCase() === name.toLowerCase());
  const add = (name: string) => {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!clean || has(clean) || value.length >= max) return;
    onChange([...value, clean]);
    setText('');
  };
  const left = suggestions.filter((s) => !has(s));
  return (
    <div className="flex flex-col gap-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={label}>
          {value.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-ink-900 py-1 pr-1 pl-3 text-sm font-semibold text-white"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(value.filter((v) => v !== name))}
                className="press grid size-7 place-items-center rounded-full text-white/80 hover:bg-white/15"
              >
                <CloseIcon fontSize="inherit" className="text-[1rem]" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2 rounded-2xl bg-ink-50 pr-1.5 pl-4 focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <input
          aria-label={label}
          value={text}
          maxLength={40}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(text);
            }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-400"
        />
        <button
          type="button"
          aria-label={`Add to ${label.toLowerCase()}`}
          disabled={!text.trim()}
          onClick={() => add(text)}
          className="press grid size-9 place-items-center rounded-full bg-ink-900 text-[1.2rem] text-white disabled:opacity-30"
        >
          <AddIcon fontSize="inherit" />
        </button>
      </div>
      {left.length ? (
        <div className="flex flex-wrap gap-1.5">
          {left.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className={cx(
                'press h-9 rounded-full bg-white px-3 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-lav-50',
              )}
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
