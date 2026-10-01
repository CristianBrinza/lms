import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/app/auth';
import { LogoTile, Lockup } from '@/components/brand/Logo';
import { QrCode } from '@/components/common/QrCode';
import { Button, ButtonLink, Chips, IconButton, toast } from '@/components/ui';
import { ArrowBackIcon, CheckCircleIcon, CheckIcon, ContentCopyIcon, ExpandMoreIcon, InfoIcon, InstallDesktopIcon, InstallIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { currentPlatform } from '@/lib/platform';
import { useInstallPrompt } from '@/lib/pwa';
import { THEME, useThemeColor } from '@/lib/themeColor';

// Drawings load only with their device's steps.
const IosArt = lazy(() => import('./IosArt'));
const AndroidArt = lazy(() => import('./AndroidArt'));
const DesktopArt = lazy(() => import('./DesktopArt'));

type Device = 'iphone' | 'android' | 'computer';

const IN_APP_NAMES = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', telegram: 'Telegram', other: 'this app' } as const;

const IOS_STEPS = [
  'In Safari, tap ⋯ at the bottom right.',
  'Tap “Share”.',
  'Scroll down and tap “Add to Home Screen” (under “View More” on some iPhones).',
  'Leave “Open as Web App” on and tap “Add”.',
  'Open LMS from your Home Screen, like any app.',
];
const IOS_ALTS = [
  'Safari’s bottom bar with the ⋯ button circled at the right.',
  'Safari’s ⋯ menu with “Share” circled.',
  'The share sheet with “Add to Home Screen” circled.',
  'The “Add to Home Screen” screen with “Open as Web App” on and “Add” circled.',
  'The LMS icon on the Home Screen, circled.',
];
const ANDROID_STEPS = [
  'In Chrome, tap ⋮ at the top right, then “Install app” (or “Add to Home screen”).',
  'Choose “Install”.',
  'Confirm with “Install”.',
  'Open LMS from your home screen or app list.',
];
const ANDROID_ALTS = [
  'Chrome with the ⋮ button circled and its menu open at “Install app”.',
  'The install panel with “Install” circled.',
  'The install dialog with “Install” circled.',
  'The LMS icon on the home screen, circled.',
];
const PERKS = ['Opens in one\u00a0tap', 'Full screen, no browser bars', 'Stays signed in', 'Updates by itself'];
const GUIDE_BELOW: Record<Device, string> = {
  iphone: 'See the guide for iPhone\u00a0below',
  android: 'See the guide for Android\u00a0below',
  computer: 'See the guide for your computer\u00a0below',
};

/**
 * /app: how to put LMS on the Home Screen. Detects the device and in-app browsers, uses the real
 * install prompt where the browser offers one, and gives computers a QR code to continue on the
 * phone. Every device's steps stay one tap away.
 */
export default function InstallPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const platform = currentPlatform();
  const { canPrompt, installed, prompt } = useInstallPrompt();
  const detected: Device = platform.os === 'ios' || platform.os === 'ipados' ? 'iphone' : platform.os === 'android' ? 'android' : 'computer';
  const [device, setDevice] = useState<Device>(detected);
  // What the app gives, behind the ⓘ; the guide below comes first.
  const [perksOpen, setPerksOpen] = useState(false);
  const appUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/app`;
  const home = user ? '/home' : '/login';
  useThemeColor(THEME.field);

  // Opened from the Home Screen icon: this already is the app.
  if (platform.standalone) return <Navigate to={home} replace />;

  const install = async () => {
    if ((await prompt()) === 'accepted') toast.success('LMS is installed', { description: 'Open it from your Home Screen or app list.' });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy. Press and hold the address bar instead.');
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="gutter-x mx-auto flex h-16 max-w-3xl items-center justify-between pt-[var(--safe-top)] box-content">
        <IconButton icon={ArrowBackIcon} label="Back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(user ? '/home' : '/', { replace: true }))} />
        <Lockup />
        <span className="size-12" aria-hidden="true" />
      </header>

      <main id="main" className="gutter-x mx-auto max-w-3xl pb-[calc(var(--safe-bottom)+2.5rem)] pt-4 animate-page">
        <div className="flex flex-col items-center text-center">
          <LogoTile className="size-24" />
          <h1 className="mt-6 text-h1 font-bold sm:text-[2.5rem]">{installed ? 'LMS is on this device' : 'Add LMS to your Home Screen'}</h1>
          <p className="mt-3 max-w-md text-base font-medium text-lav-900">
            {installed ? 'Open it from your Home Screen or app list.' : 'The app opens full screen with one tap, like any app. No store, nothing to download, always up to date.'}
            {!installed ? (
              <button
                type="button"
                aria-expanded={perksOpen}
                aria-controls="install-perks"
                aria-label="What the app gives you"
                title="What the app gives you"
                onClick={() => setPerksOpen((open) => !open)}
                className={cx(
                  'press -my-2 ml-1 inline-flex size-10 items-center justify-center rounded-full align-middle text-[1.3rem] transition-colors duration-150',
                  perksOpen ? 'bg-white text-ink-900 shadow-card' : 'text-lav-800 hover:bg-white/60 hover:text-ink-900',
                )}
              >
                <InfoIcon fontSize="inherit" />
              </button>
            ) : null}
          </p>
          {!installed ? (
            perksOpen ? (
              <ul id="install-perks" className="mt-4 flex flex-wrap justify-center gap-2 animate-rise">
                {PERKS.map((perk) => (
                  <li key={perk} className="inline-flex items-center gap-1.5 rounded-pill bg-white/60 px-3.5 py-2 text-sm font-medium text-ink-800">
                    <CheckIcon fontSize="inherit" className="text-base text-lav-700" />
                    {perk}
                  </li>
                ))}
              </ul>
            ) : (
              <p id="install-perks" className="mt-4 inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-ink-800">
                {GUIDE_BELOW[device]}
                <ExpandMoreIcon aria-hidden="true" fontSize="inherit" className="text-xl" />
              </p>
            )
          ) : null}
        </div>

        {installed ? (
          <div className="mt-8 flex justify-center">
            <ButtonLink to={home} replace icon={CheckCircleIcon}>
              Continue here
            </ButtonLink>
          </div>
        ) : (
          <>
            {platform.inApp ? (
              <div className="mx-auto mt-8 max-w-md rounded-3xl bg-ink-900 p-5 text-sm text-white/85 animate-rise">
                <p>
                  You’re inside {IN_APP_NAMES[platform.inApp]}’s built-in browser, which can’t add apps. Open this page in Safari or Chrome: tap ⋯ and choose
                  “Open in browser”, or copy the link.
                </p>
                <Button size="sm" variant="soft" icon={ContentCopyIcon} className="mt-4" onClick={() => void copy()}>
                  Copy link
                </Button>
              </div>
            ) : null}

            <div className="mt-8 flex justify-center">
              <Chips<Device>
                label="Your device"
                value={device}
                onChange={setDevice}
                options={[
                  { value: 'iphone', label: 'iPhone' },
                  { value: 'android', label: 'Android' },
                  { value: 'computer', label: 'Computer' },
                ]}
              />
            </div>

            <section key={device} className="mt-6 animate-page" aria-labelledby="steps-title">
              <h2 id="steps-title" className="sr-only">
                Steps
              </h2>

              {device === 'iphone' ? (
                <>
                  <Steps texts={IOS_STEPS} alts={IOS_ALTS} picture={(step, alt) => <Frame ratio="16 / 10"><IosArt step={step} alt={alt} /></Frame>} />
                  <Notes
                    lines={[
                      'Is the Share button right in Safari’s toolbar (iOS 18 or earlier, or an iPad)? Tap it and carry on from step 3.',
                      'Chrome on iPhone: tap Share on the right of the address bar, then “Add to Home Screen” and “Add”.',
                    ]}
                  />
                </>
              ) : null}

              {device === 'android' ? (
                canPrompt && detected === 'android' ? (
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                    <Button size="lg" icon={InstallIcon} fullWidth onClick={() => void install()}>
                      Install LMS
                    </Button>
                    <p className="text-center text-sm text-lav-900">Your phone asks once to confirm. That’s it.</p>
                  </div>
                ) : (
                  <>
                    <Steps texts={ANDROID_STEPS} alts={ANDROID_ALTS} picture={(step, alt) => <Frame ratio="16 / 10"><AndroidArt step={step} alt={alt} /></Frame>} />
                    <Notes lines={['Not there? Look for “Install app” or “Add to Home screen” in your browser’s menu.']} />
                  </>
                )
              ) : null}

              {device === 'computer' ? (
                <div className="flex flex-col items-center gap-6 rounded-3xl bg-white p-6 shadow-card md:flex-row md:items-start md:justify-center md:gap-10 md:p-8">
                  <div className="flex flex-col items-center text-center">
                    <QrCode value={appUrl} label="QR code to open this guide on your phone" className="size-48 p-2 ring-1 ring-ink-100" />
                    <h3 className="mt-3 font-bold">Scan with your phone</h3>
                    <p className="mt-1 max-w-64 text-sm text-ink-600">Opens this guide on the phone, ready to add LMS to its Home Screen.</p>
                  </div>
                  <div className="flex w-full max-w-sm flex-col items-center gap-3 text-center md:items-start md:pt-2 md:text-left">
                    {canPrompt && detected === 'computer' ? (
                      <Button size="md" icon={InstallDesktopIcon} onClick={() => void install()}>
                        Install on this computer
                      </Button>
                    ) : (
                      <>
                        <Frame ratio="16 / 7">
                          <DesktopArt alt="A browser address bar with the install icon circled at its right end." />
                        </Frame>
                        <p className="text-[0.9375rem] leading-snug">In Chrome or Edge, click the install icon at the right end of the address bar.</p>
                        <p className="text-sm text-ink-600">No icon? In Chrome: ⋮ → “Cast, save, and share” → “Install page as app”. In Safari on a Mac: File → “Add to Dock”.</p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

/** Numbered steps, each with a drawing of what the visitor will see: under the text on phones, beside it from sm up. */
function Steps({ texts, alts, picture }: { texts: string[]; alts: string[]; picture: (step: number, alt: string) => ReactNode }) {
  return (
    <ol className="mx-auto flex max-w-md flex-col gap-3 sm:max-w-2xl">
      {texts.map((text, index) => (
        <li
          key={text}
          className="animate-rise rounded-3xl bg-white p-3 shadow-card sm:grid sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:items-center sm:gap-5 sm:p-4"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <div className="flex items-start gap-3">
            <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-bold text-white">{index + 1}</span>
            <p className="min-w-0 flex-1 pt-1 text-[0.9375rem] font-medium leading-snug">{text}</p>
          </div>
          <div className="mt-3 sm:mt-0">{picture(index, alts[index] ?? '')}</div>
        </li>
      ))}
    </ol>
  );
}

/** Fixed-ratio frame for a step picture; a drawing still loading leaves the same box. */
function Frame({ ratio, children }: { ratio: string; children: ReactNode }) {
  return (
    <figure className="@container relative mx-auto w-full overflow-hidden rounded-2xl bg-ink-50 ring-1 ring-ink-100" style={{ aspectRatio: ratio }}>
      <Suspense fallback={null}>{children}</Suspense>
    </figure>
  );
}

function Notes({ lines }: { lines: string[] }) {
  return (
    <div className="mx-auto mt-4 flex max-w-md flex-col gap-2 text-center text-sm font-medium text-lav-900 sm:max-w-xl">
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}
