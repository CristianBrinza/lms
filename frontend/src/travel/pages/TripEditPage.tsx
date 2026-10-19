import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '@/app/auth';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { TranslationFields } from '@/components/common/TranslationFields';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, Chips, Skeleton, Switch, TextField, toast } from '@/components/ui';
import {
  AddIcon,
  DeleteIcon,
  ExpandMoreIcon,
  PublicIcon,
  PlaceIcon,
  RemoveIcon,
} from '@/components/ui/icons';
import { tr, type Translations } from '@/i18n';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { travelApi, travelKeys } from '../api';
import {
  bagSize,
  BAG_ICON,
  itemApplies,
  groupLabel,
  itemQuantity,
  kindLabel,
  rulesLabel,
  scopeLabel,
  tomorrow,
  translationsPatch,
  TRANSPORT_ICON,
  transportLabel,
  type TripShape,
} from '../format';
import { useTravelT } from '../i18n';
import { Field, ToggleChip } from '../parts';
import { useTravel } from '../useTravel';
import { RangeCalendar } from '../RangeCalendar';
import { GearPicker } from '../GearPicker';
import { MoneyEditor } from '../MoneyEditor';
import type { Kind, Money, PackingItem, Scope, Transport, Trip, TripInput } from '../types';

const KINDS: Kind[] = ['vacation', 'family', 'day', 'event', 'work', 'other'];
const TRANSPORTS: Transport[] = ['car', 'bus', 'train', 'plane', 'other'];

/**
 * Planning a trip, or changing one: where, in Moldova or abroad, what kind, how, which days (on a
 * calendar) and times, who goes, which bags, and what to pack. The packing list shows what fits
 * this trip by its rules; any item can be switched on or off for this trip alone.
 */
export default function TripEditPage() {
  const t = useTravelT();
  const { id } = useParams();
  const home = useTravel();
  const trip = useQuery({
    queryKey: travelKeys.trip(id ?? 'new'),
    queryFn: () => travelApi.trip(id!),
    enabled: Boolean(id),
  });
  const ready = home.data && (!id || trip.data);
  return (
    <Screen tone="white">
      <PageHeader
        compact
        back={id ? `/travel/${id}` : '/travel'}
        title={id ? t.common.changeTrip : t.common.planTrip}
        subtitle=" "
      />
      {home.error || trip.error ? (
        <p className="gutter-x mt-4 text-sm text-danger-700">
          {errorMessage(home.error ?? trip.error)}
        </p>
      ) : !ready ? (
        <div className="gutter-x mt-4 flex flex-col gap-3">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      ) : (
        <TripForm key={id ?? 'new'} trip={trip.data?.trip ?? null} />
      )}
    </Screen>
  );
}

