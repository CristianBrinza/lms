import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useUser } from '@/app/auth';
import { ConfirmSheet } from '@/components/common/ConfirmSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Badge,
  Button,
  Chips,
  ListGroup,
  ListRowButton,
  Skeleton,
  TextField,
  toast,
} from '@/components/ui';
import {
  BlockIcon,
  DeleteIcon,
  DevicesIcon,
  EmailIcon,
  LockOpenIcon,
  LockResetIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatAgo, formatDate, fullName } from '@/lib/format';
import { adminApi } from '@/services/api/endpoints';
import { queryKeys } from '@/services/queries';
import type { AdminUser, Role } from '@/types/api';
import { CredentialsSheet } from './CredentialsSheet';

type Confirm = 'reset' | 'signOut' | 'toggle' | 'delete' | null;

/** One person: their details, role and the account actions, each confirmed before it runs. */
export default function UserPage() {
  const { id = '' } = useParams();
  const me = useUser();
  const person = useQuery({ queryKey: queryKeys.user(id), queryFn: () => adminApi.user(id) });

  if (person.isPending) {
    return (
      <Screen tone="white">
        <PageHeader title=" " back="/admin/users" />
        <div className="gutter-x mt-6 lg:px-8 flex max-w-2xl flex-col gap-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </Screen>
    );
  }
  if (person.isError) {
    return (
      <Screen tone="white">
        <PageHeader
          title="Person not found"
          subtitle={errorMessage(person.error)}
          back="/admin/users"
        />
      </Screen>
    );
  }
  return <Loaded person={person.data} isMe={person.data.id === me.id} />;
}

