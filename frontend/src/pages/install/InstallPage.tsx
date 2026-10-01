import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from '@/app/auth';
import { Lockup } from '@/components/brand/Logo';
import { QrCode } from '@/components/common/QrCode';
import { Button, ButtonLink, IconButton, toast } from '@/components/ui';
import {
  AndroidIcon,
  ArrowBackIcon,
  CheckCircleIcon,
  CheckIcon,
  ContentCopyIcon,
  ExpandMoreIcon,
  InfoIcon,
  InstallDesktopIcon,
  InstallIcon,
  LaptopIcon,
  PhoneIphoneIcon,
  type IconComponent,
} from '@/components/ui/icons';
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
    <div className="flex min-h-dvh flex-col">
      <header className="gutter-x mx-auto box-content flex h-16 w-full max-w-3xl items-center justify-between pt-[var(--safe-top)]">
        <IconButton icon={ArrowBackIcon} label="Back" onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate(user ? '/home' : '/', { replace: true }))} />
        <Lockup />
        <span className="size-12" aria-hidden="true" />
      </header>

      <section className="gutter-x mx-auto w-full max-w-3xl animate-page pt-5">
        <h1 className="text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem]">
          {installed ? (
            <>
              <span className="text-lav-800">LMS is on</span> this device.
            </>
          ) : (
            <>
              <span className="text-lav-800">Add LMS to</span> your Home Screen.
            </>
          )}
        </h1>
        <p className="mt-3 max-w-lg text-base font-medium text-lav-900">
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
                perksOpen ? 'bg-white text-ink-900' : 'text-lav-800 hover:bg-white/60 hover:text-ink-900',
              )}
            >
              <InfoIcon fontSize="inherit" />
            </button>
          ) : null}
        </p>
        {!installed ? (
          perksOpen ? (
            <ul id="install-perks" className="mt-4 flex flex-wrap gap-2 animate-rise">
              {PERKS.map((perk) => (
                <li key={perk} className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-3.5 text-sm font-semibold text-ink-800">
                  <CheckIcon fontSize="inherit" className="text-base text-ink-900" />
                  {perk}
                </li>
              ))}
            </ul>
          ) : (
            <p id="install-perks" className="mt-4 inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-ink-900">
              {GUIDE_BELOW[device]}
              <ExpandMoreIcon aria-hidden="true" fontSize="inherit" className="text-xl" />
            </p>
          )
        ) : null}

        {installed ? (
          <ButtonLink to={home} replace icon={CheckCircleIcon} className="mt-8">
            Continue here
          </ButtonLink>
        ) : (
          <DeviceTiles value={device} onChange={setDevice} />
        )}
      </section>

      {installed ? null : (
        <main
          id="main"
          key={device}
          className="mt-8 flex-1 rounded-t-[2rem] bg-white px-5 pb-[calc(var(--safe-bottom)+2.5rem)] pt-3 shadow-sheet sm:px-8 md:mx-auto md:mb-10 md:w-full md:max-w-3xl md:flex-none md:rounded-[2rem] md:pt-8"
        >
          <span aria-hidden="true" className="mx-auto block h-1.5 w-10 rounded-pill bg-ink-200 md:hidden" />
          <h2 className="mt-5 text-h2 font-bold md:mt-0">{SHEET_TITLE[device]}</h2>

          {platform.inApp ? (
            <div className="mt-5 rounded-[1.5rem] bg-ink-900 p-5 text-sm text-white/85 animate-rise">
              <p>
                You’re inside {IN_APP_NAMES[platform.inApp]}’s built-in browser, which can’t add apps. Open this page in Safari or Chrome: tap ⋯ and choose
                “Open in browser”, or copy the link.
              </p>
              <button
                type="button"
                onClick={() => void copy()}
                className="press mt-4 inline-flex h-10 items-center gap-2 rounded-pill bg-butter-300 px-4 text-sm font-semibold text-ink-900"
              >
                <ContentCopyIcon fontSize="inherit" className="text-base" />
                Copy link
              </button>
            </div>
          ) : null}

          {device === 'iphone' ? (
            <>
              <Timeline texts={IOS_STEPS} alts={IOS_ALTS} picture={(step, alt) => <Frame ratio="16 / 10"><IosArt step={step} alt={alt} /></Frame>} />
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
              <div className="mt-6 flex max-w-sm flex-col gap-3">
                <Button size="lg" icon={InstallIcon} fullWidth onClick={() => void install()}>
                  Install LMS
                </Button>
                <p className="text-sm text-ink-600">Your phone asks once to confirm. That’s it.</p>
              </div>
            ) : (
              <>
                <Timeline texts={ANDROID_STEPS} alts={ANDROID_ALTS} picture={(step, alt) => <Frame ratio="16 / 10"><AndroidArt step={step} alt={alt} /></Frame>} />
                <Notes lines={['Not there? Look for “Install app” or “Add to Home screen” in your browser’s menu.']} />
              </>
            )
          ) : null}

          {device === 'computer' ? (
            <div className="mt-6 grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-8">
              <div className="flex flex-col items-center rounded-[1.75rem] bg-butter-300 p-5 text-center">
                <QrCode value={appUrl} label="QR code to open this guide on your phone" className="size-44 p-2" />
                <h3 className="mt-3 font-bold">Scan with your phone</h3>
                <p className="mt-1 max-w-56 text-sm text-butter-800">Opens this guide on the phone, ready to add LMS to its Home Screen.</p>
              </div>
              <div className="flex flex-col gap-3">
                {canPrompt && detected === 'computer' ? (
                  <Button size="md" icon={InstallDesktopIcon} className="self-start" onClick={() => void install()}>
                    Install on this computer
                  </Button>
                ) : (
                  <>
                    <Frame ratio="16 / 7">
                      <DesktopArt alt="A browser address bar with the install icon circled at its right end." />
                    </Frame>
                    <p className="text-[0.9375rem] font-semibold leading-snug">Or install it here: in Chrome or Edge, click the install icon at the right end of the address bar.</p>
                    <Notes lines={['No icon? In Chrome: ⋮ → “Cast, save, and share” → “Install page as app”. In Safari on a Mac: File → “Add to Dock”.']} />
                  </>
                )}
              </div>
            </div>
          ) : null}
        </main>
      )}
    </div>
  );
}

