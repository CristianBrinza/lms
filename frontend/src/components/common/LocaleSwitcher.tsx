import { LOCALE_NAMES, LOCALES, setLocale, useLocale } from '@/i18n';
import { cx } from '@/lib/cx';
import { uiT } from '../i18n';

/**
 * The language before anyone signs in (the start and sign-in screens): three short choices in a
 * pill, the chosen one in white. Kept on this device; the account takes it on sign-in.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  return (
    <div
      role="group"
      aria-label={uiT().language}
      className={cx('inline-flex h-9 items-center rounded-pill bg-white/55 p-1', className)}
    >
      {LOCALES.map((option) => {
        const active = option === locale;
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={active}
            aria-label={LOCALE_NAMES[option]}
            title={LOCALE_NAMES[option]}
            onClick={() => setLocale(option)}
            className={cx(
              'press h-7 min-w-9 rounded-pill px-2 text-xs font-semibold uppercase transition-colors duration-200',
              active
                ? 'bg-white text-ink-900 shadow-[var(--shadow-xs)]'
                : 'text-lav-900 hover:text-ink-900',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
