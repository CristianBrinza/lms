import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Avatar, Skeleton } from '@/components/ui';
import { formatNumber } from '@/i18n';
import { cx } from '@/lib/cx';
import { drinksApi, drinksKeys, type DrinkStats } from '../api';
import { Cover, DrinksScreen, ErrorCard, Section, Stars } from '../components/parts';
import { countryName, stars } from '../format';
import { useDrinksT } from '../i18n';

/** The journal in numbers: this year, the most loved, by kind and country, who tastes. */
export default function StatsPage() {
  const t = useDrinksT();
  const query = useQuery({ queryKey: drinksKeys.stats, queryFn: drinksApi.stats });
  return (
    <DrinksScreen nav back="/drinks" title={t.statsTitle} subtitle={t.statsSubtitle}>
      {query.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-24 rounded-[1.5rem]" />
          <Skeleton className="h-48 rounded-[1.75rem]" />
          <Skeleton className="h-40 rounded-[1.5rem]" />
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data ? (
        <Body stats={query.data} />
      ) : null}
    </DrinksScreen>
  );
}

function Body({ stats }: { stats: DrinkStats }) {
  const t = useDrinksT();
  const { totals, thisYear } = stats;
  const tiles = [
    { label: t.totals.tried, value: totals.tried },
    { label: t.totals.tastings, value: totals.tastings },
    { label: t.totals.countries, value: totals.countries },
    { label: t.totals.bottles, value: totals.bottles },
  ];
  return (
    <>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-[1.25rem] bg-white px-4 py-3.5 shadow-[var(--shadow-xs)]">
            <dt className="text-xs font-semibold text-ink-500">{tile.label}</dt>
            <dd className="tabular mt-0.5 text-[1.75rem] font-bold leading-none tracking-[-0.03em]">
              {formatNumber(tile.value)}
            </dd>
          </div>
        ))}
      </dl>

      {!totals.tastings ? (
        <p className="mt-4 rounded-[1.5rem] bg-white p-5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
          {t.statsEmpty}
        </p>
      ) : null}

      {thisYear.tastings ? (
        <section className="relative mt-4 overflow-hidden rounded-[1.75rem] bg-ink-900 p-5 text-white shadow-[var(--shadow-raised)]">
          <span
            aria-hidden="true"
            className="tabular pointer-events-none absolute -right-3 -top-7 text-[8rem] font-bold leading-none tracking-[-0.06em] text-white/[0.07]"
          >
            {thisYear.year}
          </span>
          <h2 className="relative text-sm font-semibold text-white/70">{t.thisYear(thisYear.year)}</h2>
          <p className="relative mt-1 text-[1.5rem] font-bold leading-tight tracking-[-0.02em]">
            {t.yearTastings(thisYear.tastings)}
          </p>
          <p className="relative mt-0.5 text-sm text-white/75">
            {[t.yearDrinks(thisYear.drinks), thisYear.firsts ? t.yearFirsts(thisYear.firsts) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {thisYear.top.length ? (
            <div className="relative mt-4">
              <p className="mb-2 text-xs font-semibold text-butter-200">{t.yearTop}</p>
              <ol className="flex flex-col gap-1.5">
                {thisYear.top.map(({ drink, rating }, index) => (
                  <li key={drink.id}>
                    <Link
                      to={`/drinks/${drink.id}`}
                      viewTransition
                      className="press flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2 pr-3 hover:bg-white/10"
                    >
                      <span className="tabular w-6 text-center text-sm font-bold text-white/50">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{drink.name}</span>
                      {rating !== null ? (
                        <span className="tabular text-sm font-bold text-butter-200">{t.avgShort(stars(rating))}</span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </section>
      ) : null}

      {stats.mostLoved.length ? (
        <Section title={t.mostLoved}>
          <ol className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-xs)]">
            {stats.mostLoved.map((drink, index) => (
              <li key={drink.id} className="border-b border-ink-100 last:border-0">
                <Link
                  to={`/drinks/${drink.id}`}
                  viewTransition
                  className="press flex items-center gap-3 px-3 py-2.5 hover:bg-ink-50"
                >
                  <span className="tabular w-7 text-center text-[1.25rem] font-bold tracking-[-0.03em] text-ink-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Cover drink={drink} className="w-10 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{drink.name}</span>
                    <span className="block truncate text-xs text-ink-500">
                      {[t.category[drink.category], countryName(drink.country), t.tastingsCount(drink.tastings)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end">
                    <span className="tabular text-sm font-bold">{stars(drink.rating ?? 0)}</span>
                    <Stars value={Math.round(drink.rating ?? 0)} size="xs" />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {stats.byCategory.length ? (
        <Section title={t.byKind}>
          <Bars
            rows={stats.byCategory.map((row) => ({
              key: row.category,
              label: t.category[row.category],
              value: row.drinks,
              rating: row.rating,
            }))}
          />
        </Section>
      ) : null}

      {stats.byCountry.length ? (
        <Section title={t.byCountry}>
          <Bars
            rows={stats.byCountry.map((row) => ({
              key: row.country,
              label: countryName(row.country),
              value: row.drinks,
              rating: row.rating,
            }))}
          />
        </Section>
      ) : null}

      {stats.tastedIn.length ? (
        <Section title={t.tastedInCountries}>
          <ul className="flex flex-wrap gap-1.5">
            {stats.tastedIn.map((row) => (
              <li
                key={row.country}
                className="inline-flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-sm font-semibold shadow-[var(--shadow-xs)]"
              >
                {countryName(row.country)}
                <span className="tabular text-ink-400">{row.tastings}</span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {stats.years.length > 1 ? (
        <Section title={t.byYear}>
          <YearChart years={stats.years} />
        </Section>
      ) : null}

      {stats.people.length > 1 ? (
        <Section title={t.people}>
          <ul className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-xs)]">
            {stats.people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 border-b border-ink-100 px-4 py-3 last:border-0">
                <Avatar person={{ id: person.id, name: person.name, surname: '' }} size="sm" />
                <span className="min-w-0 flex-1 truncate font-semibold">{person.name}</span>
                <span className="tabular text-sm text-ink-600">{t.tastingsCount(person.tastings)}</span>
                {person.rating !== null ? (
                  <span className="tabular w-12 text-right text-sm font-bold">{t.avgShort(stars(person.rating))}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}

/** Horizontal bars: how many, with the average stars at the end. */
function Bars({
  rows,
}: {
  rows: { key: string; label: string; value: number; rating: number | null }[];
}) {
  const t = useDrinksT();
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className="flex flex-col gap-2 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-xs)]">
      {rows.slice(0, 12).map((row, index) => (
        <li key={row.key} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_3rem] items-center gap-3">
          <span className="truncate text-sm font-semibold">{row.label}</span>
          <span className="flex items-center gap-2">
            <span
              className={cx(
                'h-6 rounded-r-lg rounded-l-sm transition-[width] duration-500',
                index === 0 ? 'bg-ink-900' : 'bg-lav-300',
              )}
              style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }}
            />
            <span className="tabular text-sm font-bold text-ink-700">{row.value}</span>
          </span>
          <span className="tabular text-right text-xs font-semibold text-ink-500">
            {row.rating !== null ? t.avgShort(stars(row.rating)) : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

function YearChart({ years }: { years: DrinkStats['years'] }) {
  const max = Math.max(1, ...years.map((y) => y.tastings));
  return (
    <div className="flex h-40 items-end gap-2 rounded-[1.5rem] bg-white p-4 pb-3 shadow-[var(--shadow-xs)]">
      {years.slice(-10).map((year) => (
        <div key={year.year} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="tabular text-xs font-bold text-ink-700">{year.tastings}</span>
          <span
            className="w-full max-w-10 rounded-t-lg bg-lav-300"
            style={{ height: `${Math.max(4, (year.tastings / max) * 88)}px` }}
          />
          <span className="tabular text-[0.6875rem] font-semibold text-ink-500">{year.year}</span>
        </div>
      ))}
    </div>
  );
}
