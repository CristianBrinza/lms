import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Skeleton, toast } from '@/components/ui';
import { ArrowBackIcon, ChevronRightIcon, ReceiptIcon, UndoIcon } from '@/components/ui/icons';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { formatAmount, money, parseAmount } from '../format';
import { FoodIcon } from '../icons/FoodIcon';
import type { ShoppingItem, Trip } from '../types';

/** Past shops with their totals; open one to correct what something cost or how much it was. */
export function TripsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tripId, setTripId] = useState<string | null>(null);
  const trips = useQuery({ queryKey: foodKeys.trips, queryFn: foodApi.trips, enabled: open });
  const close = () => {
    setTripId(null);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={tripId ? 'Shop' : 'Past shops'}
      description={
        tripId
          ? 'Fix a price or an amount: the kitchen follows.'
          : 'Every finished shop, newest first.'
      }
    >
      {tripId ? (
        <TripDetail tripId={tripId} onBack={() => setTripId(null)} />
      ) : trips.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : !trips.data?.length ? (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-ink-50 px-6 py-8 text-center">
          <ReceiptIcon fontSize="inherit" className="text-[2rem] text-ink-400" />
          <p className="font-semibold">No shops yet</p>
          <p className="text-sm text-ink-600">
            Tick things into the cart in a store, then “Finish the shop”.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {trips.data.map((trip) => (
            <li key={trip.id}>
              <TripRow trip={trip} onOpen={() => setTripId(trip.id)} />
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function TripRow({ trip, onOpen }: { trip: Trip; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press flex w-full items-center gap-3 rounded-2xl bg-ink-50 p-3.5 text-left transition-colors hover:bg-ink-100"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[1.3rem] text-ink-700">
        <ReceiptIcon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">
          {trip.storeName || 'Any store'}
        </span>
        <span className="block text-sm text-ink-600">
          {formatDate(trip.finishedAt)} · {trip.itemCount} {trip.itemCount === 1 ? 'item' : 'items'}
        </span>
      </span>
      <span className="tabular shrink-0 text-[0.9375rem] font-bold">
        {trip.total !== null ? money(trip.total) : '—'}
      </span>
      <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.3rem] text-ink-400" />
    </button>
  );
}

function TripDetail({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const trip = useQuery({ queryKey: foodKeys.trip(tripId), queryFn: () => foodApi.trip(tripId) });
  const [confirming, setConfirming] = useState(false);
  const undo = useMutation({
    mutationFn: () => foodApi.undoTrip(tripId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success('Shop undone: its things are back in the cart');
      onBack();
    },
    onError: (error) => {
      setConfirming(false);
      toast.error(errorMessage(error));
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        icon={ArrowBackIcon}
        className="self-start"
        onClick={onBack}
      >
        All shops
      </Button>
      {trip.isPending ? (
        <Skeleton className="h-40" />
      ) : trip.data ? (
        <>
          <div className="flex items-baseline justify-between rounded-2xl bg-butter-100 px-4 py-3">
            <span className="font-semibold">
              {trip.data.trip.storeName || 'Any store'} · {formatDate(trip.data.trip.finishedAt)}
            </span>
            <span className="tabular text-h2 font-bold">
              {trip.data.trip.total !== null ? money(trip.data.trip.total) : '—'}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {trip.data.items.map((line) => (
              <TripLine key={line.id} tripId={tripId} line={line} />
            ))}
          </ul>
          {confirming ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-danger-50 p-4">
              <p className="text-sm text-ink-800">
                What this shop put in the kitchen comes out again, and its lines go back into the
                cart, ticked. Only while none of it has been used or opened.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={undo.isPending}
                  onClick={() => undo.mutate()}
                >
                  Undo the shop
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={undo.isPending}
                  onClick={() => setConfirming(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={UndoIcon}
              className="self-start"
              onClick={() => setConfirming(true)}
            >
              Finished by mistake? Undo this shop
            </Button>
          )}
        </>
      ) : (
        <p className="text-sm text-danger-600">{errorMessage(trip.error)}</p>
      )}
    </div>
  );
}

function TripLine({ tripId, line }: { tripId: string; line: ShoppingItem }) {
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const save = useMutation({
    mutationFn: () => foodApi.updateTripLine(tripId, line.id, { price: parseAmount(price) }),
    onSuccess: (data) => {
      queryClient.setQueryData(foodKeys.trip(tripId), data);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success('Price saved');
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
        <FoodIcon name={line.icon} className="size-8" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{line.name}</span>
        <span className="block text-xs text-ink-600">
          {line.amount && line.unit ? formatAmount(line.amount, line.unit) : 'No amount'}
        </span>
      </span>
      <label className="flex w-28 shrink-0 items-center rounded-xl bg-white px-3 shadow-xs focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <span className="sr-only">Price of {line.name} in lei</span>
        <input
          inputMode="decimal"
          value={price}
          placeholder="—"
          onChange={(event) => setPrice(event.target.value)}
          onBlur={() => {
            if ((parseAmount(price) ?? null) !== line.price) save.mutate();
          }}
          className="tabular h-11 w-full min-w-0 bg-transparent text-right text-base font-semibold outline-none"
        />
        <span className="ml-1 text-sm text-ink-500">lei</span>
      </label>
    </li>
  );
}
