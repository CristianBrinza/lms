import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { Button, IconButton, Sheet, Skeleton } from '@/components/ui';
import {
  ArrowOutIcon,
  BookmarkBorderIcon,
  BookmarkIcon,
  CheckIcon,
  ChevronRightIcon,
  DeleteIcon,
  FavoriteBorderIcon,
  FavoriteIcon,
  MoreHorizIcon,
  PlaylistAddIcon,
  ReplayIcon,
  StarBorderIcon,
  StarIcon,
  UndoIcon,
  type IconComponent,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys } from '../api';
import { EpisodeList } from '../components/EpisodeList';
import { MarkWatchedSheet } from '../components/MarkWatchedSheet';
import {
  CheckMark,
  ErrorCard,
  PeopleStack,
  ProgressBar,
  Section,
  ViewSwitcher,
  WatchingScreen,
} from '../components/parts';
import { ListPickerSheet, RatingPicker } from '../components/pickers';
import { Face, Poster, PosterRow } from '../components/Poster';
import { airDay, formatMinutes, formatVote, watchedWhen } from '../format';
import { isPending, useAddPlays, useRemovePlay, useSetStatus } from '../hooks';
import { useWatchingT } from '../i18n';
import { tmdbImage } from '../images';
import {
  episodeCode,
  latestPlay,
  nextEpisode,
  realSeasons,
  showProgress,
  watchedSet as watchedSetOf,
} from '../logic';
import { useWatchView, useWho } from '../people';
import type { Mine, TitleDetail, TitleResponse, WatchStatus } from '../types';
import { watchedByAll } from '../view';

/**
 * A show or film: the poster and its facts, the action bar (watched, watchlist, favourite, rate,
 * more), what's next with one check, the seasons strip and the chosen season's episodes, the cast,
 * where it plays in Moldova, and more like it.
 */