const SHEET_TITLE: Record<Device, string> = {
  iphone: 'On your iPhone',
  android: 'On your Android phone',
  computer: 'On a computer',
};

const DEVICES: Array<{ value: Device; label: string; icon: IconComponent }> = [
  { value: 'iphone', label: 'iPhone', icon: PhoneIphoneIcon },
  { value: 'android', label: 'Android', icon: AndroidIcon },
  { value: 'computer', label: 'Computer', icon: LaptopIcon },
];

/** Which device the steps are for, as three tiles like the dashboard's: the chosen one goes dark. */
function DeviceTiles({ value, onChange }: { value: Device; onChange: (device: Device) => void }) {
  return (
    <div role="radiogroup" aria-label="Your device" className="mt-7 grid grid-cols-3 gap-3 sm:max-w-md">
      {DEVICES.map(({ value: option, label, icon: Icon }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            className={cx(
              'press relative flex h-28 flex-col justify-between rounded-[1.5rem] p-3.5 text-left transition-colors duration-200',
              active ? 'bg-ink-900 text-white' : 'bg-white text-ink-900 hover:bg-lav-50',
            )}
          >
            <Icon fontSize="inherit" className="text-[1.5rem]" />
            <span className="text-[0.9375rem] font-semibold">{label}</span>
            {active ? <span aria-hidden="true" className="absolute right-3.5 top-3.5 size-2.5 rounded-full bg-butter-300 animate-pop" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** The steps as a numbered path: butter numbers joined by a dashed line, each with a drawing of what you'll see. */
function Timeline({ texts, alts, picture }: { texts: string[]; alts: string[]; picture: (step: number, alt: string) => ReactNode }) {
  return (
    <ol className="mt-6 flex max-w-2xl flex-col">
      {texts.map((text, index) => (
        <li key={text} className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3.5 pb-8 last:pb-0 animate-rise" style={{ animationDelay: `${index * 60}ms` }}>
          {index < texts.length - 1 ? (
            <span aria-hidden="true" className="absolute bottom-1.5 left-[1.25rem] top-12 border-l-2 border-dashed border-ink-200" />
          ) : null}
          <span className="tabular relative flex size-10 items-center justify-center rounded-full bg-butter-300 text-[0.9375rem] font-bold text-ink-900">{index + 1}</span>
          <div className="min-w-0 pt-2">
            <p className="text-[0.9375rem] font-semibold leading-snug">{text}</p>
            <div className="mt-3 max-w-md">{picture(index, alts[index] ?? '')}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Fixed-ratio frame for a step drawing; one still loading leaves the same box. */
function Frame({ ratio, children }: { ratio: string; children: ReactNode }) {
  return (
    <figure className="@container relative w-full overflow-hidden rounded-[1.25rem] bg-lav-50 ring-1 ring-inset ring-ink-100" style={{ aspectRatio: ratio }}>
      <Suspense fallback={null}>{children}</Suspense>
    </figure>
  );
}

function Notes({ lines }: { lines: string[] }) {
  return (
    <div className="mt-6 flex max-w-2xl flex-col gap-2">
      {lines.map((line) => (
        <p key={line} className="flex items-start gap-2.5 rounded-[1.125rem] bg-ink-50 p-4 text-sm text-ink-700">
          <InfoIcon fontSize="inherit" className="mt-0.5 shrink-0 text-base text-ink-500" />
          {line}
        </p>
      ))}
    </div>
  );
}
