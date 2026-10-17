import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Chips, Sheet, toast } from '@/components/ui';
import { DeleteIcon, EditIcon } from '@/components/ui/icons';
import { localDate } from '@/food/format';
import { errorMessage } from '@/lib/errors';
import { watchingApi, watchingKeys } from '../api';
import { monthName, watchedWhen } from '../format';
import { useWatchingT } from '../i18n';
import { whenValue } from '../logic';
import type { Play } from '../types';
import { PeopleStack } from './parts';

type When = 'date' | 'month' | 'unknown';

const fieldClass =
  'h-11 w-full min-w-0 appearance-none rounded-2xl bg-ink-50 px-3.5 text-[0.9375rem] font-medium text-ink-900 outline-none focus-visible:ring-2 focus-visible:ring-ink-900';

/**
 * Every time a film (or one episode) was watched: when, with whom. Each can get another date —
 * a day, a month, or "I don't remember" — or go, for a tap that was a mistake. A change made
 * together applies to everyone who watched in that sitting.
 */
export function PlaysSheet({
  open,
  onClose,
  title,
  plays,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  plays: Play[];
}) {
  const t = useWatchingT();
  const [editing, setEditing] = useState<string | null>(null);
  const sorted = [...plays].sort((a, b) => (b.watchedAt ?? '').localeCompare(a.watchedAt ?? ''));
  return (
    <Sheet
      open={open}
      onClose={() => {
        setEditing(null);
        onClose();
      }}
      title={title}
    >
      {sorted.length ? (
        <ul className="flex flex-col gap-2">
          {sorted.map((play) => (
            <li key={play.id} className="rounded-2xl bg-ink-50 px-4 py-3">
              {editing === play.id ? (
                <DateForm play={play} onDone={() => setEditing(null)} />
              ) : (
                <PlayLine play={play} onEdit={() => setEditing(play.id)} />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-600">{t.plays.none}</p>
      )}
    </Sheet>
  );
}

function PlayLine({ play, onEdit }: { play: Play; onEdit: () => void }) {
  const t = useWatchingT();
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: () => watchingApi.removePlay(play.id, play.together.length > 0),
    onSuccess: () => toast.success(t.plays.removed),
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{watchedWhen(play.watchedAt, play.precision)}</p>
        {play.together.length ? (
          <p className="text-xs text-ink-500">{t.plays.together}</p>
        ) : null}
      </div>
      <PeopleStack ids={[play.userId, ...play.together]} />
      <Button size="sm" variant="ghost" icon={EditIcon} onClick={onEdit}>
        {t.plays.changeDate}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        icon={DeleteIcon}
        aria-label={t.plays.remove}
        loading={remove.isPending}
        onClick={() => remove.mutate()}
      >
        <span className="sr-only">{t.plays.remove}</span>
      </Button>
    </div>
  );
}

function DateForm({ play, onDone }: { play: Play; onDone: () => void }) {
  const t = useWatchingT();
  const client = useQueryClient();
  const today = localDate();
  const current = play.watchedAt ? localDate(new Date(play.watchedAt)) : today;
  const [when, setWhen] = useState<When>(
    play.precision === 'unknown' ? 'unknown' : play.precision === 'month' ? 'month' : 'date',
  );
  const [date, setDate] = useState(current);
  const [month, setMonth] = useState(current.slice(5, 7));
  const [year, setYear] = useState(current.slice(0, 4));
  const years = Array.from({ length: 50 }, (_, i) => String(Number(today.slice(0, 4)) - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const save = useMutation({
    mutationFn: () => {
      const value =
        when === 'unknown'
          ? 'unknown'
          : when === 'month'
            ? `${year}-${month}`
            : (whenValue({ kind: 'date', date }, today) ?? date);
      return watchingApi.updatePlay(play.id, {
        watchedAt: value,
        together: play.together.length > 0,
      });
    },
    onSuccess: () => {
      toast.success(t.plays.saved);
      onDone();
    },
    onError: (error) => toast.error(t.common.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: watchingKeys.all }),
  });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Chips
        label={t.backfill.when}
        tone="sheet"
        dense
        value={when}
        onChange={setWhen}
        options={(['date', 'month', 'unknown'] as const).map((value) => ({
          value,
          label: t.backfill[value],
        }))}
      />
      {when === 'date' ? (
        <input
          type="date"
          aria-label={t.backfill.dateLabel}
          className={fieldClass}
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value || today)}
        />
      ) : when === 'month' ? (
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
          <select
            aria-label={t.backfill.monthLabel}
            className={fieldClass}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(`2024-${m}`, false)}
              </option>
            ))}
          </select>
          <select
            aria-label={t.backfill.yearLabel}
            className={fieldClass}
            value={year}
            onChange={(e) => setYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={save.isPending}>
          {t.backfill.save}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t.season.cancel}
        </Button>
      </div>
    </form>
  );
}
