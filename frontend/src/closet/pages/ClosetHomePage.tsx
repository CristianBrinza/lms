import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useUser } from '@/app/auth';
import { Button, IconButton, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  CheckCircleIcon,
  CloseIcon,
  FavoriteIcon,
  SearchIcon,
  SparkleIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { closetApi, closetKeys, type Item, type Status } from '../api';
import { CATEGORY_IDS, type Category } from '../catalog';
import {
  ClosetScreen,
  ErrorCard,
  Hanger,
  PersonSwitcher,
  PlacePicker,
  Studio,
  Swatch,
} from '../components/parts';
import { recentPlaces, rememberPlace, useOwner } from '../state';
import { useClosetT } from '../i18n';

type View = 'closet' | 'to_wash' | 'away' | 'wishlist' | 'gone';
const VIEWS: Record<View, Status[]> = {
  closet: ['clean', 'to_wash', 'at_cleaners', 'lent'],
  to_wash: ['to_wash'],
  away: ['lent', 'at_cleaners'],
  wishlist: ['wishlist'],
  gone: ['archived', 'sold', 'donated'],
};

/** Kept while the app is open: back from a piece, the closet is as it was left. */
let remembered = { view: 'closet' as View, category: '' as Category | '', q: '', needsDetails: false };

const PAGE = 60;

/**
 * The closet: every piece as a cut-out on a studio backdrop, two to a row on a phone. Search as you
 * type, whose closet, what's in it now or away, the kinds; long-press to pick several and move or
 * wash them together.
 */
export default function ClosetHomePage() {
  const t = useClosetT();
  const user = useUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [owner, setOwner] = useOwner();
  const query = useQuery({ queryKey: closetKeys.overview(owner), queryFn: () => closetApi.overview(owner) });
  const [filters, setFiltersState] = useState(remembered);
  const setFilters = (change: Partial<typeof remembered>) => {
    remembered = { ...filters, ...change };
    setFiltersState(remembered);
  };
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [moving, setMoving] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const data = query.data;
  const items = useMemo(() => data?.items ?? [], [data]);
  const inView = useMemo(() => items.filter((i) => VIEWS[filters.view].includes(i.status)), [items, filters.view]);
  const kinds = CATEGORY_IDS.filter((c) => inView.some((i) => i.category === c));
  const needing = inView.filter((i) => i.needsDetails).length;
  const list = useMemo(() => {
    const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
    return inView.filter((item) => {
      if (filters.category && item.category !== filters.category) return false;
      if (filters.needsDetails && !item.needsDetails) return false;
      if (!words.length) return true;
      const text = [item.name, item.brand, item.category ? t.category[item.category] : '', t.sub[item.subcategory] ?? '', ...item.colors.map((c) => t.color[c]), ...item.tags, item.size]
        .join(' ')
        .toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [inView, filters, t]);

  // Long closets render a page at a time, the next as the end comes into view.
  const sentinel = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setShown((n) => n + PAGE);
    }, { rootMargin: '600px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [list.length, shown]);

  const bulk = useMutation({
    mutationFn: (patch: Parameters<typeof closetApi.bulk>[1]) => closetApi.bulk([...(selected ?? [])], patch),
    onSuccess: () => {
      haptic('success');
      setSelected(null);
      void queryClient.invalidateQueries({ queryKey: closetKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = (id: string) => {
    haptic('tap');
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const person = data?.people.find((p) => p.id === (owner === 'me' ? user.id : owner));
  const othersEmpty = owner !== 'me' && owner !== user.id && owner !== 'all';

  return (
    <ClosetScreen
      wide
      nav
      back="/home"
      title={t.title}
      subtitle={data ? t.pieces(items.filter((i) => VIEWS.closet.includes(i.status)).length) : ' '}
      actions={<IconButton icon={AddIcon} label={t.add} variant="ink" onClick={() => navigate('/closet/add')} />}
    >
      {data ? <PersonSwitcher people={data.people} meId={user.id} value={owner} onChange={setOwner} /> : null}

      {query.isPending ? (
        <div aria-hidden="true" className="mt-3">
          <Skeleton className="h-12 rounded-[1.25rem]" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-[1.5rem]" />
            ))}
          </div>
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : !items.length ? (
        othersEmpty ? (
          <p className="mt-6 rounded-3xl bg-white p-6 text-center text-ink-600 shadow-[var(--shadow-xs)]">
            {t.emptyOther(person?.name ?? '')}
          </p>
        ) : (
          <Empty onAdd={() => navigate('/closet/add')} />
        )
      ) : (
        <>
          <label className="mt-3 flex h-12 items-center gap-2 rounded-[1.25rem] bg-white px-4 shadow-[var(--shadow-card)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
            <SearchIcon fontSize="inherit" className="shrink-0 text-[1.25rem] text-ink-400" />
            <span className="sr-only">{t.searchLabel}</span>
            <input
              type="search"
              value={filters.q}
              placeholder={t.searchPlaceholder}
              onChange={(e) => setFilters({ q: e.target.value })}
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] font-medium outline-none placeholder:text-ink-400"
            />
            {filters.q ? (
              <button
                type="button"
                aria-label={t.clear}
                onClick={() => setFilters({ q: '' })}
                className="press grid size-7 place-items-center rounded-full bg-ink-100 text-base text-ink-600"
              >
                <CloseIcon fontSize="inherit" />
              </button>
            ) : null}
          </label>

          <Pills
            label={t.show}
            value={filters.view}
            options={(Object.keys(VIEWS) as View[])
              .map((view) => ({ value: view, label: t.view[view], count: items.filter((i) => VIEWS[view].includes(i.status)).length }))
              .filter((o) => o.value === 'closet' || o.count > 0)}
            onChange={(view) => setFilters({ view, category: '' })}
            className="mt-3"
          />
          {kinds.length > 1 || needing ? (
            <Pills
              label={t.kinds}
              value={filters.needsDetails ? 'needs' : filters.category || 'all'}
              options={[
                { value: 'all', label: t.allKinds },
                ...kinds.map((c) => ({ value: c as string, label: t.category[c], count: inView.filter((i) => i.category === c).length })),
                ...(needing ? [{ value: 'needs', label: t.needsDetails, count: needing }] : []),
              ]}
              onChange={(value) =>
                value === 'needs'
                  ? setFilters({ needsDetails: true, category: '' })
                  : setFilters({ needsDetails: false, category: value === 'all' ? '' : (value as Category) })
              }
              light
            />
          ) : null}

          {list.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {list.slice(0, shown).map((item, index) => (
                <li key={item.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_16rem]">
                  <Tile
                    item={item}
                    index={index}
                    selecting={selected !== null}
                    picked={selected?.has(item.id) ?? false}
                    onPick={() => toggle(item.id)}
                    showOwner={owner === 'all'}
                  />
                </li>
              ))}
              {list.length > shown ? <li ref={sentinel} aria-hidden="true" className="col-span-full h-8" /> : null}
            </ul>
          ) : (
            <div className="mt-6 rounded-[1.5rem] bg-white p-5 text-center shadow-[var(--shadow-xs)]">
              <p className="text-sm text-ink-600">{t.noMatch}</p>
              <Button size="sm" variant="tint" className="mt-3" onClick={() => setFilters({ q: '', category: '', needsDetails: false })}>
                {t.clear}
              </Button>
            </div>
          )}
        </>
      )}

      {selected ? (
        <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.75rem)] z-30 px-3 md:bottom-6">
          <div className="mx-auto flex max-w-xl items-center gap-2 rounded-pill bg-ink-900 p-1.5 pl-4 text-white shadow-[var(--shadow-float)] animate-rise">
            <span className="tabular mr-auto text-sm font-semibold">{t.selected(selected.size)}</span>
            <button
              type="button"
              disabled={!selected.size || bulk.isPending}
              onClick={() => setMoving(true)}
              className="press h-10 rounded-pill bg-white/10 px-3.5 text-sm font-semibold disabled:opacity-40"
            >
              {t.moveTo}
            </button>
            <button
              type="button"
              disabled={!selected.size || bulk.isPending}
              onClick={() => bulk.mutate({ status: filters.view === 'to_wash' ? 'clean' : 'to_wash' })}
              className="press h-10 rounded-pill bg-white/10 px-3.5 text-sm font-semibold disabled:opacity-40"
            >
              {filters.view === 'to_wash' ? t.markClean : t.markToWash}
            </button>
            <button
              type="button"
              aria-label={t.cancel}
              onClick={() => setSelected(null)}
              className="press grid size-10 place-items-center rounded-full bg-white text-ink-900"
            >
              <CloseIcon fontSize="inherit" className="text-xl" />
            </button>
          </div>
        </div>
      ) : null}

      <PlacePicker
        open={moving}
        onClose={() => setMoving(false)}
        places={data?.places ?? []}
        value={null}
        recent={recentPlaces()}
        onChange={(placeId) => {
          rememberPlace(placeId);
          bulk.mutate({ placeId });
        }}
      />
    </ClosetScreen>
  );
}

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  light,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  className?: string;
  light?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1 [scrollbar-width:none]', className)}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              haptic('tap');
              onChange(option.value);
            }}
            className={cx(
              'press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-pill px-3.5 text-sm font-semibold transition-colors',
              on
                ? light
                  ? 'bg-lav-200 text-ink-900'
                  : 'bg-ink-900 text-white'
                : 'bg-white text-ink-700 shadow-[var(--shadow-xs)] hover:bg-lav-50',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cx('tabular text-xs', on && !light ? 'text-white/65' : 'text-ink-500')}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** One piece: the cut-out on the studio backdrop, its name, its colours, what's going on with it. */
function Tile({
  item,
  index,
  selecting,
  picked,
  onPick,
  showOwner,
}: {
  item: Item;
  index: number;
  selecting: boolean;
  picked: boolean;
  onPick: () => void;
  showOwner: boolean;
}) {
  const t = useClosetT();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const start = () => {
    longPressed.current = false;
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onPick();
    }, 480);
  };
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  const title = item.name || (item.subcategory ? t.sub[item.subcategory] : item.category ? t.category[item.category] : '—');

  return (
    <Link
      to={`/closet/${item.id}`}
      viewTransition
      draggable={false}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (selecting || longPressed.current) {
          e.preventDefault();
          if (!longPressed.current) onPick();
          longPressed.current = false;
        }
      }}
      aria-pressed={selecting ? picked : undefined}
      className="press group block select-none [-webkit-touch-callout:none]"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <Studio
        cover={item.cover}
        alt={title}
        className={cx(
          'aspect-[4/5] rounded-[1.5rem] transition-[box-shadow,transform] duration-200',
          picked ? 'scale-[0.96] shadow-[0_0_0_3px_var(--color-ink-900)]' : 'shadow-[var(--shadow-xs)]',
        )}
      >
        <span className="absolute left-2.5 top-2.5 flex gap-1">
          {item.status === 'to_wash' ? (
            <span className="rounded-pill bg-sky-100 px-2 py-0.5 text-[0.6875rem] font-bold text-sky-800">{t.status.to_wash}</span>
          ) : null}
          {item.status === 'lent' || item.status === 'at_cleaners' ? (
            <span className="rounded-pill bg-peach-100 px-2 py-0.5 text-[0.6875rem] font-bold text-peach-800">{t.status[item.status]}</span>
          ) : null}
          {item.needsCutout ? (
            <span title={t.removeBgHint} className="grid size-6 place-items-center rounded-full bg-white/90 text-[0.8125rem] text-lav-700 shadow-[var(--shadow-xs)]">
              <SparkleIcon fontSize="inherit" />
            </span>
          ) : null}
        </span>
        {item.favorite ? (
          <FavoriteIcon fontSize="inherit" className="absolute right-3 top-3 text-base text-pink-400" />
        ) : null}
        {selecting ? (
          <span
            className={cx(
              'absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full text-xl',
              picked ? 'bg-white text-ink-900' : 'bg-white/70 text-transparent ring-2 ring-inset ring-ink-300',
            )}
          >
            <CheckCircleIcon fontSize="inherit" />
          </span>
        ) : null}
      </Studio>
      <span className="mt-2 flex items-center gap-1.5 px-1">
        {item.colors.slice(0, 3).map((c) => (
          <Swatch key={c} color={c} className="size-2.5" />
        ))}
        <span className="min-w-0 truncate text-[0.875rem] font-semibold leading-tight text-ink-900">{title}</span>
      </span>
      {item.brand || showOwner ? (
        <span className="block truncate px-1 text-xs text-ink-500">
          {[item.brand, showOwner ? item.ownerName : ''].filter(Boolean).join(' · ')}
        </span>
      ) : null}
    </Link>
  );
}