function Loaded({ person, isMe }: { person: AdminUser; isMe: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [credentials, setCredentials] = useState<string | null>(null);

  const refresh = (updated?: AdminUser) => {
    if (updated) queryClient.setQueryData(queryKeys.user(updated.id), updated);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity });
  };
  const onError = (error: unknown) => toast.error(errorMessage(error));

  const reset = useMutation({
    mutationFn: () => adminApi.resetPassword(person.id, { mustChangePassword: true }),
    onSuccess: ({ user, password }) => {
      setConfirm(null);
      refresh(user);
      if (password) setCredentials(password);
    },
    onError,
  });
  const signOut = useMutation({
    mutationFn: () => adminApi.signOut(person.id),
    onSuccess: (user) => {
      setConfirm(null);
      refresh(user);
      toast.success(`${user.name} is signed out everywhere`);
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: () => adminApi.update(person.id, { isActive: !person.isActive }),
    onSuccess: (user) => {
      setConfirm(null);
      refresh(user);
      toast.success(
        user.isActive ? `${user.name} can sign in again` : `${user.name} is switched off`,
      );
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => adminApi.remove(person.id),
    onSuccess: () => {
      setConfirm(null);
      refresh();
      toast.success(`${fullName(person)}’s account is deleted`);
      navigate('/admin/users', { replace: true });
    },
    onError,
  });

  const name = fullName(person);
  return (
    <Screen tone="white">
      <PageHeader title={name} back="/admin/users" centered />
      <div className="gutter-x mt-6 grid max-w-4xl gap-5 lg:mx-auto lg:px-8 xl:max-w-5xl xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 xl:col-start-1">
          <div className="flex items-center gap-4">
            <Avatar
              person={person}
              size="lg"
              className={cx(!person.isActive && 'opacity-45 grayscale')}
            />
            <div className="min-w-0">
              <p className="truncate text-h3 font-bold">{name}</p>
              <p className="truncate text-sm text-ink-600">{person.email}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {isMe ? <Badge tone="lav">You</Badge> : null}
            <Badge tone={person.role === 'admin' ? 'ink' : 'lav'}>
              {person.role === 'admin' ? 'Admin' : 'Member'}
            </Badge>
            {person.isActive ? (
              <Badge tone="mint">Can sign in</Badge>
            ) : (
              <Badge tone="muted">Switched off</Badge>
            )}
            {person.mustChangePassword ? <Badge tone="peach">Password not chosen yet</Badge> : null}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-sm">
            <div className="min-w-0">
              <dt className="text-ink-600">Last active</dt>
              <dd className="mt-0.5 truncate font-semibold">
                {formatAgo(person.lastSeenAt ?? person.lastLoginAt)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-600">Devices</dt>
              <dd className="tabular mt-0.5 font-semibold">{person.activeSessions}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-600">Since</dt>
              <dd className="mt-0.5 truncate font-semibold">{formatDate(person.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <ListGroup
          title="Account"
          className="xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start"
        >
          {isMe ? (
            <p className="px-4 py-4 text-sm text-ink-600">
              This is you. Change your password and devices from your Profile and Settings.
            </p>
          ) : (
            <>
              <ListRowButton
                icon={LockResetIcon}
                label="Reset password"
                detail="Make a new one-time password"
                onClick={() => setConfirm('reset')}
              />
              <ListRowButton
                icon={DevicesIcon}
                label="Sign out everywhere"
                detail={
                  person.activeSessions
                    ? `${person.activeSessions} signed-in device${person.activeSessions === 1 ? '' : 's'}`
                    : 'Not signed in anywhere'
                }
                onClick={() => setConfirm('signOut')}
                disabled={person.activeSessions === 0}
              />
              <ListRowButton
                icon={person.isActive ? BlockIcon : LockOpenIcon}
                label={person.isActive ? 'Switch off' : 'Switch back on'}
                detail={
                  person.isActive ? 'Keeps the account, blocks sign-in' : 'Let them sign in again'
                }
                onClick={() => setConfirm('toggle')}
              />
              <ListRowButton
                icon={DeleteIcon}
                label="Delete account"
                detail="Can’t be undone"
                tone="danger"
                onClick={() => setConfirm('delete')}
              />
            </>
          )}
        </ListGroup>

        <div className="xl:col-start-1">
          {/* Keyed by the saved version: a save (or a change elsewhere) starts the form from the new values. */}
          <DetailsForm key={person.updatedAt} person={person} isMe={isMe} onSaved={refresh} />
        </div>
      </div>

      <ConfirmSheet
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => reset.mutate()}
        loading={reset.isPending}
        title={`Reset ${person.name}’s password?`}
        description="Their current password stops working and every device signs out. You’ll get a one-time password to send them."
        confirmLabel="Reset password"
      />
      <ConfirmSheet
        open={confirm === 'signOut'}
        onClose={() => setConfirm(null)}
        onConfirm={() => signOut.mutate()}
        loading={signOut.isPending}
        title={`Sign ${person.name} out everywhere?`}
        description="Every device they use signs out at once. Their password stays the same."
        confirmLabel="Sign out everywhere"
      />
      <ConfirmSheet
        open={confirm === 'toggle'}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggle.mutate()}
        loading={toggle.isPending}
        title={person.isActive ? `Switch ${person.name} off?` : `Switch ${person.name} back on?`}
        description={
          person.isActive
            ? 'They’re signed out everywhere and can’t sign in until you switch them back on. Nothing is deleted.'
            : 'They can sign in again with their current password.'
        }
        confirmLabel={person.isActive ? 'Switch off' : 'Switch on'}
        tone={person.isActive ? 'danger' : 'default'}
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={`Delete ${name}’s account?`}
        description="The account and its sign-ins are removed for good. To only block sign-in, switch them off instead."
        confirmLabel="Delete account"
        tone="danger"
      />
      {credentials ? (
        <CredentialsSheet
          open
          reason="reset"
          name={person.name}
          email={person.email}
          password={credentials}
          onClose={() => setCredentials(null)}
        />
      ) : null}
    </Screen>
  );
}

function DetailsForm({
  person,
  isMe,
  onSaved,
}: {
  person: AdminUser;
  isMe: boolean;
  onSaved: (user: AdminUser) => void;
}) {
  const [name, setName] = useState(person.name);
  const [surname, setSurname] = useState(person.surname);
  const [email, setEmail] = useState(person.email);
  const [role, setRole] = useState<Role>(person.role);

  const save = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof adminApi.update>[1] = {};
      if (name.trim() !== person.name) body.name = name.trim();
      if (surname.trim() !== person.surname) body.surname = surname.trim();
      if (email.trim().toLowerCase() !== person.email) body.email = email.trim();
      if (role !== person.role) body.role = role;
      return adminApi.update(person.id, body);
    },
    onSuccess: (user) => {
      onSaved(user);
      toast.success('Saved');
    },
  });
  const changed =
    name.trim() !== person.name ||
    surname.trim() !== person.surname ||
    email.trim().toLowerCase() !== person.email ||
    role !== person.role;
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
    >
      <h2 className="text-h3 font-bold">Details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fields.name}
        />
        <TextField
          label="Surname"
          autoComplete="off"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          error={fields.surname}
        />
      </div>
      <TextField
        label="Email"
        icon={EmailIcon}
        type="email"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fields.email}
        hint="They sign in with this."
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 pl-1 text-sm font-semibold text-ink-800">Role</legend>
        <Chips<Role>
          label="Role"
          tone="sheet"
          value={role}
          onChange={setRole}
          options={[
            { value: 'member', label: 'Member' },
            { value: 'admin', label: 'Admin' },
          ]}
        />
        {isMe && role === 'member' && person.role === 'admin' ? (
          <p className="pl-1 text-sm font-medium text-peach-800">
            You’ll lose access to People as soon as you save.
          </p>
        ) : null}
      </fieldset>
      {save.error && Object.keys(fields).length === 0 ? (
        <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
      ) : null}
      <Button
        type="submit"
        size="md"
        className="self-start"
        loading={save.isPending}
        disabled={!changed || !name.trim() || !email.trim()}
      >
        Save changes
      </Button>
    </form>
  );
}
