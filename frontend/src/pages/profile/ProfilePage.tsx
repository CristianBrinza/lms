import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth, useUser } from '@/app/auth';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import { Avatar, Button, ListGroup, ListRowButton, ListRowLink, PasswordField, Sheet, TextField, toast } from '@/components/ui';
import { BadgeIcon, EmailIcon, LockIcon, LogoutOutlinedIcon, SettingsOutlinedIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate, fullName } from '@/lib/format';
import { meApi } from '@/services/api/endpoints';

/**
 * Who you are in LMS, laid out like the mood apps' profile: the avatar and name centred, a yellow
 * card with the account facts, then rows that open your details and password.
 */
export default function ProfilePage() {
  const user = useUser();
  const { logout } = useAuth();
  const [open, setOpen] = useState<'details' | 'password' | null>(null);
  const close = () => setOpen(null);
  return (
    <Screen tone="white">
      <PageHeader title="Profile" />
      <div className="gutter-x mx-auto mt-4 flex max-w-xl flex-col items-center lg:px-8">
        <Avatar person={user} size="xl" className="size-24 text-2xl ring-4" />
        <h2 className="mt-4 text-center text-h2 font-bold">{fullName(user)}</h2>
        <p className="mt-1 text-center text-sm text-ink-600">{user.email}</p>

        <section className="mt-6 w-full rounded-3xl bg-[linear-gradient(155deg,#fae3a0,#f6d47a_55%,#f1c65a)] p-5 shadow-[var(--shadow-sheen-light),0_18px_32px_-20px_rgb(110_80_0/0.6)]" aria-label="Your account">
          <p className="text-sm font-semibold text-butter-800">Your account</p>
          <p className="mt-1.5 text-[1.0625rem] font-semibold leading-snug text-ink-900">
            {user.role === 'admin' ? 'Admin: you can add and manage everyone’s accounts.' : 'Member: the admin manages accounts.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex h-7 items-center rounded-pill bg-white px-2.5 text-xs font-semibold text-ink-900">Since {formatDate(user.createdAt)}</span>
          </div>
        </section>

        <ListGroup className="mt-5 w-full">
          <ListRowButton icon={BadgeIcon} label="Your details" detail="Name and surname" onClick={() => setOpen('details')} />
          <ListRowButton icon={LockIcon} label="Password" detail="Change it any time" onClick={() => setOpen('password')} />
          <ListRowLink to="/settings" icon={SettingsOutlinedIcon} label="Settings" detail="This device, signed-in devices" />
          <ListRowButton icon={LogoutOutlinedIcon} label="Sign out" tone="danger" onClick={() => void logout()} />
        </ListGroup>
      </div>

      <Sheet open={open === 'details'} onClose={close} title="Your details">
        <NameForm onDone={close} />
      </Sheet>
      <Sheet open={open === 'password'} onClose={close} title="Change password" description="Your other devices will be signed out.">
        <PasswordForm onDone={close} />
      </Sheet>
    </Screen>
  );
}

function NameForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [surname, setSurname] = useState(user.surname);
  const save = useMutation({
    mutationFn: () => meApi.update({ name: name.trim(), surname: surname.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Saved');
      onDone();
    },
  });
  const fields = fieldErrors(save.error);
  const changed = name.trim() !== user.name || surname.trim() !== user.surname;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} error={fields.name} required />
        <TextField label="Surname" autoComplete="family-name" value={surname} onChange={(e) => setSurname(e.target.value)} error={fields.surname} />
      </div>
      <TextField label="Email" icon={EmailIcon} value={user.email} readOnly disabled hint="Only an admin can change your email." />
      {save.error && !fields.name && !fields.surname ? <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p> : null}
      <Button type="submit" size="md" fullWidth loading={save.isPending} disabled={!changed || !name.trim()}>
        Save details
      </Button>
    </form>
  );
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const save = useMutation({
    mutationFn: () => meApi.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: (updated) => {
      setUser(updated);
      setCurrent('');
      setNext('');
      setRepeat('');
      toast.success('Password changed', { description: 'Your other devices were signed out.' });
      onDone();
    },
  });
  const fields = fieldErrors(save.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (next !== repeat) return setMismatch(true);
    setMismatch(false);
    save.mutate();
  };
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />
      <PasswordField label="Current password" icon={LockIcon} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={fields.currentPassword} />
      <PasswordField
        label="New password"
        icon={LockIcon}
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        error={fields.newPassword}
        hint="At least 10 characters."
      />
      <PasswordField
        label="Repeat new password"
        icon={LockIcon}
        autoComplete="new-password"
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        error={mismatch ? 'The two passwords are different' : undefined}
      />
      {save.error && !fields.currentPassword && !fields.newPassword ? <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p> : null}
      <Button type="submit" size="md" fullWidth loading={save.isPending} disabled={!current || next.length < 10 || !repeat}>
        Change password
      </Button>
    </form>
  );
}
