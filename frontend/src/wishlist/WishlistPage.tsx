import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  ArrowDownIcon,
  ArrowOutIcon,
  ArrowUpIcon,
  CheckIcon,
  ExpandMoreIcon,
  LockIcon,
} from '@/components/ui/icons';
import { money } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import {
  wishlistApi,
  wishlistKeys,
  type Urgency,
  type Wish,
  type WishlistResponse,
} from './api';
import { useWishlistT } from './i18n';
import { WishSheet } from './WishSheet';

/** How soon, as a colour: now is warm, soon is butter, someday is quiet. */
const URGENCY_TONE: Record<Urgency, string> = {
  now: 'bg-peach-100 text-peach-800',
  soon: 'bg-butter-100 text-butter-800',
  someday: 'bg-ink-50 text-ink-600',
};

type Filter = 'all' | Urgency | `c:${string}`;

/**
 * The priority buy list: the bigger things the household means to buy, ranked by hand. The first
 * one gets the stage; the rest are a numbered column you reorder with the arrows. What was bought
 * (or dropped) folds away underneath with what it cost.
 */
export default function WishlistPage() {
  const t = useWishlistT();
  const client = useQueryClient();
  const query = useQuery({ queryKey: wishlistKeys.all, queryFn: wishlistApi.list });
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Wish | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const data = query.data;
  const wanted = useMemo(() => (data?.items ?? []).filter((w) => w.status === 'wanted'), [data]);
  const done = useMemo(() => (data?.items ?? []).filter((w) => w.status !== 'wanted'), [data]);
  const currency = data?.currency ?? 'MDL';
  const shown = wanted.filter((w) =>
    filter === 'all'
      ? true
      : filter.startsWith('c:')
        ? w.category === filter.slice(2)
        : w.urgency === filter,
  );
  const sameCurrency = wanted.filter((w) => w.price !== null && w.currency === currency);
  const total = sameCurrency.reduce((sum, w) => sum + (w.price ?? 0), 0);
  const unpriced = wanted.filter((w) => w.price === null).length;
  const spent = done
    .filter((w) => w.status === 'bought' && w.boughtPrice !== null && w.currency === currency)
    .reduce((sum, w) => sum + (w.boughtPrice ?? 0), 0);

  const refresh = () => client.invalidateQueries({ queryKey: wishlistKeys.all });
  const failed = (error: unknown) => toast.error(t.failed, { description: errorMessage(error) });

  const quickAdd = useMutation({
    mutationFn: (name: string) => wishlistApi.add({ name }),
    onSuccess: () => setDraft(''),
    onError: failed,
    onSettled: refresh,
  });
  const bought = useMutation({
    mutationFn: (wish: Wish) => wishlistApi.update(wish.id, { status: 'bought' }),
    onMutate: () => haptic('success'),
    onSuccess: ({ item }) => toast.success(t.boughtToast(item.name)),
    onError: failed,
    onSettled: refresh,
  });
  const reorder = useMutation({
    mutationFn: (ids: string[]) => wishlistApi.reorder(ids),
    onMutate: (ids) => {
      // The new order shows at once; the server's answer replaces it.
      client.setQueryData<WishlistResponse>(wishlistKeys.all, (old) => {
        if (!old) return old;
        const rank = new Map(ids.map((id, i) => [id, i]));
        const items = [...old.items].sort(
          (a, b) => (rank.get(a.id) ?? 1e6) - (rank.get(b.id) ?? 1e6),
        );
        return { ...old, items };
      });
    },
    onError: failed,
    onSettled: refresh,
  });
  const move = (wish: Wish, step: -1 | 1) => {
    const ids = wanted.map((w) => w.id);
    const from = ids.indexOf(wish.id);
    const to = from + step;
    if (to < 0 || to >= ids.length) return;
    haptic('tap');
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    reorder.mutate(ids);
  };

  const [lead, ...rest] = filter === 'all' ? shown : [null, ...shown];
  const rankOf = (wish: Wish) => wanted.indexOf(wish) + 1;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/home"
        title={t.title}
        subtitle={data ? t.summary(wanted.length) : ' '}
      />

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {/* Quick add: type it, Enter. Details come later, from the row. */}
          <form
            className="flex items-center gap-2 rounded-[1.5rem] bg-white p-2 pl-4 shadow-[var(--shadow-card)]"
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) quickAdd.mutate(draft.trim());
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">{t.addLabel}</span>
              <input
                value={draft}
                maxLength={120}
                placeholder={t.addPlaceholder}
                onChange={(e) => setDraft(e.target.value)}
                className="h-11 w-full bg-transparent text-[0.9375rem] font-medium outline-none placeholder:text-ink-400"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="tint"
              onClick={() => setCreating(draft.trim())}
              className="hidden sm:inline-flex"
            >
              {t.newTitle}
            </Button>
            <Button
              type="submit"
              size="sm"
              icon={AddIcon}
              loading={quickAdd.isPending}
              disabled={!draft.trim()}
            >
              {t.add}
            </Button>
          </form>

          {query.isPending ? (
            <div aria-hidden="true" className="flex flex-col gap-3">
              <Skeleton className="h-40 rounded-[1.75rem]" />
              <Skeleton className="h-16 rounded-[1.25rem]" />
              <Skeleton className="h-16 rounded-[1.25rem]" />
            </div>
          ) : query.error ? (
            <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
              <p className="font-semibold text-danger-700">{t.loadFailed}</p>
              <p className="mt-1 text-sm text-ink-600">{errorMessage(query.error)}</p>
              <Button size="sm" variant="tint" className="mt-3" onClick={() => void query.refetch()}>
                {t.tryAgain}
              </Button>
            </div>
          ) : !wanted.length && !done.length ? (
            <section className="rounded-[1.75rem] bg-lav-100 p-6">
              <p className="text-[2.75rem] font-bold leading-none tracking-[-0.04em] text-lav-800">
                01
              </p>
              <h2 className="mt-3 text-h3 font-bold">{t.emptyTitle}</h2>
              <p className="mt-1.5 max-w-prose text-[0.9375rem] text-ink-700">{t.emptyBody}</p>
              <Button className="mt-4" icon={AddIcon} onClick={() => setCreating('')}>
                {t.newTitle}
              </Button>
            </section>
          ) : (
            <>
              {wanted.length ? (
                <dl className="grid grid-cols-3 gap-2">
                  <Stat label={t.toBuy} value={String(wanted.length)} />
                  <Stat
                    label={t.total}
                    value={total ? money(total, currency) : '—'}
                    hint={t.totalNote(unpriced)}
                  />
                  <Stat
                    label={t.urgentCount}
                    value={String(wanted.filter((w) => w.urgency === 'now').length)}
                    warm
                  />
                </dl>
              ) : null}

              {wanted.length > 1 ? (
                <Chips
                  label={t.show}
                  dense
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all' as Filter, label: t.all, count: wanted.length },
                    ...(['now', 'soon', 'someday'] as const)
                      .filter((u) => wanted.some((w) => w.urgency === u))
                      .map((u) => ({
                        value: u as Filter,
                        label: t.urgency[u],
                        count: wanted.filter((w) => w.urgency === u).length,
                      })),
                    ...(data?.categories ?? [])
                      .filter((c) => wanted.some((w) => w.category === c))
                      .map((c) => ({ value: `c:${c}` as Filter, label: c })),
                  ]}
                />
              ) : null}

              {lead ? (
                <Lead
                  wish={lead}
                  onOpen={() => setEditing(lead)}
                  onBought={() => bought.mutate(lead)}
                />
              ) : null}

              {rest.length ? (
                <ol className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]">
                  {(rest as Wish[]).map((wish) => (
                    <Row
                      key={wish.id}
                      wish={wish}
                      rank={rankOf(wish)}
                      first={rankOf(wish) === 1}
                      last={rankOf(wish) === wanted.length}
                      onOpen={() => setEditing(wish)}
                      onMove={(step) => move(wish, step)}
                    />
                  ))}
                </ol>
              ) : wanted.length && !shown.length ? (
                <p className="rounded-[1.25rem] bg-white px-4 py-3.5 text-sm text-ink-600 shadow-[var(--shadow-xs)]">
                  {t.noneHere}
                </p>
              ) : null}

              {done.length ? (
                <section className="mt-2">
                  <button
                    type="button"
                    aria-expanded={historyOpen}
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="press flex w-full items-center justify-between gap-3 px-1 py-2 text-left"
                  >
                    <span>
                      <span className="block text-[1.0625rem] font-bold">{t.history}</span>
                      {spent ? (
                        <span className="tabular block text-sm text-ink-600">
                          {t.spent(money(spent, currency))}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-semibold text-ink-600">
                      <span className="tabular">{done.length}</span>
                      <ExpandMoreIcon
                        fontSize="inherit"
                        className={cx('text-xl transition-transform', historyOpen && 'rotate-180')}
                      />
                    </span>
                  </button>
                  {historyOpen ? (
                    <ul className="mt-1 overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-xs)]">
                      {done.map((wish) => (
                        <li key={wish.id} className="border-b border-ink-100 last:border-0">
                          <button
                            type="button"
                            onClick={() => setEditing(wish)}
                            className="press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50"
                          >
                            <span
                              className={cx(
                                'grid size-8 shrink-0 place-items-center rounded-full text-base',
                                wish.status === 'bought'
                                  ? 'bg-mint-100 text-mint-800'
                                  : 'bg-ink-50 text-ink-400',
                              )}
                            >
                              <CheckIcon fontSize="inherit" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cx(
                                  'block truncate font-semibold',
                                  wish.status === 'dropped' && 'text-ink-500',
                                )}
                              >
                                {wish.name}
                              </span>
                              <span className="block truncate text-xs text-ink-500">
                                {wish.status === 'bought'
                                  ? wish.boughtOn
                                    ? t.boughtOn(formatDate(wish.boughtOn))
                                    : t.bought
                                  : t.dropped}
                              </span>
                            </span>
                            {wish.status === 'bought' && wish.boughtPrice !== null ? (
                              <span className="tabular shrink-0 text-sm font-semibold text-ink-800">
                                {money(wish.boughtPrice, wish.currency)}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>

      <WishSheet
        open={!!editing || creating !== null}
        onClose={() => {
          setEditing(null);
          setCreating(null);
        }}
        wish={editing}
        initialName={creating ?? undefined}
        categories={data?.categories ?? []}
        currency={currency}
      />
    </Screen>
  );
}

function Stat({
  label,
  value,
  hint,
  warm,
}: {
  label: string;
  value: string;
  hint?: string;
  warm?: boolean;
}) {
  return (
    <div
      className={cx(
        'min-w-0 rounded-[1.25rem] px-3.5 py-3',
        warm ? 'bg-peach-100' : 'bg-white shadow-[var(--shadow-xs)]',
      )}
    >
      <dt className="truncate text-xs font-semibold text-ink-600">{label}</dt>
      <dd className="tabular mt-0.5 truncate text-[1.0625rem] font-bold">{value}</dd>
      {hint ? <dd className="truncate text-[0.6875rem] text-ink-500">{hint}</dd> : null}
    </div>
  );
}

/** Number one: the big card. Its rank as a numeral, what and why, and the two things you do. */
function Lead({ wish, onOpen, onBought }: { wish: Wish; onOpen: () => void; onBought: () => void }) {
  const t = useWishlistT();
  return (
    <article className="relative overflow-hidden rounded-[1.75rem] bg-ink-900 p-5 text-white shadow-[var(--shadow-raised)]">
      <span
        aria-hidden="true"
        className="tabular pointer-events-none absolute -right-2 -top-6 text-[8.5rem] font-bold leading-none tracking-[-0.06em] text-white/[0.07]"
      >
        01
      </span>
      <button type="button" onClick={onOpen} className="press relative block w-full text-left">
        <span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="text-white/70">{t.next}</span>
          <UrgencyPill urgency={wish.urgency} />
          {wish.category ? (
            <span className="rounded-pill bg-white/10 px-2 py-0.5 text-white/80">
              {wish.category}
            </span>
          ) : null}
          {!wish.shared ? <LockIcon fontSize="inherit" className="text-white/60" /> : null}
        </span>
        <span className="mt-2 block text-[1.625rem] font-bold leading-tight tracking-[-0.02em]">
          {wish.name}
        </span>
        {wish.price !== null ? (
          <span className="tabular mt-1 block text-lg font-semibold text-butter-200">
            {money(wish.price, wish.currency)}
          </span>
        ) : null}
        {wish.note ? (
          <span className="mt-2 line-clamp-3 block max-w-prose text-sm leading-relaxed text-white/75">
            {wish.note}
          </span>
        ) : null}
      </button>
      <div className="relative mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onBought}
          className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-white px-4 text-sm font-semibold text-ink-900"
        >
          <CheckIcon fontSize="inherit" className="text-base" />
          {t.markBought}
        </button>
        {wish.url ? (
          <a
            href={wish.url}
            target="_blank"
            rel="noreferrer noopener"
            className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15"
          >
            {t.open}
            <ArrowOutIcon fontSize="inherit" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

/** One ranked line: the numeral, what, how soon and how much, and the arrows that move it. */
function Row({
  wish,
  rank,
  first,
  last,
  onOpen,
  onMove,
}: {
  wish: Wish;
  rank: number;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onMove: (step: -1 | 1) => void;
}) {
  const t = useWishlistT();
  const meta = [wish.price !== null ? money(wish.price, wish.currency) : null, wish.category || null]
    .filter(Boolean)
    .join(' · ');
  return (
    <li className="flex items-center gap-1 border-b border-ink-100 pr-1.5 last:border-0">
      <button
        type="button"
        onClick={onOpen}
        className="press flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left hover:bg-ink-50/60"
      >
        <span className="tabular w-8 shrink-0 text-[1.375rem] font-bold leading-none tracking-[-0.03em] text-ink-300">
          {String(rank).padStart(2, '0')}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[0.9375rem] font-semibold">{wish.name}</span>
            {!wish.shared ? (
              <LockIcon fontSize="inherit" className="shrink-0 text-ink-400" aria-label={t.privateTag} />
            ) : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            <UrgencyPill urgency={wish.urgency} small />
            {meta ? <span className="tabular truncate text-xs text-ink-500">{meta}</span> : null}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label={t.moveUp(wish.name)}
          disabled={first}
          onClick={() => onMove(-1)}
          className="press grid size-8 place-items-center rounded-full text-lg text-ink-500 hover:bg-ink-50 disabled:opacity-25"
        >
          <ArrowUpIcon fontSize="inherit" />
        </button>
        <button
          type="button"
          aria-label={t.moveDown(wish.name)}
          disabled={last}
          onClick={() => onMove(1)}
          className="press grid size-8 place-items-center rounded-full text-lg text-ink-500 hover:bg-ink-50 disabled:opacity-25"
        >
          <ArrowDownIcon fontSize="inherit" />
        </button>
      </span>
    </li>
  );
}

function UrgencyPill({ urgency, small }: { urgency: Urgency; small?: boolean }) {
  const t = useWishlistT();
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-pill font-semibold',
        small ? 'h-5 px-1.5 text-[0.6875rem]' : 'h-6 px-2 text-xs',
        URGENCY_TONE[urgency],
      )}
    >
      {t.urgency[urgency]}
    </span>
  );
}
