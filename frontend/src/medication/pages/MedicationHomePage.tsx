import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { Button, Chips, IconButton, IconLink, ListGroup, ListRowLink, Skeleton, toast } from '@/components/ui';
import { AddIcon, CloseIcon, DownloadIcon, HistoryIcon, SearchIcon } from '@/components/ui/icons';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { isApiError } from '@/services/api/client';
import {
  medicationApi,
  medicationKeys,
  type Cabinet,
  type DayView,
  type Dose,
  type Filter,
  type Medicine,
  type Person,
  type Treatment,
} from '../api';
import { CabinetList } from '../components/CabinetList';
import { DoseCard } from '../components/DoseCard';
import { MedicineSheet } from '../components/MedicineSheet';
import { Disclaimer, EmptyCard, ErrorCard, MedScreen, PersonChips, Section, Thumb } from '../components/parts';
import { TreatmentCard } from '../components/TreatmentCard';
import { TreatmentSheet } from '../components/TreatmentSheet';
import { useMedicationT } from '../i18n';
import { isoDate } from '../logic';

type Tab = 'today' | 'cabinet' | 'treatments';
const TABS: Tab[] = ['today', 'cabinet', 'treatments'];

/** Kept while the app is open: back from a medicine, the tab and the search are as they were left. */
let remembered = { tab: 'today' as Tab, q: '', filter: 'all' as Filter };

/**
 * Medication: Today (the day's doses, with taken, skip and later), the Cabinet (what is at home by
 * place, with expiry chips) and Treatments (courses and schedules, with the stock left).
 */
export default function MedicationHomePage() {
  const t = useMedicationT();
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const [tab, setTabState] = useState<Tab>(
    TABS.includes(asked as Tab) ? (asked as Tab) : params.get('dose') ? 'today' : remembered.tab,
  );
  const [q, setQState] = useState(remembered.q);
  const [filter, setFilterState] = useState<Filter>(
    ['expiring', 'expired', 'low'].includes(params.get('filter') ?? '') ? (params.get('filter') as Filter) : remembered.filter,
  );
  const setTab = (next: Tab) => {
    remembered = { ...remembered, tab: next };
    setTabState(next);
    if (params.size) setParams({}, { replace: true });
  };
  const setQ = (next: string) => {
    remembered = { ...remembered, q: next };
    setQState(next);
  };
  const setFilter = (next: Filter) => {
    remembered = { ...remembered, filter: next };
    setFilterState(next);
  };

  const [adding, setAdding] = useState(false);
  const [starting, setStarting] = useState(false);

  const cabinet = useQuery({
    queryKey: medicationKeys.cabinet(q, filter),
    queryFn: () => medicationApi.cabinet(q, filter),
    placeholderData: (previous) => previous,
  });
  // The people and places for the sheets come from the unfiltered cabinet.
  const all = useQuery({
    queryKey: medicationKeys.cabinet('', 'all'),
    queryFn: () => medicationApi.cabinet('', 'all'),
  });
  const people = all.data?.people ?? cabinet.data?.people ?? [];
  const places = all.data?.places ?? [];
  const medicines = all.data?.medicines ?? [];

  const add = (
    <IconButton
      icon={AddIcon}
      label={tab === 'cabinet' ? t.addMedicine : t.newTreatment}
      variant="ink"
      onClick={() => (tab === 'cabinet' || !medicines.length ? setAdding(true) : setStarting(true))}
    />
  );

  return (
    <MedScreen
      wide
      back="/home"
      title={t.title}
      subtitle={all.data ? t.subtitle(medicines.length) : ' '}
      actions={
        <>
          <IconLink to="/medication/history" icon={HistoryIcon} label={t.history} variant="white" />
          {add}
        </>
      }
    >
      <Chips
        label={t.tabs.label}
        dense
        tone="sheet"
        value={tab}
        onChange={setTab}
        options={TABS.map((id) => ({
          value: id,
          label: t.tabs[id],
          count: id === 'cabinet' && all.data?.summary.badge ? all.data.summary.badge : undefined,
        }))}
      />

      <div className="mt-4">
        {tab === 'today' ? (
          <TodayTab people={people} onStart={() => (medicines.length ? setStarting(true) : setAdding(true))} />
        ) : tab === 'cabinet' ? (
          <CabinetTab
            query={cabinet}
            q={q}
            setQ={setQ}
            filter={filter}
            setFilter={setFilter}
            onAdd={() => setAdding(true)}
          />
        ) : (
          <TreatmentsTab medicines={medicines} people={people} onStart={() => (medicines.length ? setStarting(true) : setAdding(true))} />
        )}
      </div>

      <div className="mt-8">
        <ListGroup>
          <ListRowLink to="/medication/export" icon={DownloadIcon} label={t.doctor} detail={t.exportSubtitle} />
        </ListGroup>
      </div>
      <Disclaimer />

      <MedicineSheet open={adding} onClose={() => setAdding(false)} people={people} places={places} />
      <TreatmentSheet
        open={starting}
        onClose={() => setStarting(false)}
        medicines={medicines}
        people={people}
      />
    </MedScreen>
  );
}

