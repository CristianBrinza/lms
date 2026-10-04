import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Button, Chips, PasswordField, Switch, TextField } from '@/components/ui';
import { EmailIcon, LockIcon, PersonAddIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { adminApi } from '@/services/api/endpoints';
import type { AdminUser, Role } from '@/types/api';
import { PasswordStrength } from '@/components/common/PasswordStrength';
import { CredentialsSheet } from './CredentialsSheet';

/** A new account: details, role, and a one-time password (generated, or the admin's choice). */
export default function NewUserPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [generate, setGenerate] = useState(true);
  const [password, setPassword] = useState('');
  const [mustChange, setMustChange] = useState(true);
  const [created, setCreated] = useState<{ user: AdminUser; password: string } | null>(null);

  const create = useMutation({
    mutationFn: () =>
      adminApi.create({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        role,
        ...(generate ? {} : { password }),
        mustChangePassword: generate ? true : mustChange,
      }),
    onSuccess: ({ user, password: oneTime }) => {
      haptic('success');
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      if (oneTime) setCreated({ user, password: oneTime });
      else navigate(`/admin/users/${user.id}`, { replace: true });
    },
  });

  const fields = fieldErrors(create.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <Screen tone="white">
      <PageHeader title="Add a person" back="/admin/users" centered />
      <form
        onSubmit={submit}
        noValidate
        className="gutter-x mt-6 flex max-w-2xl flex-col gap-5 lg:mx-auto lg:grid lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-x-8 lg:gap-y-5 lg:px-8"
      >
        <p className="text-[0.9375rem] text-ink-600 lg:col-span-2">
          They sign in with this email. Nobody can sign up on their own.
        </p>
        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70 lg:row-span-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={fields.name}
              required
              autoFocus
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
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
            required
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
            <p className="pl-1 text-sm text-ink-600">
              {role === 'admin'
                ? 'Admins can also add, change and remove accounts.'
                : 'Members use the app; they can’t manage accounts.'}
            </p>
          </fieldset>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-inset ring-ink-100/70">
          <Switch
            checked={generate}
            onChange={setGenerate}
            label="Create a one-time password for me"
            hint="Shown to you once, to send them. They choose their own at first sign-in."
          />
          {!generate ? (
            <>
              <PasswordField
                label="Password"
                icon={LockIcon}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fields.password}
                hint="At least 10 characters."
              />
              <PasswordStrength password={password} />
              <Switch
                checked={mustChange}
                onChange={setMustChange}
                label="Ask them to choose their own at first sign-in"
              />
            </>
          ) : null}
        </section>

        {create.error && Object.keys(fields).length === 0 ? (
          <p className="text-sm font-medium text-danger-600">{errorMessage(create.error)}</p>
        ) : null}
        <Button
          type="submit"
          icon={PersonAddIcon}
          loading={create.isPending}
          disabled={!name.trim() || !email.trim() || (!generate && password.length < 10)}
          className="sm:self-start lg:col-start-2 lg:w-full"
        >
          Create account
        </Button>
      </form>

      {created ? (
        <CredentialsSheet
          open
          reason="created"
          name={created.user.name}
          email={created.user.email}
          password={created.password}
          onClose={() => navigate(`/admin/users/${created.user.id}`, { replace: true })}
        />
      ) : null}
    </Screen>
  );
}
