import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { Lockup } from '@/components/brand/Logo';
import { Button, ButtonLink, Checkbox, PasswordField, TextField } from '@/components/ui';
import { EmailIcon, ErrorIcon, InstallIcon, LockIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { currentPlatform } from '@/lib/platform';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { isApiError } from '@/services/api/client';
import { authApi } from '@/services/api/endpoints';
import { THEME, useThemeColor } from '@/lib/themeColor';

/**
 * Sign-in, the only way in (accounts come from the admin). A real <form> with autocomplete
 * hints, so password managers fill and save it. "Keep me signed in" is on by default: the
 * session then lasts a year on this device.
 */
export default function LoginPage() {
  const { setUser } = useAuth();
  const [email, setEmail] = useState(() => storage.get(STORAGE_KEYS.lastEmail) ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [shake, setShake] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const standalone = currentPlatform().standalone;
  useThemeColor(THEME.field);

  const login = useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ user }) => {
      storage.set(STORAGE_KEYS.lastEmail, user.email);
      setUser(user); // GuestOnly sends the person on.
    },
    onError: (error) => {
      setShake((n) => n + 1);
      if (isApiError(error, 'INVALID_CREDENTIALS')) {
        setPassword('');
        passwordRef.current?.focus();
      }
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (login.isPending) return;
    login.mutate({ email: email.trim(), password, remember });
  };

  const fields = fieldErrors(login.error);
  const formError = login.error && !fields.email && !fields.password ? errorMessage(login.error) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter-x mx-auto flex w-full max-w-md items-center pt-[calc(var(--safe-top)+1.25rem)]">
        <Lockup />
      </header>
      <main id="main" className="gutter-x mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--safe-bottom)+1.25rem)]">
        <h1 className="mt-8 text-center text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em]">
          <span className="text-lav-800">Welcome</span> back.
        </h1>
        <p className="mx-auto mt-2 max-w-xs text-center text-base font-medium text-lav-900">Sign in with the email the admin set up for you.</p>

        <form onSubmit={submit} noValidate className={cx('mt-7 flex flex-col gap-4', shake && 'animate-shake')} key={shake}>
          <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-5 shadow-[0_20px_40px_-28px_rgb(42_43_102/0.6)]">
            {formError ? (
              <p role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                <ErrorIcon fontSize="inherit" className="mt-0.5 shrink-0 text-base" />
                {formError}
              </p>
            ) : null}
            <TextField
              label="Email"
              icon={EmailIcon}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={fields.email}
              autoFocus={!email}
            />
            <PasswordField
              ref={passwordRef}
              label="Password"
              icon={LockIcon}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fields.password}
              autoFocus={Boolean(email)}
            />
            <Checkbox
              label="Keep me signed in"
              hint="Stay signed in on this device for a year."
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-2">
            <Button type="submit" size="lg" fullWidth loading={login.isPending} disabled={!email || !password}>
              Sign in
            </Button>
            {!standalone ? (
              <ButtonLink to="/app" variant="outline" icon={InstallIcon} fullWidth>
                Add LMS to your Home Screen
              </ButtonLink>
            ) : null}
            <p className="px-2 text-center text-sm text-lav-900">No account yet? Ask the admin to add you. Forgot your password? The admin can reset it.</p>
          </div>
        </form>
      </main>
    </div>
  );
}
