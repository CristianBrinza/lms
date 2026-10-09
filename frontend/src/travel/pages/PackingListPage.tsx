import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, ChevronRightIcon, DeleteIcon } from '@/components/ui/icons';
import { plural } from '@/food/format';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { travelApi, travelKeys } from '../api';
import {
  DUE_OPTIONS,
  dueText,
  KIND_LABEL,
  QUANTITY_LABEL,
  rulesLabel,
  SCOPE_LABEL,
  TRANSPORT_LABEL,
} from '../format';
import { ToggleChip } from '../parts';
import { useTravel } from '../useTravel';
import type { ItemInput, Kind, PackingItem, Quantity, Rules, Transport } from '../types';

const KINDS: Kind[] = ['vacation', 'family', 'day', 'event', 'work', 'other'];
const TRANSPORTS: Transport[] = ['car', 'bus', 'train', 'plane', 'other'];
const QUANTITIES: Quantity[] = ['one', 'person', 'day', 'person_day'];

/**
 * The household's packing list: everything a trip might need, each with when it comes along
 * (abroad, nights away, by car, for a holiday…) and how many. Trips build their checklists from
 * it; a change here reaches every trip that hasn't happened yet.
 */
export default function PackingListPage() {
  const home = useTravel();
  const items = home.data?.items ?? [];
  const groups = home.data?.options.groups ?? [];
  const [editing, setEditing] = useState<PackingItem | 'new' | null>(null);
  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/travel"
        title="Packing list"
        subtitle={home.data ? `${plural(items.length, 'thing')} for every trip` : ' '}
        actions={
          <IconButton
            icon={AddIcon}
            label="Add to the list"
            variant="ink"
            size="sm"
            onClick={() => setEditing('new')}
          />
        }
      />
      <div className="gutter-x mx-auto mt-3 max-w-3xl pb-16 md:px-5">
        {home.isPending ? (
          <Skeleton className="h-64 rounded-[1.5rem]" />
        ) : home.error ? (
          <p className="text-sm text-danger-700">{errorMessage(home.error)}</p>
        ) : (
          groups.map((group) => {
            const rows = items.filter((i) => i.group === group);
            if (!rows.length) return null;
            return (
              <section key={group} className="mb-3.5" aria-label={group}>
                <h2 className="mb-1.5 px-1 text-[0.9375rem] font-bold">{group}</h2>
                <ul className="divide-y divide-ink-100 overflow-hidden rounded-[1.25rem] bg-white shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
                  {rows.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setEditing(item)}
                        className="press flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[0.9375rem] font-semibold">
                            {item.name}
                          </span>
                          <span className="block truncate text-sm text-ink-600">
                            {rulesLabel(item.rules)}
                            {item.quantity !== 'one'
                              ? ` · ${QUANTITY_LABEL[item.quantity].toLowerCase()}`
                              : ''}
                            {item.dueHours !== null
                              ? ` · ${dueText(item.dueHours).toLowerCase()}`
                              : ''}
                          </span>
                        </span>
                        <ChevronRightIcon
                          fontSize="inherit"
                          className="text-[1.3rem] text-ink-400"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add to the list' : (editing?.name ?? '')}
      >
        {editing ? (
          <ItemForm
            key={editing === 'new' ? 'new' : editing.id}
            item={editing === 'new' ? null : editing}
            groups={groups}
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Sheet>
    </Screen>
  );
}

const toggle = <T,>(list: T[] | undefined, value: T): T[] =>
  list?.includes(value) ? list.filter((x) => x !== value) : [...(list ?? []), value];

function ItemForm({
  item,
  groups,
  onDone,
}: {
  item: PackingItem | null;
  groups: string[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(item?.name ?? '');
  const [group, setGroup] = useState(item?.group ?? 'For the trip');
  const [quantity, setQuantity] = useState<Quantity>(item?.quantity ?? 'one');
  const [rules, setRules] = useState<Rules>(item?.rules ?? {});
  const [dueHours, setDue] = useState<number | null>(item?.dueHours ?? null);
  const set = (patch: Partial<Rules>) => {
    const next: Rules = { ...rules, ...patch };
    for (const key of Object.keys(next) as Array<keyof Rules>) {
      const v = next[key];
      if (v === undefined || (Array.isArray(v) && !v.length)) delete next[key];
    }
    setRules(next);
  };
  const body: ItemInput = { name: name.trim(), group, quantity, rules, dueHours };
  const after = () => {
    void queryClient.invalidateQueries({ queryKey: travelKeys.all });
    onDone();
  };
  const save = useMutation({
    mutationFn: () => (item ? travelApi.updateItem(item.id, body) : travelApi.addItem(body)),
    onSuccess: after,
  });
  const remove = useMutation({
    mutationFn: () => travelApi.removeItem(item!.id),
    onSuccess: () => {
      toast.success(`${item!.name} is off the list`);
      after();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  const overnight = rules.overnight === undefined ? 'any' : rules.overnight ? 'yes' : 'no';

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <TextField
        label="What"
        placeholder="Phone charger"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fields.name}
        autoFocus={!item}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-700">Section</span>
        <select
          value={group}
          onChange={(e) => setGroup(e.target.value)}
          className="h-12 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>
      <div>
        <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">How many</p>
        <Chips
          label="How many"
          tone="sheet"
          dense
          value={quantity}
          onChange={setQuantity}
          options={QUANTITIES.map((q) => ({ value: q, label: QUANTITY_LABEL[q] }))}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-semibold text-ink-700">Done by</span>
        <select
          value={dueHours ?? ''}
          onChange={(e) => setDue(e.target.value === '' ? null : Number(e.target.value))}
          className="h-12 rounded-[1.125rem] bg-ink-50 px-4 text-base outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_var(--color-ink-900)]"
        >
          {DUE_OPTIONS.map((o) => (
            <option key={o.hours ?? 'none'} value={o.hours ?? ''}>
              {o.label}
            </option>
          ))}
          {dueHours !== null && !DUE_OPTIONS.some((o) => o.hours === dueHours) ? (
            <option value={dueHours}>{dueText(dueHours)}</option>
          ) : null}
        </select>
      </label>
      <div className="flex flex-col gap-3 rounded-[1.25rem] bg-ink-50 p-3">
        <p className="text-[0.8125rem] font-semibold text-ink-700">
          When it comes along{' '}
          <span className="font-medium text-ink-500">· {rulesLabel(rules)}</span>
        </p>
        <Chips
          label="Where"
          dense
          value={rules.scope ?? 'any'}
          onChange={(v) => set({ scope: v === 'any' ? undefined : v })}
          options={[
            { value: 'any', label: 'Anywhere' },
            { value: 'national', label: SCOPE_LABEL.national },
            { value: 'international', label: SCOPE_LABEL.international },
          ]}
        />
        <Chips
          label="Nights away"
          dense
          value={overnight}
          onChange={(v) => set({ overnight: v === 'any' ? undefined : v === 'yes' })}
          options={[
            { value: 'any', label: 'Any length' },
            { value: 'yes', label: 'Nights away' },
            { value: 'no', label: 'Day trips' },
          ]}
        />
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-600">Getting there (none: any)</p>
          <div className="flex flex-wrap gap-1.5">
            {TRANSPORTS.map((t) => (
              <ToggleChip
                key={t}
                on={Boolean(rules.transport?.includes(t))}
                onClick={() => set({ transport: toggle(rules.transport, t) })}
              >
                {TRANSPORT_LABEL[t]}
              </ToggleChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-ink-600">Kind of trip (none: any)</p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <ToggleChip
                key={k}
                on={Boolean(rules.kinds?.includes(k))}
                onClick={() => set({ kinds: toggle(rules.kinds, k) })}
              >
                {KIND_LABEL[k]}
              </ToggleChip>
            ))}
          </div>
        </div>
        <TextField
          label="At least how many days"
          inputMode="numeric"
          placeholder="Any"
          value={rules.minDays ? String(rules.minDays) : ''}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            set({ minDays: n > 1 ? Math.min(n, 60) : undefined });
          }}
        />
      </div>

      {save.error && !Object.keys(fields).length ? (
        <p className="text-sm text-danger-700">{errorMessage(save.error)}</p>
      ) : null}
      <div className="flex gap-2">
        {item ? (
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
          {item ? 'Save' : 'Add it'}
        </Button>
      </div>
    </form>
  );
}
