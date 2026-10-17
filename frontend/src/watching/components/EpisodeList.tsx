import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Avatar, Button, Chips, Sheet, Skeleton, Switch } from '@/components/ui';
import {
  CheckIcon,
  CloseIcon,
  FavoriteBorderIcon,
  FavoriteIcon,
  ReplayIcon,
  StarIcon,
  UndoIcon,
} from '@/components/ui/icons';
import { localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys } from '../api';
import { airDay, formatMinutes, watchedWhen } from '../format';
import { isPending, useAddPlays, useRemovePlay, useSetEpisode } from '../hooks';
import { useWatchingT } from '../i18n';
import { episodeCode, latestPlay, whenValue } from '../logic';
import { useHousehold, useMarkWho } from '../people';
import { useSpoilerGuard } from '../spoilers';
import { REACTIONS, type Episode, type Reaction } from '../types';
import type { WatchView } from '../view';
import { CheckMark, ErrorCard, PeopleStack, WhoPicker } from './parts';
import { PlaysSheet } from './PlaysSheet';
import { RatingPicker, stars } from './pickers';
import { Still } from './Poster';
import { FACE, MAX_REACTIONS } from '../reactions';
import { StarsRow } from './Review';

/**
 * A season's episodes with check marks: the round check ticks (or unticks) one, the row opens the
 * episode itself (plot, your rating and note, favourite, every time you watched it). "Pick
 * episodes" turns the rows into a selection, marked in one go with who and when. Who a check is
 * for sits above the list (hidden for a household of one). The spoiler guard blurs and hides what
 * you haven't seen. Together, an episode counts once everyone saw it.
 */
