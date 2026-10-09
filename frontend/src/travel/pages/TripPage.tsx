import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, Chips, IconLink, Sheet, Skeleton, toast } from '@/components/ui';
import {
  AddIcon,
  AddShoppingCartIcon,
  CheckIcon,
  EditIcon,
  MoreHorizIcon,
  RemoveIcon,
} from '@/components/ui/icons';
import { localDate, plural } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { travelApi, travelKeys } from '../api';
import {
  BAG_ICON,
  dueLabel,
  dueState,
  GEAR_ICON,
  KIND_LABEL,
  moneyTotal,
  SCOPE_LABEL,
  TRANSPORT_ICON,
  TRANSPORT_LABEL,
  tripDates,
  tripWhen,
} from '../format';
import { PackedBar } from '../parts';
import type { Money, Trip, TripCheck } from '../types';
import { useTravel } from '../useTravel';

type TripData = { trip: Trip; checks: TripCheck[] };

/**
 * One trip: the way there and back, who, bags and gear, the money; what's due before leaving and
 * what still has to be bought; then the checklist by section, ticked as things go into the bag
 * (by anyone in the household). Things for this trip only are added at the bottom.
 */
export default function TripPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: travelKeys.trip(id), queryFn: () => travelApi.trip(id) });
  const home = useTravel();
  const [hidePacked, setHidePacked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const trip = data.data?.trip;
  const checks = data.data?.checks ?? [];

  // Optimistic: a tick or "to buy" shows at once, and goes back if the API says no.
  const patch = useMutation({
    mutationFn: ({ check, body }: { check: TripCheck; body: Partial<TripCheck> }) =>
      travelApi.updateCheck(id, check.id, body),
    onMutate: async ({ check, body }) => {
      haptic('tap');
      await queryClient.cancelQueries({ queryKey: travelKeys.trip(id) });
      const before = queryClient.getQueryData<TripData>(travelKeys.trip(id));
      if (before)
        queryClient.setQueryData(travelKeys.trip(id), {
          ...before,
          checks: before.checks.map((c) => (c.id === check.id ? { ...c, ...body } : c)),
        });
      return { before };
    },
    onError: (error, _v, context) => {
      if (context?.before) queryClient.setQueryData(travelKeys.trip(id), context.before);
      toast.error(errorMessage(error));
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: travelKeys.all }),
  });
  const tick = (check: TripCheck) => patch.mutate({ check, body: { checked: !check.checked } });

  const done = checks.filter((c) => c.checked).length;
  const groups = [...new Set(checks.map((c) => c.group))];
  const shown = hidePacked ? checks.filter((c) => !c.checked) : checks;
  const due = checks
    .filter((c) => c.dueAt && !c.checked)
    .sort((a, b) => a.dueAt!.localeCompare(b.dueAt!));
  const toBuy = checks.filter((c) => c.toBuy && !c.checked);
  const row = (check: TripCheck) => (
    <Row
      key={check.id}
      check={check}
      onTick={() => tick(check)}
      onMore={() => setEditingId(check.id)}
    />
  );

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/travel"
        title={trip?.name ?? 'Trip'}
        subtitle={
          trip
            ? `${tripDates(trip.startDate, trip.endDate)} · ${tripWhen(trip.startDate, trip.endDate, localDate())}`
            : ' '
        }
        actions={
          trip ? (
            <IconLink
              icon={EditIcon}
              label="Change the trip"
              to={`/travel/${id}/edit`}
              size="sm"
              variant="ink"
            />
          ) : null
        }
      />
      {data.error ? (
        <p className="gutter-x mt-4 text-sm text-danger-700">{errorMessage(data.error)}</p>
      ) : !trip ? (
        <div className="gutter-x mt-3 flex flex-col gap-3">
          <Skeleton className="h-32 rounded-[1.5rem]" />
          <Skeleton className="h-64 rounded-[1.5rem]" />
        </div>
      ) : (
        <div className="gutter-x mx-auto mt-3 grid max-w-5xl gap-4 pb-10 md:grid-cols-[18rem_minmax(0,1fr)] md:items-start md:px-5 lg:px-8">
          <div className="flex flex-col gap-3">
            <Summary trip={trip} home={home.data} done={done} total={checks.length} />
            {trip.money.length ? <MoneyCard trip={trip} /> : null}
          </div>

          <div className="min-w-0">
            {due.length ? (
              <Panel title="Before you leave" count={due.length}>
                {due.map(row)}
              </Panel>
            ) : null}
            {toBuy.length ? (
              <BuyPanel
                tripId={id}
                count={toBuy.length}
                unlisted={toBuy.filter((c) => !c.listedAt).length}
              >
                {toBuy.map(row)}
              </BuyPanel>
            ) : null}

            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-600">
                {done === checks.length && checks.length
                  ? 'Everything’s packed'
                  : `${checks.length - done} still to pack`}
              </p>
              {done ? (
                <button
                  type="button"
                  aria-pressed={hidePacked}
                  onClick={() => setHidePacked((h) => !h)}
                  className={cx(
                    'press h-8 rounded-pill px-3 text-xs font-semibold',
                    hidePacked ? 'bg-ink-900 text-white' : 'bg-ink-50 text-ink-700',
                  )}
                >
                  Hide packed
                </button>
              ) : null}
            </div>
            {groups.map((group) => {
              const rows = shown.filter((c) => c.group === group);
              if (!rows.length) return null;
              const all = checks.filter((c) => c.group === group);
              return (
                <Panel
                  key={group}
                  title={group}
                  count={`${all.filter((c) => c.checked).length}/${all.length}`}
                >
                  {rows.map(row)}
                </Panel>
              );
            })}
            <AddBar tripId={id} />
          </div>
        </div>
      )}
      <CheckSheet
        tripId={id}
        check={checks.find((c) => c.id === editingId) ?? null}
        onBuy={(check, value) => patch.mutate({ check, body: { toBuy: value } })}
        onClose={() => setEditingId(null)}
      />
    </Screen>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-3.5" aria-label={title}>
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
        {title}
        <span className="tabular text-sm font-semibold text-ink-500">{count}</span>
      </h2>
      <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
        {children}
      </ul>
    </section>
  );
}

