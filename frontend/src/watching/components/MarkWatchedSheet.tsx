import { useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { Button, Chips, Sheet, Skeleton } from '@/components/ui';
import { localDate } from '@/food/format';
import { cx } from '@/lib/cx';
import { watchingApi, watchingKeys } from '../api';
import { monthName } from '../format';
import { useAddPlays } from '../hooks';
import { useWatchingT } from '../i18n';
import {
  backfillCount,
  backfillInput,
  episodeCode,
  realSeasons,
  whenValue,
  type BackfillScope,
  type WhenChoice,
} from '../logic';
import { useWho } from '../people';
import type { PlayInput, TitleKind } from '../types';
import { WhoPicker } from './parts';

type ScopeKind = BackfillScope['kind'];
type WhenKind = WhenChoice['kind'];

const selectClass =
  'h-11 w-full min-w-0 appearance-none rounded-2xl bg-ink-50 px-3.5 text-[0.9375rem] font-medium text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-ink-900';

/**
 * "Watched": for the past as much as for now. Films: who and when. Shows: how much (all of it, one
 * season, or up to an episode), then who and when: just now, a day, a month, or "I don't
 * remember", so years of history go in without inventing dates.
 */
export function MarkWatchedSheet({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: { id: string; kind: TitleKind; title: string };
}) {
  const t = useWatchingT();
  return (
    <Sheet open={open} onClose={onClose} title={t.backfill.title(title.title)}>
      {open ? <Form title={title} onDone={onClose} /> : null}
    </Sheet>
  );
}

function Form({
  title,
  onDone,
}: {
  title: { id: string; kind: TitleKind; title: string };
  onDone: () => void;
}) {
  const t = useWatchingT();
  const ids = useId();
  const today = localDate();
  const isShow = title.kind === 'tv';
  const detail = useQuery({
    queryKey: watchingKeys.title(title.id, { kind: 'me' }),
    queryFn: () => watchingApi.title(title.id, { kind: 'me' }),
    enabled: isShow,
  });
  const seasons = realSeasons(detail.data?.title.seasons ?? []);
  const upcoming = detail.data?.title.nextEpisode;

  const { who: remembered, setWho } = useWho(title.id);
  const [who, setLocalWho] = useState(remembered);
  const [scope, setScope] = useState<ScopeKind>('show');
  const [season, setSeason] = useState<number | null>(null);
  const [episode, setEpisode] = useState(1);
  const [when, setWhen] = useState<WhenKind>(isShow ? 'unknown' : 'now');
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(today.slice(5, 7));
  const [year, setYear] = useState(today.slice(0, 4));
  const add = useAddPlays();

  const chosenSeason = season ?? seasons.at(-1)?.n ?? 1;
  const seasonInfo = seasons.find((s) => s.n === chosenSeason);
  const years = Array.from({ length: 50 }, (_, i) => String(Number(today.slice(0, 4)) - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

  const choice: WhenChoice =
    when === 'date'
      ? { kind: 'date', date }
      : when === 'month'
        ? { kind: 'month', month: `${year}-${month}` }
        : { kind: when };

  const chosenScope: BackfillScope =
    scope === 'show'
      ? { kind: 'show' }
      : scope === 'season'
        ? { kind: 'season', season: chosenSeason }
        : { kind: 'through', season: chosenSeason, episode };
  const count = isShow ? backfillCount(seasons, chosenScope, upcoming) : 1;

  const save = () => {
    const input: PlayInput = {
      titleId: title.id,
      watchedAt: whenValue(choice, today),
      userIds: who,
      ...(isShow ? backfillInput(chosenScope) : {}),
    };
    setWho(who);
    add.mutate(
      {
        input,
        message: isShow ? t.backfill.done(count) : t.backfill.movieDone(title.title),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {isShow ? (
        <section className="flex flex-col gap-2.5">
          <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.backfill.how}</h3>
          <Chips
            label={t.backfill.how}
            tone="sheet"
            dense
            value={scope}
            onChange={setScope}
            options={(['show', 'season', 'through'] as const).map((value) => ({
              value,
              label: t.backfill[value],
            }))}
          />
          {detail.isPending ? (
            <Skeleton className="h-11 rounded-2xl" />
          ) : scope !== 'show' && seasons.length ? (
            <div className={cx('grid gap-2', scope === 'through' && 'grid-cols-2')}>
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-xs font-semibold text-ink-600">{t.backfill.seasonLabel}</span>
                <select
                  className={selectClass}
                  value={chosenSeason}
                  onChange={(e) => {
                    setSeason(Number(e.target.value));
                    setEpisode(1);
                  }}
                >
                  {seasons.map((s) => (
                    <option key={s.n} value={s.n}>
                      {t.backfill.seasonN(s.n)}
                    </option>
                  ))}
                </select>
              </label>
              {scope === 'through' ? (
                <label className="flex min-w-0 flex-col gap-1">
                  <span className="text-xs font-semibold text-ink-600">
                    {t.backfill.episodeLabel}
                  </span>
                  <select
                    className={selectClass}
                    value={episode}
                    onChange={(e) => setEpisode(Number(e.target.value))}
                  >
                    {Array.from({ length: seasonInfo?.episodeCount ?? 1 }, (_, i) => i + 1).map(
                      (n) => (
                        <option key={n} value={n}>
                          {episodeCode(chosenSeason, n)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
          {!detail.isPending && count ? (
            <p className="text-sm text-ink-600">{t.common.episodes(count)}</p>
          ) : null}
        </section>
      ) : null}

      <WhoPicker value={who} onChange={setLocalWho} />

      <section className="flex flex-col gap-2.5">
        <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.backfill.when}</h3>
        <Chips
          label={t.backfill.when}
          tone="sheet"
          dense
          value={when}
          onChange={setWhen}
          options={(['now', 'date', 'month', 'unknown'] as const).map((value) => ({
            value,
            label: t.backfill[value],
          }))}
        />
        {when === 'date' ? (
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-ink-600">{t.backfill.dateLabel}</span>
            <input
              id={`${ids}-date`}
              type="date"
              className={selectClass}
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
            />
          </label>
        ) : null}
        {when === 'month' ? (
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold text-ink-600">{t.backfill.monthLabel}</span>
              <select
                className={selectClass}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(`2024-${m}`, false)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-semibold text-ink-600">{t.backfill.yearLabel}</span>
              <select
                className={selectClass}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </section>

      <Button
        fullWidth
        onClick={save}
        loading={add.isPending}
        disabled={isShow && (detail.isPending || !count)}
      >
        {t.backfill.save}
      </Button>
    </div>
  );
}
