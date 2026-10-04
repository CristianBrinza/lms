import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth, useUser } from '@/app/auth';
import { PasswordSheet } from '@/components/common/PasswordSheet';
import { PageHeader } from '@/components/layout/PageHeader';
import { Screen } from '@/components/layout/Screen';
import {
  Button,
  ListGroup,
  ListRowButton,
  ListRowLink,
  Sheet,
  TextField,
  toast,
} from '@/components/ui';
import {
  BadgeIcon,
  EmailIcon,
  LockIcon,
  LogoutIcon,
  PersonIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import { PhotoPicker, ProfileFieldsForm } from '@/components/common/ProfileFields';
import { profileInput, profileValues } from '@/lib/profile';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate, fullName } from '@/lib/format';
import { meApi } from '@/services/api/endpoints';

/**
 * Who you are in LMS, laid out like the mood apps' profile: the avatar and name centred, a yellow
 * card with the account facts, then rows that open your details and password.
 */
export default function ProfilePage() {
  const user = useUser();
  const { logout, setUser } = useAuth();
  const [open, setOpen] = useState<'details' | 'about' | 'password' | null>(null);
  const close = () => setOpen(null);
  return (
    <Screen tone="white">
      <PageHeader title="Profile" />
      <div className="gutter-x mx-auto mt-4 flex max-w-xl flex-col items-center lg:max-w-2xl lg:px-8 xl:mx-0 xl:mt-8 xl:grid xl:max-w-5xl xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className="flex w-full flex-col items-center xl:rounded-[2rem] xl:bg-white xl:p-7 xl:shadow-[var(--shadow-card)] xl:ring-1 xl:ring-inset xl:ring-ink-100/70">
          <PhotoPicker person={user} onSave={(image) => meApi.setAvatar(image).then(setUser)} />
          <h2 className="mt-4 text-center text-h2 font-bold">{fullName(user)}</h2>
          <p className="mt-1 text-center text-sm text-ink-600">{user.email}</p>

          <section
            className="mt-6 w-full rounded-3xl bg-butter-300 p-5 shadow-[0_18px_32px_-20px_rgb(110_80_0/0.6)]"
            aria-label="Your account"
          >
            <p className="text-[1.0625rem] font-semibold leading-snug text-ink-900">
              {user.role === 'admin'
                ? 'Admin: you can add and manage everyone’s accounts.'
                : 'Member: the admin manages accounts.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex h-7 items-center rounded-pill bg-white px-2.5 text-xs font-semibold text-ink-900">
                Since {formatDate(user.createdAt)}
              </span>
            </div>
          </section>
        </div>

        <ListGroup className="mt-5 w-full xl:mt-0" title="Your account">
          <ListRowButton
            icon={BadgeIcon}
            label="Your details"
            detail="Name and surname"
            onClick={() => setOpen('details')}
          />
          <ListRowButton
            icon={PersonIcon}
            label="About you"
            detail={aboutLine(user)}
            onClick={() => setOpen('about')}
          />
          <ListRowButton
            icon={LockIcon}
            label="Password"
            detail="Change it any time"
            onClick={() => setOpen('password')}
          />
          <ListRowLink
            to="/settings"
            icon={SettingsIcon}
            label="Settings"
            detail="This device, signed-in devices"
          />
          <ListRowButton
            icon={LogoutIcon}
            label="Sign out"
            detail="On this device"
            onClick={() => void logout()}
          />
        </ListGroup>
      </div>

      <Sheet open={open === 'details'} onClose={close} title="Your details">
        <NameForm onDone={close} />
      </Sheet>
      <Sheet
        open={open === 'about'}
        onClose={close}
        title="About you"
        description="Used for training plans and health numbers."
      >
        <AboutForm onDone={close} />
      </Sheet>
      <PasswordSheet open={open === 'password'} onClose={close} />
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
        <TextField
          label="Name"
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fields.name}
          required
        />
        <TextField
          label="Surname"
          autoComplete="family-name"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          error={fields.surname}
        />
      </div>
      <TextField
        label="Email"
        icon={EmailIcon}
        value={user.email}
        readOnly
        disabled
        hint="Only an admin can change your email."
      />
      {save.error && !fields.name && !fields.surname ? (
        <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
      ) : null}
      <Button
        type="submit"
        size="md"
        fullWidth
        loading={save.isPending}
        disabled={!changed || !name.trim()}
      >
        Save details
      </Button>
    </form>
  );
}

const GENDER_WORD = { female: 'Female', male: 'Male', other: 'Other' } as const;

function aboutLine(user: {
  gender: keyof typeof GENDER_WORD | null;
  birthDate: string | null;
  heightCm: number | null;
}): string {
  const parts = [
    user.gender ? GENDER_WORD[user.gender] : null,
    user.birthDate ? `born ${formatDate(user.birthDate)}` : null,
    user.heightCm ? `${user.heightCm} cm` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Gender, birth date, height';
}

function AboutForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const [value, setValue] = useState(() => profileValues(user));
  const save = useMutation({
    mutationFn: () => meApi.update(profileInput(value)),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Saved');
      onDone();
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <ProfileFieldsForm value={value} onChange={setValue} />
      {save.error ? (
        <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
      ) : null}
      <Button size="md" fullWidth loading={save.isPending} onClick={() => save.mutate()}>
        Save
      </Button>
    </div>
  );
}
