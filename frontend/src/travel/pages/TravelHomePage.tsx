import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { ButtonLink, Skeleton } from '@/components/ui';
import { AddIcon, ChecklistIcon, ChevronRightIcon, LuggageIcon } from '@/components/ui/icons';
import { localDate } from '@/food/format';
import { tr } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { kindLabel, scopeLabel, TRANSPORT_ICON, tripDates, tripWhen } from '../format';
import { useTravelT } from '../i18n';
import { PackedBar } from '../parts';
import { useTravel } from '../useTravel';
import type { Trip } from '../types';

/**
 * Travel's front door: the trips coming up (soonest first, with how much is packed), a button to
 * plan one, and the bags and the packing list behind it. Past trips sit below, quieter.
 */
export default function TravelHomePage() {
  const t = useTravelT();
  const home = useTravel();
  const today = localDate();
  const trips = home.data?.trips ?? [];
  const coming = trips.filter((trip) => trip.endDate >= today);
  const past = trips.filter((trip) => trip.endDate < today);

  return (
    <Screen tone="field">
      <PageHeader
        compact
        back="/home"
        title={t.title}
        subtitle={
          home.data
            ? coming.length
              ? t.home.comingUp(t.count.trips(coming.length))
              : t.home.nothingPlanned
            : ' '
        }
      />
      <div className="gutter-x mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_18rem] md:items-start md:gap-4 md:px-5 lg:px-8">
        <div className="flex min-w-0 flex-col gap-3">
          <ButtonLink icon={AddIcon} to="/travel/new" fullWidth>
            {t.common.planTrip}
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
                  <p className="text-[1.0625rem] font-bold">{t.home.whereNext}</p>
                  <p className="mt-1 text-sm text-ink-600">{t.home.empty}</p>
                </div>
              )}
              {past.length ? (
                <section aria-labelledby="past" className="mt-2">
                  <h2 id="past" className="mb-2 px-1 text-[0.9375rem] font-bold text-ink-700">
                    {t.home.been}
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
          aria-label={t.title}
          className="overflow-hidden rounded-[1.5rem] bg-white shadow-[var(--shadow-card)]"
        >
          <ul className="divide-y divide-ink-100">
            <Row
              to="/travel/bags"
              icon={LuggageIcon}
              title={t.common.bagsAndGear}
              detail={
                home.data
                  ? home.data.bags.length || home.data.gear.length
                    ? t.home.bagsDetail(
                        t.count.bags(home.data.bags.length),
                        t.count.gear(home.data.gear.length),
                      )
                    : t.home.addYours
                  : ' '
              }
            />
            <Row
              to="/travel/list"
              icon={ChecklistIcon}
              title={t.common.packingList}
              detail={home.data ? t.home.listDetail(t.count.things(home.data.items.length)) : ' '}
            />
          </ul>
        </nav>
      </div>
    </Screen>
  );
}

function TripCard({ trip, today, past }: { trip: Trip; today: string; past?: boolean }) {
  const t = useTravelT();
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
            {tr(trip, 'name')}
          </span>
          <span className="mt-0.5 block truncate text-sm text-ink-600">
            {tripDates(trip.startDate, trip.endDate)}
            {trip.departTime ? `, ${trip.departTime}` : ''} · {kindLabel(trip.kind)} ·{' '}
            {scopeLabel(trip.scope)}
          </span>
        </span>
        <span
          className={cx(
            'max-w-[45%] shrink-0 truncate rounded-pill px-2.5 py-1 text-xs font-bold',
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
            {done === total ? t.home.allPacked : t.home.packedOf(done, total)}
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
