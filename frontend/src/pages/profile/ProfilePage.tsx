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
  CalendarIcon,
  EmailIcon,
  LockIcon,
  LogoutIcon,
  PersonIcon,
  SettingsIcon,
} from '@/components/ui/icons';
import {
  PaydayForm,
  PhotoPicker,
  ProfileFieldsForm,
  useProfileT,
  useWeightField,
} from '@/components/common/ProfileFields';
import { profileInput, profileValues } from '@/lib/profile';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { formatDate, fullName } from '@/lib/format';
import { meApi } from '@/services/api/endpoints';
import type { Gender } from '@/types/api';
import { useProfilePageT } from './i18n';

/**
 * Who you are in LMS, laid out like the mood apps' profile: the avatar and name centred, a yellow
 * card with the account facts, then rows that open your details and password.
 */
export default function ProfilePage() {
  const user = useUser();
  const { logout, setUser } = useAuth();
  const t = useProfileT();
  const p = useProfilePageT();
  const [open, setOpen] = useState<'details' | 'about' | 'paydays' | 'password' | null>(null);
  const close = () => setOpen(null);
  return (
    <Screen tone="white">
      <PageHeader title={p.title} />
      <div className="gutter-x mx-auto mt-4 flex max-w-xl flex-col items-center lg:max-w-2xl lg:px-8 xl:mx-0 xl:mt-8 xl:grid xl:max-w-5xl xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start xl:gap-8">
        <div className="flex w-full flex-col items-center xl:rounded-[2rem] xl:bg-white xl:p-7 xl:shadow-[var(--shadow-card)] xl:ring-1 xl:ring-inset xl:ring-ink-100/70">
          <PhotoPicker person={user} onSave={(image) => meApi.setAvatar(image).then(setUser)} />
          <h2 className="mt-4 text-center text-h2 font-bold">{fullName(user)}</h2>
          <p className="mt-1 text-center text-sm text-ink-600">{user.email}</p>

          <section
            className="mt-6 w-full rounded-3xl bg-butter-300 p-5 shadow-[0_18px_32px_-20px_rgb(110_80_0/0.6)]"
            aria-label={p.yourAccount}
          >
            <p className="text-[1.0625rem] font-semibold leading-snug text-ink-900">
              {p.roleLine(user.role === 'admin')}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="inline-flex h-7 items-center rounded-pill bg-white px-2.5 text-xs font-semibold text-ink-900">
                {p.since(formatDate(user.createdAt))}
              </span>
            </div>
          </section>
        </div>

        <ListGroup className="mt-5 w-full xl:mt-0" title={p.yourAccount}>
          <ListRowButton
            icon={BadgeIcon}
            label={p.details}
            detail={p.detailsLine}
            onClick={() => setOpen('details')}
          />
          <ListRowButton
            icon={PersonIcon}
            label={p.about}
            detail={aboutLine(user, t, p)}
            onClick={() => setOpen('about')}
          />
          <ListRowButton
            icon={CalendarIcon}
            label={t.paydays}
            detail={t.paydaysSummary(user.salaryDay, user.advanceDay)}
            onClick={() => setOpen('paydays')}
          />
          <ListRowButton
            icon={LockIcon}
            label={p.password}
            detail={p.passwordLine}
            onClick={() => setOpen('password')}
          />
          <ListRowLink
            to="/settings"
            icon={SettingsIcon}
            label={p.settings}
            detail={p.settingsLine}
          />
          <ListRowButton
            icon={LogoutIcon}
            label={p.signOut}
            detail={p.signOutLine}
            onClick={() => void logout()}
          />
        </ListGroup>
      </div>

      <Sheet open={open === 'details'} onClose={close} title={p.details}>
        <NameForm onDone={close} />
      </Sheet>
      <Sheet open={open === 'about'} onClose={close} title={p.about} description={p.aboutUse}>
        <AboutForm onDone={close} />
      </Sheet>
      <Sheet
        open={open === 'paydays'}
        onClose={close}
        title={t.paydays}
        description={t.paydaysLine}
      >
        <PaydayForm
          person={user}
          save={meApi.update}
          onSaved={(updated) => {
            setUser(updated);
            close();
          }}
          wide
        />
      </Sheet>
      <PasswordSheet open={open === 'password'} onClose={close} />
    </Screen>
  );
}

function NameForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const p = useProfilePageT();
  const [name, setName] = useState(user.name);
  const [surname, setSurname] = useState(user.surname);
  const save = useMutation({
    mutationFn: () => meApi.update({ name: name.trim(), surname: surname.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success(p.saved);
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
          label={p.name}
          autoComplete="given-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fields.name}
          required
        />
        <TextField
          label={p.surname}
          autoComplete="family-name"
          value={surname}
          onChange={(e) => setSurname(e.target.value)}
          error={fields.surname}
        />
      </div>
      <TextField
        label={p.email}
        icon={EmailIcon}
        value={user.email}
        readOnly
        disabled
        hint={p.emailHint}
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
        {p.saveDetails}
      </Button>
    </form>
  );
}

function aboutLine(
  user: { gender: Gender | null; birthDate: string | null; heightCm: number | null },
  t: ReturnType<typeof useProfileT>,
  p: ReturnType<typeof useProfilePageT>,
): string {
  const parts = [
    user.gender ? t.genders[user.gender] : null,
    user.birthDate ? p.born(formatDate(user.birthDate)) : null,
    user.heightCm ? p.cm(user.heightCm) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : p.aboutEmpty;
}

function AboutForm({ onDone }: { onDone: () => void }) {
  const user = useUser();
  const { setUser } = useAuth();
  const p = useProfilePageT();
  const [value, setValue] = useState(() => profileValues(user));
  const weight = useWeightField(user);
  const save = useMutation({
    mutationFn: () => meApi.update({ ...profileInput(value), ...weight.input() }),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success(p.saved);
      onDone();
    },
  });
  const fields = fieldErrors(save.error);
  return (
    <div className="flex flex-col gap-4">
      <ProfileFieldsForm value={value} onChange={setValue} weight={weight.field} errors={fields} />
      {save.error && !fields.weightKg && !fields.goalWeight ? (
        <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
      ) : null}
      <Button
        size="md"
        fullWidth
        loading={save.isPending}
        onClick={() => {
          if (weight.check()) save.mutate();
        }}
      >
        {p.save}
      </Button>
    </div>
  );
}
