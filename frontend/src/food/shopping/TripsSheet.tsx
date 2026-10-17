import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Sheet, Skeleton, toast } from '@/components/ui';
import { ArrowBackIcon, ChevronRightIcon, ReceiptIcon, UndoIcon } from '@/components/ui/icons';
import { tr } from '@/i18n';
import { formatDate } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { foodApi, foodKeys } from '../api';
import { formatAmount, money, parseAmount, storeText } from '../format';
import { FoodIcon } from '../icons/FoodIcon';
import type { ShoppingItem, Trip } from '../types';
import { shoppingT } from './shopping.i18n';

/** Past shops with their totals; open one to correct what something cost or how much it was. */
export function TripsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = shoppingT();
  const t = s.trips;
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
      title={tripId ? t.shop : s.pastShops}
      description={tripId ? t.fixHint : t.everyShop}
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
          <p className="font-semibold">{t.none}</p>
          <p className="text-sm text-ink-600">{t.noneHint}</p>
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
  const s = shoppingT();
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
          {storeText(trip.storeName, trip.storeTranslations) || s.anyStore}
        </span>
        <span className="block text-sm text-ink-600">
          {formatDate(trip.finishedAt)} · {s.trips.items(trip.itemCount)}
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
  const s = shoppingT();
  const t = s.trips;
  const queryClient = useQueryClient();
  const trip = useQuery({ queryKey: foodKeys.trip(tripId), queryFn: () => foodApi.trip(tripId) });
  const [confirming, setConfirming] = useState(false);
  const undo = useMutation({
    mutationFn: () => foodApi.undoTrip(tripId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(t.undone);
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
        {t.allShops}
      </Button>
      {trip.isPending ? (
        <Skeleton className="h-40" />
      ) : trip.data ? (
        <>
          <div className="flex items-baseline justify-between gap-3 rounded-2xl bg-butter-100 px-4 py-3">
            <span className="min-w-0 font-semibold">
              {storeText(trip.data.trip.storeName, trip.data.trip.storeTranslations) || s.anyStore}{' '}
              · {formatDate(trip.data.trip.finishedAt)}
            </span>
            <span className="tabular shrink-0 text-h2 font-bold">
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
              <p className="text-sm text-ink-800">{t.undoText}</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  loading={undo.isPending}
                  onClick={() => undo.mutate()}
                >
                  {t.undoShop}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={undo.isPending}
                  onClick={() => setConfirming(false)}
                >
                  {t.keepIt}
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
              {t.byMistake}
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
  const s = shoppingT();
  const queryClient = useQueryClient();
  const [price, setPrice] = useState(line.price === null ? '' : String(line.price));
  const save = useMutation({
    mutationFn: () => foodApi.updateTripLine(tripId, line.id, { price: parseAmount(price) }),
    onSuccess: (data) => {
      queryClient.setQueryData(foodKeys.trip(tripId), data);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      toast.success(s.trips.priceSaved);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const name = tr(line, 'name');
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-ink-50 p-2.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
        <FoodIcon name={line.icon} className="size-8" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.9375rem] font-semibold">{name}</span>
        <span className="block text-xs text-ink-600">
          {line.amount && line.unit ? formatAmount(line.amount, line.unit) : s.trips.noAmount}
        </span>
      </span>
      <label className="flex w-28 shrink-0 items-center rounded-xl bg-white px-3 shadow-xs focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
        <span className="sr-only">{s.priceOf(name)}</span>
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
