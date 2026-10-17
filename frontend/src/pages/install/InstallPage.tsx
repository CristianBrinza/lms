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
import { uiT } from '@/components/i18n';
import { useInstallT } from './i18n';

// Drawings load only with their device's steps.
const IosArt = lazy(() => import('./IosArt'));
const AndroidArt = lazy(() => import('./AndroidArt'));
const DesktopArt = lazy(() => import('./DesktopArt'));

type Device = 'iphone' | 'android' | 'computer';

const IN_APP_NAMES = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  telegram: 'Telegram',
  other: null,
} as const;

/**
 * /app: how to put LMS on the Home Screen. Detects the device and in-app browsers, uses the real
 * install prompt where the browser offers one, and gives computers a QR code to continue on the
 * phone. Every device's steps stay one tap away.
 */
export default function InstallPage() {
  const t = useInstallT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const platform = currentPlatform();
  const { canPrompt, installed, prompt } = useInstallPrompt();
  const detected: Device =
    platform.os === 'ios' || platform.os === 'ipados'
      ? 'iphone'
      : platform.os === 'android'
        ? 'android'
        : 'computer';
  const [device, setDevice] = useState<Device>(detected);
  // What the app gives, behind the ⓘ; the guide below comes first.
  const [perksOpen, setPerksOpen] = useState(false);
  const appUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/app`;
  const home = user ? '/home' : '/login';
  useThemeColor(THEME.field);

  // Opened from the Home Screen icon: this already is the app.
  if (platform.standalone) return <Navigate to={home} replace />;

  const install = async () => {
    if ((await prompt()) === 'accepted')
      toast.success(t.installedToast, {
        description: t.openFromHome,
      });
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      toast.success(t.linkCopied);
    } catch {
      toast.error(t.copyFailed);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="gutter-x mx-auto box-content flex h-16 w-full max-w-3xl items-center justify-between pt-[var(--safe-top)] lg:max-w-5xl lg:pt-4">
        <IconButton
          icon={ArrowBackIcon}
          label={uiT().back}
          onClick={() =>
            window.history.state?.idx > 0
              ? navigate(-1)
              : navigate(user ? '/home' : '/', { replace: true })
          }
        />
        <Lockup />
        <span className="size-12" aria-hidden="true" />
      </header>

      <section className="gutter-x mx-auto w-full max-w-3xl animate-page pt-5 lg:max-w-5xl">
        <h1 className="text-[2.25rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.75rem]">
          {installed ? (
            <>
              <span className="text-lav-800">{t.titleInstalled[0]}</span>
              {t.titleInstalled[1]}
            </>
          ) : (
            <>
              <span className="text-lav-800">{t.titleAdd[0]}</span>
              {t.titleAdd[1]}
            </>
          )}
        </h1>
        <p className="mt-3 max-w-lg text-base font-medium text-lav-900">
          {installed ? t.openFromHome : t.intro}
          {!installed ? (
            <button
              type="button"
              aria-expanded={perksOpen}
              aria-controls="install-perks"
              aria-label={t.perksLabel}
              title={t.perksLabel}
              onClick={() => setPerksOpen((open) => !open)}
              className={cx(
                'press -my-2 ml-1 inline-flex size-10 items-center justify-center rounded-full align-middle text-[1.3rem] transition-colors duration-150',
                perksOpen
                  ? 'bg-white text-ink-900'
                  : 'text-lav-800 hover:bg-white/60 hover:text-ink-900',
              )}
            >
              <InfoIcon fontSize="inherit" />
            </button>
          ) : null}
        </p>
        {!installed ? (
          perksOpen ? (
            <ul id="install-perks" className="mt-4 flex flex-wrap gap-2 animate-rise">
              {t.perks.map((perk) => (
                <li
                  key={perk}
                  className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-white px-3.5 text-sm font-semibold text-ink-800"
                >
                  <CheckIcon fontSize="inherit" className="text-base text-ink-900" />
                  {perk}
                </li>
              ))}
            </ul>
          ) : (
            <p
              id="install-perks"
              className="mt-4 inline-flex items-center gap-1 text-[0.9375rem] font-semibold text-ink-900"
            >
              {t.guideBelow[device]}
              <ExpandMoreIcon aria-hidden="true" fontSize="inherit" className="text-xl" />
            </p>
          )
        ) : null}

        {installed ? (
          <ButtonLink to={home} replace icon={CheckCircleIcon} className="mt-8">
            {t.continueHere}
          </ButtonLink>
        ) : (
          <DeviceTiles value={device} onChange={setDevice} />
        )}
      </section>

      {installed ? null : (
        <main
          id="main"
          key={device}
          className="mt-8 flex-1 rounded-t-[2rem] bg-white px-5 pb-[calc(var(--safe-bottom)+2.5rem)] pt-3 shadow-sheet sm:px-8 md:mx-auto md:mb-10 md:w-full md:max-w-3xl md:flex-none md:rounded-[2rem] md:pt-8 lg:max-w-5xl lg:p-10"
        >
          <span
            aria-hidden="true"
            className="mx-auto block h-1.5 w-10 rounded-pill bg-ink-200 md:hidden"
          />
          <h2 className="mt-5 text-h2 font-bold md:mt-0">{t.sheetTitle[device]}</h2>

          {platform.inApp ? (
            <div className="mt-5 rounded-[1.5rem] bg-ink-900 p-5 text-sm text-white/85 animate-rise">
              <p>{t.inApp(IN_APP_NAMES[platform.inApp])}</p>
              <button
                type="button"
                onClick={() => void copy()}
                className="press mt-4 inline-flex h-10 items-center gap-2 rounded-pill bg-butter-300 px-4 text-sm font-semibold text-ink-900"
              >
                <ContentCopyIcon fontSize="inherit" className="text-base" />
                {t.copyLink}
              </button>
            </div>
          ) : null}

          {device === 'iphone' ? (
            <>
              <Timeline
                texts={t.iosSteps}
                alts={t.iosAlts}
                picture={(step, alt) => (
                  <Frame ratio="16 / 10">
                    <IosArt step={step} alt={alt} />
                  </Frame>
                )}
              />
              <Notes lines={t.iosNotes} />
            </>
          ) : null}

          {device === 'android' ? (
            canPrompt && detected === 'android' ? (
              <div className="mt-6 flex max-w-sm flex-col gap-3">
                <Button size="lg" icon={InstallIcon} fullWidth onClick={() => void install()}>
                  {t.installLms}
                </Button>
                <p className="text-sm text-ink-600">{t.confirmOnce}</p>
              </div>
            ) : (
              <>
                <Timeline
                  texts={t.androidSteps}
                  alts={t.androidAlts}
                  picture={(step, alt) => (
                    <Frame ratio="16 / 10">
                      <AndroidArt step={step} alt={alt} />
                    </Frame>
                  )}
                />
                <Notes lines={t.androidNotes} />
              </>
            )
          ) : null}

          {device === 'computer' ? (
            <div className="mt-6 grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:gap-8">
              <div className="flex flex-col items-center rounded-[1.75rem] bg-butter-300 p-5 text-center">
                <QrCode value={appUrl} label={t.qr} className="size-44 p-2" />
                <h3 className="mt-3 font-bold">{t.scan}</h3>
                <p className="mt-1 max-w-56 text-sm text-butter-800">{t.scanLine}</p>
              </div>
              <div className="flex flex-col gap-3">
                {canPrompt && detected === 'computer' ? (
                  <Button
                    size="md"
                    icon={InstallDesktopIcon}
                    className="self-start"
                    onClick={() => void install()}
                  >
                    {t.installComputer}
                  </Button>
                ) : (
                  <>
                    <Frame ratio="16 / 7">
                      <DesktopArt alt={t.desktopAlt} />
                    </Frame>
                    <p className="text-[0.9375rem] font-semibold leading-snug">{t.desktopLine}</p>
                    <Notes lines={t.desktopNotes} />
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

const DEVICES: Array<{ value: Device; icon: IconComponent }> = [
  { value: 'iphone', icon: PhoneIphoneIcon },
  { value: 'android', icon: AndroidIcon },
  { value: 'computer', icon: LaptopIcon },
];

/** Which device the steps are for, as three tiles like the dashboard's: the chosen one goes dark. */
function DeviceTiles({ value, onChange }: { value: Device; onChange: (device: Device) => void }) {
  const t = useInstallT();
  return (
    <div
      role="radiogroup"
      aria-label={t.yourDevice}
      className="mt-7 grid grid-cols-3 gap-3 sm:max-w-md"
    >
      {DEVICES.map(({ value: option, icon: Icon }) => {
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
            <span className="min-w-0 hyphens-auto break-words text-[0.9375rem] font-semibold">
              {t.devices[option]}
            </span>
            {active ? (
              <span
                aria-hidden="true"
                className="absolute right-3.5 top-3.5 size-2.5 rounded-full bg-butter-300 animate-pop"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** The steps as a numbered path: butter numbers joined by a dashed line, each with a drawing of what you'll see. */
function Timeline({
  texts,
  alts,
  picture,
}: {
  texts: string[];
  alts: string[];
  picture: (step: number, alt: string) => ReactNode;
}) {
  return (
    <ol className="mt-6 flex max-w-2xl flex-col lg:max-w-none">
      {texts.map((text, index) => (
        <li
          key={text}
          className="relative grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3.5 pb-8 last:pb-0 animate-rise"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          {index < texts.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute bottom-1.5 left-[1.25rem] top-12 border-l-2 border-dashed border-ink-200"
            />
          ) : null}
          <span className="tabular relative flex size-10 items-center justify-center rounded-full bg-butter-300 text-[0.9375rem] font-bold text-ink-900">
            {index + 1}
          </span>
          <div className="min-w-0 pt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start lg:gap-8">
            <p className="text-[0.9375rem] font-semibold leading-snug lg:text-base">{text}</p>
            <div className="mt-3 max-w-md lg:mt-0">{picture(index, alts[index] ?? '')}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Fixed-ratio frame for a step drawing; one still loading leaves the same box. */
function Frame({ ratio, children }: { ratio: string; children: ReactNode }) {
  return (
    <figure
      className="@container relative w-full overflow-hidden rounded-[1.25rem] bg-lav-50 ring-1 ring-inset ring-ink-100"
      style={{ aspectRatio: ratio }}
    >
      <Suspense fallback={null}>{children}</Suspense>
    </figure>
  );
}

function Notes({ lines }: { lines: string[] }) {
  return (
    <div className="mt-6 flex max-w-2xl flex-col gap-2">
      {lines.map((line) => (
        <p
          key={line}
          className="flex items-start gap-2.5 rounded-[1.125rem] bg-ink-50 p-4 text-sm text-ink-700"
        >
          <InfoIcon fontSize="inherit" className="mt-0.5 shrink-0 text-base text-ink-500" />
          {line}
        </p>
      ))}
    </div>
  );
}
