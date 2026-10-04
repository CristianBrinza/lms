import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, IconButton, Skeleton } from '@/components/ui';
import { AddIcon, ArrowForwardIcon } from '@/components/ui/icons';
import { plural } from '@/food/format';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { trainingApi, trainingKeys } from '../api';
import { AddEquipmentSheet } from '../equipment/AddEquipmentSheet';
import { EquipmentSheet } from '../equipment/EquipmentSheet';
import { countLabel } from '../equipment/weights';
import { kg } from '../format';
import { EquipmentIcon } from '../icons/TrainingIcon';
import { usePerson } from '../person';
import type { Equipment } from '../types';

/**
 * What's at home to train with: mats, dumbbells and their weights, a pull-up bar. It decides which
 * exercises the library offers and the generator picks. Phones: a list of cards; tablets: two
 * columns, desktops three. Things away for a while (count 0) stay listed, faded, at the end.
 */
export default function EquipmentPage() {
  const { personId } = usePerson();
  const list = useQuery({ queryKey: trainingKeys.equipment, queryFn: trainingApi.equipment });
  const exercises = useQuery({
    queryKey: trainingKeys.exercises(personId),
    queryFn: () => trainingApi.exercises(personId),
  });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; open: boolean }>({
    id: null,
    open: false,
  });

  const items = list.data?.equipment ?? [];
  const presets = list.data?.presets ?? [];
  const sorted = [...items.filter((i) => i.count > 0), ...items.filter((i) => i.count <= 0)];
  const editItem = items.find((i) => i.id === editing.id) ?? null;
  const all = exercises.data ?? [];
  const possible = all.filter((e) => e.available).length;
  const bare = all.filter((e) => !e.equipment.length).length;
  const iconOf = (kind: string) => presets.find((p) => p.kind === kind)?.icon;
  const away = items.filter((i) => i.count <= 0).length;

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/training"
        title="What’s at home"
        subtitle={
          list.data
            ? items.length
              ? `${plural(items.length, 'thing')}${away ? ` · ${away} away` : ''}`
              : 'Nothing added yet'
            : ' '
        }
        actions={
          <IconButton
            icon={AddIcon}
            label="Add equipment"
            variant="ink"
            size="sm"
            onClick={() => setAdding(true)}
          />
        }
      />

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {list.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 rounded-2xl" />
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32 rounded-3xl" />
              <Skeleton className="h-32 rounded-3xl" />
              <Skeleton className="h-32 rounded-3xl" />
            </div>
          </div>
        ) : list.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load the equipment</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(list.error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={() => void list.refetch()}>
              Try again
            </Button>
          </div>
        ) : !items.length ? (
          <Empty bare={exercises.data ? bare : null} onAdd={() => setAdding(true)} />
        ) : (
          <>
            {exercises.data ? (
              <Link
                to="/training/exercises"
                className="press group/sum flex items-center gap-3 rounded-[1.25rem] bg-ink-900 px-4 py-3 text-white shadow-[var(--shadow-tile)]"
              >
                <span className="min-w-0 flex-1 text-[0.9375rem] font-medium leading-snug">
                  Your home lets you do{' '}
                  <span className="tabular font-bold text-butter-300">
                    {possible} of {all.length}
                  </span>{' '}
                  exercises
                </span>
                <ArrowForwardIcon
                  fontSize="inherit"
                  className="shrink-0 text-[1.25rem] text-white/70 transition-transform group-hover/sum:translate-x-0.5"
                />
              </Link>
            ) : exercises.isPending ? (
              <Skeleton className="h-12 rounded-[1.25rem]" />
            ) : null}

            <ul className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {sorted.map((item) => (
                <li key={item.id}>
                  <EquipmentCard
                    item={item}
                    icon={iconOf(item.kind)}
                    onOpen={() => setEditing({ id: item.id, open: true })}
                  />
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="press flex h-full min-h-20 w-full items-center justify-center gap-2 rounded-[1.5rem] border-2 border-dashed border-ink-200 px-4 py-3 text-[0.9375rem] font-semibold text-ink-700 hover:border-ink-300 hover:bg-white"
                >
                  <AddIcon fontSize="inherit" className="text-[1.25rem]" />
                  Add equipment
                </button>
              </li>
            </ul>
          </>
        )}
      </div>

      <AddEquipmentSheet
        open={adding}
        onClose={() => setAdding(false)}
        owned={items}
        presets={presets}
        onOpen={(id) => setEditing({ id, open: true })}
      />
      <EquipmentSheet
        open={editing.open && Boolean(editItem)}
        item={editItem}
        presets={presets}
        onClose={() => setEditing((e) => ({ ...e, open: false }))}
      />
    </Screen>
  );
}

