import {
  PaydayForm,
  PhotoPicker,
  ProfileFieldsForm,
  useProfileT,
  useWeightField,
} from '@/components/common/ProfileFields';
import { profileInput, profileValues } from '@/lib/profile';
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
import { useAdminT } from './i18n';

type Confirm = 'reset' | 'signOut' | 'toggle' | 'delete' | null;

/** One person: their details, role and the account actions, each confirmed before it runs. */
export default function UserPage() {
  const t = useAdminT();
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
        <PageHeader title={t.notFound} subtitle={errorMessage(person.error)} back="/admin/users" />
      </Screen>
    );
  }
  return <Loaded person={person.data} isMe={person.data.id === me.id} />;
}

function Loaded({ person, isMe }: { person: AdminUser; isMe: boolean }) {
  const t = useAdminT();
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
      toast.success(t.signedOutEverywhere(user.name));
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: () => adminApi.update(person.id, { isActive: !person.isActive }),
    onSuccess: (user) => {
      setConfirm(null);
      refresh(user);
      toast.success(user.isActive ? t.canSignInAgain(user.name) : t.switchedOffToast(user.name));
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: () => adminApi.remove(person.id),
    onSuccess: () => {
      setConfirm(null);
      refresh();
      toast.success(t.deletedToast(fullName(person)));
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
            {isMe ? <Badge tone="lav">{t.you}</Badge> : null}
            <Badge tone={person.role === 'admin' ? 'ink' : 'lav'}>{t.roles[person.role]}</Badge>
            {person.isActive ? (
              <Badge tone="mint">{t.canSignInBadge}</Badge>
            ) : (
              <Badge tone="muted">{t.switchedOff}</Badge>
            )}
            {person.mustChangePassword ? <Badge tone="peach">{t.passwordNotChosen}</Badge> : null}
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-ink-100 pt-4 text-sm">
            <div className="min-w-0">
              <dt className="text-ink-600">{t.lastActive}</dt>
              <dd className="mt-0.5 truncate font-semibold">
                {formatAgo(person.lastSeenAt ?? person.lastLoginAt)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-600">{t.devicesLabel}</dt>
              <dd className="tabular mt-0.5 font-semibold">{person.activeSessions}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-ink-600">{t.since}</dt>
              <dd className="mt-0.5 truncate font-semibold">{formatDate(person.createdAt)}</dd>
            </div>
          </dl>
        </section>

        <ListGroup
          title={t.account}
          className="xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-start"
        >
          {isMe ? (
            <p className="px-4 py-4 text-sm text-ink-600">{t.thisIsYou}</p>
          ) : (
            <>
              <ListRowButton
                icon={LockResetIcon}
                label={t.resetPassword}
                detail={t.resetLine}
                onClick={() => setConfirm('reset')}
              />
              <ListRowButton
                icon={DevicesIcon}
                label={t.signOutEverywhere}
                detail={
                  person.activeSessions ? t.signedInDevices(person.activeSessions) : t.notSignedIn
                }
                onClick={() => setConfirm('signOut')}
                disabled={person.activeSessions === 0}
              />
              <ListRowButton
                icon={person.isActive ? BlockIcon : LockOpenIcon}
                label={person.isActive ? t.switchOff : t.switchBackOn}
                detail={person.isActive ? t.switchOffLine : t.switchOnLine}
                onClick={() => setConfirm('toggle')}
              />
              <ListRowButton
                icon={DeleteIcon}
                label={t.deleteAccount}
                detail={t.cantUndo}
                tone="danger"
                onClick={() => setConfirm('delete')}
              />
            </>
          )}
        </ListGroup>

        <div className="xl:col-start-1">
          {/* Keyed by the saved version: a save (or a change elsewhere) starts the form from the new values. */}
          <DetailsForm key={person.updatedAt} person={person} isMe={isMe} onSaved={refresh} />
          <AboutCard key={`about-${person.updatedAt}`} person={person} onSaved={refresh} />
          <PaydayCard key={`paydays-${person.updatedAt}`} person={person} onSaved={refresh} />
        </div>
      </div>

      <ConfirmSheet
        open={confirm === 'reset'}
        onClose={() => setConfirm(null)}
        onConfirm={() => reset.mutate()}
        loading={reset.isPending}
        title={t.resetTitle(person.name)}
        description={t.resetDescription}
        confirmLabel={t.resetPassword}
      />
      <ConfirmSheet
        open={confirm === 'signOut'}
        onClose={() => setConfirm(null)}
        onConfirm={() => signOut.mutate()}
        loading={signOut.isPending}
        title={t.signOutTitle(person.name)}
        description={t.signOutDescription}
        confirmLabel={t.signOutEverywhere}
      />
      <ConfirmSheet
        open={confirm === 'toggle'}
        onClose={() => setConfirm(null)}
        onConfirm={() => toggle.mutate()}
        loading={toggle.isPending}
        title={person.isActive ? t.switchOffTitle(person.name) : t.switchOnTitle(person.name)}
        description={person.isActive ? t.switchOffDescription : t.switchOnDescription}
        confirmLabel={person.isActive ? t.switchOff : t.switchOn}
        tone={person.isActive ? 'danger' : 'default'}
      />
      <ConfirmSheet
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        title={t.deleteTitle(name)}
        description={t.deleteDescription}
        confirmLabel={t.deleteAccount}
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
  const t = useAdminT();
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
      toast.success(t.saved);
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
      <h2 className="text-h3 font-bold">{t.details}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.name}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fields.name}
        />
        <TextField
          label={t.surname}
          autoComplete="off"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          error={fields.surname}
        />
      </div>
      <TextField
        label={t.email}
        icon={EmailIcon}
        type="email"
        autoCapitalize="none"
        autoComplete="off"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fields.email}
        hint={t.emailHint}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 pl-1 text-sm font-semibold text-ink-800">{t.role}</legend>
        <Chips<Role>
          label={t.role}
          tone="sheet"
          value={role}
          onChange={setRole}
          options={[
            { value: 'member', label: t.roles.member },
            { value: 'admin', label: t.roles.admin },
          ]}
        />
        {isMe && role === 'member' && person.role === 'admin' ? (
          <p className="pl-1 text-sm font-medium text-peach-800">{t.loseAccess}</p>
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
        {t.saveChanges}
      </Button>
    </form>
  );
}

/**
 * Picture, gender, birth date, height, current and goal weight: the admin can set them for anyone
 * (a child without a phone).
 */
function AboutCard({ person, onSaved }: { person: AdminUser; onSaved: (user: AdminUser) => void }) {
  const t = useAdminT();
  const [value, setValue] = useState(() => profileValues(person));
  const weight = useWeightField(person);
  const save = useMutation({
    mutationFn: () => adminApi.update(person.id, { ...profileInput(value), ...weight.input() }),
    onSuccess: (user) => {
      onSaved(user);
      toast.success(t.saved);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  return (
    <section
      aria-labelledby="about"
      className="mt-5 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
    >
      <h2 id="about" className="text-h3 font-bold">
        {t.about(person.name)}
      </h2>
      <p className="mt-1 text-sm text-ink-600">{t.aboutUse}</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <PhotoPicker
          person={person}
          onSave={(image) => adminApi.setAvatar(person.id, image).then(onSaved)}
        />
        <div className="flex flex-col gap-4">
          <ProfileFieldsForm
            value={value}
            onChange={setValue}
            weight={weight.field}
            errors={fieldErrors(save.error)}
          />
          <Button
            size="md"
            loading={save.isPending}
            onClick={() => {
              if (weight.check()) save.mutate();
            }}
          >
            {t.save}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** The salary and advance days behind Home's countdown: the admin can set anyone's. */
function PaydayCard({
  person,
  onSaved,
}: {
  person: AdminUser;
  onSaved: (user: AdminUser) => void;
}) {
  const t = useProfileT();
  return (
    <section
      aria-labelledby="paydays"
      className="mt-5 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70"
    >
      <h2 id="paydays" className="text-h3 font-bold">
        {t.paydays}
      </h2>
      <p className="mt-1 text-sm text-ink-600">{t.paydaysLine}</p>
      <div className="mt-4">
        <PaydayForm
          person={person}
          save={(input) => adminApi.update(person.id, input)}
          onSaved={onSaved}
        />
      </div>
    </section>
  );
}
