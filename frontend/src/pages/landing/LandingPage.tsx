import type { CSSProperties, ReactNode } from 'react';
import { Navigate } from 'react-router';
import { homePathFor, useAuth } from '@/app/auth';
import { CurlyArrow, Flower, StarBurst } from '@/components/brand/Doodles';
import { Lockup } from '@/components/brand/Logo';
import { ButtonLink } from '@/components/ui';
import { InstallIcon, LockIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { currentPlatform, markLandingSeen } from '@/lib/platform';
import { THEME, useThemeColor } from '@/lib/themeColor';

/**
 * "/" — where a visitor starts. Signed-in people (and the installed app, which opens here) go
 * straight in. Everyone else gets the learning app's onboarding block in LMS colours: a giant
 * headline with one word on a white strip, sticker pills stuck at angles, hand-drawn doodles,
 * and the two ways in at the bottom. The choice is remembered on this browser.
 */
export default function LandingPage() {
  const { user } = useAuth();
  useThemeColor(THEME.field);
  if (user) return <Navigate to={homePathFor(user)} replace />;
  if (currentPlatform().standalone) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden">
      <header className="gutter-x mx-auto flex w-full max-w-md items-center justify-between pt-[calc(var(--safe-top)+1.25rem)] lg:max-w-5xl">
        <Lockup />
        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white/55 px-3.5 text-xs font-semibold text-lav-900">
          <LockIcon fontSize="inherit" className="text-sm" />
          Private
        </span>
      </header>

      <main id="main" className="gutter-x mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--safe-bottom)+1.25rem)] lg:max-w-5xl lg:flex-row lg:items-center lg:gap-16">
        <div className="relative flex flex-1 items-center py-8 lg:py-0">
          <Flower className="pointer-events-none absolute -right-4 top-2 w-28 rotate-12 animate-pop text-pink-400 [animation-delay:300ms] lg:right-10" />
          <StarBurst className="pointer-events-none absolute -left-5 bottom-0 w-16 -rotate-12 animate-pop text-cyan-500 [animation-delay:420ms]" />
          <h1 className="relative text-[3.25rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-ink-900 sm:text-[3.75rem] lg:text-[5rem]">
            Train,
            <Sticker className="ml-3 -rotate-[10deg] bg-butter-300 align-[0.5em]" delay={200}>
              Training
            </Sticker>
            <br />
            eat,
            <Sticker className="ml-3 rotate-[8deg] bg-pink-200 align-[0.45em]" delay={280}>
              Food
            </Sticker>
            <br />
            <span className="-ml-2 inline-block -rotate-1 bg-white px-2 pb-1">live.</span>
            <br />
            <span className="text-lav-800">All in</span>
            <Sticker className="ml-3 -rotate-[6deg] bg-ink-900 align-[0.5em] text-white" delay={360}>
              Family
            </Sticker>
            <br />
            <span className="text-lav-800">one place.</span>
          </h1>
          <CurlyArrow className="pointer-events-none absolute -bottom-2 right-6 w-16 animate-pop text-ink-900 [animation-delay:520ms] lg:hidden" />
        </div>

        <div className="flex flex-col gap-3 lg:w-96">
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

/** A label pill stuck on at an angle, like the reference's "Design" and "Marketing" stickers. */
function Sticker({ children, className, delay }: { children: ReactNode; className?: string; delay: number }) {
  const style: CSSProperties = { animationDelay: `${delay}ms` };
  return (
    <span
      aria-hidden="true"
      style={style}
      className={cx(
        'inline-block animate-pop rounded-pill px-3.5 py-1.5 text-[0.9375rem] font-semibold leading-none tracking-normal text-ink-900 shadow-[0_8px_16px_-10px_rgb(29_29_36/0.45)] sm:text-base',
        className,
      )}
    >
      {children}
    </span>
  );
}