function Row({
  check,
  onTick,
  onMore,
}: {
  check: TripCheck;
  onTick: () => void;
  onMore: () => void;
}) {
  const state = check.dueAt && !check.checked ? dueState(check.dueAt) : null;
  const buying = check.toBuy && !check.checked;
  return (
    <li className="flex items-center pr-1">
      <button
        type="button"
        role="checkbox"
        aria-checked={check.checked}
        onClick={onTick}
        className="press flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 text-left"
      >
        <span
          className={cx(
            'grid size-7 shrink-0 place-items-center rounded-full text-[1.1rem] transition-colors',
            check.checked
              ? 'bg-ink-900 text-white'
              : 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
          )}
        >
          {check.checked ? <CheckIcon fontSize="inherit" className="animate-pop" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cx(
              'block truncate text-[0.9375rem] font-semibold',
              check.checked && 'text-ink-500 line-through decoration-ink-300',
            )}
          >
            {check.name}
            {check.quantity > 1 ? (
              <span className="tabular font-medium text-ink-500"> × {check.quantity}</span>
            ) : null}
          </span>
          {state || buying ? (
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs font-semibold">
              {check.dueAt && state ? (
                <span
                  className={cx(
                    state === 'late' && 'text-danger-700',
                    state === 'soon' && 'text-peach-800',
                    state === 'later' && 'text-ink-500',
                  )}
                >
                  {state === 'late' ? 'Late: ' : ''}
                  {dueLabel(check.dueAt)}
                </span>
              ) : null}
              {buying ? (
                <span className="rounded-pill bg-butter-100 px-2 py-0.5 text-butter-800">
                  {check.listedAt ? 'On the shopping list' : 'To buy'}
                </span>
              ) : null}
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onMore}
        aria-label={`More for ${check.name}`}
        className="press grid size-11 shrink-0 place-items-center rounded-full text-[1.25rem] text-ink-400 hover:bg-ink-50 hover:text-ink-700"
      >
        <MoreHorizIcon fontSize="inherit" />
      </button>
    </li>
  );
}

function BuyPanel({
  tripId,
  count,
  unlisted,
  children,
}: {
  tripId: string;
  count: number;
  unlisted: number;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const shop = useMutation({
    mutationFn: () => travelApi.shop(tripId),
    onSuccess: ({ listed }) => {
      toast.success(`${plural(listed, 'thing')} on the shopping list`);
      void queryClient.invalidateQueries({ queryKey: travelKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['food'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <section className="mb-3.5" aria-label="To buy">
      <h2 className="mb-1.5 flex items-center gap-2 px-1 text-[0.9375rem] font-bold">
        To buy
        <span className="tabular text-sm font-semibold text-ink-500">{count}</span>
      </h2>
      <div className="overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-butter-300">
        <ul className="divide-y divide-ink-100">{children}</ul>
        {unlisted ? (
          <div className="bg-butter-100 p-2">
            <Button
              fullWidth
              size="sm"
              icon={AddShoppingCartIcon}
              loading={shop.isPending}
              onClick={() => shop.mutate()}
            >
              Put {plural(unlisted, 'thing')} on the shopping list
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

const legDay = (date: string, time: string | null) =>
  `${tripDates(date, date)}${time ? `, ${time}` : ''}`;

function Summary({
  trip,
  home,
  done,
  total,
}: {
  trip: Trip;
  home: ReturnType<typeof useTravel>['data'];
  done: number;
  total: number;
}) {
  const Icon = TRANSPORT_ICON[trip.transport];
  const people = (home?.people ?? []).filter((p) => trip.people.includes(p.id));
  const bags = (home?.bags ?? []).filter((b) => trip.bagIds.includes(b.id));
  const gear = trip.gear
    .map((g) => ({ ...g, item: home?.gear.find((x) => x.id === g.gearId) }))
    .filter((g) => g.item);
  const legs: Array<[string, string]> = [['Leave home', legDay(trip.startDate, trip.departTime)]];
  if (trip.arriveTime)
    legs.push(['Arrive', legDay(trip.arriveDate ?? trip.startDate, trip.arriveTime)]);
  if (trip.backTime) legs.push(['Head back', legDay(trip.backDate ?? trip.endDate, trip.backTime)]);
  legs.push(['Home again', legDay(trip.endDate, trip.returnTime)]);
  return (
    <section aria-label="The trip" className="flex flex-col gap-3 rounded-[1.5rem] bg-cyan-100 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white text-[1.5rem] text-cyan-800">
          <Icon fontSize="inherit" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-bold">{trip.destination || trip.name}</p>
          <p className="truncate text-sm text-cyan-800">
            {TRANSPORT_LABEL[trip.transport]} · {KIND_LABEL[trip.kind]} · {SCOPE_LABEL[trip.scope]}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {legs.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white/70 p-2.5">
            <dt className="text-xs font-semibold text-cyan-800">{label}</dt>
            <dd className="font-bold">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-2">
        <span className="flex -space-x-2">
          {people.map((p) => (
            <Avatar key={p.id} person={p} size="sm" />
          ))}
        </span>
        <span className="text-sm font-medium">
          {plural(trip.travellers, 'person', 'people')}
          {trip.guests ? ` (${trip.guests} not in LMS)` : ''} · {plural(trip.days, 'day')}
        </span>
      </div>
      {bags.length || gear.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {bags.map((bag) => {
            const BagIcon = BAG_ICON(bag.kind);
            return (
              <li
                key={bag.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-white px-3 text-xs font-semibold"
              >
                <BagIcon fontSize="inherit" className="text-[1rem] text-cyan-800" />
                {bag.name}
              </li>
            );
          })}
          {gear.map(({ gearId, count, item }) => {
            const GearIcon = GEAR_ICON[item!.kind];
            return (
              <li
                key={gearId}
                className="inline-flex h-8 items-center gap-1.5 rounded-pill bg-white px-3 text-xs font-semibold"
              >
                <GearIcon fontSize="inherit" className="text-[1rem] text-cyan-800" />
                {item!.name}
                {count > 1 ? ` × ${count}` : ''}
              </li>
            );
          })}
        </ul>
      ) : null}
      {trip.note ? <p className="whitespace-pre-line text-sm">{trip.note}</p> : null}
      <div className="flex items-center gap-3">
        <PackedBar done={done} total={total} className="flex-1 bg-white" />
        <span className="tabular text-xs font-bold">
          {done}/{total}
        </span>
      </div>
    </section>
  );
}

const amount = (n: number) => n.toLocaleString('en-GB').replace(/,/g, ' ');

/** Cash and cards: how much of each, ticked once taken, or topped up and checked. */
function MoneyCard({ trip }: { trip: Trip }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (money: Money[]) => travelApi.updateTrip(trip.id, { money }),
    onMutate: (money) => {
      haptic('tap');
      queryClient.setQueryData<TripData>(travelKeys.trip(trip.id), (d) =>
        d ? { ...d, trip: { ...d.trip, money } } : d,
      );
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: travelKeys.all }),
  });
  const total = moneyTotal(trip.money);
  const toggle = (m: Money) =>
    save.mutate(trip.money.map((x) => (x.id === m.id ? { ...x, ready: !x.ready } : x)));
  return (
    <section
      aria-label="Money"
      className="rounded-[1.5rem] bg-white p-3 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
    >
      <h2 className="flex items-baseline justify-between gap-2 px-1 text-[0.9375rem] font-bold">
        Money
        {total ? <span className="tabular text-sm font-semibold text-ink-600">{total}</span> : null}
      </h2>
      <ul className="mt-1">
        {trip.money.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={m.ready}
              onClick={() => toggle(m)}
              className="press flex w-full items-center gap-3 rounded-2xl px-1 py-2 text-left hover:bg-ink-50"
            >
              <span
                className={cx(
                  'grid size-7 shrink-0 place-items-center rounded-full text-[1.1rem]',
                  m.ready
                    ? 'bg-ink-900 text-white'
                    : 'bg-white shadow-[inset_0_0_0_2px_var(--color-ink-300)]',
                )}
              >
                {m.ready ? <CheckIcon fontSize="inherit" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.9375rem] font-semibold">{m.label}</span>
                <span className="block text-xs text-ink-500">
                  {m.kind === 'cash'
                    ? m.ready
                      ? 'Taken'
                      : 'Take it'
                    : m.ready
                      ? 'Balance checked'
                      : 'Check the balance, top up'}
                </span>
              </span>
              <span className="tabular shrink-0 font-bold">
                {m.amount !== null ? `${amount(m.amount)} ` : ''}
                <span className="font-semibold text-ink-500">{m.currency}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AddBar({ tripId }: { tripId: string }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const add = useMutation({
    mutationFn: () => travelApi.addCheck(tripId, { name: name.trim() }),
    onSuccess: () => {
      setName('');
      void queryClient.invalidateQueries({ queryKey: travelKeys.all });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) add.mutate();
  };
  return (
    <form
      onSubmit={submit}
      className="mt-2 flex items-center gap-2 rounded-[1.25rem] bg-ink-50 p-1.5 pl-4"
    >
      <label htmlFor="trip-add" className="sr-only">
        Something for this trip
      </label>
      <input
        id="trip-add"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Something else for this trip…"
        maxLength={80}
        enterKeyHint="done"
        className="h-10 min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none placeholder:text-ink-500"
      />
      <Button
        type="submit"
        size="sm"
        icon={AddIcon}
        loading={add.isPending}
        disabled={!name.trim()}
      >
        Add
      </Button>
    </form>
  );
}

function CheckSheet({
  tripId,
  check,
  onBuy,
  onClose,
}: {
  tripId: string;
  check: TripCheck | null;
  onBuy: (check: TripCheck, toBuy: boolean) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: travelKeys.all });
  const quantity = useMutation({
    mutationFn: (q: number) => travelApi.updateCheck(tripId, check!.id, { quantity: q }),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: () => travelApi.removeCheck(tripId, check!.id),
    onSuccess: () => {
      toast.success(`${check!.name} is off this trip`);
      refresh();
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const q = quantity.isPending && quantity.variables ? quantity.variables : (check?.quantity ?? 1);
  return (
    <Sheet open={Boolean(check)} onClose={onClose} title={check?.name ?? ''}>
      {check ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">At home?</p>
            <Chips
              label="At home?"
              tone="sheet"
              dense
              value={check.toBuy ? 'buy' : 'have'}
              onChange={(v) => onBuy(check, v === 'buy')}
              options={[
                { value: 'have', label: 'Have it' },
                { value: 'buy', label: 'Need to buy' },
              ]}
            />
            <p className="mt-1.5 text-sm text-ink-600">
              {check.listedAt
                ? 'It’s on the shopping list.'
                : check.toBuy
                  ? 'Goes onto the shopping list from “To buy” on the trip.'
                  : 'Not at home? Mark it, and put it on the shopping list from the trip.'}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-[1.125rem] bg-ink-50 px-4 py-2">
            <span className="text-[0.9375rem] font-medium">How many</span>
            <span className="flex items-center gap-1">
              <button
                type="button"
                aria-label="One fewer"
                disabled={q <= 1}
                onClick={() => quantity.mutate(q - 1)}
                className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs disabled:opacity-40"
              >
                <RemoveIcon fontSize="inherit" />
              </button>
              <span className="tabular w-8 text-center text-[1.0625rem] font-bold">{q}</span>
              <button
                type="button"
                aria-label="One more"
                onClick={() => quantity.mutate(q + 1)}
                className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs"
              >
                <AddIcon fontSize="inherit" />
              </button>
            </span>
          </div>
          {check.dueAt ? (
            <p className="text-sm text-ink-600">Done {dueLabel(check.dueAt)}.</p>
          ) : null}
          <p className="text-sm text-ink-600">
            {check.itemId
              ? 'From the packing list. Taking it off switches it off for this trip only.'
              : 'Added to this trip only.'}
          </p>
          <Button
            variant="outline"
            fullWidth
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Take it off this trip
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