// ---------------------------------------------------------------- today

function TodayTab({ people, onStart }: { people: Person[]; onStart: () => void }) {
  const t = useMedicationT();
  const [params] = useSearchParams();
  const highlight = params.get('dose');
  const [person, setPerson] = useState('');
  const date = isoDate(new Date());
  const today = useQuery({
    queryKey: medicationKeys.today(date),
    queryFn: () => medicationApi.today(date),
    // Minutes pass: a dose turns missed two hours late.
    refetchInterval: 60_000,
  });

  if (today.isPending) return <TodaySkeleton />;
  if (today.error) return <ErrorCard error={today.error} onRetry={() => void today.refetch()} />;
  const view: DayView = today.data;
  const doses = view.doses.filter((d) => !d.asNeeded && (!person || d.personId === person));
  const taken = view.doses.filter((d) => d.asNeeded && (!person || d.personId === person));
  const asNeeded = view.asNeeded.filter((x) => !person || x.personId === person);
  const holders = people.filter((p) => view.doses.some((d) => d.personId === p.id) || view.asNeeded.some((x) => x.personId === p.id));

  if (!view.doses.length && !view.asNeeded.length)
    return (
      <EmptyCard title={t.noDoses} detail={t.noDosesDetail}>
        <Button size="sm" onClick={onStart}>
          {t.setUpTreatment}
        </Button>
      </EmptyCard>
    );

  // One section per person when several have doses; the day in time order within each.
  const groups = (person ? holders.filter((p) => p.id === person) : holders).map((p) => ({
    person: p,
    doses: doses.filter((d) => d.personId === p.id),
  }));
  return (
    <div className="flex flex-col gap-5">
      {holders.length > 1 ? <PersonChips all people={holders} value={person} onChange={setPerson} /> : null}
      {groups.map((group) =>
        group.doses.length ? (
          <section key={group.person.id} aria-label={group.person.name}>
            {holders.length > 1 ? (
              <h2 className="mb-2 px-1 text-[0.9375rem] font-bold text-ink-700">{group.person.name}</h2>
            ) : null}
            <ul className="flex flex-col gap-3">
              {group.doses.map((dose) => (
                <li key={dose.id}>
                  <DoseCard dose={dose} highlight={highlight === dose.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null,
      )}
      {asNeeded.length ? (
        <Section title={t.asNeeded} className="mt-2">
          <ul className="flex flex-col gap-3">
            {asNeeded.map((treatment) => (
              <li key={treatment.id}>
                <AsNeededCard treatment={treatment} taken={taken.filter((d) => d.treatmentId === treatment.id)} />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}

function AsNeededCard({
  treatment,
  taken,
}: {
  treatment: DayView['asNeeded'][number];
  taken: Dose[];
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const [over, setOver] = useState(false);
  const take = useMutation({
    mutationFn: (override: boolean) => medicationApi.takeAsNeeded(treatment.id, override),
    onSuccess: (result) => {
      haptic('success');
      setOver(false);
      if (result.dose.shortfall > 0) toast.info(t.shortfall);
    },
    onError: (error) => {
      if (isApiError(error, 'CONFLICT')) setOver(true);
      else toast.error(t.failed, { description: errorMessage(error) });
    },
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  return (
    <article className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
      <Thumb cover={treatment.cover} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[1.0625rem] font-semibold tracking-[-0.01em]">
          {treatment.medicineName}
          {treatment.strength ? <span className="font-medium text-ink-600"> {treatment.strength}</span> : null}
        </p>
        <p className="tabular mt-0.5 text-sm text-ink-600">
          {treatment.personName} · {t.qty(treatment.dose, treatment.unit, treatment.form)} ·{' '}
          {t.takenToday(treatment.takenToday, treatment.maxPerDay)}
        </p>
        {taken.some((d) => d.takenAt) ? (
          <UndoLast dose={taken[taken.length - 1]!} />
        ) : null}
      </div>
      <Button size="sm" loading={take.isPending} onClick={() => take.mutate(false)}>
        {t.takeNow}
      </Button>
      <ConfirmSheet
        open={over}
        onClose={() => setOver(false)}
        onConfirm={() => take.mutate(true)}
        title={t.takeAnyway}
        description={t.maxReached}
        confirmLabel={t.takeAnyway}
        loading={take.isPending}
      />
    </article>
  );
}

function UndoLast({ dose }: { dose: Dose }) {
  const t = useMedicationT();
  const client = useQueryClient();
  const undo = useMutation({
    mutationFn: () => medicationApi.undo(dose.id),
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  return (
    <button
      type="button"
      disabled={undo.isPending}
      onClick={() => undo.mutate()}
      className="press mt-1 text-xs font-semibold text-lav-800 underline-offset-2 hover:underline"
    >
      {t.undo}
    </button>
  );
}

function TodaySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-28 rounded-3xl" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- cabinet

function CabinetTab({
  query,
  q,
  setQ,
  filter,
  setFilter,
  onAdd,
}: {
  query: UseQueryResult<Cabinet>;
  q: string;
  setQ: (q: string) => void;
  filter: Filter;
  setFilter: (filter: Filter) => void;
  onAdd: () => void;
}) {
  const t = useMedicationT();
  const data = query.data;
  const shown = useMemo(() => data?.medicines ?? [], [data]);
  const empty = data && !data.counts.all && !q && filter === 'all';
  return (
    <div>
      {query.isPending ? (
        <div aria-hidden="true" className="flex flex-col gap-3">
          <Skeleton className="h-12 rounded-[1.25rem]" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : query.error ? (
        <ErrorCard error={query.error} onRetry={() => void query.refetch()} />
      ) : empty ? (
        <EmptyCard title={t.emptyTitle} detail={t.emptyDetail}>
          <Button size="sm" icon={AddIcon} onClick={onAdd}>
            {t.addMedicine}
          </Button>
        </EmptyCard>
      ) : data ? (
        <>
          <label className="flex h-12 items-center gap-2 rounded-[1.25rem] bg-white px-4 shadow-[var(--shadow-card)] focus-within:shadow-[inset_0_0_0_2px_var(--color-ink-900)]">
            <SearchIcon fontSize="inherit" className="shrink-0 text-[1.25rem] text-ink-400" />
            <span className="sr-only">{t.searchLabel}</span>
            <input
              type="search"
              value={q}
              placeholder={t.searchPlaceholder}
              onChange={(e) => setQ(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-[0.9375rem] font-medium outline-none placeholder:text-ink-400"
            />
            {q ? (
              <button
                type="button"
                aria-label={t.clearSearch}
                onClick={() => setQ('')}
                className="press grid size-7 place-items-center rounded-full bg-ink-100 text-base text-ink-600"
              >
                <CloseIcon fontSize="inherit" />
              </button>
            ) : null}
          </label>
          <Chips
            label={t.showLabel}
            dense
            tone="sheet"
            className="mt-3"
            value={filter}
            onChange={setFilter}
            options={(['all', 'expiring', 'expired', 'low'] as const).map((f) => ({
              value: f,
              label: t.filter[f],
              count: f === 'all' ? undefined : data.counts[f] || undefined,
            }))}
          />
          <div className="mt-4">
            {shown.length ? <CabinetList medicines={shown} /> : <p className="px-1 py-8 text-center text-ink-600">{t.noMatches}</p>}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------- treatments

function TreatmentsTab({
  medicines,
  people,
  onStart,
}: {
  medicines: Medicine[];
  people: Person[];
  onStart: () => void;
}) {
  const t = useMedicationT();
  const client = useQueryClient();
  const query = useQuery({ queryKey: medicationKeys.treatments, queryFn: medicationApi.treatments });
  const [view, setView] = useState<'active' | 'finished'>('active');
  const [editing, setEditing] = useState<Treatment | null>(null);
  const [stopping, setStopping] = useState<Treatment | null>(null);
  const [deleting, setDeleting] = useState<Treatment | null>(null);

  const stop = useMutation({
    mutationFn: (id: string) => medicationApi.stopTreatment(id),
    onSuccess: () => {
      toast.success(t.stopped);
      setStopping(null);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => medicationApi.removeTreatment(id),
    onSuccess: () => {
      toast.success(t.removed);
      setDeleting(null);
    },
    onError: (error) => toast.error(t.failed, { description: errorMessage(error) }),
    onSettled: () => client.invalidateQueries({ queryKey: medicationKeys.all }),
  });

  if (query.isPending) return <TodaySkeleton />;
  if (query.error) return <ErrorCard error={query.error} onRetry={() => void query.refetch()} />;
  const list = query.data.treatments;
  const shown = list.filter((x) => (view === 'finished' ? x.status === 'finished' : x.status !== 'finished'));
  if (!list.length)
    return (
      <EmptyCard title={t.noTreatments} detail={t.noTreatmentsDetail}>
        <Button size="sm" icon={AddIcon} onClick={onStart}>
          {t.newTreatment}
        </Button>
      </EmptyCard>
    );
  return (
    <div>
      <Chips
        label={t.treatmentsTitle}
        dense
        tone="sheet"
        value={view}
        onChange={setView}
        options={[
          { value: 'active', label: t.activeTreatments, count: list.filter((x) => x.status !== 'finished').length },
          { value: 'finished', label: t.finishedTreatments, count: list.filter((x) => x.status === 'finished').length },
        ]}
      />
      <ul className="mt-4 grid gap-3 md:grid-cols-2">
        {shown.map((treatment) => (
          <li key={treatment.id}>
            <TreatmentCard
              treatment={treatment}
              onEdit={() => setEditing(treatment)}
              onStop={() => setStopping(treatment)}
              onDelete={() => setDeleting(treatment)}
            />
          </li>
        ))}
      </ul>
      <TreatmentSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        treatment={editing}
        medicines={medicines}
        people={people}
      />
      <ConfirmSheet
        open={Boolean(stopping)}
        onClose={() => setStopping(null)}
        onConfirm={() => stopping && stop.mutate(stopping.id)}
        title={t.stop}
        description={t.stopConfirm}
        confirmLabel={t.stop}
        loading={stop.isPending}
      />
      <ConfirmSheet
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        title={t.deleteTreatment}
        description={t.deleteTreatmentConfirm}
        confirmLabel={t.delete}
        tone="danger"
        loading={remove.isPending}
      />
    </div>
  );
}