const MAX_CHIPS = 7;

function EquipmentCard({
  item,
  icon,
  onOpen,
}: {
  item: Equipment;
  icon?: string;
  onOpen: () => void;
}) {
  const away = item.count <= 0;
  const chips = item.weights.slice(0, MAX_CHIPS);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        'press flex h-full w-full items-start gap-3 rounded-[1.5rem] bg-white p-3 text-left shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 transition-colors hover:bg-ink-50',
        away && 'bg-white/60 shadow-none',
      )}
    >
      <span
        className={cx(
          'grid size-16 shrink-0 place-items-center rounded-2xl',
          away ? 'bg-ink-100' : 'bg-butter-100',
        )}
      >
        <EquipmentIcon
          name={item.icon || icon || 'mat'}
          className={cx('size-12', away && 'opacity-50 grayscale')}
        />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span
          className={cx(
            'block truncate text-[1rem] font-bold leading-tight',
            away && 'text-ink-600',
          )}
        >
          {item.name}
        </span>
        <span
          className={cx(
            'mt-0.5 block text-[0.8125rem] font-medium',
            away ? 'font-semibold text-peach-800' : 'text-ink-600',
          )}
        >
          {away
            ? countLabel(0)
            : [
                item.count > 1 ? countLabel(item.count) : null,
                item.weights.length ? (item.pairs ? 'Pairs' : 'One of each') : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'At home'}
        </span>
        {chips.length ? (
          <span className="mt-2 flex flex-wrap items-center gap-1">
            {chips.map((w) => (
              <span
                key={w}
                className={cx(
                  'tabular inline-flex h-6 items-center rounded-pill px-2 text-xs font-semibold',
                  away ? 'bg-ink-100 text-ink-600' : 'bg-butter-100 text-ink-900',
                )}
              >
                {kg(w)}
                {item.pairs ? <span className="ml-0.5 text-butter-800">×2</span> : null}
              </span>
            ))}
            {item.weights.length > MAX_CHIPS ? (
              <span className="tabular text-xs font-semibold text-ink-500">
                +{item.weights.length - MAX_CHIPS}
              </span>
            ) : null}
          </span>
        ) : null}
        {item.note ? (
          <span className="mt-1.5 line-clamp-2 block text-xs text-ink-500">{item.note}</span>
        ) : null}
      </span>
    </button>
  );
}

function Empty({ bare, onAdd }: { bare: number | null; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-[2rem] bg-white px-6 py-9 text-center shadow-[var(--shadow-card)]">
      <div className="flex items-end gap-1" aria-hidden="true">
        <EquipmentIcon name="mat" className="size-14" />
        <EquipmentIcon name="dumbbells" className="size-20" />
        <EquipmentIcon name="pullup-bar" className="size-14" />
      </div>
      <h2 className="mt-4 text-h2 font-bold">What do you train with?</h2>
      <p className="mt-2 max-w-sm text-[0.9375rem] text-ink-600">
        {bare !== null
          ? `${bare} exercises need no equipment. Add what you have to unlock more.`
          : 'Add what you have to unlock more exercises.'}
      </p>
      <Button icon={AddIcon} className="mt-6" onClick={onAdd}>
        Add equipment
      </Button>
    </div>
  );
}
