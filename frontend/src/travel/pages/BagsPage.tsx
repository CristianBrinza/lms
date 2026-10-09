import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, DeleteIcon, RemoveIcon } from '@/components/ui/icons';
import { plural } from '@/food/format';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { travelApi, travelKeys } from '../api';
import { BAG_ICON, BAG_LABEL, bagFits, bagSize, GEAR_ICON, GEAR_LABEL } from '../format';
import { ToggleChip } from '../parts';
import { useTravel } from '../useTravel';
import type { Bag, BagInput, BagKind, Gear, GearKind } from '../types';

const KINDS: BagKind[] = ['backpack', 'handbag', 'carry-on', 'suitcase', 'duffel', 'other'];

/**
 * The bags the household travels with, with their size and which cabin limits they fit (a
 * 40×30×20 bag goes free on Wizz Air). A trip says which ones it takes.
 */
export default function BagsPage() {
  const home = useTravel();
  const bags = home.data?.bags ?? [];
  const [editing, setEditing] = useState<Bag | 'new' | null>(null);
  const gear = home.data?.gear ?? [];
  const [gearEditing, setGearEditing] = useState<Gear | 'new' | null>(null);
  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/travel"
        title="Bags and gear"
        subtitle={
          home.data
            ? bags.length || gear.length
              ? `${plural(bags.length, 'bag')} · ${plural(gear.length, 'thing')} of gear`
              : 'None yet'
            : ' '
        }
        actions={
          <IconButton
            icon={AddIcon}
            label="Add a bag"
            variant="ink"
            size="sm"
            onClick={() => setEditing('new')}
          />
        }
      />
      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {home.isPending ? (
          <Skeleton className="h-24 rounded-[1.5rem]" />
        ) : home.error ? (
          <p className="text-sm text-danger-700">{errorMessage(home.error)}</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {bags.map((bag) => {
              const Icon = BAG_ICON(bag.kind);
              const fits = bagFits(bag);
              return (
                <li key={bag.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(bag)}
                    className="press flex h-full w-full items-start gap-3 rounded-[1.5rem] bg-white p-3 text-left shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 hover:bg-ink-50"
                  >
                    <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-[1.8rem] text-cyan-800">
                      <Icon fontSize="inherit" />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block truncate text-[1rem] font-bold">{bag.name}</span>
                      <span className="block text-sm text-ink-600">
                        {[BAG_LABEL[bag.kind], bagSize(bag), bag.litres ? `${bag.litres} L` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                      {fits.length ? (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {fits.map((f) => (
                            <span
                              key={f}
                              className="rounded-pill bg-mint-100 px-2 py-0.5 text-xs font-semibold text-mint-800"
                            >
                              Fits {f}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
            <li>
              <button
                type="button"
                onClick={() => setEditing('new')}
                className="press flex h-full min-h-20 w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-ink-200 px-4 py-3 text-[0.9375rem] font-semibold text-ink-700 hover:border-ink-300 hover:bg-white"
              >
                <AddIcon fontSize="inherit" className="text-[1.25rem]" />
                Add a bag
              </button>
            </li>
          </ul>
        )}
        {home.data ? (
          <section aria-labelledby="gear" className="mt-6">
            <h2 id="gear" className="mb-1 px-1 text-[1rem] font-bold">
              Gear
            </h2>
            <p className="mb-2.5 px-1 text-sm text-ink-600">
              Power banks, chargers, cables, adapters: with their plugs and how many you have.
            </p>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {gear.map((g) => {
                const Icon = GEAR_ICON[g.kind];
                return (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setGearEditing(g)}
                      className="press flex h-full w-full items-center gap-3 rounded-[1.5rem] bg-white p-3 text-left shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 hover:bg-ink-50"
                    >
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-cyan-100 text-[1.8rem] text-cyan-800">
                        <Icon fontSize="inherit" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[1rem] font-bold">{g.name}</span>
                        <span className="block text-sm text-ink-600">
                          {[GEAR_LABEL[g.kind], g.connectors.join(', ')]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </span>
                      <span className="tabular shrink-0 rounded-pill bg-ink-900 px-2.5 py-1 text-sm font-bold text-white">
                        × {g.count}
                      </span>
                    </button>
                  </li>
                );
              })}
              <li>
                <button
                  type="button"
                  onClick={() => setGearEditing('new')}
                  className="press flex h-full min-h-20 w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-ink-200 px-4 py-3 text-[0.9375rem] font-semibold text-ink-700 hover:border-ink-300 hover:bg-white"
                >
                  <AddIcon fontSize="inherit" className="text-[1.25rem]" />
                  Add gear
                </button>
              </li>
            </ul>
          </section>
        ) : null}
      </div>
      <Sheet
        open={gearEditing !== null}
        onClose={() => setGearEditing(null)}
        title={gearEditing === 'new' ? 'Gear' : (gearEditing?.name ?? '')}
      >
        {gearEditing ? (
          <GearForm
            key={gearEditing === 'new' ? 'new' : gearEditing.id}
            gear={gearEditing === 'new' ? null : gearEditing}
            connectors={home.data?.options.connectors ?? []}
            onDone={() => setGearEditing(null)}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'A bag' : (editing?.name ?? '')}
      >
        {editing ? (
          <BagForm
            key={editing === 'new' ? 'new' : editing.id}
            bag={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const cm = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return value.trim() && Number.isFinite(n) && n > 0 ? n : null;
};

function BagForm({ bag, onDone }: { bag: Bag | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(bag?.name ?? '');
  const [kind, setKind] = useState<BagKind>(bag?.kind ?? 'backpack');
  const [l, setL] = useState(bag?.lengthCm ? String(bag.lengthCm) : '');
  const [w, setW] = useState(bag?.widthCm ? String(bag.widthCm) : '');
  const [h, setH] = useState(bag?.heightCm ? String(bag.heightCm) : '');
  const [note, setNote] = useState(bag?.note ?? '');
  const body: BagInput = {
    name: name.trim(),
    kind,
    lengthCm: cm(l),
    widthCm: cm(w),
    heightCm: cm(h),
    note: note.trim(),
  };
  const after = () => {
    void queryClient.invalidateQueries({ queryKey: travelKeys.all });
    onDone();
  };
  const save = useMutation({
    mutationFn: () => (bag ? travelApi.updateBag(bag.id, body) : travelApi.addBag(body)),
    onSuccess: after,
  });
  const remove = useMutation({
    mutationFn: () => travelApi.removeBag(bag!.id),
    onSuccess: () => {
      toast.success(`${bag!.name} removed`);
      after();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const fits = bagFits(body);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Name"
        placeholder="Tommy Hilfiger handbag"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fields.name}
        autoFocus={!bag}
      />
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Kind</p>
        <Chips
          label="Kind"
          tone="sheet"
          dense
          value={kind}
          onChange={setKind}
          options={KINDS.map((k) => ({ value: k, label: BAG_LABEL[k] }))}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Size, cm</p>
        <div className="grid grid-cols-3 gap-2">
          <TextField
            label="Length"
            inputMode="decimal"
            placeholder="40"
            value={l}
            onChange={(e) => setL(e.target.value)}
          />
          <TextField
            label="Width"
            inputMode="decimal"
            placeholder="30"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
          <TextField
            label="Height"
            inputMode="decimal"
            placeholder="20"
            value={h}
            onChange={(e) => setH(e.target.value)}
          />
        </div>
        {fits.length ? (
          <p className="mt-1.5 text-sm font-medium text-mint-800">Fits {fits.join(', ')}</p>
        ) : null}
      </div>
      <TextField
        label="Note"
        placeholder="Medium, the blue one…"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {save.error && !Object.keys(fields).length ? (
        <p className="text-sm text-danger-700">{errorMessage(save.error)}</p>
      ) : null}
      <div className="flex gap-2">
        {bag ? (
          <Button
            type="button"
            variant="outline"
            icon={DeleteIcon}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        ) : null}
        <Button type="submit" fullWidth loading={save.isPending} disabled={!name.trim()}>
          {bag ? 'Save' : 'Add the bag'}
        </Button>
      </div>
    </form>
  );
}

const GEAR_KINDS: GearKind[] = ['power-bank', 'charger', 'cable', 'adapter', 'headphones', 'other'];

function GearForm({
  gear,
  connectors,
  onDone,
}: {
  gear: Gear | null;
  connectors: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(gear?.name ?? '');
  const [kind, setKind] = useState<GearKind>(gear?.kind ?? 'power-bank');
  const [plugs, setPlugs] = useState<string[]>(gear?.connectors ?? []);
  const [count, setCount] = useState(gear?.count ?? 1);
  const body = { name: name.trim(), kind, connectors: plugs, count, note: gear?.note ?? '' };
  const after = () => {
    void queryClient.invalidateQueries({ queryKey: travelKeys.all });
    onDone();
  };
  const save = useMutation({
    mutationFn: () => (gear ? travelApi.updateGear(gear.id, body) : travelApi.addGear(body)),
    onSuccess: after,
  });
  const remove = useMutation({
    mutationFn: () => travelApi.removeGear(gear!.id),
    onSuccess: () => {
      toast.success(`${gear!.name} removed`);
      after();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="Name"
        placeholder="MagSafe power bank"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fields.name}
        autoFocus={!gear}
      />
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Kind</p>
        <Chips
          label="Kind"
          tone="sheet"
          dense
          value={kind}
          onChange={setKind}
          options={GEAR_KINDS.map((k) => ({ value: k, label: GEAR_LABEL[k] }))}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Plugs and charging</p>
        <div className="flex flex-wrap gap-1.5">
          {connectors.map((c) => (
            <ToggleChip
              key={c}
              on={plugs.includes(c)}
              onClick={() =>
                setPlugs((list) => (list.includes(c) ? list.filter((x) => x !== c) : [...list, c]))
              }
            >
              {c}
            </ToggleChip>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between rounded-[1.125rem] bg-ink-50 px-4 py-2">
        <span className="text-[0.9375rem] font-medium">How many you have</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            aria-label="One fewer"
            disabled={count <= 0}
            onClick={() => setCount((n) => Math.max(0, n - 1))}
            className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs disabled:opacity-40"
          >
            <RemoveIcon fontSize="inherit" />
          </button>
          <span className="tabular w-8 text-center text-[1.0625rem] font-bold">{count}</span>
          <button
            type="button"
            aria-label="One more"
            onClick={() => setCount((n) => Math.min(99, n + 1))}
            className="press grid size-10 place-items-center rounded-full bg-white text-[1.2rem] shadow-xs"
          >
            <AddIcon fontSize="inherit" />
          </button>
        </span>
      </div>
      {save.error && !Object.keys(fields).length ? (
        <p className="text-sm text-danger-700">{errorMessage(save.error)}</p>
      ) : null}
      <div className="flex gap-2">
        {gear ? (
          <Button
            type="button"
            variant="outline"
            icon={DeleteIcon}
            loading={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </Button>
        ) : null}
        <Button type="submit" fullWidth loading={save.isPending} disabled={!name.trim()}>
          {gear ? 'Save' : 'Add it'}
        </Button>
      </div>
    </form>
  );
}
