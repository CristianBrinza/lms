import { Navigate } from 'react-router';
import { homePathFor, useAuth } from '@/app/auth';
import { CardFan } from '@/components/brand/CardFan';
import { Lockup } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui';
import { InstallIcon, LockIcon } from '@/components/ui/icons';
import { currentPlatform, markLandingSeen } from '@/lib/platform';
import { THEME, useThemeColor } from '@/lib/themeColor';

/**
 * "/" — where a visitor starts. Signed-in people (and the installed app, which opens here) go
 * straight in. Everyone else chooses once, on the yellow app's onboarding screen: put LMS on the
 * Home Screen (the outlined "Skip" pill) or carry on in the browser (the black "Continue" pill).
 * The choice is remembered on this browser.
 */
export default function LandingPage() {
  const { user } = useAuth();
  useThemeColor(THEME.field);
  if (user) return <Navigate to={homePathFor(user)} replace />;
  if (currentPlatform().standalone) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter-x mx-auto flex w-full max-w-md items-center justify-between pt-[calc(var(--safe-top)+1.25rem)]">
        <Lockup />
        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white/55 px-3.5 text-xs font-semibold text-lav-900">
          <LockIcon fontSize="inherit" className="text-sm" />
          Private
        </span>
      </header>

      <main id="main" className="gutter-x mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--safe-bottom)+1.25rem)]">
        <h1 className="mt-10 text-center text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em]">
          Your life,
          <br />
          in one place.
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-center text-base font-medium text-lav-900">Training, food and every other area of life, for family and friends.</p>
        <div className="flex flex-1 items-center py-10">
          <CardFan />
        </div>
        <div className="flex flex-col gap-3">
          <ButtonLink to="/app" variant="outline" icon={InstallIcon} fullWidth onClick={markLandingSeen}>
            Install the app
          </ButtonLink>
          <ButtonLink to="/login" fullWidth onClick={markLandingSeen}>
            Continue in the browser
          </ButtonLink>
          <p className="px-2 text-center text-sm text-lav-900">The app opens full screen, stays signed in and updates by itself.</p>
        </div>
      </main>
    </div>
  );
}