export default function TitlePage() {
  const { id = '' } = useParams();
  const t = useWatchingT();
  const { view, ids } = useWatchView();
  const query = useQuery({
    queryKey: watchingKeys.title(id, view),
    queryFn: () => watchingApi.title(id, view),
  });
  const data = query.data;

  return (
    <WatchingScreen
      title={data?.title.title ?? ' '}
      subtitle={
        data ? [t.kindOne[data.title.kind], data.title.year].filter(Boolean).join(' · ') : ' '
      }
      error={query.error}
    >
      {query.isPending ? (
        <TitleSkeleton />
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : data ? (
        <TitleBody data={data} viewIds={ids} />
      ) : null}
    </WatchingScreen>
  );
}

function TitleBody({ data, viewIds }: { data: TitleResponse; viewIds: string[] }) {
  const { title, mine } = data;
  const t = useWatchingT();
  const { view } = useWatchView();
  const { who: remembered } = useWho(title.id);
  const together = view.kind === 'together';
  const who = together ? viewIds : remembered;
  const isShow = title.kind === 'tv';
  const seasons = realSeasons(title.seasons);
  // Together: what everyone in the view watched (my plays and who sat with me); else the server's.
  const togetherSeen = together ? watchedByAll(mine.plays, viewIds) : null;
  const next = !isShow
    ? null
    : togetherSeen
      ? nextEpisode(title.seasons, togetherSeen, title.nextEpisode)
      : mine.next;
  const progress = !isShow
    ? null
    : togetherSeen
      ? showProgress(title.seasons, togetherSeen, title.nextEpisode)
      : mine.progress
        ? { watched: mine.progress.watched, total: mine.progress.aired }
        : null;
  const seen = togetherSeen ?? watchedSetOf(mine.plays);
  const [season, setSeason] = useState<number | null>(null);
  const chosenSeason = season ?? next?.season ?? seasons[0]?.n ?? null;
  const moviePlays = mine.plays.filter((p) => p.season === null);

  return (
    <>
      <ViewSwitcher className="mb-3" />
      <div className="md:grid md:grid-cols-[14rem_minmax(0,1fr)] md:gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <div className="flex gap-4 md:block">
          <Poster
            path={title.posterPath}
            kind={title.kind}
            eager
            sizes="(min-width: 64rem) 17rem, (min-width: 44rem) 14rem, 8.5rem"
            className="w-[8.5rem] shrink-0 rounded-[1.125rem] shadow-[var(--shadow-card)] md:w-full"
          />
          <div className="min-w-0 flex-1 md:hidden">
            <Facts title={title} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="hidden md:block">
            <h2 className="text-[1.75rem] font-bold leading-tight tracking-[-0.025em]">
              {title.title}
            </h2>
            <Facts title={title} />
          </div>

          <ActionBar title={title} mine={mine} who={who} />

          {isShow && progress && progress.total ? (
            <div className="mt-4">
              <ProgressBar
                share={progress.watched / progress.total}
                label={t.title.progress(progress.watched, progress.total)}
              />
              <p className="tabular mt-1.5 text-xs font-medium text-ink-500">
                {t.title.progress(progress.watched, progress.total)}
              </p>
            </div>
          ) : null}

          {next ? (
            <UpNext title={title} season={next.season} episode={next.episode} who={who} />
          ) : null}
          {isShow && title.nextEpisode?.airDate ? (
            <p className="mt-3 rounded-2xl bg-pink-100 px-3.5 py-2.5 text-sm font-medium text-pink-800">
              {t.title.nextAirs(
                episodeCode(title.nextEpisode.season, title.nextEpisode.episode),
                airDay(title.nextEpisode.airDate),
              )}
            </p>
          ) : null}
          <Household data={data} />

          {!isShow && moviePlays.length ? <MoviePlays mine={mine} /> : null}

          {title.tagline || title.overview ? (
            <Section title={t.title.about} className="mt-6">
              {title.tagline ? (
                <p className="mb-1.5 text-[0.9375rem] font-semibold italic text-ink-700">
                  {title.tagline}
                </p>
              ) : null}
              <p className="max-w-prose text-[0.9375rem] leading-relaxed text-ink-700">
                {title.overview}
              </p>
              {title.imdbId ? (
                <a
                  href={`https://www.imdb.com/title/${title.imdbId}/`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900"
                >
                  {t.title.imdb}
                  <ArrowOutIcon fontSize="inherit" />
                </a>
              ) : null}
            </Section>
          ) : null}

          {isShow && seasons.length && chosenSeason !== null ? (
            <Section title={t.title.seasons}>
              <SeasonsStrip
                titleId={title.id}
                seasons={seasons}
                chosen={chosenSeason}
                onChoose={setSeason}
                seen={seen}
              />
              <div className="mt-3">
                <EpisodeList
                  key={chosenSeason}
                  titleId={title.id}
                  titleName={title.title}
                  season={chosenSeason}
                  view={view}
                  viewIds={viewIds}
                  who={who}
                />
                <Link
                  to={`/watching/${title.id}/season/${chosenSeason}`}
                  viewTransition
                  className="mt-2 inline-flex items-center gap-1 px-1 text-sm font-semibold text-ink-600 hover:text-ink-900"
                >
                  {t.season.title(chosenSeason)}
                  <ChevronRightIcon fontSize="inherit" />
                </Link>
              </div>
            </Section>
          ) : null}

          {title.cast.length ? (
            <Section title={t.title.cast}>
              <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-0 md:px-0">
                {title.cast.map((person) => (
                  <li key={person.id} className="w-[5.5rem] shrink-0">
                    <Link
                      to={`/watching/person/${person.id}`}
                      viewTransition
                      className="press block text-center"
                    >
                      <Face path={person.profilePath} className="mx-auto w-[4.5rem]" />
                      <span className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight">
                        {person.name}
                      </span>
                      {person.character ? (
                        <span className="line-clamp-1 text-[0.6875rem] text-ink-500">
                          {person.character}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <WhereToWatch title={title} />
          <Similar id={title.id} />
        </div>
      </div>
    </>
  );
}

function Facts({ title }: { title: TitleDetail }) {
  const t = useWatchingT();
  const vote = formatVote(title.rating);
  const seasons = realSeasons(title.seasons).length;
  const line = [
    title.year,
    title.kind === 'movie' && title.runtime ? formatMinutes(title.runtime) : null,
    title.kind === 'tv' && seasons ? t.common.seasons(seasons) : null,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-1.5 md:mt-1">
      <p className="tabular text-sm font-medium text-ink-600">{line.join(' · ')}</p>
      {title.genres.length ? (
        <ul className="flex flex-wrap gap-1">
          {title.genres.slice(0, 4).map((genre) => (
            <li
              key={genre}
              className="rounded-pill bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-[var(--shadow-xs)]"
            >
              {genre}
            </li>
          ))}
        </ul>
      ) : null}
      {vote ? (
        <p className="tabular inline-flex items-center gap-1 text-sm font-semibold text-ink-800">
          <StarIcon fontSize="inherit" className="text-[1.1rem] text-butter-400" />
          {t.title.tmdbRating(vote)}
        </p>
      ) : null}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  on,
  onClick,
  pressed,
}: {
  icon: IconComponent;
  label: string;
  on?: boolean;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => {
        haptic('tap');
        onClick();
      }}
      className="press group flex min-w-0 flex-1 flex-col items-center gap-1.5"
    >
      <span
        className={cx(
          'grid size-12 place-items-center rounded-full text-[1.4rem] transition-colors',
          on
            ? 'bg-ink-900 text-white'
            : 'bg-white text-ink-800 shadow-[var(--shadow-card)] group-hover:bg-pink-100',
        )}
      >
        <Icon fontSize="inherit" />
      </span>
      <span className="max-w-full truncate text-xs font-semibold text-ink-700">{label}</span>
    </button>
  );
}

/** Watched · Watchlist · Favourite · Rate · More: the reference's action bar, in LMS's light. */
function ActionBar({ title, mine, who }: { title: TitleDetail; mine: Mine; who: string[] }) {
  const t = useWatchingT();
  const setStatus = useSetStatus();
  const [sheet, setSheet] = useState<'watched' | 'rate' | 'more' | 'list' | null>(null);
  const watchedMovie = title.kind === 'movie' && mine.plays.some((p) => p.season === null);
  const onList = mine.status === 'watchlist';
  const status = (body: Parameters<typeof setStatus.mutate>[0]['body'], message?: string) =>
    setStatus.mutate({ id: title.id, body: { ...body, userIds: who }, message });

  return (
    <>
      <div role="group" aria-label={t.title.actions} className="mt-5 flex items-start gap-1">
        <ActionButton
          icon={watchedMovie ? ReplayIcon : CheckIcon}
          label={watchedMovie ? t.title.watchedAgain : t.title.watched}
          on={watchedMovie || mine.status === 'completed'}
          onClick={() => setSheet('watched')}
        />
        <ActionButton
          icon={onList ? BookmarkIcon : BookmarkBorderIcon}
          label={onList ? t.title.inWatchlist : t.title.watchlist}
          on={onList}
          pressed={onList}
          onClick={() => status({ status: onList ? null : 'watchlist' })}
        />
        <ActionButton
          icon={mine.favorite ? FavoriteIcon : FavoriteBorderIcon}
          label={t.title.favorite}
          on={mine.favorite}
          pressed={mine.favorite}
          onClick={() => status({ favorite: !mine.favorite })}
        />
        <ActionButton
          icon={mine.rating ? StarIcon : StarBorderIcon}
          label={mine.rating ? t.title.rated(mine.rating) : t.title.rate}
          on={!!mine.rating}
          onClick={() => setSheet('rate')}
        />
        <ActionButton icon={MoreHorizIcon} label={t.title.more} onClick={() => setSheet('more')} />
      </div>

      <MarkWatchedSheet open={sheet === 'watched'} onClose={() => setSheet(null)} title={title} />

      <Sheet open={sheet === 'rate'} onClose={() => setSheet(null)} title={t.title.yourRating}>
        <RatingPicker
          label={t.title.yourRating}
          value={mine.rating}
          onChange={(rating) => {
            status({ rating });
            setSheet(null);
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'more'} onClose={() => setSheet(null)} title={title.title}>
        <div className="flex flex-col gap-4">
          <section>
            <h3 className="mb-2 text-[0.8125rem] font-semibold text-ink-700">{t.title.status}</h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  'watchlist',
                  'watching',
                  'rewatching',
                  'completed',
                  'paused',
                  'dropped',
                ] as WatchStatus[]
              ).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mine.status === value}
                  onClick={() => status({ status: value })}
                  className={cx(
                    'press h-10 rounded-pill px-4 text-sm font-semibold transition-colors',
                    mine.status === value
                      ? 'bg-ink-900 text-white'
                      : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  )}
                >
                  {t.status[value]}
                </button>
              ))}
            </div>
          </section>
          <Button
            variant="tint"
            icon={PlaylistAddIcon}
            fullWidth
            size="md"
            onClick={() => setSheet('list')}
          >
            {t.title.addToList}
          </Button>
          {mine.status ? (
            <Button
              variant="ghost"
              icon={DeleteIcon}
              fullWidth
              size="md"
              onClick={() => {
                status({ status: null }, t.title.removed);
                setSheet(null);
              }}
            >
              {t.title.removeFromMine}
            </Button>
          ) : null}
        </div>
      </Sheet>

      <ListPickerSheet open={sheet === 'list'} onClose={() => setSheet(null)} titleId={title.id} />
    </>
  );
}

/** The others at home who have this title, and how far they are. */
function Household({ data }: { data: TitleResponse }) {
  const t = useWatchingT();
  if (!data.household.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5">
      {data.household.map((h) => (
        <li
          key={h.userId}
          className="rounded-pill bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-[var(--shadow-xs)]"
        >
          {h.name}
          {h.status ? ` · ${t.status[h.status]}` : ''}
          {h.plays ? ` · ${t.common.plays(h.plays)}` : ''}
        </li>
      ))}
    </ul>
  );
}

/** The next episode as a card with one check. */
function UpNext({
  title,
  season,
  episode,
  who,
}: {
  title: TitleDetail;
  season: number;
  episode: number;
  who: string[];
}) {
  const t = useWatchingT();
  const add = useAddPlays();
  const code = episodeCode(season, episode);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-white p-3 pl-4 shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-500">{t.nav.home}</p>
        <p className="tabular truncate text-[0.9375rem] font-bold">{code}</p>
      </div>
      <button
        type="button"
        aria-label={t.home.markNext(title.title, code)}
        disabled={add.isPending}
        onClick={() =>
          add.mutate({
            input: { titleId: title.id, season, episode, userIds: who },
            message: t.home.marked(title.title, code),
          })
        }
        className="press shrink-0 rounded-full"
      >
        <CheckMark on={false} className="size-11" />
      </button>
    </div>
  );
}

/** A film's plays: how many times, when last, who; undo the last one. */
function MoviePlays({ mine }: { mine: Mine }) {
  const t = useWatchingT();
  const remove = useRemovePlay();
  const plays = mine.plays.filter((p) => p.season === null && !isPending(p));
  const last = latestPlay(plays, null, null);
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[1.25rem] bg-white px-4 py-3 shadow-[var(--shadow-xs)]">
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] font-semibold">{t.title.watchedTimes(plays.length)}</p>
        {last ? (
          <p className="text-sm text-ink-600">
            {t.title.lastWatched(watchedWhen(last.watchedAt, last.precision))}
          </p>
        ) : null}
      </div>
      {last ? <PeopleStack ids={[last.userId, ...last.together]} /> : null}
      {last ? (
        <IconButton
          icon={UndoIcon}
          label={t.title.unwatchMovie}
          variant="ghost"
          size="sm"
          onClick={() => remove.mutate({ play: last, message: t.title.unwatchMovie })}
        />
      ) : null}
    </div>
  );
}

