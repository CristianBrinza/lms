import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useUser } from '@/app/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Badge, ButtonLink, Chips, IconLink, Skeleton, TextField } from '@/components/ui';
import { ChevronRightIcon, HistoryIcon, PersonAddIcon, SearchIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage } from '@/lib/errors';
import { formatAgo, fullName } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { ActivityEntry, AdminUser } from '@/types/api';

type Filter = 'all' | 'admins' | 'members' | 'off';

/** The admin console: everyone who has an account, and what changed lately. */
export default function UsersPage() {
  const me = useUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const q = useDeferredValue(search.trim());
  const users = useQuery({ queryKey: queryKeys.users(q), queryFn: () => adminApi.users(q), placeholderData: (previous) => previous });

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
    filter === 'all' ? true : filter === 'off' ? !u.isActive : u.isActive && u.role === (filter === 'admins' ? 'admin' : 'member'),
  );

  return (
    <Screen tone="white">
      <PageHeader
        title="People"
        subtitle={users.data ? `${counts.admins + counts.members} can sign in${counts.off ? ` · ${counts.off} switched off` : ''}` : ' '}
        back="/settings"
        actions={<IconLink to="/admin/users/new" icon={PersonAddIcon} label="Add a person" variant="ink" />}
      />

      <div className="gutter-x mt-6 lg:px-8 flex max-w-3xl flex-col gap-4">
        <TextField
          label="Search people"
          hideLabel
          icon={SearchIcon}
          type="search"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
        />
        <Chips<Filter>
          label="Show"
          tone="sheet"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'admins', label: 'Admins', count: counts.admins },
            { value: 'members', label: 'Members', count: counts.members },
            { value: 'off', label: 'Switched off', count: counts.off },
          ]}
        />

        <section aria-label="Accounts" className="overflow-hidden rounded-3xl bg-white ring-1 ring-inset ring-ink-100">
          {users.isPending ? (
            <div className="flex flex-col gap-4 p-4">
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
            <p className="p-5 text-sm font-medium text-danger-600">{errorMessage(users.error)}</p>
          ) : shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
              <p className="text-h3 font-bold">{q ? `No one matches “${q}”` : 'No one here yet'}</p>
              <p className="max-w-xs text-sm text-ink-600">{q ? 'Try part of a name or the email.' : 'Add family and friends: each gets their own sign-in.'}</p>
              {!q ? (
                <ButtonLink to="/admin/users/new" size="md" icon={PersonAddIcon} className="mt-2">
                  Add a person
                </ButtonLink>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-ink-100">
              {shown.map((person) => (
                <li key={person.id}>
                  <PersonRow person={person} isMe={person.id === me.id} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <Activity />
      </div>
    </Screen>
  );
}

function PersonRow({ person, isMe }: { person: AdminUser; isMe: boolean }) {
  return (
    <Link to={`/admin/users/${person.id}`} className="press flex min-h-18 items-center gap-3.5 px-4 py-3 hover:bg-lav-50">
      <Avatar person={person} size="md" className={cx(!person.isActive && 'opacity-45 grayscale')} />
      <span className="min-w-0 flex-1">
        <span className={cx('block truncate text-[0.9375rem] font-semibold', person.isActive ? 'text-ink-900' : 'text-ink-500')}>{fullName(person)}</span>
        <span className="block truncate text-sm text-ink-600">{person.email}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {isMe ? <Badge tone="lav">You</Badge> : null}
          {person.role === 'admin' ? <Badge tone="ink">Admin</Badge> : null}
          {!person.isActive ? <Badge tone="muted">Off</Badge> : null}
          <span className="text-xs font-medium text-ink-500">
            {person.mustChangePassword ? 'Hasn’t chosen a password yet' : `Active ${formatAgo(person.lastSeenAt ?? person.lastLoginAt).toLowerCase()}`}
          </span>
        </span>
      </span>
      <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.4rem] text-ink-400" />
    </Link>
  );
}

const ACTIONS: Record<string, string> = {
  'auth.login': 'signed in',
  'auth.session_reuse': 'had a session ended (an old sign-in token was reused)',
  'user.created': 'created an account for',
  'user.updated': 'edited the details of',
  'user.role_changed': 'changed the role of',
  'user.deactivated': 'switched off',
  'user.reactivated': 'switched back on',
  'user.password_reset': 'reset the password of',
  'user.password_changed': 'changed their password',
  'user.signed_out': 'signed out every device of',
  'user.deleted': 'deleted the account of',
};

function describe(entry: ActivityEntry): { who: string; what: string } {
  const who = entry.actor?.name || 'Someone';
  const verb = ACTIONS[entry.action] ?? entry.action;
  const self = entry.actor && entry.target && entry.actor.id === entry.target.id;
  if (entry.action === 'auth.login' || entry.action === 'user.password_changed' || self) return { who, what: verb };
  const target = entry.target?.name || (typeof entry.meta.name === 'string' ? entry.meta.name : '') || 'a removed account';
  const role = entry.action === 'user.role_changed' && typeof entry.meta.to === 'string' ? ` (now ${entry.meta.to})` : '';
  return { who, what: `${verb} ${target}${role}` };
}

function Activity() {
  const activity = useQuery({ queryKey: queryKeys.activity, queryFn: adminApi.activity });
  const entries = (activity.data ?? []).filter((entry) => entry.action !== 'auth.login').slice(0, 12);
  if (activity.isPending || entries.length === 0) return null;
  return (
    <section aria-labelledby="activity-title" className="mt-3">
      <h2 id="activity-title" className="mb-2.5 flex items-center gap-2 px-1 text-h3 font-bold">
        <HistoryIcon fontSize="inherit" className="text-lav-800" />
        Recent changes
      </h2>
      <ol className="flex flex-col gap-2">
        {entries.map((entry) => {
          const { who, what } = describe(entry);
          return (
            <li key={entry.id} className="flex items-baseline justify-between gap-4 rounded-2xl bg-white/55 px-4 py-3 text-sm">
              <span className="min-w-0 text-ink-800">
                <span className="font-semibold text-ink-900">{who}</span> {what}
              </span>
              <span className="shrink-0 text-xs font-medium text-lav-800">{formatAgo(entry.createdAt)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