function TripForm({ trip }: { trip: Trip | null }) {
  const t = useTravelT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const home = useTravel().data!;
  const first = trip?.startDate ?? tomorrow();

  const [name, setName] = useState(trip?.name ?? '');
  const [destination, setDestination] = useState(trip?.destination ?? '');
  const [scope, setScope] = useState<Scope>(trip?.scope ?? 'national');
  const [kind, setKind] = useState<Kind>(trip?.kind ?? 'day');
  const [transport, setTransport] = useState<Transport>(trip?.transport ?? 'car');
  const [startDate, setStart] = useState(first);
  const [endDate, setEnd] = useState(trip?.endDate ?? first);
  const [departTime, setDepart] = useState(trip?.departTime ?? '');
  const [returnTime, setReturn] = useState(trip?.returnTime ?? '');
  const [arriveDate, setArriveDate] = useState(trip?.arriveDate ?? '');
  const [arriveTime, setArriveTime] = useState(trip?.arriveTime ?? '');
  const [backDate, setBackDate] = useState(trip?.backDate ?? '');
  const [backTime, setBackTime] = useState(trip?.backTime ?? '');
  const [money, setMoney] = useState<Money[]>(trip?.money ?? []);
  const [gear, setGear] = useState(trip?.gear ?? []);
  const [people, setPeople] = useState<string[]>(trip?.people ?? (user ? [user.id] : []));
  const [guests, setGuests] = useState(trip?.guests ?? 0);
  const [bagIds, setBags] = useState<string[]>(trip?.bagIds ?? []);
  const [overrides, setOverrides] = useState<Record<string, boolean>>(trip?.overrides ?? {});
  const [note, setNote] = useState(trip?.note ?? '');
  const [translations, setTranslations] = useState<Translations>(trip?.translations ?? {});
  const [deleting, setDeleting] = useState(false);

  const days =
    Math.round(
      (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000,
    ) + 1;
  const shape: TripShape = {
    scope,
    kind,
    transport,
    days,
    people: Math.max(1, people.length + guests),
  };
  const included = (item: PackingItem) => overrides[item.id] ?? itemApplies(item.rules, shape);
  const toggle = (item: PackingItem, on: boolean) =>
    setOverrides((current) => {
      const next = { ...current };
      if (on === itemApplies(item.rules, shape)) delete next[item.id];
      else next[item.id] = on;
      return next;
    });

  const body: TripInput = {
    name: name.trim() || destination.trim(),
    destination: destination.trim(),
    scope,
    kind,
    transport,
    startDate,
    endDate,
    departTime: departTime || null,
    returnTime: returnTime || null,
    arriveDate: arriveTime && arriveDate && arriveDate !== startDate ? arriveDate : null,
    arriveTime: arriveTime || null,
    backDate: backTime && backDate && backDate !== endDate ? backDate : null,
    backTime: backTime || null,
    money: money.filter((m) => m.label.trim()).map((m) => ({ ...m, label: m.label.trim() })),
    gear,
    people,
    guests,
    bagIds,
    overrides,
    note: note.trim(),
    translations: translationsPatch(trip?.translations, translations),
  };
  const save = useMutation({
    mutationFn: () => (trip ? travelApi.updateTrip(trip.id, body) : travelApi.createTrip(body)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: travelKeys.all });
      toast.success(
        trip
          ? t.edit.saved
          : t.edit.planned(tr(saved.trip, 'name'), t.count.things(saved.checks.length)),
      );
      navigate(`/travel/${saved.trip.id}`, { replace: true });
    },
  });
  const remove = useMutation({
    mutationFn: () => travelApi.removeTrip(trip!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: travelKeys.all });
      toast.success(t.edit.deleted(tr(trip!, 'name')));
      navigate('/travel', { replace: true });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  const groups = home.options.groups.map((group) => ({
    group,
    items: home.items.filter((i) => i.group === group),
  }));
  const packing = home.items.filter(included).length;

  return (
    <form
      onSubmit={submit}
      noValidate
      className="gutter-x mx-auto mt-3 flex max-w-2xl flex-col gap-3 pb-6 md:px-5"
    >
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label={t.edit.whereTo}
            icon={PlaceIcon}
            placeholder={t.edit.wherePlaceholder}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            error={fields.destination}
            autoFocus={!trip}
          />
          <TextField
            label={t.edit.tripName}
            placeholder={destination.trim() || t.edit.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={fields.name}
            hint={name ? undefined : t.edit.nameHint}
          />
        </div>
      </Card>

      <Card>
        <Field label={t.edit.where}>
          <Chips
            label={t.edit.where}
            tone="sheet"
            dense
            value={scope}
            onChange={setScope}
            options={[
              { value: 'national', label: scopeLabel('national'), icon: PlaceIcon },
              { value: 'international', label: scopeLabel('international'), icon: PublicIcon },
            ]}
          />
        </Field>
        <Field label={t.edit.kind}>
          <Chips
            label={t.edit.kind}
            tone="sheet"
            dense
            value={kind}
            onChange={setKind}
            options={KINDS.map((k) => ({ value: k, label: kindLabel(k) }))}
          />
        </Field>
        <Field label={t.edit.gettingThere}>
          <Chips
            label={t.edit.gettingThere}
            tone="sheet"
            dense
            value={transport}
            onChange={setTransport}
            options={TRANSPORTS.map((x) => ({
              value: x,
              label: transportLabel(x),
              icon: TRANSPORT_ICON[x],
            }))}
          />
        </Field>
      </Card>

      <Card>
        <Field
          label={t.edit.when}
          hint={
            days === 1
              ? t.edit.oneDay
              : t.edit.daysNights(t.count.days(days), t.count.nights(days - 1))
          }
        >
          <RangeCalendar
            start={startDate}
            end={endDate}
            onChange={(start, end) => {
              setStart(start);
              setEnd(end);
            }}
          />
          <Leg title={t.edit.going}>
            <TimeField label={t.edit.leaveHome} value={departTime} onChange={setDepart} />
            <TimeField
              label={t.edit.arrive}
              value={arriveTime}
              onChange={setArriveTime}
              date={arriveDate || startDate}
              onDate={setArriveDate}
              min={startDate}
            />
          </Leg>
          <Leg title={t.edit.comingBack}>
            <TimeField
              label={t.edit.headBack}
              value={backTime}
              onChange={setBackTime}
              date={backDate || endDate}
              onDate={setBackDate}
              max={endDate}
            />
            <TimeField label={t.edit.homeAgain} value={returnTime} onChange={setReturn} />
          </Leg>
          {fields.endDate ? <p className="text-sm text-danger-700">{fields.endDate}</p> : null}
        </Field>
      </Card>

      <Card>
        <Field label={t.edit.whoGoes} hint={t.edit.inAll(t.count.people(shape.people))}>
          <div className="flex flex-wrap gap-1.5">
            {home.people.map((p) => (
              <ToggleChip
                key={p.id}
                on={people.includes(p.id)}
                onClick={() =>
                  setPeople((list) =>
                    list.includes(p.id) ? list.filter((x) => x !== p.id) : [...list, p.id],
                  )
                }
                leading={<Avatar person={p} size="sm" />}
              >
                {p.name}
              </ToggleChip>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 rounded-[1.125rem] bg-ink-50 px-4 py-2">
            <span className="min-w-0 text-[0.9375rem] font-medium">{t.edit.others}</span>
            <span className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                aria-label={t.common.oneFewer}
                disabled={guests === 0}
                onClick={() => setGuests((g) => Math.max(0, g - 1))}
                className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs disabled:opacity-40"
              >
                <RemoveIcon fontSize="inherit" />
              </button>
              <span
                className="tabular w-8 text-center text-[1.0625rem] font-bold"
                aria-live="polite"
              >
                {guests}
              </span>
              <button
                type="button"
                aria-label={t.common.oneMore}
                onClick={() => setGuests((g) => Math.min(50, g + 1))}
                className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs"
              >
                <AddIcon fontSize="inherit" />
              </button>
            </span>
          </div>
        </Field>

        <Field label={t.common.bagsAndGear}>
          {home.bags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {home.bags.map((bag) => (
                <ToggleChip
                  key={bag.id}
                  on={bagIds.includes(bag.id)}
                  icon={BAG_ICON(bag.kind)}
                  onClick={() =>
                    setBags((list) =>
                      list.includes(bag.id) ? list.filter((x) => x !== bag.id) : [...list, bag.id],
                    )
                  }
                >
                  {tr(bag, 'name')}
                  {bagSize(bag) ? (
                    <span className="font-medium opacity-70">{bagSize(bag)}</span>
                  ) : null}
                </ToggleChip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-600">
              {t.edit.noBags}{' '}
              <Link to="/travel/bags" className="font-semibold text-lav-800 underline">
                {t.edit.addBags}
              </Link>
              {t.edit.toPick}
            </p>
          )}
          <GearPicker gear={home.gear} value={gear} onChange={setGear} />
        </Field>
      </Card>

      <Card>
        <Field
          label={t.edit.whatToPack}
          hint={t.edit.packHint(t.count.things(packing))}
        >
          <div className="flex flex-col gap-2">
            {groups
              .filter((g) => g.items.length)
              .map(({ group, items }) => (
                <details
                  key={group}
                  className="group/g rounded-[1.25rem] bg-ink-50 open:bg-white open:shadow-[var(--shadow-card)] open:ring-1 open:ring-inset open:ring-ink-100"
                >
                  <summary className="press flex cursor-pointer list-none items-center gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1 text-[0.9375rem] font-bold">
                      {groupLabel(group)}
                    </span>
                    <span className="tabular text-sm font-semibold text-ink-500">
                      {t.of(items.filter(included).length, items.length)}
                    </span>
                    <ExpandMoreIcon
                      fontSize="inherit"
                      className="text-[1.3rem] text-ink-500 transition-transform group-open/g:rotate-180"
                    />
                  </summary>
                  <ul className="divide-y divide-ink-100 px-4 pb-2">
                    {items.map((item) => {
                      const on = included(item);
                      const changed = overrides[item.id] !== undefined;
                      const name = tr(item, 'name');
                      return (
                        <li key={item.id}>
                          <Switch
                            checked={on}
                            onChange={(value) => toggle(item, value)}
                            label={
                              on && itemQuantity(item.quantity, shape) > 1
                                ? `${name} × ${itemQuantity(item.quantity, shape)}`
                                : name
                            }
                            hint={
                              changed
                                ? on
                                  ? t.edit.switchedOn
                                  : t.edit.switchedOff
                                : rulesLabel(item.rules)
                            }
                            className="py-2"
                          />
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
          </div>
          <Link to="/travel/list" className="text-sm font-semibold text-lav-800 underline">
            {t.edit.changeList}
          </Link>
        </Field>
      </Card>

      <Card>
        <Field
          label={t.common.money}
          hint={t.edit.moneyHint}
        >
          <MoneyEditor value={money} onChange={setMoney} />
        </Field>
      </Card>

      <Card>
        <TextField
          label={t.common.note}
          placeholder={t.edit.notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <TranslationFields
          fields={[
            { key: 'name', label: t.edit.tripName, maxLength: 80 },
            { key: 'destination', label: t.edit.destination, maxLength: 120 },
            { key: 'note', label: t.common.note, multiline: true, maxLength: 1000 },
          ]}
          value={translations}
          onChange={setTranslations}
        />
      </Card>

      {save.error && !Object.keys(fields).length ? (
        <p className="text-sm font-medium text-danger-700">{errorMessage(save.error)}</p>
      ) : null}

      <div data-fab className="sticky bottom-[calc(var(--tabbar-h)+var(--safe-bottom)+0.5rem)] z-20 rounded-[1.5rem] bg-white/95 p-2 shadow-[var(--shadow-raised)] backdrop-blur md:bottom-4">
        <div className="flex gap-2">
          {trip ? (
            <Button
              type="button"
              variant="outline"
              icon={DeleteIcon}
              onClick={() => setDeleting(true)}
            >
              {t.common.delete}
            </Button>
          ) : null}
          <Button
            type="submit"
            fullWidth
            loading={save.isPending}
            disabled={!(name.trim() || destination.trim())}
          >
            {trip ? t.common.save : t.edit.planIt}
          </Button>
        </div>
      </div>

      <ConfirmSheet
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        title={t.edit.confirmTitle(trip ? tr(trip, 'name') : null)}
        description={t.edit.confirmText}
        confirmLabel={t.edit.confirm}
        tone="danger"
        loading={remove.isPending}
      />
    </form>
  );
}

function TimeField({
  label,
  value,
  onChange,
  date,
  onDate,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** A day of its own (arriving the next day): shown when given. */
  date?: string;
  onDate?: (v: string) => void;
  min?: string;
  max?: string;
}) {
  const t = useTravelT();
  const well =
    'h-12 min-w-0 rounded-[1.125rem] bg-ink-50 px-3 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]';
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-semibold text-ink-700">{label}</span>
      <div className="flex gap-1.5">
        {onDate ? (
          <input
            type="date"
            aria-label={t.edit.dayOf(label)}
            value={date}
            min={min}
            max={max}
            onChange={(e) => onDate(e.target.value)}
            className={cx(well, 'flex-[1.4]')}
          />
        ) : null}
        <input
          type="time"
          aria-label={t.edit.timeOf(label)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cx(well, 'flex-1', !value && 'text-ink-500')}
        />
      </div>
    </div>
  );
}

function Leg({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold uppercase tracking-wide text-ink-500">{title}</p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-[1.5rem] bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
      {children}
    </div>
  );
}