export function EpisodeList({
  titleId,
  titleName,
  season,
  view,
  viewIds,
  withGuard,
}: {
  titleId: string;
  titleName: string;
  season: number;
  view: WatchView;
  /** The people the view is about (together: all of them must have seen an episode). */
  viewIds: string[];
  /** Show the spoiler switch above the list (the season screen). */
  withGuard?: boolean;
}) {
  const t = useWatchingT();
  const [guard, setGuard] = useSpoilerGuard();
  // Who a new check is for: the person viewed, the people together, else who watched it last.
  const { who, setWho } = useMarkWho(titleId);
  const { people } = useHousehold();
  const owner = view.kind === 'person' ? (people.find((p) => p.id === view.id)?.name ?? '') : null;
  const query = useQuery({
    queryKey: watchingKeys.season(titleId, season, view),
    queryFn: () => watchingApi.season(titleId, season, view),
  });
  const add = useAddPlays();
  const remove = useRemovePlay();
  const [open, setOpen] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const together = view.kind === 'together';
  const episodes = query.data?.episodes ?? [];
  const isSeen = (ep: Episode) =>
    together ? viewIds.every((id) => ep.watchedBy.includes(id)) : ep.watched.length > 0;
  const aired = episodes.filter((ep) => ep.aired);
  const unseen = aired.filter((ep) => !isSeen(ep));
  const allSeen = aired.length > 0 && !unseen.length;
  const openEpisode = episodes.find((ep) => ep.n === open) ?? null;

  const toggle = (ep: Episode) => {
    const code = episodeCode(season, ep.n);
    if (isSeen(ep)) {
      const play = latestPlay(ep.plays, season, ep.n);
      if (play && !isPending(play))
        remove.mutate({ play, together, message: t.season.unmarked(code) });
      return;
    }
    add.mutate({
      input: { titleId, season, episode: ep.n, userIds: who },
      message: t.home.marked(titleName, code),
    });
  };
  const pick = (n: number) => {
    haptic('tap');
    setPicked((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]));
  };
  const stopPicking = () => {
    setPicking(false);
    setPicked([]);
  };

  if (query.isPending)
    return (
      <div aria-hidden="true" className="flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-20 rounded-[1.25rem]" />
        ))}
      </div>
    );
  if (query.error) return <ErrorCard error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <div className="flex flex-col gap-2.5">
      {withGuard ? (
        <div className="rounded-[1.25rem] bg-white px-4 py-2.5 shadow-[var(--shadow-xs)]">
          <Switch
            checked={guard}
            onChange={setGuard}
            label={t.season.spoilers}
            hint={t.season.spoilersHint}
          />
        </div>
      ) : null}
      {!together ? <WhoPicker value={who} onChange={setWho} /> : null}
      {aired.length ? (
        picking ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="tabular mr-auto text-sm font-semibold text-ink-800">
              {t.season.picked(picked.length)}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setPicked(picked.length === unseen.length ? [] : unseen.map((ep) => ep.n))
              }
            >
              {picked.length === unseen.length && unseen.length
                ? t.season.pickNone
                : t.season.pickAll}
            </Button>
            <Button size="sm" variant="tint" icon={CloseIcon} onClick={stopPicking}>
              {t.season.cancel}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {!allSeen ? (
              <Button
                size="sm"
                variant="tint"
                icon={CheckIcon}
                loading={add.isPending}
                onClick={() =>
                  add.mutate({
                    input: { titleId, season, all: true, userIds: who },
                    message: t.title.seasonMarked(season),
                  })
                }
              >
                {t.season.markAll}
              </Button>
            ) : null}
            {unseen.length > 1 ? (
              <Button size="sm" variant="ghost" onClick={() => setPicking(true)}>
                {t.season.pick}
              </Button>
            ) : null}
          </div>
        )
      ) : null}
      {!episodes.length ? (
        <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600">
          {t.season.noEpisodes}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {episodes.map((ep) => {
          const seen = isSeen(ep);
          const hide = guard && !seen;
          const code = episodeCode(season, ep.n);
          const others = ep.watchedBy.filter((id) => !viewIds.includes(id));
          const canPick = picking && ep.aired && !seen;
          const isPicked = picked.includes(ep.n);
          return (
            <li key={ep.n}>
              <div
                className={cx(
                  'flex items-center gap-3 rounded-[1.25rem] bg-white p-2 pr-2.5 shadow-[var(--shadow-xs)] transition-colors',
                  !ep.aired && 'opacity-70',
                  picking && !canPick && 'opacity-50',
                  isPicked && 'bg-ink-50 ring-2 ring-inset ring-ink-900',
                )}
              >
                <button
                  type="button"
                  onClick={() => (picking ? canPick && pick(ep.n) : setOpen(ep.n))}
                  aria-pressed={picking ? isPicked : undefined}
                  disabled={picking && !canPick}
                  className="press flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Still
                    path={ep.stillPath}
                    blurred={hide}
                    sizes="7rem"
                    className="w-24 shrink-0 rounded-[0.75rem] sm:w-28"
                  >
                    {ep.watched.length > 1 ? (
                      <span className="tabular absolute bottom-1 left-1 rounded-pill bg-ink-900/80 px-1.5 py-0.5 text-[0.6875rem] font-bold text-white">
                        {t.title.rewatch(ep.watched.length)}
                      </span>
                    ) : null}
                  </Still>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                      <span className="tabular whitespace-nowrap">{code}</span>
                      {ep.mine?.favorite ? (
                        <FavoriteIcon fontSize="inherit" className="text-pink-800" />
                      ) : null}
                      {ep.mine?.rating ? (
                        <span className="tabular inline-flex items-center gap-0.5 text-ink-700">
                          <StarIcon fontSize="inherit" className="text-butter-400" />
                          {stars(ep.mine.rating)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 line-clamp-2 text-[0.9375rem] font-semibold leading-snug">
                      {hide || !ep.name ? t.season.hidden(ep.n) : ep.name}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className="tabular block min-w-0 truncate text-xs text-ink-500">
                        {ep.aired
                          ? [airDay(ep.airDate), ep.runtime ? formatMinutes(ep.runtime) : null]
                              .filter(Boolean)
                              .join(' · ')
                          : ep.airDate
                            ? t.season.airs(airDay(ep.airDate))
                            : t.season.notAired}
                      </span>
                      <PeopleStack ids={others} />
                    </span>
                  </span>
                </button>
                {picking ? (
                  canPick ? (
                    <button
                      type="button"
                      aria-pressed={isPicked}
                      aria-label={t.season.mark(code)}
                      onClick={() => pick(ep.n)}
                      className="press shrink-0 rounded-full"
                    >
                      <CheckMark on={isPicked} />
                    </button>
                  ) : seen ? (
                    <CheckMark on className="opacity-60" />
                  ) : null
                ) : ep.aired ? (
                  <button
                    type="button"
                    aria-pressed={seen}
                    aria-label={seen ? t.season.unmark(code) : t.season.mark(code)}
                    onClick={() => toggle(ep)}
                    className="press shrink-0 rounded-full"
                  >
                    <CheckMark on={seen} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {picking ? (
        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-10 lg:bottom-4">
          <Button
            fullWidth
            icon={CheckIcon}
            disabled={!picked.length}
            onClick={() => setConfirming(true)}
            className="shadow-[var(--shadow-raised)]"
          >
            {t.season.markPicked(picked.length)}
          </Button>
        </div>
      ) : null}

      <PickedSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        titleId={titleId}
        titleName={titleName}
        season={season}
        episodes={picked}
        who={who}
        together={together}
        onDone={() => {
          setConfirming(false);
          stopPicking();
        }}
      />

      <Sheet
        open={openEpisode !== null}
        onClose={() => setOpen(null)}
        title={openEpisode ? `${episodeCode(season, openEpisode.n)} · ${titleName}` : ''}
        size="lg"
      >
        {openEpisode ? (
          <EpisodeDetail
            key={openEpisode.n}
            titleId={titleId}
            titleName={titleName}
            season={season}
            episode={openEpisode}
            who={who}
            together={together}
            owner={owner}
            hide={guard && !isSeen(openEpisode)}
            onDone={() => setOpen(null)}
          />
        ) : null}
      </Sheet>
    </div>
  );
}

/** The picked episodes: who watched them and when, then one save. */
function PickedSheet({
  open,
  onClose,
  titleId,
  titleName,
  season,
  episodes,
  who,
  together,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  titleName: string;
  season: number;
  episodes: number[];
  who: string[];
  together: boolean;
  onDone: () => void;
}) {
  const t = useWatchingT();
  return (
    <Sheet open={open} onClose={onClose} title={t.season.markPicked(episodes.length)}>
      {open ? (
        <PickedForm
          titleId={titleId}
          titleName={titleName}
          season={season}
          episodes={episodes}
          who={who}
          together={together}
          onDone={onDone}
        />
      ) : null}
    </Sheet>
  );
}

function PickedForm({
  titleId,
  titleName,
  season,
  episodes,
  who: initialWho,
  together,
  onDone,
}: {
  titleId: string;
  titleName: string;
  season: number;
  episodes: number[];
  who: string[];
  together: boolean;
  onDone: () => void;
}) {
  const t = useWatchingT();
  const today = localDate();
  const { setWho } = useMarkWho(titleId);
  const [who, setLocalWho] = useState(initialWho);
  const [when, setWhen] = useState<'now' | 'date' | 'unknown'>('now');
  const [date, setDate] = useState(today);
  const add = useAddPlays();
  const sorted = [...episodes].sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-5">
      <p className="tabular text-sm text-ink-600">
        {titleName} · {sorted.map((n) => episodeCode(season, n)).join(', ')}
      </p>
      {!together ? <WhoPicker value={who} onChange={setLocalWho} /> : null}
      <section className="flex flex-col gap-2.5">
        <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.backfill.when}</h3>
        <Chips
          label={t.backfill.when}
          tone="sheet"
          dense
          value={when}
          onChange={setWhen}
          options={(['now', 'date', 'unknown'] as const).map((value) => ({
            value,
            label: t.backfill[value],
          }))}
        />
        {when === 'date' ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-600">{t.backfill.dateLabel}</span>
            <input
              type="date"
              className="h-11 w-full min-w-0 rounded-2xl bg-ink-50 px-3.5 text-[0.9375rem] font-medium text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-ink-900"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
            />
          </label>
        ) : null}
      </section>
      <Button
        fullWidth
        loading={add.isPending}
        disabled={!episodes.length}
        onClick={() => {
          if (!together) setWho(who);
          add.mutate(
            {
              input: {
                titleId,
                season,
                episodes: sorted,
                userIds: who,
                watchedAt: whenValue(
                  when === 'date' ? { kind: 'date', date } : { kind: when },
                  today,
                ),
              },
              message: t.backfill.done(sorted.length),
            },
            { onSuccess: onDone },
          );
        }}
      >
        {t.backfill.save}
      </Button>
    </div>
  );
}

function EpisodeDetail({
  titleId,
  titleName,
  season,
  episode,
  who,
  together,
  owner,
  hide,
  onDone,
}: {
  titleId: string;
  titleName: string;
  season: number;
  episode: Episode;
  who: string[];
  together: boolean;
  /** Someone else's episode, looked at (their name): their rating and note, read only. */
  owner: string | null;
  hide: boolean;
  onDone: () => void;
}) {
  const t = useWatchingT();
  const add = useAddPlays();
  const remove = useRemovePlay();
  const setEpisode = useSetEpisode();
  const [playsOpen, setPlaysOpen] = useState(false);
  const [note, setNote] = useState(episode.mine?.note ?? '');
  const code = episodeCode(season, episode.n);
  const last = latestPlay(episode.plays, season, episode.n);
  const save = (body: Parameters<typeof setEpisode.mutate>[0]['body']) =>
    setEpisode.mutate({ titleId, season, episode: episode.n, body });
  const dates = [...episode.watched].sort((a, b) => (b ?? '').localeCompare(a ?? ''));

  return (
    <div className="flex flex-col gap-4">
      <Still
        path={episode.stillPath}
        blurred={hide}
        sizes="(min-width: 44rem) 36rem, 92vw"
        className="rounded-[1rem]"
      />
      <div>
        <h3 className="text-[1.0625rem] font-bold leading-snug">
          {hide || !episode.name ? t.season.hidden(episode.n) : episode.name}
        </h3>
        <p className="tabular text-sm text-ink-500">
          {[airDay(episode.airDate), episode.runtime ? formatMinutes(episode.runtime) : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {!hide && episode.overview ? (
          <p className="mt-2 text-[0.9375rem] leading-relaxed text-ink-700">{episode.overview}</p>
        ) : null}
      </div>

      {dates.length ? (
        <div>
          <h4 className="text-[0.8125rem] font-semibold text-ink-700">
            {t.title.watchedTimes(dates.length)}
          </h4>
          <p className="mt-0.5 text-sm text-ink-600">
            {dates.map((at) => watchedWhen(at)).join(' · ')}
          </p>
          <button
            type="button"
            onClick={() => setPlaysOpen(true)}
            className="mt-1 text-xs font-semibold text-lav-700 hover:underline"
          >
            {t.plays.open}
          </button>
          <PlaysSheet
            open={playsOpen}
            onClose={() => setPlaysOpen(false)}
            title={`${code} · ${titleName}`}
            plays={episode.plays.filter((p) => p.season === season && p.episode === episode.n)}
          />
        </div>
      ) : null}

      {episode.aired ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={dates.length ? ReplayIcon : CheckIcon}
            loading={add.isPending}
            onClick={() =>
              add.mutate({
                input: { titleId, season, episode: episode.n, userIds: who },
                message: t.home.marked(titleName, code),
              })
            }
          >
            {dates.length ? t.season.watchedAgain : t.title.whenWatched}
          </Button>
          {!dates.length && episode.n > 1 ? (
            <Button
              size="sm"
              variant="tint"
              icon={CheckIcon}
              loading={add.isPending}
              onClick={() =>
                add.mutate(
                  {
                    input: { titleId, season, upTo: episode.n, userIds: who },
                    message: t.season.upToDone(code),
                  },
                  { onSuccess: onDone },
                )
              }
            >
              {t.season.upToHere}
            </Button>
          ) : null}
          {last && !isPending(last) ? (
            <Button
              size="sm"
              variant="ghost"
              icon={UndoIcon}
              onClick={() =>
                remove.mutate({ play: last, together, message: t.season.unmarked(code) })
              }
            >
              {t.season.removeLast}
            </Button>
          ) : null}
          {owner === null ? (
            <Button
              size="sm"
              variant="tint"
              icon={episode.mine?.favorite ? FavoriteIcon : FavoriteBorderIcon}
              aria-pressed={!!episode.mine?.favorite}
              onClick={() => save({ favorite: !episode.mine?.favorite })}
            >
              {t.season.favorite}
            </Button>
          ) : null}
        </div>
      ) : null}

      {owner !== null ? (
        <EpisodeTake
          name={owner}
          take={{
            rating: episode.mine?.rating ?? null,
            note: episode.mine?.note ?? '',
            reactions: episode.mine?.reactions ?? [],
          }}
          heading
        />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h4 className="text-[0.8125rem] font-semibold text-ink-700">{t.title.yourRating}</h4>
            <RatingPicker
              label={t.title.yourRating}
              value={episode.mine?.rating ?? null}
              onChange={(rating) => save({ rating })}
            />
          </section>

          <EpisodeReactions
            value={episode.mine?.reactions ?? []}
            onChange={(reactions) => save({ reactions })}
          />

          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.season.note}</span>
            <textarea
              value={note}
              maxLength={500}
              rows={2}
              placeholder={t.season.notePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => {
                if (note.trim() !== (episode.mine?.note ?? '')) save({ note: note.trim() });
              }}
              className="w-full resize-none rounded-2xl bg-ink-50 px-4 py-3 text-[0.9375rem] outline-none focus:bg-white focus:ring-2 focus:ring-ink-900"
            />
          </label>
        </>
      )}

      <OthersTakes others={episode.others ?? []} />
    </div>
  );
}

/** Up to three feelings about an episode, like the ones on a title. */
function EpisodeReactions({
  value,
  onChange,
}: {
  value: Reaction[];
  onChange: (value: Reaction[]) => void;
}) {
  const t = useWatchingT();
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-[0.8125rem] font-semibold text-ink-700">
        {t.extras.reaction}
        <span className="tabular text-xs font-medium text-ink-500">
          {t.review.upTo(value.length, MAX_REACTIONS)}
        </span>
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {REACTIONS.map((reaction) => {
          const on = value.includes(reaction);
          const full = !on && value.length >= MAX_REACTIONS;
          return (
            <button
              key={reaction}
              type="button"
              aria-pressed={on}
              disabled={full}
              onClick={() => {
                haptic('tap');
                onChange(on ? value.filter((r) => r !== reaction) : [...value, reaction]);
              }}
              className={cx(
                'press inline-flex h-9 items-center gap-1.5 rounded-pill pl-2 pr-3 text-[0.8125rem] font-semibold transition-colors',
                on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                full && 'opacity-40',
              )}
            >
              <span aria-hidden="true" className="text-[1rem] leading-none">
                {FACE[reaction]}
              </span>
              {t.review.reaction[reaction]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One person's take on an episode, read only: stars, faces, their line. */
function EpisodeTake({
  name,
  take,
  heading,
}: {
  name: string;
  take: { rating: number | null; note: string; reactions: Reaction[] };
  heading?: boolean;
}) {
  const t = useWatchingT();
  const empty = !take.rating && !take.note && !take.reactions.length;
  return (
    <div className="min-w-0">
      {heading ? (
        <h4 className="text-[0.8125rem] font-semibold text-ink-700">{t.seen.theirTake(name)}</h4>
      ) : null}
      {empty ? (
        <p className="text-sm text-ink-600">{t.seen.nothingYet(name)}</p>
      ) : (
        <>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {take.rating ? (
              <>
                <StarsRow value={take.rating} className="text-[1.1rem]" />
                <span className="tabular text-sm font-semibold">{stars(take.rating)}</span>
              </>
            ) : null}
            {take.reactions.map((r) => (
              <span key={r} className="text-sm text-ink-700">
                <span aria-hidden="true">{FACE[r]}</span> {t.review.reaction[r]}
              </span>
            ))}
          </p>
          {take.note ? <p className="mt-1 text-sm text-ink-700">{take.note}</p> : null}
        </>
      )}
    </div>
  );
}

/** What the others at home thought of this episode. */
function OthersTakes({ others }: { others: NonNullable<Episode['others']> }) {
  const t = useWatchingT();
  const { me, people } = useHousehold();
  if (!others.length) return null;
  return (
    <section className="flex flex-col gap-2.5 border-t border-ink-100 pt-3">
      <h4 className="text-[0.8125rem] font-semibold text-ink-700">{t.seen.atHome}</h4>
      <ul className="flex flex-col gap-3">
        {others.map((o) => {
          const person = people.find((p) => p.id === o.userId);
          const name = o.userId === me.id ? t.common.you : (person?.name ?? '');
          return (
            <li key={o.userId} className="flex items-start gap-2.5">
              {person ? (
                <Avatar
                  person={person}
                  size="sm"
                  className="mt-0.5 size-7 text-[0.6875rem] ring-0"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {name}
                  {o.favorite ? (
                    <FavoriteIcon fontSize="inherit" className="text-pink-800" />
                  ) : null}
                </p>
                <EpisodeTake name={name} take={o} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
