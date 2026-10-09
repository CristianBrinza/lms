import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { ButtonLink, Skeleton } from '@/components/ui';
import { AddIcon, ChecklistIcon, ChevronRightIcon, LuggageIcon } from '@/components/ui/icons';
import { localDate, plural } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { KIND_LABEL, SCOPE_LABEL, TRANSPORT_ICON, tripDates, tripWhen } from '../format';
import { PackedBar } from '../parts';
import { useTravel } from '../useTravel';
import type { Trip } from '../types';

/**
 * Travel's front door: the trips coming up (soonest first, with how much is packed), a button to
 * plan one, and the bags and the packing list behind it. Past trips sit below, quieter.
 */
export default function TravelHomePage() {
  const home = useTravel();
  const today = localDate();
  const trips = home.data?.trips ?? [];
  const coming = trips.filter((t) => t.endDate >= today);
  const past = trips.filter((t) => t.endDate < today);

  return (
    <Screen tone="field">
      <PageHeader
        compact
        back="/home"
        title="Travel"
        subtitle={
          home.data
            ? coming.length
              ? `${plural(coming.length, 'trip')} coming up`
              : 'Nothing planned'
            : ' '
        }
      />
      <div className="gutter-x mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-4 md:px-5 lg:px-8">
        <div className="flex min-w-0 flex-col gap-3">
          <ButtonLink icon={AddIcon} to="/travel/new" fullWidth>
            Plan a trip
          </ButtonLink>
          {home.isPending ? (
            <>
              <Skeleton className="h-28 rounded-[1.5rem]" />
              <Skeleton className="h-28 rounded-[1.5rem]" />
            </>
          ) : home.error ? (
            <p className="rounded-3xl bg-white p-4 text-sm text-danger-700">
              {errorMessage(home.error)}
            </p>
          ) : (
            <>
              {coming.length ? (
                <ul className="flex flex-col gap-3">
                  {coming.map((trip) => (
                    <li key={trip.id}>
                      <TripCard trip={trip} today={today} />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-[1.5rem] bg-white p-5 shadow-[var(--shadow-card)]">
                  <p className="text-[1.0625rem] font-bold">Where next?</p>
                  <p className="mt-1 text-sm text-ink-600">
                    A trip gets its own checklist: documents, clothes for the days, the car or the
                    tickets, the house before you leave. A day out to a monument, a weekend at the
                    grandparents’, a week abroad each get what they need.
                  </p>
                </div>
              )}
              {past.length ? (
                <section aria-labelledby="past" className="mt-2">
                  <h2 id="past" className="mb-2 px-1 text-[0.9375rem] font-bold text-ink-700">
                    Been
                  </h2>
                  <ul className="flex flex-col gap-2">
                    {past.map((trip) => (
                      <li key={trip.id}>
                        <TripCard trip={trip} today={today} past />
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        <nav
          aria-label="Travel"
          className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]"
        >
          <ul className="divide-y divide-ink-100">
            <Row
              to="/travel/bags"
              icon={LuggageIcon}
              title="Bags and gear"
              detail={
                home.data
                  ? home.data.bags.length || home.data.gear.length
                    ? `${plural(home.data.bags.length, 'bag')}, ${plural(home.data.gear.length, 'thing')} of gear`
                    : 'Add the ones you have'
                  : ' '
              }
            />
            <Row
              to="/travel/list"
              icon={ChecklistIcon}
              title="Packing list"
              detail={
                home.data ? `${plural(home.data.items.length, 'thing')}, and when each comes` : ' '
              }
            />
          </ul>
        </nav>
      </div>
    </Screen>
  );
}

function TripCard({ trip, today, past }: { trip: Trip; today: string; past?: boolean }) {
  const Icon = TRANSPORT_ICON[trip.transport];
  const { done, total } = trip.packed;
  return (
    <Link
      to={`/travel/${trip.id}`}
      viewTransition
      className={cx(
        'press flex flex-col gap-2.5 rounded-[1.5rem] p-4 transition-colors',
        past
          ? 'bg-white/60 hover:bg-white'
          : 'bg-white shadow-[var(--shadow-card)] hover:bg-cyan-50',
      )}
    >
      <span className="flex items-start gap-3">
        <span
          className={cx(
            'grid size-12 shrink-0 place-items-center rounded-2xl text-[1.5rem]',
            past ? 'bg-ink-100 text-ink-500' : 'bg-cyan-100 text-cyan-800',
          )}
        >
          <Icon fontSize="inherit" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1.0625rem] font-bold leading-tight">
            {trip.name}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-600">
            {tripDates(trip.startDate, trip.endDate)}
            {trip.departTime ? `, ${trip.departTime}` : ''} · {KIND_LABEL[trip.kind]} ·{' '}
            {SCOPE_LABEL[trip.scope]}
          </span>
        </span>
        <span
          className={cx(
            'shrink-0 rounded-pill px-2.5 py-1 text-xs font-bold',
            past ? 'bg-ink-100 text-ink-600' : 'bg-ink-900 text-white',
          )}
        >
          {tripWhen(trip.startDate, trip.endDate, today)}
        </span>
      </span>
      {!past && total ? (
        <span className="flex items-center gap-3">
          <PackedBar done={done} total={total} className="flex-1" />
          <span className="tabular text-xs font-semibold text-ink-600">
            {done === total ? 'All packed' : `${done} of ${total} packed`}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

function Row({
  to,
  icon: Icon,
  title,
  detail,
}: {
  to: string;
  icon: typeof LuggageIcon;
  title: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        to={to}
        viewTransition
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cyan-50"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-[1.35rem] text-cyan-800">
          <Icon fontSize="inherit" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{title}</span>
          <span className="block truncate text-sm text-ink-600">{detail}</span>
        </span>
        <ChevronRightIcon fontSize="inherit" className="text-[1.3rem] text-ink-400" />
      </Link>
    </li>
  );
}
