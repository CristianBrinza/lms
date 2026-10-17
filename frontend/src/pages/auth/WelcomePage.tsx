import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth, useUser } from '@/app/auth';
import { LogoTile } from '@/components/brand/Logo';
import { Button, PasswordField, toast } from '@/components/ui';
import { LockIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { MatchMark, PasswordStrength } from '@/components/common/PasswordStrength';
import { meApi } from '@/services/api/endpoints';
import { THEME, useThemeColor } from '@/lib/themeColor';
import { uiT } from '@/components/i18n';
import { useAuthT } from './i18n';

/**
 * First sign-in with a one-time password from the admin: the person chooses their own before
 * anything else. The temporary one is not asked for again; they just used it.
 */
export default function WelcomePage() {
  const t = useAuthT();
  const user = useUser();
  const { setUser, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  useThemeColor(THEME.butter);

  const save = useMutation({
    mutationFn: () => meApi.changePassword({ newPassword: password }),
    onSuccess: (updated) => {
      toast.success(t.passwordSaved, { description: t.useNextTime });
      setUser(updated);
    },
  });

  if (!user.mustChangePassword) return <Navigate to="/home" replace />;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    save.mutate();
  };
  const fields = fieldErrors(save.error);

  return (
    <div className="min-h-dvh bg-butter-300">
      <main
        id="main"
        className="gutter-x mx-auto flex min-h-dvh max-w-md flex-col pb-[calc(var(--safe-bottom)+1.25rem)] pt-[calc(var(--safe-top)+1.5rem)] animate-page lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_28rem] lg:content-center lg:items-center lg:gap-20"
      >
        <div>
          <LogoTile className="mx-auto size-14 lg:mx-0" />
          <h1 className="mt-7 text-center text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em] lg:text-left lg:text-[4.25rem] lg:font-extrabold lg:leading-[0.98] lg:tracking-[-0.045em]">
            {t.choose(user.name)[0]}
            <br />
            {t.choose(user.name)[1]}
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-center text-base font-medium text-butter-800 lg:mx-0 lg:mt-5 lg:max-w-md lg:text-left lg:text-lg">
            {t.oneTime}
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="mt-7 flex flex-1 flex-col gap-4 lg:mt-0 lg:flex-none"
        >
          <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-5 shadow-[0_20px_40px_-28px_rgb(110_80_0/0.6)]">
            <input
              type="email"
              name="username"
              autoComplete="username"
              value={user.email}
              readOnly
              hidden
            />
            <PasswordField
              label={uiT().password.next}
              icon={LockIcon}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint={uiT().password.nextHint}
              error={fields.newPassword}
              autoFocus
            />
            <PasswordStrength password={password} />
            <PasswordField
              label={t.repeatIt}
              icon={LockIcon}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={mismatch ? t.different : undefined}
            />
            {!mismatch ? <MatchMark password={password} repeat={confirm} /> : null}
            {save.error && !fields.newPassword ? (
              <p className="text-sm font-medium text-danger-600">{errorMessage(save.error)}</p>
            ) : null}
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              fullWidth
              loading={save.isPending}
              disabled={password.length < 10 || !confirm}
            >
              {t.saveContinue}
            </Button>
            <Button variant="outline" fullWidth onClick={() => void logout()}>
              {t.notYou}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
