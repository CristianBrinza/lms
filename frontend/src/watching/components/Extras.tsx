import { useState } from 'react';
import { Link } from 'react-router';
import { Sheet } from '@/components/ui';
import { ArrowOutIcon, CheckIcon, PlayIcon, StarIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { haptic } from '@/lib/haptics';
import { watchedWhen } from '../format';
import { useWatchingT } from '../i18n';
import type { CrewMember, TitleExtras, TitleKind, Video } from '../types';
import { Section } from './parts';
import { Face, PosterCard } from './Poster';

/**
 * A title's extras from TMDB, loaded after the page itself (they never hold it up): the trailer,
 * who made it, its themes, the film series with what's been seen of it, and a few reviews.
 */

/** "▶ Trailer": a round button that opens the video in a sheet (YouTube without cookies). */
export function TrailerButton({ videos, title }: { videos: Video[]; title: string }) {
  const t = useWatchingT();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(0);
  if (!videos.length) return null;
  const video = videos[chosen] ?? videos[0]!;
  return (
    <>
      <button
        type="button"
        onClick={() => {
          haptic('tap');
          setOpen(true);
        }}
        className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-ink-900 pl-2.5 pr-4 text-sm font-semibold text-white"
      >
        <PlayIcon fontSize="inherit" className="text-[1.3rem]" />
        {t.extras.trailer}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} size="lg">
        {open ? (
          <div className="flex flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-[1rem] bg-ink-900">
              <iframe
                key={video.key}
                title={t.extras.play(video.name)}
                src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 size-full"
              />
            </div>
            {videos.length > 1 ? (
              <ul aria-label={t.extras.videos} className="flex flex-col gap-1.5">
                {videos.map((v, i) => (
                  <li key={v.key}>
                    <button
                      type="button"
                      aria-pressed={i === chosen}
                      onClick={() => setChosen(i)}
                      className={cx(
                        'press flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition-colors',
                        i === chosen ? 'bg-ink-900 text-white' : 'bg-ink-50 hover:bg-ink-100',
                      )}
                    >
                      <PlayIcon fontSize="inherit" className="shrink-0 text-[1.2rem]" />
                      <span className="min-w-0 flex-1 truncate">{v.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}

/** The age rating as a small outlined badge: "16", "PG-13". */
export function CertificationBadge({ extras }: { extras: TitleExtras | undefined }) {
  const t = useWatchingT();
  const c = extras?.certification;
  if (!c) return null;
  return (
    <span
      title={t.extras.rated(c.rating, c.region)}
      aria-label={t.extras.rated(c.rating, c.region)}
      className="tabular inline-flex h-6 items-center rounded-md px-1.5 text-xs font-bold text-ink-700 ring-1 ring-inset ring-ink-300"
    >
      {c.rating}
    </span>
  );
}

/** "Director: Lana Wachowski" in the facts, the first one or two names. */
export function MakerLine({ crew }: { crew: CrewMember[] | undefined }) {
  const t = useWatchingT();
  const lead = (crew ?? []).filter((c) => c.job === 'director' || c.job === 'creator');
  if (!lead.length) return null;
  return (
    <p className="truncate text-sm text-ink-600">
      <span className="font-semibold text-ink-700">{t.extras.job[lead[0]!.job]}</span>{' '}
      {lead
        .slice(0, 2)
        .map((c) => c.name)
        .join(', ')}
    </p>
  );
}

/** Who made it: faces with their job, each to their films and shows. */
export function CrewSection({ crew }: { crew: CrewMember[] }) {
  const t = useWatchingT();
  if (!crew.length) return null;
  return (
    <Section title={t.extras.madeBy}>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-0 md:px-0">
        {crew.map((person) => (
          <li key={`${person.id}-${person.job}`} className="w-[5.5rem] shrink-0">
            <Link
              to={`/watching/person/${person.id}`}
              viewTransition
              className="press block text-center"
            >
              <Face path={person.profilePath} className="mx-auto w-[4.5rem]" />
              <span className="mt-1.5 line-clamp-2 text-xs font-semibold leading-tight">
                {person.name}
              </span>
              <span className="line-clamp-1 text-[0.6875rem] text-ink-500">
                {t.extras.job[person.job]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Themes as chips; each opens Discover with more like it. */
export function KeywordChips({
  keywords,
  kind,
}: {
  keywords: TitleExtras['keywords'];
  kind: TitleKind;
}) {
  const t = useWatchingT();
  if (!keywords.length) return null;
  return (
    <div className="mt-3">
      <h3 className="sr-only">{t.extras.keywords}</h3>
      <ul className="flex flex-wrap gap-1.5">
        {keywords.slice(0, 10).map((k) => (
          <li key={k.id} className="min-w-0 max-w-full">
            <Link
              to={`/watching/discover?kind=${kind}&keyword=${k.id}&name=${encodeURIComponent(k.name)}`}
              viewTransition
              className="press block max-w-full truncate rounded-pill bg-lav-100 px-3 py-1.5 text-xs font-semibold text-ink-800 hover:bg-lav-200"
            >
              {k.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The film series, in order, each poster ticked when seen, and how many of them that is. */
export function CollectionSection({
  collection,
}: {
  collection: NonNullable<TitleExtras['collection']>;
}) {
  const t = useWatchingT();
  const total = collection.parts.length;
  return (
    <Section
      title={collection.name || t.extras.collection}
      action={
        <span className="tabular shrink-0 text-sm font-semibold text-ink-600">
          {t.extras.collectionSeen(collection.seen, total)}
        </span>
      }
    >
      <div
        role="progressbar"
        aria-label={t.extras.collectionSeen(collection.seen, total)}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={collection.seen}
        className="mb-3 flex gap-1"
      >
        {collection.parts.map((p) => (
          <span
            key={p.id}
            className={cx('h-1.5 flex-1 rounded-full', p.seen ? 'bg-ink-900' : 'bg-ink-100')}
          />
        ))}
      </div>
      <ul className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-0 md:px-0">
        {collection.parts.map((part) => (
          <li key={part.id} className="w-[6.75rem] shrink-0 snap-start sm:w-[7.5rem]">
            <PosterCard
              title={part}
              sizes="7.5rem"
              badge={
                part.seen ? (
                  <span
                    aria-label={t.extras.seen}
                    className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-ink-900 text-[1rem] text-white shadow-[var(--shadow-xs)]"
                  >
                    <CheckIcon fontSize="inherit" />
                  </span>
                ) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** A few reviews from TMDB, each a short excerpt with a way to read it all. */
export function ReviewsSection({ extras }: { extras: TitleExtras }) {
  const t = useWatchingT();
  const [open, setOpen] = useState<string | null>(null);
  if (!extras.reviews.length) return null;
  return (
    <Section
      title={t.extras.reviews}
      action={
        extras.reviewCount > extras.reviews.length ? (
          <span className="text-sm font-medium text-ink-500">
            {t.extras.reviewsOnTmdb(extras.reviewCount)}
          </span>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-2">
        {extras.reviews.map((review) => {
          const expanded = open === review.id;
          return (
            <li
              key={review.id}
              className="rounded-[1.25rem] bg-white p-4 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {review.author}
                </span>
                {review.rating !== null ? (
                  <span className="tabular inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold text-ink-800">
                    <StarIcon fontSize="inherit" className="text-butter-400" />
                    {(review.rating / 2).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </span>
                ) : null}
                <span className="shrink-0 text-xs text-ink-500">
                  {watchedWhen(review.createdAt)}
                </span>
              </div>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : review.id)}
                className="mt-1.5 block w-full text-left"
              >
                <span
                  className={cx(
                    'block whitespace-pre-line text-[0.9375rem] leading-relaxed text-ink-700',
                    !expanded && 'line-clamp-4',
                  )}
                >
                  {review.excerpt}
                </span>
              </button>
              {review.long || expanded ? (
                <a
                  href={review.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900"
                >
                  {t.extras.readOn}
                  <ArrowOutIcon fontSize="inherit" />
                </a>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
