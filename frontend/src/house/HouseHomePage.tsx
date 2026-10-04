import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Skeleton, toast } from '@/components/ui';
import { AddIcon, ChevronRightIcon } from '@/components/ui/icons';
import { foodApi, foodKeys } from '@/food/api';
import { areaOf, CATEGORY_LABEL, plural } from '@/food/format';
import { FoodIcon, FoodIconTile } from '@/food/icons/FoodIcon';
import type { Category } from '@/food/types';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';

const ROOMS: Array<{ category: Category; icon: string }> = [
  { category: 'bathroom', icon: 'shampoo' },
  { category: 'cleaning', icon: 'cleaner-spray' },
  { category: 'laundry', icon: 'fabric-softener' },
  { category: 'paper', icon: 'toilet-paper' },
  { category: 'pets', icon: 'cat-litter' },
  { category: 'household', icon: 'light-bulb' },
];

/**
 * The house's front door: what's running low (one tap puts it on the list), the kinds of things
 * kept at home with how many of each, and the way to everything and to the house's shopping.
 * The same engine as the kitchen: counts, levels, low-stock limits, a finished shop stocks it.
 */
export default function HouseHomePage() {
  const queryClient = useQueryClient();
  const kitchen = useQuery({ queryKey: foodKeys.kitchen, queryFn: foodApi.kitchen });
  const shopping = useQuery({ queryKey: foodKeys.shopping, queryFn: foodApi.shopping });
  const things = (kitchen.data ?? []).filter((p) => areaOf(p.category) === 'house');
  const lines = (shopping.data?.items ?? []).filter(
    (l) => (l.area ?? areaOf(l.category)) === 'house' && !l.checked,
  );
  const low = things.filter((p) => p.low && !lines.some((l) => l.productId === p.id));
  const have = things.filter((p) => p.total > 0 || (p.trackMode === 'level' && p.level !== 'out'));

  const add = useMutation({
    mutationFn: (productId: string) => foodApi.addLines([{ productId }], 'low_stock'),
    onSuccess: ([line]) => {
      haptic('tap');
      toast.success(`${line?.name ?? 'It'} is on the list`);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Screen tone="field">
      <PageHeader
        compact
        back="/home"
        title="House"
        subtitle={
          kitchen.data
            ? `${plural(have.length, 'thing')} at home${low.length ? ` · ${low.length} running low` : ''}`
            : ' '
        }
      />
      <div className="gutter-x mt-3 grid gap-3 md:grid-cols-2 md:gap-4 md:px-5 lg:px-8">
        <section
          aria-labelledby="low"
          className="rounded-[1.5rem] bg-ink-900 p-4 text-white shadow-[var(--shadow-tile)] sm:p-5 md:row-span-2"
        >
          <h2 id="low" className="text-[1.125rem] font-bold">
            Running low
          </h2>
          {kitchen.isPending ? (
            <Skeleton className="mt-3 h-24 rounded-2xl bg-white/10" />
          ) : low.length ? (
            <ul className="mt-3 flex flex-col gap-2">
              {low.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/8 p-2">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
                    <FoodIcon name={p.icon} className="size-9" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.name}</span>
                    <span className="block text-sm text-white/65">
                      {p.trackMode === 'level'
                        ? p.level === 'out'
                          ? 'Out'
                          : 'Low'
                        : `${p.total} left`}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="accent"
                    icon={AddIcon}
                    loading={add.isPending && add.variables === p.id}
                    onClick={() => add.mutate(p.id)}
                  >
                    List
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-white/70">
              Nothing. Give things a low limit (or mark a bottle low) and they show up here.
            </p>
          )}
        </section>

        <section aria-label="Kinds of things" className="grid grid-cols-3 gap-2">
          {ROOMS.map((room) => {
            const count = have.filter((p) => p.category === room.category).length;
            return (
              <Link
                key={room.category}
                to={`/house/items?kind=${room.category}`}
                className="press flex flex-col items-center gap-1 rounded-[1.25rem] bg-white p-3 text-center shadow-[var(--shadow-card)] transition-colors hover:bg-lav-50"
              >
                <FoodIconTile name={room.icon} className="size-12" />
                <span className="text-sm font-semibold">{CATEGORY_LABEL[room.category]}</span>
                <span className="tabular text-xs text-ink-500">{count || '—'}</span>
              </Link>
            );
          })}
        </section>

        <nav
          aria-label="House"
          className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]"
        >
          <ul className="divide-y divide-ink-100">
            <Row
              to="/house/items"
              title="Everything at home"
              detail={kitchen.data ? plural(have.length, 'thing') : ' '}
              icon="cleaner-spray"
            />
            <Row
              to="/house/shopping"
              title="House shopping"
              detail={shopping.data ? `${lines.length} to buy` : ' '}
              icon="paper-towels"
            />
            <Row
              to="/shopping"
              title="All shopping"
              detail="Food and the house, one trip"
              icon="basket"
            />
          </ul>
        </nav>
      </div>
      {kitchen.error ? (
        <p className="gutter-x mt-3 text-sm text-danger-700">{errorMessage(kitchen.error)}</p>
      ) : null}
    </Screen>
  );
}

function Row({
  to,
  title,
  detail,
  icon,
}: {
  to: string;
  title: string;
  detail: string;
  icon: string;
}) {
  return (
    <li>
      <Link
        to={to}
        viewTransition
        className={cx('flex items-center gap-3 px-4 py-3 transition-colors hover:bg-lav-50')}
      >
        <FoodIconTile name={icon} className="size-11" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-sm text-ink-600">{detail}</span>
        </span>
        <ChevronRightIcon fontSize="inherit" className="text-[1.3rem] text-ink-400" />
      </Link>
    </li>
  );
}
