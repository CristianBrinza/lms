import { useQuery } from '@tanstack/react-query';
import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { ButtonLink, Chips, IconLink, Skeleton } from '@/components/ui';
import { ListIcon, SearchIcon, UploadIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { watchingApi, watchingKeys } from '../api';
import { groupPlays, PlayRow } from '../components/rows';
import {
  CheckMark,
  ErrorCard,
  ProgressBar,
  Section,
  ViewSwitcher,
  WatchingScreen,
} from '../components/parts';
import { Poster, PosterRow, Still } from '../components/Poster';
import { airDay, daysUntil, formatMinutes } from '../format';
import { useAddPlays } from '../hooks';
import { useWatchingT } from '../i18n';
import { episodeCode } from '../logic';
import { useMarkWho, useWatchView } from '../people';
import { useSpoilerGuard } from '../spoilers';
import type { ContinueItem, PlayLine, TitleKind, UpcomingItem } from '../types';
import '../watching.css';

/**
 * Watching's front door, phone first: what to watch next with one tap to tick it off, what's on
 * the list to start, new episodes coming, and what was watched lately. Shows and films apart.
 */
export default function WatchingHomePage() {
  const t = useWatchingT();
  const { view } = useWatchView();
  const [tab, setTab] = useState<TitleKind | 'all'>('all');
  const home = useQuery({
    queryKey: watchingKeys.home(view),
    queryFn: () => watchingApi.home(view),
  });
  const data = home.data;

  const startWatching = data?.startWatching.filter((x) => tab === 'all' || x.kind === tab) ?? [];
  const recent = data?.recent.filter((x) => tab === 'all' || x.title.kind === tab) ?? [];
  const empty =
    data &&
    !data.continueWatching.length &&
    !data.startWatching.length &&
    !data.recent.length &&
    !data.upcoming.length;

  return (
    <WatchingScreen
      title={t.name}
      back="/home"
      nav
      error={home.error}
      actions={
        <>
          <IconLink
            icon={ListIcon}
            label={t.lists.title}
            to="/watching/lists"
            variant="outline"
            size="sm"
          />
          <IconLink
            icon={SearchIcon}
            label={t.common.search}
            to="/watching/search"
            variant="ink"
            size="sm"
          />
        </>
      }
    >
      <ViewSwitcher className="mb-2" />
      <Chips
        label={t.name}
        dense
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all' as const, label: t.kindAll },
          ...(['tv', 'movie'] as const).map((value) => ({ value, label: t.kind[value] })),
        ]}
      />

      <div className="mt-4">
        {home.isPending ? (
          <HomeSkeleton />
        ) : home.error ? (
          <ErrorCard error={home.error} onRetry={() => void home.refetch()} />
        ) : empty ? (
          <EmptyHome />
        ) : tab !== 'movie' ? (
          <>
            {data!.continueWatching.length ? (
              <Section title={t.home.continue}>
                <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
                  {data!.continueWatching.map((item) => (
                    <li
                      key={item.title.id}
                      className="w-[85%] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none"
                    >
                      <ContinueCard item={item} />
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {startWatching.length ? (
              <Section title={t.home.start}>
                <PosterRow items={startWatching} label={t.home.start} />
              </Section>
            ) : null}
            {data!.upcoming.length ? (
              <Section title={t.home.upcoming} action={<SeeAll to="/watching/calendar" />}>
                <ul className="flex flex-col gap-2">
                  {data!.upcoming.slice(0, 5).map((item) => (
                    <li key={`${item.title.id}-${item.episode?.season}-${item.episode?.episode}`}>
                      <UpcomingRow item={item} />
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            <RecentSection items={recent} />
          </>
        ) : (
          <>
            <Section title={t.home.toWatch}>
              {startWatching.length ? (
                <PosterRow items={startWatching} label={t.home.toWatch} />
              ) : (
                <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
                  {t.home.noMovies}
                </p>
              )}
            </Section>
            <RecentSection items={recent} />
          </>
        )}

        {data && !empty && data.recent.length < 5 ? <ImportCard className="mt-6" /> : null}
      </div>
    </WatchingScreen>
  );
}

function SeeAll({ to }: { to: string }) {
  const t = useWatchingT();
  return (
    <Link to={to} viewTransition className="text-sm font-semibold text-ink-600 hover:text-ink-900">
      {t.common.seeAll}
    </Link>
  );
}

/**
 * The next episode of a show: its still, the show, which episode, how much is left, and one round
 * check to tick it off (for whoever watches it, remembered per show).
 */
function ContinueCard({ item }: { item: ContinueItem }) {
  const t = useWatchingT();
  const [guard] = useSpoilerGuard();
  const add = useAddPlays();
  // The person viewed, the people together, else whoever watches this show.
  const { who } = useMarkWho(item.title.id);
  const [ticked, setTicked] = useState(false);
  const [burst, setBurst] = useState(0);
  const code = episodeCode(item.next.season, item.next.episode);
  const leftLine = [
    item.left > 0 ? t.home.left(item.left) : t.home.caughtUp,
    item.left > 0 && item.next.runtime
      ? t.time.left(formatMinutes(item.left * item.next.runtime))
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
      <Link to={`/watching/${item.title.id}`} viewTransition className="block">
        <Still
          path={item.next.stillPath ?? item.title.backdropPath}
          blurred={guard && !!item.next.stillPath}
          sizes="(min-width: 64rem) 20rem, (min-width: 44rem) 45vw, 85vw"
        />
      </Link>
      <div className="flex flex-1 items-start gap-3 p-3.5">
        <Link to={`/watching/${item.title.id}`} viewTransition className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-bold leading-tight">
            {item.title.title}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-600">
            <span className="tabular font-semibold text-ink-800">{code}</span>
            {item.next.name && !guard ? ` · ${item.next.name}` : ''}
          </span>
          <ProgressBar share={item.progress} label={leftLine} className="mt-2.5" />
          <span className="tabular mt-1.5 block truncate text-xs font-medium text-ink-500">
            {leftLine}
          </span>
        </Link>
        <button
          type="button"
          aria-label={t.home.markNext(item.title.title, code)}
          disabled={ticked || add.isPending}
          onClick={() => {
            setTicked(true);
            setBurst((n) => n + 1);
            add.mutate(
              {
                input: {
                  titleId: item.title.id,
                  season: item.next.season,
                  episode: item.next.episode,
                  userIds: who,
                },
                message: t.home.marked(item.title.title, code),
              },
              { onSettled: () => setTicked(false) },
            );
          }}
          className="press relative -mr-0.5 shrink-0 rounded-full"
        >
          <CheckMark on={ticked} className={cx('size-11', ticked && 'watch-check-pop')} />
          {burst ? <CheckBurst key={burst} /> : null}
        </button>
      </div>
    </article>
  );
}

/** Eight dots flying out of the check, once; nothing when motion is reduced (see CSS). */
function CheckBurst() {
  return (
    <span aria-hidden="true" className="watch-burst pointer-events-none absolute inset-0">
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          style={{ '--angle': `${i * 45}deg` } as CSSProperties}
          className={cx(
            'absolute left-1/2 top-1/2 size-1.5 rounded-full',
            i % 2 ? 'bg-butter-400' : 'bg-pink-400',
          )}
        />
      ))}
    </span>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  const t = useWatchingT();
  const [guard] = useSpoilerGuard();
  const ep = item.episode;
  const days = daysUntil(item.airDate);
  return (
    <Link
      to={ep ? `/watching/${item.title.id}/season/${ep.season}` : `/watching/${item.title.id}`}
      viewTransition
      className="press flex items-center gap-3 rounded-[1.25rem] bg-white p-2.5 pr-4 shadow-[var(--shadow-xs)] hover:bg-pink-100"
    >
      <Poster
        path={item.title.posterPath}
        kind={item.title.kind}
        sizes="3rem"
        className="w-12 shrink-0 rounded-[0.625rem]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{item.title.title}</span>
        <span className="block truncate text-sm text-ink-600">
          {ep ? (
            <>
              <span className="tabular">{episodeCode(ep.season, ep.episode)}</span>
              {ep.name && !guard ? ` · ${ep.name}` : ''}
            </>
          ) : (
            t.kindOne.movie
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5">
        <span
          className={cx(
            'rounded-pill px-2.5 py-1 text-xs font-bold',
            days <= 1 ? 'bg-ink-900 text-white' : 'bg-pink-100 text-pink-800',
          )}
        >
          {airDay(item.airDate) || t.season.notAired}
        </span>
        {days > 1 && days <= 60 ? (
          <span className="tabular text-[0.6875rem] font-semibold text-ink-500">
            {t.extras.inDays(days)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function RecentSection({ items }: { items: PlayLine[] }) {
  const t = useWatchingT();
  if (!items.length) return null;
  return (
    <Section title={t.home.recent} action={<SeeAll to="/watching/stats" />}>
      <ul className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
        {groupPlays(items)
          .slice(0, 8)
          .map((group) => (
            <li key={group[0]!.id} className="border-b border-ink-100 last:border-0">
              <PlayRow play={group[0]!} group={group} />
            </li>
          ))}
      </ul>
    </Section>
  );
}

function ImportCard({ className }: { className?: string }) {
  const t = useWatchingT();
  return (
    <div
      className={cx(
        'flex flex-wrap items-center justify-between gap-3 rounded-[1.25rem] bg-pink-100 px-4 py-3.5',
        className,
      )}
    >
      <p className="min-w-0 flex-1 text-sm font-medium text-ink-800">{t.home.importLine}</p>
      <ButtonLink to="/watching/import" size="sm" variant="primary" icon={UploadIcon}>
        {t.home.import}
      </ButtonLink>
    </div>
  );
}

function EmptyHome() {
  const t = useWatchingT();
  return (
    <div className="flex flex-col gap-3">
      <section className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-[1.0625rem] font-bold">{t.home.emptyTitle}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-600">{t.home.emptyBody}</p>
        <ButtonLink to="/watching/search" icon={SearchIcon} size="md" className="mt-4">
          {t.home.find}
        </ButtonLink>
      </section>
      <ImportCard />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className="h-6 w-40 rounded-lg" />
      <div className="flex gap-3 overflow-hidden">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="w-[85%] max-w-[22rem] shrink-0 overflow-hidden rounded-[1.5rem] bg-white"
          >
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className="p-3.5">
              <Skeleton className="h-4 w-2/3 rounded-md" />
              <Skeleton className="mt-2 h-3 w-1/2 rounded-md" />
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
