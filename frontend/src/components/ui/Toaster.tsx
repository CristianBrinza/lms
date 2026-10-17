import { Toaster as Sonner } from 'sonner';
import { CheckIcon, ErrorIcon, InfoIcon, WarningIcon } from './icons';
import { Spinner } from './Spinner';
import { uiT } from '../i18n';

const chip =
  'flex size-9 animate-pop items-center justify-center rounded-full text-[1.15rem] text-ink-900';

/**
 * LMS toasts: white cards that rise from the bottom, above the menu, each led by a round icon
 * chip in the palette's colours (mint done, butter news, peach warning, crimson problem).
 */
export function Toaster() {
  const bottom = 'calc(var(--tabbar-h) + var(--safe-bottom) + 0.75rem)';
  return (
    <Sonner
      position="bottom-center"
      offset={{ bottom: '1.5rem' }}
      mobileOffset={{ bottom }}
      gap={10}
      visibleToasts={3}
      containerAriaLabel={uiT().notifications}
      icons={{
        success: (
          <span className={`${chip} bg-mint-200`}>
            <CheckIcon fontSize="inherit" />
          </span>
        ),
        info: (
          <span className={`${chip} bg-butter-300`}>
            <InfoIcon fontSize="inherit" />
          </span>
        ),
        warning: (
          <span className={`${chip} bg-peach-200`}>
            <WarningIcon fontSize="inherit" />
          </span>
        ),
        error: (
          <span className={`${chip} bg-danger-600 text-white`}>
            <ErrorIcon fontSize="inherit" />
          </span>
        ),
        loading: (
          <span className={`${chip} bg-lav-100`}>
            <Spinner className="size-4 text-lav-700" />
          </span>
        ),
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-3 rounded-[1.375rem] bg-white p-2.5 pr-3 font-sans text-ink-900 shadow-[0_18px_40px_-16px_rgb(42_43_102/0.5)] ring-1 ring-ink-100 md:w-[23rem]',
          title: 'text-[0.9375rem] font-semibold leading-snug',
          description: 'mt-0.5 text-sm leading-snug text-ink-600',
          content: 'min-w-0 flex-1 py-0.5',
          actionButton:
            'press ml-auto shrink-0 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-white',
          cancelButton: 'shrink-0 rounded-pill px-3 py-2 text-sm font-semibold text-ink-600',
          icon: 'flex shrink-0 items-center justify-center self-start [&>*]:m-0',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
