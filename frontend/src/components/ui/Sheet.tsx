import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { lockScroll } from '@/lib/scroll-lock';
import { CloseIcon } from './icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Actions, stacked full width on phones (the yellow app's "Skip" over "Continue"). */
  footer?: ReactNode;
  /** Visually hide the title (kept for screen readers). */
  hideTitle?: boolean;
  size?: 'md' | 'lg';
}

const CLOSE_MS = 200;

/**
 * The LMS popup: a white card floating a little above the bottom edge on phones and in the
 * middle on wider screens, rising in over an indigo-tinted dim. Built on <dialog> + showModal(),
 * so focus trapping, Escape and the inert page behind come from the platform.
 */
export function Sheet({ open, onClose, title, description, children, footer, hideTitle, size = 'md' }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const releaseScroll = useRef<(() => void) | null>(null);
  const closing = useRef(false);
  const titleId = useId();

  const requestClose = useCallback(() => {
    const dialog = ref.current;
    if (!dialog || closing.current) return;
    closing.current = true;
    dialog.dataset.state = 'closed';
    const done = () => {
      closing.current = false;
      if (dialog.open && dialog.dataset.state === 'closed') dialog.close();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else window.setTimeout(done, CLOSE_MS);
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) requestClose();
      return;
    }
    closing.current = false;
    if (!dialog.open) {
      dialog.dataset.state = 'closed';
      dialog.showModal();
      panel.current?.focus({ preventScroll: true });
    }
    releaseScroll.current ??= lockScroll();
    if (dialog.dataset.state === 'open') return;
    // Paint the start position once, then rise: a transition needs a drawn first frame.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        dialog.dataset.state = 'open';
      });
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [open, requestClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onDialogClose = () => {
      releaseScroll.current?.();
      releaseScroll.current = null;
      if (open) onClose();
    };
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    dialog.addEventListener('close', onDialogClose);
    dialog.addEventListener('cancel', onCancel);
    return () => {
      dialog.removeEventListener('close', onDialogClose);
      dialog.removeEventListener('cancel', onCancel);
    };
  }, [open, onClose, requestClose]);

  useEffect(
    () => () => {
      releaseScroll.current?.();
      releaseScroll.current = null;
    },
    [],
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === ref.current) requestClose();
      }}
      className={cx(
        'group fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none touch-none overflow-visible bg-transparent text-ink-900',
        'px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-[calc(var(--safe-top)+0.75rem)] open:flex open:items-end open:justify-center md:open:items-center md:px-6',
      )}
    >
      <div
        ref={panel}
        tabIndex={-1}
        className={cx(
          'flex max-h-full w-full flex-col overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_60px_-24px_rgb(42_43_102/0.55)] outline-none',
          size === 'lg' ? 'md:max-w-2xl' : 'md:max-w-md',
          'translate-y-6 scale-[0.97] opacity-0 transition-[translate,scale,opacity]',
          'group-data-[state=open]:translate-y-0 group-data-[state=open]:scale-100 group-data-[state=open]:opacity-100 group-data-[state=open]:duration-[340ms] group-data-[state=open]:ease-(--ease-out)',
          'group-data-[state=closed]:duration-200 group-data-[state=closed]:ease-(--ease-in-out)',
        )}
      >
        <header className="flex items-start justify-between gap-4 px-6 pb-1 pt-6">
          <div className="min-w-0">
            <h2 id={titleId} className={cx('text-h2 font-bold', hideTitle && 'sr-only')}>
              {title}
            </h2>
            {description ? <div className="mt-1.5 text-[0.9375rem] text-ink-600">{description}</div> : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            title="Close"
            className="press -mr-1 -mt-1 flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[1.2rem] text-white hover:bg-ink-800"
          >
            <CloseIcon fontSize="inherit" />
          </button>
        </header>
        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain px-6 pb-6 pt-4">{children}</div>
        {footer ? <footer className="px-6 pb-6">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
