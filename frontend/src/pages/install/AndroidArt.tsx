import { ChevronRightIcon, DownloadIcon, LanguageIcon, LockIcon, MoreVertIcon, AddToHomeScreenIcon, type IconComponent } from '@/components/ui/icons';
import { LogoTile } from '@/components/brand/Logo';
import { cx } from '@/lib/cx';
import { mark } from './highlight';
import { Dimmed, HomeScene, MenuLine, PageLines } from './parts';

/**
 * Chrome on Android, drawn: simplified scenes of each step with the real button labels and our
 * mark on what to tap. Loaded only when the Android steps are shown.
 */
export default function AndroidArt({ step, alt }: { step: number; alt: string }) {
  const scene = [<MenuScene key="menu" />, <SheetScene key="sheet" />, <DialogScene key="dialog" />, <HomeScene key="home" step={3} />][step];
  return (
    <div role="img" aria-label={alt} className="size-full text-[3.4cqw] leading-tight text-ink-900">
      <div aria-hidden="true" className="relative size-full overflow-hidden">
        {scene}
      </div>
    </div>
  );
}

function MenuScene() {
  const dots = mark(0);
  const item = mark(0);
  return (
    <div className="size-full bg-white">
      <div className="flex items-center gap-[0.6em] border-b border-ink-100 px-[3%] py-[0.55em]">
        <div className="flex h-[2.1em] flex-1 items-center gap-[0.5em] rounded-pill bg-ink-100 px-[0.8em]">
          <LockIcon fontSize="inherit" className="text-[1em] text-ink-500" />
          <span className="h-[0.5em] w-[45%] rounded-pill bg-ink-300" />
        </div>
        <span className={cx('grid size-[2.1em] shrink-0 place-items-center rounded-full text-[1.1em] text-ink-800', dots.className)} style={dots.style}>
          <MoreVertIcon fontSize="inherit" />
        </span>
      </div>
      <PageLines className="w-[40%]" />
      <div className="absolute right-[3%] top-[22%] w-[64%] rounded-[0.9em] bg-white p-[0.35em] shadow-raised ring-1 ring-ink-100">
        <MenuLine width="58%" />
        <MenuLine width="44%" />
        <div className={cx('my-[0.2em] flex items-center gap-[0.6em] rounded-[0.6em] bg-lav-50 px-[0.6em] py-[0.55em] font-semibold', item.className)} style={item.style}>
          <AddToHomeScreenIcon fontSize="inherit" className="shrink-0 text-[1.3em] text-lav-700" />
          <span>Install app</span>
        </div>
        <MenuLine width="50%" />
      </div>
    </div>
  );
}

function Option({ icon: Icon, title, note, marked }: { icon: IconComponent; title: string; note?: string; marked?: boolean }) {
  const m = mark(1);
  return (
    <div className={cx('flex items-center gap-[0.8em] rounded-[0.8em] px-[0.6em] py-[0.5em]', marked && m.className)} style={marked ? m.style : undefined}>
      <span className="grid size-[2.2em] shrink-0 place-items-center rounded-full bg-lav-100 text-[1.1em] text-lav-700">
        <Icon fontSize="inherit" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {note ? <span className="mt-[0.15em] block text-[0.85em] text-ink-600">{note}</span> : null}
      </span>
      <ChevronRightIcon fontSize="inherit" className="shrink-0 text-[1.3em] text-ink-400" />
    </div>
  );
}

function SheetScene() {
  return (
    <Dimmed>
      <div className="absolute inset-x-0 bottom-0 rounded-t-[1.3em] bg-white px-[5%] pb-[4%] pt-[0.6em] shadow-sheet">
        <span className="mx-auto mb-[0.7em] block h-[0.3em] w-[2.6em] rounded-pill bg-ink-200" />
        <Option icon={DownloadIcon} title="Install" marked />
        <Option icon={LanguageIcon} title="Create shortcut" note="Shortcuts open in Chrome" />
      </div>
    </Dimmed>
  );
}

function DialogScene() {
  const m = mark(2);
  return (
    <Dimmed>
      <div className="absolute left-1/2 top-1/2 w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-[1.3em] bg-white p-[5%] shadow-raised">
        <div className="flex items-center gap-[0.8em]">
          <LogoTile className="w-[3em] shrink-0 shadow-none" label={null} />
          <div className="min-w-0">
            <p className="truncate font-bold">LMS — Life Management System</p>
            <span className="mt-[0.45em] block h-[0.5em] w-[6.5em] rounded-pill bg-ink-200" />
          </div>
        </div>
        <div className="mt-[1.3em] flex items-center justify-end gap-[0.6em] font-semibold">
          <span className="px-[0.6em] py-[0.5em] text-ink-600">Cancel</span>
          <span className={cx('rounded-pill bg-ink-900 px-[1.1em] py-[0.5em] text-white', m.className)} style={m.style}>
            Install
          </span>
        </div>
      </div>
    </Dimmed>
  );
}
