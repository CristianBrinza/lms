import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { Skeleton } from '@/components/ui';
import { cx } from '@/lib/cx';
import { watchingApi, watchingKeys } from '../api';
import { EpisodeList } from '../components/EpisodeList';
import { ErrorCard, ViewSwitcher, WatchingScreen } from '../components/parts';
import { useWatchingT } from '../i18n';
import { realSeasons } from '../logic';
import { useWatchView, useWho } from '../people';

/** One season, full screen: its episodes with checks, the spoiler guard, the other seasons a tap away. */
export default function SeasonPage() {
  const { id = '', n = '1' } = useParams();
  const season = Number(n) || 0;
  const t = useWatchingT();
  const { view, ids } = useWatchView();
  const { who: remembered } = useWho(id);
  const title = useQuery({
    queryKey: watchingKeys.title(id, view),
    queryFn: () => watchingApi.title(id, view),
  });
  const data = title.data;
  const who = view.kind === 'together' ? ids : remembered;

  return (
    <WatchingScreen
      title={t.season.title(season)}
      subtitle={data?.title.title ?? ' '}
      back={`/watching/${id}`}
      error={title.error}
    >
      <ViewSwitcher className="mb-3" />
      {title.isPending ? (
        <Skeleton className="h-40 rounded-[1.25rem]" />
      ) : title.error ? (
        <ErrorCard error={title.error} onRetry={() => void title.refetch()} />
      ) : data ? (
        <>
          {realSeasons(data.title.seasons).length > 1 ? (
            <nav
              aria-label={t.title.seasons}
              className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]"
            >
              {realSeasons(data.title.seasons).map((s) => (
                <Link
                  key={s.n}
                  to={`/watching/${id}/season/${s.n}`}
                  replace
                  aria-current={s.n === season ? 'page' : undefined}
                  className={cx(
                    'press inline-flex h-9 shrink-0 items-center rounded-pill px-3.5 text-sm font-semibold',
                    s.n === season
                      ? 'bg-ink-900 text-white'
                      : 'bg-white text-ink-700 shadow-[var(--shadow-xs)]',
                  )}
                >
                  {t.season.title(s.n)}
                </Link>
              ))}
            </nav>
          ) : null}
          <EpisodeList
            key={season}
            titleId={id}
            titleName={data.title.title}
            season={season}
            view={view}
            viewIds={ids}
            who={who}
            withGuard
          />
        </>
      ) : null}
    </WatchingScreen>
  );
}
