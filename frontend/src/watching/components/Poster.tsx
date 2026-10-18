import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Skeleton } from '@/components/ui';
import { MovieIcon, PersonIcon, TvIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { posterSources, profileImage, stillSources } from '../images';
import type { TitleCard, TitleKind } from '../types';

/**
 * Pictures from TMDB's CDN. Every one sits in a box of fixed aspect (2:3 posters, 16:9 stills,
 * round faces) with a skeleton under it, so nothing moves when the image arrives; it fades in
 * over the skeleton. Lazy, async decoding, CORS (so the service worker can keep it).
 */

function Img({
  src,
  srcSet,
  sizes,
  width,
  height,
  eager,
  className,
}: {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
  eager?: boolean;
  className?: string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'broken'>('loading');
  if (state === 'broken') return null;
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt=""
      width={width}
      height={height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      crossOrigin="anonymous"
      referrerPolicy="no-referrer"
      onLoad={() => setState('ok')}
      onError={() => setState('broken')}
      className={cx(
        'absolute inset-0 size-full object-cover transition-opacity duration-300',
        state === 'ok' ? 'opacity-100' : 'opacity-0',
        className,
      )}
    />
  );
}

/** The caller set its own width (w-12, size-10): then the box isn't full width. */
const sized = (className?: string) => /(^|\s)(w|size)-/.test(className ?? '');

/** A 2:3 poster. `sizes` is how wide it's drawn, so the browser picks w185 or w342. */
export function Poster({
  path,
  kind,
  sizes = '7.5rem',
  eager,
  className,
  children,
}: {
  path: string | null | undefined;
  kind?: TitleKind;
  sizes?: string;
  eager?: boolean;
  className?: string;
  /** Badges over the picture. */
  children?: ReactNode;
}) {
  const sources = posterSources(path);
  const Icon = kind === 'movie' ? MovieIcon : TvIcon;
  return (
    <span
      className={cx(
        'relative block aspect-[2/3] overflow-hidden rounded-[0.875rem] bg-ink-100 shadow-[var(--shadow-xs)]',
        !sized(className) && 'w-full',
        className,
      )}
    >
      {sources ? (
        <>
          <Skeleton className="absolute inset-0 rounded-none" />
          <Img {...sources} sizes={sizes} width={185} height={278} eager={eager} />
        </>
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[2rem] text-ink-300">
          <Icon fontSize="inherit" />
        </span>
      )}
      {children}
    </span>
  );
}

/** A 16:9 still or backdrop; blurred when it would spoil an episode not seen yet. */
export function Still({
  path,
  sizes = '18rem',
  blurred,
  eager,
  className,
  children,
}: {
  path: string | null | undefined;
  sizes?: string;
  blurred?: boolean;
  eager?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const sources = stillSources(path);
  return (
    <span
      className={cx(
        'relative block aspect-video overflow-hidden bg-ink-100',
        !sized(className) && 'w-full',
        className,
      )}
    >
      {sources ? (
        <>
          <Skeleton className="absolute inset-0 rounded-none" />
          <Img
            {...sources}
            sizes={sizes}
            width={300}
            height={169}
            eager={eager}
            className={blurred ? 'scale-110 blur-xl' : undefined}
          />
        </>
      ) : null}
      {children}
    </span>
  );
}

/** A round face (cast, people). */
export function Face({ path, className }: { path: string | null | undefined; className?: string }) {
  const src = profileImage(path);
  return (
    <span
      className={cx(
        'relative block aspect-square overflow-hidden rounded-full bg-ink-100',
        className,
      )}
    >
      {src ? (
        <>
          <Skeleton className="absolute inset-0 rounded-full" />
          <Img src={src} width={185} height={185} />
        </>
      ) : (
        <span className="absolute inset-0 grid place-items-center text-[1.75rem] text-ink-300">
          <PersonIcon fontSize="inherit" />
        </span>
      )}
    </span>
  );
}

/** A poster with its title and year under it, as a link to the title. */
export function PosterCard({
  title,
  sizes,
  line,
  badge,
  className,
}: {
  title: Pick<TitleCard, 'id' | 'kind' | 'title' | 'year' | 'posterPath'>;
  sizes?: string;
  /** Replaces the year under the name (a character, "3 left"). */
  line?: ReactNode;
  /** Over the poster's corner. */
  badge?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={`/watching/${title.id}`}
      viewTransition
      className={cx('press group/poster flex min-w-0 flex-col gap-1.5', className)}
    >
      <Poster path={title.posterPath} kind={title.kind} sizes={sizes}>
        {badge}
      </Poster>
      <span className="min-w-0 px-0.5">
        <span className="line-clamp-2 text-[0.8125rem] font-semibold leading-snug text-ink-900">
          {title.title}
        </span>
        {line !== undefined ? (
          <span className="block truncate text-xs text-ink-500">{line}</span>
        ) : title.year ? (
          <span className="tabular block text-xs text-ink-500">{title.year}</span>
        ) : null}
      </span>
    </Link>
  );
}

/** A row of posters that scrolls sideways (snapping), wider on tablets. */
export function PosterRow({
  items,
  label,
  render,
}: {
  items: ReadonlyArray<Pick<TitleCard, 'id' | 'kind' | 'title' | 'year' | 'posterPath'>>;
  label: string;
  render?: (
    item: TitleCard | Pick<TitleCard, 'id' | 'kind' | 'title' | 'year' | 'posterPath'>,
  ) => ReactNode;
}) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x snap-proximity scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-5 md:scroll-px-5 md:px-5 lg:-mx-8 lg:scroll-px-8 lg:px-8"
    >
      {items.map((item) => (
        <li key={item.id} className="w-[6.75rem] shrink-0 snap-start sm:w-[7.5rem] lg:w-[8.5rem]">
          {render ? (
            render(item)
          ) : (
            <PosterCard title={item} sizes="(min-width: 64rem) 8.5rem, 7.5rem" />
          )}
        </li>
      ))}
    </ul>
  );
}

/** A row of skeleton posters while a row loads. */
export function PosterRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-[6.75rem] shrink-0 sm:w-[7.5rem] lg:w-[8.5rem]">
          <Skeleton className="aspect-[2/3] w-full rounded-[0.875rem]" />
          <Skeleton className="mt-2 h-3 w-4/5 rounded-md" />
        </div>
      ))}
    </div>
  );
}
