import { Fragment, useId, useState } from 'react';
import { AddIcon } from '@/components/ui/icons';
import type { Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { kindText } from '../format';
import { FoodIcon } from '../icons/FoodIcon';
import { foodUiT } from './components.i18n';

/**
 * Which kind: the item's kinds as pills (Cheddar, Gouda; Finlandia, Absolut; Apple, Mango-peach),
 * "Any" first, and "Other…" to name a new one — it is remembered for next time. Kinds show in the
 * current language when the item's translations name them; the value stays the stored kind.
 */
export function VariantChips({
  variants,
  value,
  onChange,
  label,
  anyLabel,
  icons = {},
  translations,
}: {
  variants: string[];
  /** A picture per kind (keys in lower case): Zero's black can, Penne's tubes. */
  icons?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  anyLabel?: string;
  /** The item's translations: `{ ro: { variants: [...] } }` names the kinds. */
  translations?: Translations | null;
}) {
  const t = foodUiT().kinds;
  const id = useId();
  const custom = Boolean(value) && !variants.some((v) => v.toLowerCase() === value.toLowerCase());
  const [typing, setTyping] = useState(custom);
  const options = ['', ...variants];
  const shown = label ?? t.label;
  const other = typing ? (
    <span className="inline-flex h-9 shrink-0 items-center rounded-pill bg-white px-3 ring-2 ring-ink-900">
      <label htmlFor={id} className="sr-only">
        {t.another}
      </label>
      <input
        id={id}
        autoFocus
        value={value}
        maxLength={40}
        placeholder={t.another}
        onChange={(event) => onChange(event.target.value)}
        className="w-32 bg-transparent text-sm font-semibold outline-none"
      />
    </span>
  ) : (
    <button
      type="button"
      onClick={() => {
        setTyping(true);
        onChange('');
      }}
      className="press inline-flex h-9 shrink-0 items-center gap-1 rounded-pill bg-butter-100 px-3 text-sm font-semibold hover:bg-butter-200"
    >
      <AddIcon fontSize="inherit" className="text-base" />
      {t.other}
    </button>
  );
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{shown}</span>
      <div
        className={cx(
          '-mx-1 flex gap-1.5 px-1 pb-0.5',
          variants.length > 4 ? 'flex-wrap' : 'overflow-x-auto [scrollbar-width:none] md:flex-wrap',
        )}
      >
        {options.map((option, index) => {
          const on = !typing && option.toLowerCase() === value.toLowerCase();
          return (
            <Fragment key={option || 'any'}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setTyping(false);
                  onChange(option);
                }}
                className={cx(
                  'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill text-sm font-semibold transition-colors',
                  icons[option.toLowerCase()] ? 'pr-3.5 pl-1.5' : 'px-3.5',
                  on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                )}
              >
                {icons[option.toLowerCase()] ? (
                  <span className="grid size-6 place-items-center rounded-full bg-white">
                    <FoodIcon name={icons[option.toLowerCase()]!} className="size-5" />
                  </span>
                ) : null}
                {option ? kindText(option, { variants, translations }) : (anyLabel ?? t.any)}
              </button>
              {index === 0 ? other : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
