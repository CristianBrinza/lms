import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import { Skeleton } from '@/components/ui';
import { intlLocale } from '@/i18n';
import { watchingApi, watchingKeys } from '../api';
import { ErrorCard, Section, WatchingScreen } from '../components/parts';
import { Face, PosterCard } from '../components/Poster';
import { useWatchingT } from '../i18n';

/** An actor: their face, a few facts, the biography (folded), and the films and shows they're in. */
export default function PersonPage() {
  const { personId = '' } = useParams();
  const t = useWatchingT();
  const query = useQuery({
    queryKey: watchingKeys.person(personId),
    queryFn: () => watchingApi.person(personId),
    staleTime: 60 * 60_000,
  });
  const person = query.data?.person;
  const [more, setMore] = useState(false);
  const date = (d: string) =>
    new Intl.DateTimeFormat(intlLocale(), {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${d.slice(0, 10)}T12:00:00`));

  return (
    <WatchingScreen
      title={person?.name ?? ' '}
      subtitle={person?.knownFor ?? ' '}
      error={query.error}
    >
      {query.isPending ? (
        <div aria-hidden="true" className="flex gap-4">
          <Skeleton className="size-28 rounded-full" />
          <Skeleton className="h-20 flex-1 rounded-2xl" />
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : person ? (
        <>
          <div className="flex items-center gap-4">
            <Face path={person.profilePath} className="w-28 shrink-0 shadow-[var(--shadow-card)]" />
            <div className="min-w-0 text-sm text-ink-600">
              {person.birthday ? (
                <p>{t.person.born(date(person.birthday), person.placeOfBirth)}</p>
              ) : null}
              {person.deathday ? <p>{t.person.died(date(person.deathday))}</p> : null}
            </div>
          </div>
          {person.biography ? (
            <Section title={t.person.biography} className="mt-6">
              <p
                className={
                  more
                    ? 'max-w-prose text-[0.9375rem] leading-relaxed text-ink-700'
                    : 'line-clamp-5 max-w-prose text-[0.9375rem] leading-relaxed text-ink-700'
                }
              >
                {person.biography}
              </p>
              {!more && person.biography.length > 320 ? (
                <button
                  type="button"
                  onClick={() => setMore(true)}
                  className="mt-1 text-sm font-semibold text-ink-600 hover:text-ink-900"
                >
                  {t.title.more}
                </button>
              ) : null}
            </Section>
          ) : null}
          {person.credits.length ? (
            <Section title={t.person.credits}>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
                {person.credits.map((credit) => (
                  <li key={credit.id}>
                    <PosterCard
                      title={credit}
                      sizes="(min-width: 64rem) 9rem, 30vw"
                      line={[credit.year, credit.role].filter(Boolean).join(' · ')}
                    />
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}
    </WatchingScreen>
  );
}