/** No pieces yet: an empty rail with one hanger, and the one thing to do. */
function Empty({ onAdd }: { onAdd: () => void }) {
  const t = useClosetT();
  return (
    <section className="relative mt-3 overflow-hidden rounded-[1.75rem] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
      <svg viewBox="0 0 320 120" aria-hidden="true" className="w-full max-w-sm text-ink-300">
        <path d="M12 22h296" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="12" cy="22" r="4" fill="currentColor" />
        <circle cx="308" cy="22" r="4" fill="currentColor" />
        <g transform="translate(118 18)" className="text-ink-900">
          <Hanger className="h-[84px] w-[126px]" />
        </g>
        <path d="M70 108h180" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      </svg>
      <h2 className="mt-4 max-w-md text-[1.75rem] font-bold leading-tight tracking-[-0.025em]">{t.emptyTitle}</h2>
      <p className="mt-2 max-w-prose text-[0.9375rem] leading-relaxed text-ink-600">{t.emptyBody}</p>
      <button
        type="button"
        onClick={onAdd}
        className="press mt-5 inline-flex h-12 items-center gap-2 rounded-pill bg-ink-900 px-5 text-[0.9375rem] font-semibold text-white"
      >
        <AddIcon fontSize="inherit" className="text-xl" />
        {t.emptyCta}
      </button>
    </section>
  );
}
