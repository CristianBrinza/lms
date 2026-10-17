import { useState } from 'react';
import { Button } from '@/components/ui';
import { StarBorderIcon, StarHalfIcon, StarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { useSetStatus } from '../hooks';
import { useWatchingT } from '../i18n';
import { REACTIONS, type Mine, type Reaction, type TitleDetail } from '../types';
import { FACE, MAX_REACTIONS } from '../reactions';
import { RatingPicker, stars } from './pickers';

/**
 * My take on a title, all in one card: stars in half steps, the heart, up to three reactions and
 * a written review. Each change saves at once (the review on Save); it's mine alone, even when we
 * watched it together.
 */
export function Review({
  title,
  mine,
  owner = null,
}: {
  title: TitleDetail;
  mine: Mine;
  /** Someone else's take, looked at (their name): read only, it's theirs to change. */
  owner?: string | null;
}) {
  return owner ? <TheirTake mine={mine} owner={owner} /> : <MyTake title={title} mine={mine} />;
}

/** Five stars, read only, in half steps. */
export function StarsRow({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center text-butter-400', className)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const Icon =
          value >= star * 2 ? StarIcon : value === star * 2 - 1 ? StarHalfIcon : StarBorderIcon;
        return <Icon key={star} fontSize="inherit" />;
      })}
    </span>
  );
}

function TheirTake({ mine, owner }: { mine: Mine; owner: string }) {
  const t = useWatchingT();
  const reactions = mine.reactions ?? [];
  const empty = !mine.rating && !reactions.length && !mine.notes;
  return (
    <section
      id="your-take"
      aria-labelledby="your-take-title"
      className="mt-5 scroll-mt-20 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <h2 id="your-take-title" className="text-[1.0625rem] font-bold tracking-[-0.01em]">
        {t.seen.theirTake(owner)}
      </h2>
      <p className="mt-0.5 text-sm text-ink-600">
        {empty ? t.seen.nothingYet(owner) : t.seen.theirTakeHint(owner)}
      </p>
      {mine.rating ? (
        <p className="mt-3 flex items-center gap-2">
          <StarsRow value={mine.rating} className="text-[1.75rem]" />
          <span className="tabular text-[1.0625rem] font-bold">{stars(mine.rating)}</span>
        </p>
      ) : null}
      {reactions.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {reactions.map((reaction) => (
            <li
              key={reaction}
              className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-ink-50 pl-2.5 pr-3.5 text-sm font-semibold text-ink-700"
            >
              <span aria-hidden="true" className="text-[1.125rem] leading-none">
                {FACE[reaction]}
              </span>
              {t.review.reaction[reaction]}
            </li>
          ))}
        </ul>
      ) : null}
      {mine.notes ? (
        <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-800">
          {mine.notes}
        </p>
      ) : null}
    </section>
  );
}

function MyTake({ title, mine }: { title: TitleDetail; mine: Mine }) {
  const t = useWatchingT();
  const setStatus = useSetStatus();
  const [draft, setDraft] = useState(mine.notes);
  const [editing, setEditing] = useState(!mine.notes);
  const watched = mine.playCount > 0 || mine.status === 'completed';
  const save = (body: Parameters<typeof setStatus.mutate>[0]['body'], message?: string) =>
    setStatus.mutate({ id: title.id, body, message });
  const reactions = mine.reactions ?? [];
  const toggle = (reaction: Reaction) => {
    haptic('tap');
    const on = reactions.includes(reaction);
    if (!on && reactions.length >= MAX_REACTIONS) return;
    save({ reactions: on ? reactions.filter((r) => r !== reaction) : [...reactions, reaction] });
  };
  const changed = draft.trim() !== mine.notes;

  return (
    <section
      id="your-take"
      aria-labelledby="your-take-title"
      className="mt-5 scroll-mt-20 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="your-take-title" className="text-[1.0625rem] font-bold tracking-[-0.01em]">
            {t.review.title}
          </h2>
          <p className="mt-0.5 text-sm text-ink-600">
            {watched && !mine.rating ? t.review.prompt : t.review.private}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <RatingPicker
          label={t.title.yourRating}
          value={mine.rating}
          onChange={(rating) => save({ rating })}
          size="lg"
        />
      </div>

      <fieldset className="mt-4 min-w-0">
        <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-[0.8125rem] font-semibold text-ink-700">
          {t.review.feel}
          <span className="tabular text-xs font-medium text-ink-500">
            {t.review.upTo(reactions.length, MAX_REACTIONS)}
          </span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {REACTIONS.map((reaction) => {
            const on = reactions.includes(reaction);
            const full = !on && reactions.length >= MAX_REACTIONS;
            return (
              <button
                key={reaction}
                type="button"
                aria-pressed={on}
                disabled={full}
                onClick={() => toggle(reaction)}
                className={cx(
                  'press inline-flex h-10 items-center gap-1.5 rounded-pill pl-2.5 pr-3.5 text-sm font-semibold transition-colors',
                  on ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700 hover:bg-ink-100',
                  full && 'opacity-40',
                )}
              >
                <span aria-hidden="true" className="text-[1.125rem] leading-none">
                  {FACE[reaction]}
                </span>
                {t.review.reaction[reaction]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4">
        {editing ? (
          <label className="flex flex-col gap-2">
            <span className="text-[0.8125rem] font-semibold text-ink-700">{t.review.label}</span>
            <textarea
              value={draft}
              maxLength={2000}
              rows={4}
              placeholder={t.review.placeholder}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full resize-y rounded-2xl bg-ink-50 px-4 py-3 text-[0.9375rem] leading-relaxed outline-none focus:bg-white focus:ring-2 focus:ring-ink-900"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                disabled={!changed}
                loading={setStatus.isPending}
                onClick={() => {
                  save({ notes: draft.trim() }, draft.trim() ? t.review.saved : t.review.cleared);
                  if (draft.trim()) setEditing(false);
                }}
              >
                {t.review.save}
              </Button>
              {mine.notes ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setDraft(mine.notes);
                    setEditing(false);
                  }}
                >
                  {t.season.cancel}
                </Button>
              ) : null}
            </div>
          </label>
        ) : (
          <div>
            <h3 className="text-[0.8125rem] font-semibold text-ink-700">{t.review.label}</h3>
            <p className="mt-1 whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-800">
              {mine.notes}
            </p>
            <Button
              size="sm"
              variant="tint"
              className="mt-2"
              onClick={() => {
                setDraft(mine.notes);
                setEditing(true);
              }}
            >
              {t.review.edit}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
