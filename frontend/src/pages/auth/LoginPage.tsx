import { useMutation } from '@tanstack/react-query';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { StarBurst } from '@/components/brand/Doodles';
import { Lockup } from '@/components/brand/Logo';
import { Sticker } from '@/components/brand/Sticker';
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher';
import { Button, ButtonLink, Checkbox, PasswordField, Sheet, TextField } from '@/components/ui';
import { EmailIcon, ErrorIcon, InstallIcon, LockIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { currentPlatform } from '@/lib/platform';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { isApiError } from '@/services/api/client';
import { authApi } from '@/services/api/endpoints';
import { haptic } from '@/lib/haptics';
import { THEME, useThemeColor } from '@/lib/themeColor';
import { useAuthT } from './i18n';

/**
 * Sign-in, the only way in (accounts come from the admin). A real <form> with autocomplete
 * hints, so password managers fill and save it. "Keep me signed in" is on by default: the
 * session then lasts a year on this device.
 */
export default function LoginPage() {
  const t = useAuthT();
  const { setUser } = useAuth();
  const [email, setEmail] = useState(() => storage.get(STORAGE_KEYS.lastEmail) ?? '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [shake, setShake] = useState(0);
  const [forgotOpen, setForgotOpen] = useState(false);
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
      haptic('error');
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
  const formError =
    login.error && !fields.email && !fields.password ? errorMessage(login.error) : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter-x mx-auto flex w-full max-w-md items-center justify-between pt-[calc(var(--safe-top)+1.25rem)] lg:max-w-6xl lg:pt-8">
        <Lockup />
        <LocaleSwitcher />
      </header>
      <main
        id="main"
        className="gutter-x mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--safe-bottom)+1.25rem)] lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-center lg:gap-20 lg:pb-12"
      >
        <div className="relative">
          <StarBurst className="pointer-events-none absolute -left-10 -top-12 hidden w-16 -rotate-12 animate-pop text-cyan-500 lg:block" />
          <h1 className="mt-8 text-center text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em] lg:mt-0 lg:text-left lg:text-[4.75rem] lg:font-extrabold lg:leading-[0.98] lg:tracking-[-0.045em]">
            <span className="text-lav-800">{t.welcome}</span>
            {t.welcomeRest}
            <Sticker
              className="ml-3 hidden -rotate-[8deg] bg-butter-300 align-[0.6em] lg:inline-block"
              delay={200}
            >
              {t.private}
            </Sticker>
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-center text-base font-medium text-lav-900 lg:mx-0 lg:mt-5 lg:max-w-md lg:text-left lg:text-lg">
            {t.signInLine}
          </p>
        </div>

        <form
          onSubmit={submit}
          noValidate
          className={cx('mt-7 flex flex-col gap-4 lg:mt-0', shake && 'animate-shake')}
          key={shake}
        >
          <div className="flex flex-col gap-4 rounded-[1.75rem] bg-white p-5 shadow-[0_20px_40px_-28px_rgb(42_43_102/0.6)]">
            {formError ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-2xl bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700"
              >
                <ErrorIcon fontSize="inherit" className="mt-0.5 shrink-0 text-base" />
                {formError}
              </p>
            ) : null}
            <TextField
              label={t.email}
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
              label={t.password}
              icon={LockIcon}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fields.password}
              autoFocus={Boolean(email)}
            />
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="press -mt-2 self-end rounded-pill px-2 py-1.5 text-sm font-semibold text-lav-800 underline-offset-4 hover:underline"
            >
              {t.forgot}
            </button>
            <Checkbox
              label={t.remember}
              hint={t.rememberHint}
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
            />
          </div>

          <div className="mt-auto flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={login.isPending}
              disabled={!email || !password}
            >
              {t.signIn}
            </Button>
            {!standalone ? (
              <ButtonLink to="/app" variant="outline" icon={InstallIcon} fullWidth>
                {t.addToHome}
              </ButtonLink>
            ) : null}
            <p className="px-2 text-center text-sm text-lav-900">{t.noAccount}</p>
          </div>
        </form>
        <Sheet
          open={forgotOpen}
          onClose={() => setForgotOpen(false)}
          title={t.forgotTitle}
          footer={
            <Button fullWidth onClick={() => setForgotOpen(false)}>
              {t.gotIt}
            </Button>
          }
        >
          <div className="flex flex-col gap-3 text-[0.9375rem] text-ink-700">
            <p>{t.forgotPrivate}</p>
            <p>{t.forgotAsk}</p>
          </div>
        </Sheet>
      </main>
    </div>
  );
}
