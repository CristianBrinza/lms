import { AddBoxIcon, IosShareIcon, LockIcon, MoreHorizIcon } from '@/components/ui/icons';
import { LogoTile } from '@/components/brand/Logo';
import { cx } from '@/lib/cx';
import { mark } from './highlight';
import { useInstallT } from './i18n';
import { Dimmed, HomeScene, MenuLine, PageLines } from './parts';

/**
 * Safari on iPhone (iOS 26), drawn: simplified scenes of each step with the real button labels
 * and our mark on what to tap. Loaded only when the iPhone steps are shown.
 */
export default function IosArt({ step, alt }: { step: number; alt: string }) {
  const scene = [
    <BarScene key="bar" />,
    <MenuScene key="menu" />,
    <ShareScene key="share" />,
    <ConfirmScene key="confirm" />,
    <HomeScene key="home" step={4} />,
  ][step];
  return (
    <div role="img" aria-label={alt} className="size-full text-[3.4cqw] leading-tight text-ink-900">
      <div aria-hidden="true" className="relative size-full overflow-hidden">
        {scene}
      </div>
    </div>
  );
}

/** Safari's bottom bar: back, the address pill, and ⋯ at the right. */
function BottomBar({ step, markMore }: { step: number; markMore?: boolean }) {
  const m = mark(step);
  return (
    <div className="absolute inset-x-[4%] bottom-[7%] flex items-center gap-[0.6em]">
      <span className="grid size-[2.6em] place-items-center rounded-full bg-white/90 shadow-card">
        <span className="h-[0.5em] w-[0.9em] rounded-pill bg-ink-300" />
      </span>
      <span className="flex h-[2.6em] flex-1 items-center justify-center gap-[0.4em] rounded-pill bg-white/90 text-[0.9em] font-semibold shadow-card">
        <LockIcon fontSize="inherit" className="text-ink-500" />
        lms
      </span>
      <span
        className={cx(
          'grid size-[2.6em] place-items-center rounded-full bg-white/90 text-[1.15em] shadow-card',
          markMore && m.className,
        )}
        style={markMore ? m.style : undefined}
      >
        <MoreHorizIcon fontSize="inherit" />
      </span>
    </div>
  );
}

function BarScene() {
  return (
    <div className="size-full bg-lav-100">
      <PageLines />
      <BottomBar step={0} markMore />
    </div>
  );
}

function MenuScene() {
  const t = useInstallT().ios;
  const m = mark(1);
  return (
    <div className="size-full bg-lav-100">
      <PageLines className="opacity-60" />
      <div className="absolute bottom-[22%] right-[4%] w-[58%] rounded-[1.1em] bg-white/95 p-[0.35em] shadow-raised">
        <div
          className={cx(
            'flex items-center justify-between rounded-[0.8em] px-[0.8em] py-[0.6em] font-semibold',
            m.className,
          )}
          style={m.style}
        >
          <span className="min-w-0 truncate">{t.share}</span>
          <IosShareIcon fontSize="inherit" className="text-[1.2em]" />
        </div>
        <MenuLine width="60%" />
        <MenuLine width="48%" />
        <MenuLine width="54%" />
      </div>
      <BottomBar step={1} />
    </div>
  );
}

function ShareScene() {
  const t = useInstallT().ios;
  const m = mark(2);
  return (
    <Dimmed>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[1.4em] bg-ink-50 px-[4%] pb-[5%] pt-[0.6em] shadow-sheet">
        <span className="mx-auto mb-[0.8em] block h-[0.3em] w-[2.6em] rounded-pill bg-ink-300" />
        <div className="flex items-center gap-[0.7em] rounded-[1em] bg-white px-[0.8em] py-[0.6em]">
          <LogoTile className="w-[2.2em] shadow-none" label={null} />
          <span className="font-semibold">LMS</span>
        </div>
        <div className="mt-[0.6em] overflow-hidden rounded-[1em] bg-white">
          <MenuLine width="44%" />
          <div
            className={cx(
              'flex items-center justify-between px-[0.8em] py-[0.65em] font-semibold',
              m.className,
            )}
            style={m.style}
          >
            <span className="min-w-0 truncate">{t.addToHome}</span>
            <AddBoxIcon fontSize="inherit" className="text-[1.25em]" />
          </div>
          <MenuLine width="52%" />
        </div>
      </div>
    </Dimmed>
  );
}

function ConfirmScene() {
  const t = useInstallT().ios;
  const m = mark(3);
  return (
    <div className="size-full bg-ink-50 px-[5%] pt-[4%]">
      <div className="flex items-center justify-between font-semibold">
        <span className="shrink-0 text-ink-500">{t.cancel}</span>
        <span className="min-w-0 truncate px-[0.4em] text-[0.95em]">{t.addToHome}</span>
        <span
          className={cx(
            'shrink-0 rounded-pill bg-lav-600 px-[0.9em] py-[0.3em] text-white',
            m.className,
          )}
          style={m.style}
        >
          {t.add}
        </span>
      </div>
      <div className="mt-[1.2em] flex items-center gap-[0.8em] rounded-[1em] bg-white p-[0.8em]">
        <LogoTile className="w-[3em] shadow-none" label={null} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">LMS</p>
          <span className="mt-[0.4em] block h-[0.45em] w-[60%] rounded-pill bg-ink-200" />
        </div>
      </div>
      <div className="mt-[0.8em] flex items-center justify-between rounded-[1em] bg-white px-[0.9em] py-[0.7em] font-medium">
        <span className="min-w-0 truncate">{t.openAsWebApp}</span>
        <span className="relative h-[1.5em] w-[2.6em] shrink-0 rounded-pill bg-mint-800">
          <span className="absolute right-[0.15em] top-[0.15em] size-[1.2em] rounded-full bg-white" />
        </span>
      </div>
    </div>
  );
}