/** The seasons as a strip of small posters with how much of each is seen. */
function SeasonsStrip({
  titleId,
  seasons,
  chosen,
  onChoose,
  seen,
}: {
  titleId: string;
  seasons: TitleDetail['seasons'];
  chosen: number;
  onChoose: (n: number) => void;
  seen: ReadonlySet<string>;
}) {
  const t = useWatchingT();
  return (
    <ul
      role="tablist"
      aria-label={t.title.seasons}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-0 md:px-0"
    >
      {seasons.map((s) => {
        let watched = 0;
        for (let e = 1; e <= s.episodeCount; e++) if (seen.has(`${s.n}:${e}`)) watched++;
        const on = s.n === chosen;
        return (
          <li key={`${titleId}-${s.n}`} className="shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChoose(s.n)}
              className={cx(
                'press flex w-[6.5rem] flex-col gap-1.5 rounded-[1rem] p-1.5 text-left transition-colors',
                on
                  ? 'bg-ink-900 text-white'
                  : 'bg-white text-ink-900 shadow-[var(--shadow-xs)] hover:bg-pink-100',
              )}
            >
              <span className="text-[0.8125rem] font-bold">{t.season.title(s.n)}</span>
              <span className={cx('tabular text-xs', on ? 'text-white/75' : 'text-ink-500')}>
                {watched}/{s.episodeCount}
              </span>
              <span
                className={cx(
                  'h-1 overflow-hidden rounded-full',
                  on ? 'bg-white/20' : 'bg-ink-100',
                )}
              >
                <span
                  className={cx('block h-full rounded-full', on ? 'bg-butter-300' : 'bg-ink-900')}
                  style={{
                    width: `${s.episodeCount ? Math.round((watched / s.episodeCount) * 100) : 0}%`,
                  }}
                />
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Where it streams in Moldova (TMDB's list via JustWatch), and what the household has checked. */
function WhereToWatch({ title }: { title: TitleDetail }) {
  const t = useWatchingT();
  const providers = title.providers;
  const flat = providers?.flatrate ?? [];
  const checked = providers?.checked ?? [];
  return (
    <Section title={t.title.where}>
      <div className="rounded-[1.25rem] bg-white p-4 shadow-[var(--shadow-xs)]">
        {flat.length ? (
          <>
            {providers?.check ? (
              <p className="mb-2.5 text-sm text-ink-600">
                {t.title.whereRo} <span className="font-semibold">{t.title.whereCheck}</span>
              </p>
            ) : null}
            <ul className="flex flex-wrap gap-2">
              {flat.map((p) => (
                <li
                  key={p.id ?? p.name}
                  className="flex items-center gap-2 rounded-pill bg-ink-50 py-1 pl-1 pr-3 text-sm font-semibold"
                >
                  {p.logoPath ? (
                    <img
                      src={tmdbImage(p.logoPath, 'w92')!}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      decoding="async"
                      crossOrigin="anonymous"
                      className="size-7 rounded-full bg-ink-100"
                    />
                  ) : null}
                  {p.name}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-ink-600">{t.title.noProviders}</p>
        )}
        {checked.length ? (
          <div className="mt-3 border-t border-ink-100 pt-3">
            <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.title.checked}</h3>
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {checked.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-semibold">{c.provider}</span>
                  {': '}
                  <span className={c.available ? 'font-semibold text-mint-800' : 'text-ink-600'}>
                    {c.available ? t.title.available : t.title.notAvailable}
                  </span>
                  <span className="text-ink-500">
                    {' · '}
                    {t.title.checkedOn(watchedWhen(c.checkedAt))}
                    {c.checkedBy ? ` · ${c.checkedBy.name}` : ''}
                  </span>
                  {c.note ? <span className="block text-ink-600">{c.note}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}

function Similar({ id }: { id: string }) {
  const t = useWatchingT();
  const similar = useQuery({
    queryKey: watchingKeys.similar(id),
    queryFn: () => watchingApi.similar(id),
    staleTime: 60 * 60_000,
    retry: false,
  });
  const items = similar.data?.results ?? [];
  if (!items.length) return null;
  return (
    <Section title={t.title.similar}>
      <PosterRow items={items} label={t.title.similar} />
    </Section>
  );
}

function TitleSkeleton(): ReactNode {
  return (
    <div aria-hidden="true">
      <div className="flex gap-4">
        <Skeleton className="aspect-[2/3] w-[8.5rem] shrink-0 rounded-[1.125rem]" />
        <div className="flex-1">
          <Skeleton className="h-4 w-2/3 rounded-md" />
          <Skeleton className="mt-2 h-6 w-full rounded-pill" />
          <Skeleton className="mt-2 h-4 w-1/3 rounded-md" />
        </div>
      </div>
      <div className="mt-5 flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="size-12 rounded-full" />
        ))}
      </div>
    </div>
  );
}
