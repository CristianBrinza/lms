import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, Chips, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, CloseIcon, WarningIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { fullName } from '@/lib/format';
import { NoFoodIcon } from '@/pages/settings/icons';
import { foodKeys, peopleApi } from '../api';
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../format';
import type { Category, KitchenPerson, Restriction } from '../types';

type Kind = Restriction['kind'];

const KIND_OPTIONS = [
  { value: 'allergy' as const, label: 'Allergy' },
  { value: 'avoid' as const, label: 'Avoids' },
];
const CATEGORIES = CATEGORY_ORDER.filter((category) => category !== 'household');

function foodOf(restriction: Restriction): string {
  if (restriction.productName) return restriction.productName;
  if (restriction.category) return `All ${CATEGORY_LABEL[restriction.category].toLowerCase()}`;
  return 'Unknown food';
}

/**
 * Who eats in this kitchen, and what each of them is allergic to or avoids: one food (Honey) or
 * a whole kind (fish). Recipes and planned meals warn when an ingredient hits one. Allergies wear
 * the danger marker; things avoided a quieter peach one.
 */
export default function PeoplePage() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: foodKeys.people, queryFn: peopleApi.list });
  const [adding, setAdding] = useState<{ open: boolean; userId: string | null }>({ open: false, userId: null });
  const people = data.data?.people ?? [];
  const restrictions = data.data?.restrictions ?? [];
  const refresh = () => queryClient.invalidateQueries({ queryKey: foodKeys.all });

  const remove = useMutation({
    mutationFn: (restriction: Restriction) => peopleApi.remove(restriction.id),
    onSuccess: (_, restriction) => {
      void refresh();
      toast.success(`${foodOf(restriction)} removed for ${restriction.person}`, {
        action: {
          label: 'Undo',
          onClick: () =>
            void peopleApi
              .add({
                userId: restriction.userId,
                kind: restriction.kind,
                ...(restriction.productId ? { productId: restriction.productId } : restriction.category ? { category: restriction.category } : {}),
                note: restriction.note,
              })
              .then(refresh)
              .catch((error: unknown) => toast.error(errorMessage(error))),
        },
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <Screen tone="white">
      <PageHeader
        compact
        back="/settings"
        title="People and allergies"
        subtitle="Recipes and meals warn about these"
        actions={
          // One person: their card's own Add is enough.
          people.length > 1 ? (
            <IconButton icon={AddIcon} label="Add an allergy or a food to avoid" variant="ink" size="sm" onClick={() => setAdding({ open: true, userId: null })} />
          ) : null
        }
      />

      <div className="gutter-x mt-3 md:px-5 lg:px-8">
        {data.isPending ? (
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-36 rounded-3xl" />
            <Skeleton className="h-36 rounded-3xl" />
          </div>
        ) : data.error ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
            <p className="font-semibold text-danger-700">Couldn’t load the people</p>
            <p className="mt-1 text-sm text-ink-600">{errorMessage(data.error)}</p>
            <Button size="sm" variant="tint" className="mt-3" onClick={() => void data.refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="grid items-start gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
            {people.map((person) => (
              <PersonCard
                key={person.id}
                person={person}
                restrictions={restrictions.filter((r) => r.userId === person.id)}
                onAdd={() => setAdding({ open: true, userId: person.id })}
                onRemove={(restriction) => remove.mutate(restriction)}
                removing={remove.isPending ? (remove.variables?.id ?? null) : null}
              />
            ))}
          </div>
        )}
      </div>

      <AddRestrictionSheet
        open={adding.open}
        people={people}
        userId={adding.userId}
        onClose={() => setAdding((a) => ({ ...a, open: false }))}
      />
    </Screen>
  );
}

function PersonCard({
  person,
  restrictions,
  onAdd,
  onRemove,
  removing,
}: {
  person: KitchenPerson;
  restrictions: Restriction[];
  onAdd: () => void;
  onRemove: (restriction: Restriction) => void;
  removing: string | null;
}) {
  const allergies = restrictions.filter((r) => r.kind === 'allergy').length;
  const avoided = restrictions.length - allergies;
  const summary = restrictions.length
    ? [allergies ? `${allergies} ${allergies === 1 ? 'allergy' : 'allergies'}` : null, avoided ? `avoids ${avoided}` : null].filter(Boolean).join(' · ')
    : 'Eats everything';
  const sorted = [...restrictions].sort((a, b) => (a.kind === b.kind ? foodOf(a).localeCompare(foodOf(b)) : a.kind === 'allergy' ? -1 : 1));

  return (
    <article className="rounded-[1.5rem] bg-white p-2.5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
      <header className="flex items-center gap-3 pl-1">
        <Avatar person={person} size="sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[1rem] font-bold leading-tight">{fullName(person)}</h2>
          <p className="truncate text-[0.8125rem] font-medium text-ink-600">{summary.charAt(0).toUpperCase() + summary.slice(1)}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add for ${person.name}`}
          className="press flex h-11 shrink-0 items-center gap-1 rounded-pill bg-lav-100 px-3.5 text-sm font-semibold text-ink-900 hover:bg-lav-200"
        >
          <AddIcon fontSize="inherit" className="text-[1.15rem]" />
          Add
        </button>
      </header>
      {sorted.length ? (
        <ul className="mt-2.5 flex flex-col gap-1.5">
          {sorted.map((restriction) => {
            const allergy = restriction.kind === 'allergy';
            const Marker = allergy ? WarningIcon : NoFoodIcon;
            return (
              <li key={restriction.id} className={cx('flex items-center gap-2.5 rounded-2xl py-1 pl-2 pr-1', allergy ? 'bg-danger-50' : 'bg-ink-50')}>
                <span
                  aria-hidden="true"
                  className={cx('grid size-8 shrink-0 place-items-center rounded-full text-[1.05rem]', allergy ? 'bg-danger-600 text-white' : 'bg-peach-200 text-peach-800')}
                >
                  <Marker fontSize="inherit" />
                </span>
                <span className="min-w-0 flex-1 py-1">
                  <span className="block truncate text-[0.9375rem] font-semibold">{foodOf(restriction)}</span>
                  <span className={cx('block truncate text-xs font-semibold', allergy ? 'text-danger-700' : 'text-peach-800')}>
                    {allergy ? 'Allergy' : 'Avoids'}
                    {restriction.note ? <span className="font-medium text-ink-600"> · {restriction.note}</span> : null}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(restriction)}
                  disabled={removing === restriction.id}
                  aria-label={`Remove ${foodOf(restriction)} for ${person.name}`}
                  title="Remove"
                  className="press grid size-11 shrink-0 place-items-center rounded-full text-[1.2rem] text-ink-500 hover:bg-white hover:text-ink-900 disabled:opacity-40"
                >
                  <CloseIcon fontSize="inherit" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </article>
  );
}

function AddRestrictionSheet({ open, people, userId, onClose }: { open: boolean; people: KitchenPerson[]; userId: string | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [person, setPerson] = useState('');
  const [kind, setKind] = useState<Kind>('allergy');
  const [by, setBy] = useState<'item' | 'category'>('item');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');

  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setPerson(userId ?? people[0]?.id ?? '');
      setKind('allergy');
      setBy('item');
      setName('');
      setCategory(null);
      setNote('');
    }
  }

  const save = useMutation({
    mutationFn: () =>
      peopleApi.add({
        userId: person,
        kind,
        ...(by === 'item' ? { name: name.trim() } : { category: category! }),
        ...(note.trim() ? { note: note.trim() } : {}),
      }),
    onSuccess: (restriction) => {
      toast.success(`${foodOf(restriction)} added for ${restriction.person}`);
      void queryClient.invalidateQueries({ queryKey: foodKeys.all });
      onClose();
    },
  });
  const fields = fieldErrors(save.error);
  const ready = Boolean(person) && (by === 'item' ? Boolean(name.trim()) : Boolean(category));
  const who = people.find((p) => p.id === person);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={who ? `For ${who.name}` : 'Allergy or food to avoid'}
      footer={
        <div className="flex flex-col gap-2">
          {save.isError && !Object.keys(fields).length ? <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p> : null}
          <Button fullWidth onClick={() => save.mutate()} loading={save.isPending} disabled={!ready}>
            {kind === 'allergy' ? 'Add allergy' : 'Add food to avoid'}
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) save.mutate();
        }}
      >
        {people.length > 1 ? (
          <div>
            <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Who</p>
            <Chips label="Who" tone="sheet" dense value={person} onChange={setPerson} options={people.map((p) => ({ value: p.id, label: p.name }))} />
          </div>
        ) : null}
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">What it is</p>
          <Chips label="What it is" tone="sheet" dense value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <p className="mt-1.5 text-sm text-ink-600">{kind === 'allergy' ? 'A hazard: shown with a warning everywhere it appears.' : 'Doesn’t eat it: a gentler note on recipes and meals.'}</p>
        </div>
        <div>
          <p className="mb-1.5 text-[0.8125rem] font-semibold text-ink-700">Which food</p>
          <Chips
            label="Which food"
            tone="sheet"
            dense
            value={by}
            onChange={setBy}
            options={[
              { value: 'item' as const, label: 'One food' },
              { value: 'category' as const, label: 'A whole kind' },
            ]}
          />
          {by === 'item' ? (
            <TextField
              className="mt-2.5"
              label="Food"
              hideLabel
              placeholder="Honey, peanuts, mushrooms…"
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={fields.name}
              maxLength={80}
            />
          ) : (
            <div role="radiogroup" aria-label="Kind of food" className="mt-2.5 flex flex-wrap gap-1.5">
              {CATEGORIES.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={category === value}
                  onClick={() => setCategory(value)}
                  className={cx(
                    'press h-11 rounded-pill px-4 text-sm font-semibold',
                    category === value ? 'bg-butter-300 text-ink-900' : 'bg-butter-100 text-ink-800 hover:bg-butter-200',
                  )}
                >
                  {CATEGORY_LABEL[value]}
                </button>
              ))}
            </div>
          )}
        </div>
        <TextField label="Note" placeholder="Optional: “only raw”, “makes him ill”" value={note} onChange={(event) => setNote(event.target.value)} error={fields.note} maxLength={200} />
      </form>
    </Sheet>
  );
}
