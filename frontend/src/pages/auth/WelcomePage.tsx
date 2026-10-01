import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router';
import { useAuth, useUser } from '@/app/auth';
import { LogoTile } from '@/components/brand/Logo';
import { Button, PasswordField, toast } from '@/components/ui';
import { LockIcon } from '@/components/ui/icons';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { meApi } from '@/services/api/endpoints';
import { THEME, useThemeColor } from '@/lib/themeColor';

/**
 * First sign-in with a one-time password from the admin: the person chooses their own before
 * anything else. The temporary one is not asked for again; they just used it.
 */
export default function WelcomePage() {
  const user = useUser();
  const { setUser, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  useThemeColor(THEME.butter);

  const save = useMutation({
    mutationFn: () => meApi.changePassword({ newPassword: password }),
    onSuccess: (updated) => {
      toast.success('Password saved', { description: 'Use it next time you sign in.' });
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
        className="gutter-x mx-auto flex min-h-dvh max-w-md flex-col pb-[calc(var(--safe-bottom)+1.25rem)] pt-[calc(var(--safe-top)+1.5rem)] animate-page"
      >
        <LogoTile className="mx-auto size-14" />
        <h1 className="mt-7 text-center text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em]">
          {user.name}, choose
          <br />
          your password.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-base font-medium text-butter-800">
          You signed in with a one-time password. Pick your own to finish.
        </p>

        <form onSubmit={submit} noValidate className="mt-7 flex flex-1 flex-col gap-4">
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
              label="New password"
              icon={LockIcon}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              hint="At least 10 characters. A short sentence works well."
              error={fields.newPassword}
              autoFocus
            />
            <PasswordField
              label="Repeat it"
              icon={LockIcon}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              error={mismatch ? 'The two passwords are different' : undefined}
            />
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
              Save and continue
            </Button>
            <Button variant="outline" fullWidth onClick={() => void logout()}>
              Not you? Sign out
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
