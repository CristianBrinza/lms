import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, IconButton, Sheet, Skeleton, TextField, toast } from '@/components/ui';
import { AddIcon, EditIcon, HouseIcon, PersonAddIcon, SwapIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { fullName } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { Household } from '@/types/api';
import { useAdminT } from './i18n';

type Member = Household['members'][number];
type Move = { person: Member; from: Household | null; to: Household | null };

/**
 * Households (families): who shares one kitchen. Everyone in a household sees and changes the same
 * kitchen, shopping, buy list, house and trips, and watches together; workouts and health stay each
 * person's own. People move between households here; a new one starts empty.
 */
export default function HouseholdsPage() {
  const t = useAdminT();
  const client = useQueryClient();
  const query = useQuery({ queryKey: queryKeys.households, queryFn: adminApi.households });
  const [naming, setNaming] = useState<Household | 'new' | null>(null);
  const [adding, setAdding] = useState<Household | null>(null);
  const [moving, setMoving] = useState<{ person: Member; from: Household } | null>(null);
  const [confirm, setConfirm] = useState<Move | null>(null);

  const households = query.data ?? [];
  const refresh = () => {
    void client.invalidateQueries({ queryKey: queryKeys.households });
    void client.invalidateQueries({ queryKey: ['admin'] });
  };
  const failed = (error: unknown) => toast.error(errorMessage(error));

  const move = useMutation({
    mutationFn: ({ person, to }: Move) => adminApi.setKitchen(person.id, to?.id ?? null),
    onSuccess: (_, { person, to }) => {
      setConfirm(null);
      setMoving(null);
      setAdding(null);
      toast.success(t.moved(person.name, to?.name ?? null));
    },
    onError: failed,
    onSettled: refresh,
  });

  return (
    <Screen tone="white">
      <PageHeader
        title={t.households}
        back="/admin/users"
        actions={
          <IconButton
            icon={AddIcon}
            label={t.newHousehold}
            variant="ink"
            onClick={() => setNaming('new')}
          />
        }
      />
      <div className="gutter-x mx-auto mt-4 flex max-w-3xl flex-col gap-4 lg:px-8">
        <p className="max-w-prose text-[0.9375rem] text-ink-600">{t.householdsIntro}</p>

        {query.isPending ? (
          <>
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </>
        ) : query.error ? (
          <p className="rounded-3xl bg-white p-5 text-sm text-danger-700 shadow-[var(--shadow-card)]">
            {errorMessage(query.error)}
          </p>
        ) : (
          households.map((household) => (
            <section
              key={household.id}
              aria-label={household.name}
              className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
            >
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-butter-100 text-[1.5rem] text-ink-900">
                  <HouseIcon fontSize="inherit" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-h3 font-bold">{household.name}</h2>
                  <p className="text-sm text-ink-600">{t.memberCount(household.members.length)}</p>
                </div>
                <IconButton
                  icon={EditIcon}
                  label={t.rename(household.name)}
                  size="sm"
                  onClick={() => setNaming(household)}
                />
              </div>

              {household.members.length ? (
                <ul className="mt-4 flex flex-col divide-y divide-ink-100 border-t border-ink-100">
                  {household.members.map((person) => (
                    <li key={person.id} className="flex items-center gap-3 py-2.5">
                      <Link
                        to={`/admin/users/${person.id}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <Avatar person={person} size="sm" />
                        <span className="truncate font-semibold">{fullName(person)}</span>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={SwapIcon}
                        onClick={() => setMoving({ person, from: household })}
                      >
                        {t.moveTo}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-600">
                  {t.emptyHousehold}
                </p>
              )}

              <Button
                size="sm"
                variant="tint"
                icon={PersonAddIcon}
                className="mt-3"
                onClick={() => setAdding(household)}
              >
                {t.addToHousehold}
              </Button>
            </section>
          ))
        )}
      </div>

      <NameSheet
        target={naming}
        onClose={() => setNaming(null)}
        onSaved={() => {
          setNaming(null);
          refresh();
        }}
      />

      {/* Someone from another household, brought into this one. */}
      <Sheet
        open={adding !== null}
        onClose={() => setAdding(null)}
        title={adding ? t.addToNamed(adding.name) : ''}
      >
        <ul className="flex flex-col gap-2">
          {households
            .filter((h) => h.id !== adding?.id)
            .flatMap((h) => h.members.map((person) => ({ person, from: h })))
            .map(({ person, from }) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setConfirm({ person, from, to: adding })}
                  className="press flex w-full items-center gap-3 rounded-2xl bg-ink-50 px-3 py-2.5 text-left hover:bg-ink-100"
                >
                  <Avatar person={person} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{fullName(person)}</span>
                    <span className="block truncate text-xs text-ink-500">{t.nowIn(from.name)}</span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
        {households.every((h) => h.id === adding?.id || !h.members.length) ? (
          <p className="text-sm text-ink-600">{t.nobodyElse}</p>
        ) : null}
      </Sheet>

      {/* Where this person goes: another household, or one of their own. */}
      <Sheet
        open={moving !== null}
        onClose={() => setMoving(null)}
        title={moving ? t.moveNamed(moving.person.name) : ''}
      >
        <div className="flex flex-col gap-2">
          {households
            .filter((h) => h.id !== moving?.from.id)
            .map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => moving && setConfirm({ ...moving, to: h })}
                className="press flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-left hover:bg-ink-100"
              >
                <HouseIcon fontSize="inherit" className="text-xl text-ink-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{h.name}</span>
                  <span className="block text-xs text-ink-500">{t.memberCount(h.members.length)}</span>
                </span>
              </button>
            ))}
          <button
            type="button"
            onClick={() => moving && setConfirm({ ...moving, to: null })}
            className={cx(
              'press flex items-center gap-3 rounded-2xl px-4 py-3 text-left ring-1 ring-inset ring-ink-200 hover:bg-ink-50',
            )}
          >
            <AddIcon fontSize="inherit" className="text-xl text-ink-600" />
            <span className="font-semibold">{t.ownHousehold}</span>
          </button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && move.mutate(confirm)}
        loading={move.isPending}
        title={confirm ? t.moveTitle(confirm.person.name, confirm.to?.name ?? null) : ''}
        description={confirm ? t.moveDescription(confirm.person.name, confirm.from?.name ?? '') : ''}
        confirmLabel={t.moveConfirm}
      />
    </Screen>
  );
}

/** A new household's name, or a household renamed. */
function NameSheet({
  target,
  onClose,
  onSaved,
}: {
  target: Household | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useAdminT();
  return (
    <Sheet
      open={target !== null}
      onClose={onClose}
      title={target === 'new' ? t.newHousehold : t.renameHousehold}
    >
      {target !== null ? (
        <NameForm key={target === 'new' ? 'new' : target.id} target={target} onSaved={onSaved} />
      ) : null}
    </Sheet>
  );
}

function NameForm({ target, onSaved }: { target: Household | 'new'; onSaved: () => void }) {
  const t = useAdminT();
  const [name, setName] = useState(target === 'new' ? '' : target.name);
  const save = useMutation({
    mutationFn: () =>
      target === 'new'
        ? adminApi.createHousehold(name.trim())
        : adminApi.renameHousehold(target.id, name.trim()),
    onSuccess: () => {
      toast.success(t.saved);
      onSaved();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) save.mutate();
      }}
    >
      <TextField
        label={t.householdName}
        placeholder={t.householdPlaceholder}
        value={name}
        maxLength={60}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" fullWidth disabled={!name.trim()} loading={save.isPending}>
        {t.save}
      </Button>
    </form>
  );
}
