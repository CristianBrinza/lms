import { Navigate } from 'react-router';
import { homePathFor, useAuth } from '@/app/auth';
import { CurlyArrow, Flower, StarBurst } from '@/components/brand/Doodles';
import { Lockup } from '@/components/brand/Logo';
import { Sticker } from '@/components/brand/Sticker';
import { LocaleSwitcher } from '@/components/common/LocaleSwitcher';
import { QrCode } from '@/components/common/QrCode';
import { ButtonLink } from '@/components/ui';
import { InstallIcon, LockIcon } from '@/components/ui/icons';
import { currentPlatform, markLandingSeen } from '@/lib/platform';
import { THEME, useThemeColor } from '@/lib/themeColor';
import { useLandingT } from './i18n';

/**
 * "/" — where a visitor starts. Signed-in people (and the installed app, which opens here) go
 * straight in. Everyone else gets the learning app's onboarding block in LMS colours: a giant
 * headline with one word on a white strip, sticker pills stuck at angles, hand-drawn doodles,
 * and the two ways in at the bottom. The choice is remembered on this browser.
 */
export default function LandingPage() {
  const t = useLandingT();
  const h = t.headline;
  const { user } = useAuth();
  useThemeColor(THEME.field);
  if (user) return <Navigate to={homePathFor(user)} replace />;
  if (currentPlatform().standalone) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-dvh flex-col overflow-hidden">
      <header className="gutter-x mx-auto flex w-full max-w-md items-center justify-between pt-[calc(var(--safe-top)+1.25rem)] lg:max-w-6xl lg:pt-8">
        <Lockup />
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <span className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white/55 px-3.5 text-xs font-semibold text-lav-900 max-[23rem]:hidden">
            <LockIcon fontSize="inherit" className="text-sm" />
            {t.private}
          </span>
        </div>
      </header>

      <main
        id="main"
        className="gutter-x mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--safe-bottom)+1.25rem)] lg:grid lg:max-w-6xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-20 lg:pb-12"
      >
        <div className="relative flex flex-1 items-center py-8 lg:py-0">
          <Flower className="pointer-events-none absolute -right-4 top-2 w-28 rotate-12 animate-pop text-pink-400 [animation-delay:300ms] lg:right-6 lg:top-[8%] lg:w-32" />
          <StarBurst className="pointer-events-none absolute -left-5 bottom-0 w-16 -rotate-12 animate-pop text-cyan-500 [animation-delay:420ms] lg:-left-16 lg:bottom-auto lg:top-[40%]" />
          <h1 className="relative text-[3.25rem] font-extrabold leading-[0.98] tracking-[-0.045em] text-ink-900 sm:text-[3.75rem] lg:text-[5rem]">
            {h.train}
            <Sticker className="ml-3 -rotate-[10deg] bg-butter-300 align-[0.5em]" delay={200}>
              {h.trainSticker}
            </Sticker>
            <br />
            {h.eat}
            <Sticker className="ml-3 rotate-[8deg] bg-pink-200 align-[0.45em]" delay={280}>
              {h.eatSticker}
            </Sticker>
            <br />
            <span className="-ml-2 inline-block -rotate-1 bg-white px-2 pb-1">{h.live}</span>
            <br />
            <span className="text-lav-800">{h.allIn}</span>
            <Sticker
              className="ml-3 -rotate-[6deg] bg-ink-900 align-[0.5em] text-white"
              delay={360}
            >
              {h.familySticker}
            </Sticker>
            <br />
            <span className="text-lav-800">{h.onePlace}</span>
          </h1>
          <CurlyArrow className="pointer-events-none absolute -bottom-2 right-6 w-16 animate-pop text-ink-900 [animation-delay:520ms] lg:-right-10 lg:bottom-[22%] lg:w-20 lg:-rotate-[80deg]" />
        </div>

        <DesktopStart />

        <div className="flex flex-col gap-3 lg:hidden">
          <ButtonLink
            to="/app"
            variant="outline"
            icon={InstallIcon}
            fullWidth
            onClick={markLandingSeen}
          >
            {t.install}
          </ButtonLink>
          <ButtonLink to="/login" fullWidth onClick={markLandingSeen}>
            {t.browser}
          </ButtonLink>
          <p className="px-2 text-center text-sm text-lav-900">{t.appLine}</p>
        </div>
      </main>
    </div>
  );
}

/**
 * Desktop: the choice as a card beside the headline. Most people want LMS on their phone, so the
 * QR code that opens the install guide there is part of the choice, not an afterthought.
 */
function DesktopStart() {
  const t = useLandingT();
  const guide = typeof window === 'undefined' ? '/app' : `${window.location.origin}/app`;
  return (
    <aside
      className="hidden animate-rise flex-col rounded-[2rem] bg-white p-7 shadow-[var(--shadow-raised)] [animation-delay:200ms] lg:flex"
      aria-label={t.getStarted}
    >
      <h2 className="text-h2 font-bold">{t.how}</h2>
      <p className="mt-1.5 text-[0.9375rem] text-ink-600">{t.accounts}</p>
      <div className="mt-6 flex flex-col gap-3">
        <ButtonLink to="/login" fullWidth onClick={markLandingSeen}>
          {t.browser}
        </ButtonLink>
        <ButtonLink to="/app" variant="tint" icon={InstallIcon} fullWidth onClick={markLandingSeen}>
          {t.installHere}
        </ButtonLink>
      </div>
      <div className="mt-6 flex items-center gap-4 rounded-[1.5rem] bg-butter-300 p-4">
        <QrCode value={guide} label={t.qr} className="size-24 shrink-0 p-1.5" />
        <div>
          <p className="font-bold text-ink-900">{t.onPhone}</p>
          <p className="mt-1 text-sm leading-snug text-butter-800">{t.scan}</p>
        </div>
      </div>
    </aside>
  );
}
