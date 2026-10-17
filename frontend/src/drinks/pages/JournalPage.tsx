import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui';
import { intlLocale, getLocale } from '@/i18n';
import { drinksApi, drinksKeys, type JournalEntry } from '../api';
import { Cover, DrinksScreen, ErrorCard, Stars } from '../components/parts';
import { countryName } from '../format';
import { useDrinksT } from '../i18n';

/** Every tasting at home, newest first, by month: the diary of glasses. */
export default function JournalPage() {
  const t = useDrinksT();
  const query = useQuery({ queryKey: drinksKeys.journal, queryFn: () => drinksApi.journal() });
  const entries = query.data?.tastings ?? [];
  const month = new Intl.DateTimeFormat(intlLocale(getLocale()), { month: 'long', year: 'numeric' });
  const day = new Intl.DateTimeFormat(intlLocale(getLocale()), { day: 'numeric' });
  const weekday = new Intl.DateTimeFormat(intlLocale(getLocale()), { weekday: 'short' });

  const months: { key: string; label: string; entries: JournalEntry[] }[] = [];
  for (const entry of entries) {
    const key = entry.tastedOn.slice(0, 7);
    let group = months.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: month.format(new Date(`${key}-01T12:00:00`)), entries: [] };
      months.push(group);
    }
    group.entries.push(entry);
  }

  return (
    <DrinksScreen
      nav
      back="/drinks"
      title={t.journalTitle}
      subtitle={query.data ? t.journalSubtitle(entries.length) : ' '}
    >
      {query.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-[1.25rem]" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : !entries.length ? (
        <p className="rounded-[1.5rem] bg-white p-5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
          {t.journalEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {months.map((group) => (
            <section key={group.key}>
              <h2 className="mb-2 px-1 text-[1.0625rem] font-bold capitalize tracking-[-0.01em]">
                {group.label}
              </h2>
              <ol className="relative flex flex-col gap-2 before:absolute before:bottom-3 before:left-[1.6rem] before:top-3 before:w-px before:bg-ink-200">
                {group.entries.map((entry) => {
                  const date = new Date(`${entry.tastedOn}T12:00:00`);
                  const where = [entry.place, countryName(entry.country)].filter(Boolean).join(' · ');
                  return (
                    <li key={entry.id}>
                      <Link
                        to={`/drinks/${entry.drink.id}`}
                        viewTransition
                        className="press relative flex items-center gap-3 rounded-[1.25rem] bg-white p-2.5 pr-4 shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-card)]"
                      >
                        <span className="tabular relative z-10 flex w-9 shrink-0 flex-col items-center leading-none">
                          <span className="text-[1.125rem] font-bold">{day.format(date)}</span>
                          <span className="mt-0.5 text-[0.625rem] font-semibold uppercase text-ink-500">
                            {weekday.format(date)}
                          </span>
                        </span>
                        <Cover
                          drink={{
                            category: entry.drink.category,
                            cover: entry.drink.cover
                              ? { id: entry.drink.id, thumb: entry.drink.cover, full: entry.drink.cover }
                              : null,
                          }}
                          className="w-11 shrink-0 rounded-xl"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{entry.drink.name}</span>
                          <span className="block truncate text-xs text-ink-500">
                            {[entry.person.name, where].filter(Boolean).join(' · ')}
                          </span>
                          {entry.comment ? (
                            <span className="mt-0.5 line-clamp-1 block text-sm text-ink-700">
                              {entry.comment}
                            </span>
                          ) : null}
                        </span>
                        <Stars value={entry.rating} size="xs" className="shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </DrinksScreen>
  );
}
