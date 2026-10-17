import { useId, useState } from 'react';
import { TextField } from '@/components/ui';
import { ExpandMoreIcon, LanguageIcon } from '@/components/ui/icons';
import { getLocale, LOCALE_NAMES, LOCALES, messages, type Locale, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';

const useT = messages({
  en: {
    toggle: 'In other languages',
    hint: 'Left empty, the text above is shown.',
    filled: (count: number) => (count === 1 ? '1 filled' : `${count} filled`),
  },
  ro: {
    toggle: 'În alte limbi',
    hint: 'Dacă rămâne gol, se arată textul de mai sus.',
    filled: (count: number) => (count === 1 ? '1 completată' : `${count} completate`),
  },
  ru: {
    toggle: 'На других языках',
    hint: 'Если оставить пустым, будет показан текст выше.',
    filled: (count: number) => `заполнено: ${count}`,
  },
});

export interface TranslationField {
  /** The record's field: 'name', 'note', 'instructions'… */
  key: string;
  label: string;
  multiline?: boolean;
  maxLength?: number;
}

const AREA =
  'min-h-20 w-full resize-y rounded-[1.125rem] bg-ink-50 px-4 py-3 text-base outline-none placeholder:text-ink-500 focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]';

/**
 * The same fields in the app's other two languages, folded away under the main ones. What is
 * written above stays the text everyone sees until a translation is filled in.
 *
 *   <TranslationFields fields={[{ key: 'name', label: 'Name' }]} value={tx} onChange={setTx} />
 */
export function TranslationFields({
  fields,
  value,
  onChange,
  className,
}: {
  fields: TranslationField[];
  value: Translations | null | undefined;
  onChange: (next: Translations) => void;
  className?: string;
}) {
  const t = useT();
  const id = useId();
  const others = LOCALES.filter((locale) => locale !== getLocale());
  const current = value ?? {};
  const filled = others.filter((locale) =>
    fields.some((field) => String(current[locale]?.[field.key] ?? '').trim()),
  ).length;
  const [open, setOpen] = useState(filled > 0);

  const set = (locale: Locale, key: string, text: string) => {
    // A cleared field is sent as '' (not left out), so the server's per-field merge clears it too.
    onChange({ ...current, [locale]: { ...(current[locale] ?? {}), [key]: text } });
  };

  return (
    <div className={cx('rounded-[1.25rem] bg-ink-50/60', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className="flex min-h-12 w-full items-center gap-3 px-4 text-left text-[0.9375rem] font-semibold text-ink-800"
      >
        <LanguageIcon fontSize="inherit" className="text-[1.25rem] text-ink-500" />
        <span className="flex-1">{t.toggle}</span>
        {filled ? <span className="text-sm font-medium text-ink-500">{t.filled(filled)}</span> : null}
        <ExpandMoreIcon
          fontSize="inherit"
          className={cx('text-[1.25rem] text-ink-500 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-5 px-4 pb-4">
          {others.map((locale) => (
            <div key={locale} lang={locale} className="flex flex-col gap-3">
              <p className="text-sm font-bold text-ink-900">{LOCALE_NAMES[locale]}</p>
              {fields.map((field) => {
                const text = String(current[locale]?.[field.key] ?? '');
                const label = `${field.label} · ${LOCALE_NAMES[locale]}`;
                return field.multiline ? (
                  <label key={field.key} className="flex flex-col gap-2">
                    <span className="text-[0.8125rem] font-semibold text-ink-700">{field.label}</span>
                    <textarea
                      aria-label={label}
                      rows={2}
                      value={text}
                      maxLength={field.maxLength}
                      onChange={(event) => set(locale, field.key, event.target.value)}
                      className={AREA}
                    />
                  </label>
                ) : (
                  <TextField
                    key={field.key}
                    label={field.label}
                    aria-label={label}
                    value={text}
                    maxLength={field.maxLength}
                    onChange={(event) => set(locale, field.key, event.target.value)}
                  />
                );
              })}
            </div>
          ))}
          <p className="text-sm text-ink-500">{t.hint}</p>
        </div>
      ) : null}
    </div>
  );
}
