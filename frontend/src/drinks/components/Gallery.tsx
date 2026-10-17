import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DeleteIcon,
  StarIcon,
} from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { lockScroll } from '@/lib/scroll-lock';
import type { PhotoKind, PhotoRef } from '../api';
import { useDrinksT } from '../i18n';

export interface GalleryPhoto extends PhotoRef {
  kind?: PhotoKind;
  /** A tasting's photo: it can't be the bottle's cover. */
  tastingId?: string | null;
}

/**
 * The photos full screen, on black: swipe between them (native scroll snapping, so it follows the
 * finger), arrows and keys on a computer. Built on <dialog>, so focus and Escape come for free.
 */
export function Gallery({
  photos,
  start,
  onClose,
  onCover,
  onDelete,
}: {
  photos: GalleryPhoto[];
  /** The photo to open on; null keeps it closed. */
  start: number | null;
  onClose: () => void;
  onCover?: (photo: GalleryPhoto) => void;
  onDelete?: (photo: GalleryPhoto) => void;
}) {
  const t = useDrinksT();
  const dialog = useRef<HTMLDialogElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start ?? 0);
  const open = start !== null;

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (!open) {
      if (node.open) node.close();
      return;
    }
    if (!node.open) node.showModal();
    const release = lockScroll();
    // Jump (not scroll) to the photo it opens on. (The caller keys the gallery by `start`, so
    // `index` began there too.)
    requestAnimationFrame(() => {
      const width = strip.current?.clientWidth ?? 0;
      strip.current?.scrollTo({ left: start * width, behavior: 'instant' });
    });
    return release;
  }, [open, start]);

  // A photo deleted from under the viewer: stay within the ones left.
  useEffect(() => {
    if (open && !photos.length) onClose();
  }, [open, photos.length, onClose]);

  const go = (to: number) => {
    const width = strip.current?.clientWidth ?? 0;
    const next = Math.max(0, Math.min(photos.length - 1, to));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.current?.scrollTo({ left: next * width, behavior: reduced ? 'instant' : 'smooth' });
  };
  const current = photos[Math.min(index, photos.length - 1)];

  return (
    <dialog
      ref={dialog}
      aria-label={t.photos}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(index + 1);
        if (e.key === 'ArrowLeft') go(index - 1);
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-black p-0 text-white backdrop:bg-black"
    >
      {open ? (
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="tabular text-sm font-semibold text-white/80" aria-live="polite">
              {photos.length > 1 ? t.photoOf(index + 1, photos.length) : ''}
              {current?.kind ? <span className="ml-2 text-white/60">{t.photoKind[current.kind]}</span> : null}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeGallery}
              className="press grid size-11 place-items-center rounded-full bg-white/10 text-[1.4rem] hover:bg-white/20"
            >
              <CloseIcon fontSize="inherit" />
            </button>
          </div>

          <div
            ref={strip}
            onScroll={(e) => {
              const node = e.currentTarget;
              setIndex(Math.round(node.scrollLeft / Math.max(1, node.clientWidth)));
            }}
            className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-contain [scrollbar-width:none]"
          >
            {photos.map((photo, i) => (
              <figure key={photo.id} className="flex h-full w-full shrink-0 snap-center items-center justify-center p-2">
                <img
                  src={photo.full}
                  alt=""
                  loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="max-h-full max-w-full rounded-xl object-contain"
                />
              </figure>
            ))}
          </div>

          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label={t.previous}
                disabled={index === 0}
                onClick={() => go(index - 1)}
                className="press absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-[1.6rem] hover:bg-white/20 disabled:opacity-0 md:grid"
              >
                <ChevronLeftIcon fontSize="inherit" />
              </button>
              <button
                type="button"
                aria-label={t.next}
                disabled={index === photos.length - 1}
                onClick={() => go(index + 1)}
                className="press absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-[1.6rem] hover:bg-white/20 disabled:opacity-0 md:grid"
              >
                <ChevronRightIcon fontSize="inherit" />
              </button>
            </>
          ) : null}

          <div className="flex items-center justify-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {photos.length > 1 ? (
              <span aria-hidden="true" className="mr-auto flex gap-1.5">
                {photos.map((photo, i) => (
                  <span
                    key={photo.id}
                    className={cx(
                      'h-1.5 rounded-pill transition-all duration-300',
                      i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/35',
                    )}
                  />
                ))}
              </span>
            ) : (
              <span className="mr-auto" />
            )}
            {current && onCover && !current.tastingId && index > 0 ? (
              <button
                type="button"
                onClick={() => onCover(current)}
                className="press inline-flex h-10 items-center gap-1.5 rounded-pill bg-white px-4 text-sm font-semibold text-ink-900"
              >
                <StarIcon fontSize="inherit" className="text-base" />
                {t.setCover}
              </button>
            ) : null}
            {current && onDelete ? (
              <button
                type="button"
                aria-label={t.removePhoto}
                onClick={() => onDelete(current)}
                className="press grid size-10 place-items-center rounded-full bg-white/10 text-[1.25rem] hover:bg-white/20"
              >
                <DeleteIcon fontSize="inherit" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
