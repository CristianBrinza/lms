import type { ReactNode } from 'react';
import { LogoTile } from '@/components/brand/Logo';
import { cx } from '@/lib/cx';
import { mark } from './highlight';

/** Shared pieces of the drawn install steps (sizes in em of the frame's container-relative font). */

/** Grey bars standing in for a web page. */
export function PageLines({ className }: { className?: string }) {
  return (
    <div className={cx('flex flex-col gap-[0.7em] px-[5%] pt-[5%]', className)}>
      <span className="h-[3.2em] w-full rounded-[0.8em] bg-lav-300" />
      <span className="h-[0.55em] w-[70%] rounded-pill bg-ink-200" />
      <span className="h-[0.55em] w-[55%] rounded-pill bg-ink-200" />
      <span className="h-[0.55em] w-[62%] rounded-pill bg-ink-200" />
    </div>
  );
}

/** A plain menu row: icon and text as grey shapes. */
export function MenuLine({ width }: { width: string }) {
  return (
    <div className="flex items-center gap-[0.7em] px-[0.8em] py-[0.6em]">
      <span className="size-[1.1em] shrink-0 rounded-[0.3em] bg-ink-200" />
      <span className="h-[0.5em] rounded-pill bg-ink-200" style={{ width }} />
    </div>
  );
}

export function Dimmed({ children }: { children: ReactNode }) {
  return (
    <div className="size-full bg-white">
      <PageLines />
      <div className="absolute inset-0 bg-ink-900/30" />
      {children}
    </div>
  );
}

/** A Home Screen with the LMS icon among blank ones, marked. */
export function HomeScene({ step }: { step: number }) {
  const m = mark(step);
  return (
    <div className="grid size-full grid-cols-4 content-start gap-x-[7%] gap-y-[0.8em] bg-linear-to-b from-sky-100 to-lav-200 px-[9%] pt-[6%]">
      {Array.from({ length: 8 }, (_, i) =>
        i === 5 ? (
          <div key={i} className="min-w-0">
            <span className={cx('block rounded-[26%]', m.className)} style={m.style}>
              <LogoTile className="w-full shadow-none" label={null} />
            </span>
            <span className="mt-[0.35em] block truncate text-center text-[0.8em] font-semibold text-ink-900">
              LMS
            </span>
          </div>
        ) : (
          <div key={i}>
            <span className="block aspect-square rounded-[26%] bg-white/75" />
            <span className="mx-auto mt-[0.55em] block h-[0.45em] w-[70%] rounded-pill bg-white/80" />
          </div>
        ),
      )}
    </div>
  );
}
