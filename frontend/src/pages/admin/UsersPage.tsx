import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '@/app/auth';
import { ChevronCircle } from '@/components/common/ThumbRow';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Badge, ButtonLink, Chips, IconLink, Skeleton, TextField } from '@/components/ui';
import {
  AdminIcon,
  BlockIcon,
  GroupIcon,
  HistoryIcon,
  HouseIcon, PersonAddIcon,
  PersonIcon,
  SearchIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatAgo, fullName } from '@/lib/format';
import { useCountUp } from '@/lib/useCountUp';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { ActivityEntry, AdminUser, Role } from '@/types/api';
import { useAdminT } from './i18n';

type Filter = 'all' | 'admins' | 'members' | 'off';

/** The admin console: everyone who has an account, and what changed lately. */
export default function UsersPage() {
  const t = useAdminT();
  const me = useUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDeferredValue(search.trim());
  const users = useQuery({
    queryKey: queryKeys.users(q),
    queryFn: () => adminApi.users(q),
    placeholderData: (previous) => previous,
  });
  // Everyone, whatever the search: the numbers at the top always count the whole list.
  const everyone = useQuery({ queryKey: queryKeys.users(''), queryFn: () => adminApi.users() });

  const list = useMemo(() => users.data ?? [], [users.data]);
  const counts = useMemo(
    () => ({
      all: list.length,
      admins: list.filter((u) => u.role === 'admin' && u.isActive).length,
      members: list.filter((u) => u.role === 'member' && u.isActive).length,
      off: list.filter((u) => !u.isActive).length,
    }),
    [list],
  );
  const shown = list.filter((u) =>
    filter === 'all'
      ? true
      : filter === 'off'
        ? !u.isActive
        : u.isActive && u.role === (filter === 'admins' ? 'admin' : 'member'),
  );

  return (
    <Screen tone="white">
      <PageHeader
        title={t.people}
        back="/settings"
        actions={
          <>
            <IconLink
              to="/admin/households"
              icon={HouseIcon}
              label={t.manageHouseholds}
              variant="outline"
            />
            <IconLink to="/admin/users/new" icon={PersonAddIcon} label={t.addPerson} variant="ink" />
          </>
        }
      />

      <div className="gutter-x mt-6 flex max-w-3xl flex-col gap-4 lg:max-w-6xl lg:px-8">
        {everyone.data ? <Stats people={everyone.data} /> : null}
        {/* Desktop: the list on the left, recent changes beside it. */}
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_21rem] xl:items-start xl:gap-8">
          <div className="flex min-w-0 flex-col gap-4">
            <TextField
              label={t.searchLabel}
              hideLabel
              surface="raised"
              icon={SearchIcon}
              type="search"
              placeholder={t.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
            <Chips<Filter>
              label={t.show}
              tone="sheet"
              value={filter}
              onChange={setFilter}
              className="-mx-5 px-5 lg:-mx-1 lg:px-1"
              options={[
                { value: 'all', label: t.filters.all, count: counts.all, icon: GroupIcon },
                { value: 'admins', label: t.filters.admins, count: counts.admins, icon: AdminIcon },
                {
                  value: 'members',
                  label: t.filters.members,
                  count: counts.members,
                  icon: PersonIcon,
                },
                { value: 'off', label: t.filters.off, count: counts.off, icon: BlockIcon },
              ]}
            />

            <section aria-label={t.accounts}>
              {users.isPending ? (
                <div className="flex flex-col gap-4 rounded-[1.375rem] bg-white p-4 ring-1 ring-inset ring-ink-100">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="size-12 rounded-full" />
                      <div className="flex flex-1 flex-col gap-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : users.isError ? (
                <p className="rounded-[1.375rem] bg-danger-50 p-5 text-sm font-medium text-danger-600">
                  {errorMessage(users.error)}
                </p>
              ) : shown.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[1.375rem] bg-white px-6 py-10 text-center ring-1 ring-inset ring-ink-100">
                  <p className="text-h3 font-bold">{q ? t.noMatch(q) : t.noOne}</p>
                  <p className="max-w-xs text-sm text-ink-600">{q ? t.tryPart : t.addFamily}</p>
                  {!q ? (
                    <ButtonLink
                      to="/admin/users/new"
                      size="md"
                      icon={PersonAddIcon}
                      className="mt-2"
                    >
                      {t.addPerson}
                    </ButtonLink>
                  ) : null}
                </div>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {shown.map((person, index) => (
                    <li
                      key={person.id}
                      className="animate-rise"
                      style={{ animationDelay: `${Math.min(index, 6) * 50}ms` }}
                    >
                      <PersonRow person={person} isMe={person.id === me.id} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <Activity />
        </div>
      </div>
    </Screen>
  );
}

/** The learning app's stat tiles: four real counts, the first one in butter. */
function Stats({ people }: { people: AdminUser[] }) {
  const t = useAdminT().stats;
  const active = people.filter((person) => person.isActive);
  const tiles = [
    {
      label: t.canSignIn,
      value: active.length,
      note: t.activeAccounts(active.length),
    },
    {
      label: t.admins,
      value: active.filter((person) => person.role === 'admin').length,
      note: t.manage,
    },
    {
      label: t.notSetUp,
      value: active.filter((person) => person.mustChangePassword).length,
      note: t.noPassword,
    },
    {
      label: t.signedInNow,
      value: active.reduce((sum, person) => sum + person.activeSessions, 0),
      note: t.devices(active.reduce((sum, person) => sum + person.activeSessions, 0)),
    },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((tile, index) => (
        <div
          key={tile.label}
          className={cx(
            'flex flex-col rounded-[1.375rem] p-4 animate-rise',
            index === 0
              ? 'bg-butter-300 shadow-[0_14px_28px_-18px_rgb(110_80_0/0.6)]'
              : 'bg-white shadow-[var(--shadow-xs)] ring-1 ring-inset ring-ink-100',
          )}
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <dt className="text-[0.9375rem] font-medium text-ink-800">{tile.label}</dt>
          <dd className="mt-4">
            <CountUp value={tile.value} />
            <span
              className={cx(
                'mt-1.5 block text-sm',
                index === 0 ? 'text-butter-800' : 'text-ink-600',
              )}
            >
              {tile.note}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CountUp({ value }: { value: number }) {
  const shown = useCountUp(value);
  return (
    <span className="tabular block text-[2.25rem] font-semibold leading-none tracking-[-0.03em] text-ink-900">
      {shown}
    </span>
  );
}

function PersonRow({ person, isMe }: { person: AdminUser; isMe: boolean }) {
  const t = useAdminT();
  return (
    <Link
      to={`/admin/users/${person.id}`}
      className="press flex min-h-20 items-center gap-3.5 rounded-[1.375rem] bg-white p-3 pr-4 shadow-[var(--shadow-xs)] ring-1 ring-inset ring-ink-100 transition-[box-shadow,translate] duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card)]"
    >
      <Avatar
        person={person}
        size="lg"
        className={cx('ring-0', !person.isActive && 'opacity-45 grayscale')}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate text-[0.9375rem] font-semibold',
            person.isActive ? 'text-ink-900' : 'text-ink-500',
          )}
        >
          {fullName(person)}
        </span>
        <span className="block truncate text-sm text-ink-600">{person.email}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {isMe ? <Badge tone="lav">{t.you}</Badge> : null}
          {person.role === 'admin' ? <Badge tone="ink">{t.adminBadge}</Badge> : null}
          {!person.isActive ? <Badge tone="muted">{t.off}</Badge> : null}
          <span className="text-xs font-medium text-ink-500">
            {person.mustChangePassword
              ? t.noPasswordYet
              : t.activeAgo(formatAgo(person.lastSeenAt ?? person.lastLoginAt).toLowerCase())}
          </span>
        </span>
      </span>
      <ChevronCircle />
    </Link>
  );
}

function describe(
  entry: ActivityEntry,
  t: ReturnType<typeof useAdminT>,
): { who: string; what: string } {
  const who = entry.actor?.name || t.someone;
  const verb = t.actions[entry.action] ?? entry.action;
  const self = entry.actor && entry.target && entry.actor.id === entry.target.id;
  if (entry.action === 'auth.login' || entry.action === 'user.password_changed' || self)
    return { who, what: verb };
  const target =
    entry.target?.name ||
    (typeof entry.meta.name === 'string' ? entry.meta.name : '') ||
    t.removedAccount;
  const role =
    entry.action === 'user.role_changed' && typeof entry.meta.to === 'string'
      ? t.nowRole(t.roles[entry.meta.to as Role] ?? entry.meta.to)
      : '';
  return { who, what: `${verb} ${target}${role}` };
}

function Activity() {
  const t = useAdminT();
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: adminApi.activity });
  const entries = (activity.data ?? [])
    .filter((entry) => entry.action !== 'auth.login')
    .slice(0, 12);
  if (activity.isPending || entries.length === 0) return null;
  return (
    <section
      aria-labelledby="activity-title"
      className="mt-3 xl:sticky xl:top-6 xl:mt-0 xl:rounded-[1.75rem] xl:bg-white xl:p-5 xl:shadow-[var(--shadow-card)] xl:ring-1 xl:ring-inset xl:ring-ink-100/70"
    >
      <h2 id="activity-title" className="mb-2.5 flex items-center gap-2 px-1 text-h3 font-bold">
        <HistoryIcon fontSize="inherit" className="text-lav-800" />
        {t.recent}
      </h2>
      <ol className="flex flex-col gap-2">
        {entries.map((entry) => {
          const { who, what } = describe(entry, t);
          return (
            <li
              key={entry.id}
              className="flex items-baseline justify-between gap-4 rounded-2xl bg-white/55 px-4 py-3 text-sm xl:bg-ink-50"
            >
              <span className="min-w-0 text-ink-800">
                <span className="font-semibold text-ink-900">{who}</span> {what}
              </span>
              <span className="shrink-0 text-xs font-medium text-lav-800">
                {formatAgo(entry.createdAt)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
