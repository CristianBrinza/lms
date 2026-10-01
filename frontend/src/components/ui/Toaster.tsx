import { Toaster as Sonner } from 'sonner';
import { CheckCircleIcon, ErrorIcon, InfoIcon, WarningIcon } from './icons';
import { Spinner } from './Spinner';

const icon = 'animate-pop text-[1.35rem]';

/** App-wide toasts: ink pills dropping from the top, clear of the tab bar. */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={{ top: 'calc(var(--safe-top) + 12px)' }}
      mobileOffset={{ top: 'calc(var(--safe-top) + 12px)' }}
      gap={10}
      visibleToasts={3}
      icons={{
        success: <CheckCircleIcon fontSize="inherit" className={`${icon} text-mint-200`} />,
        error: <ErrorIcon fontSize="inherit" className={`${icon} text-white`} />,
        warning: <WarningIcon fontSize="inherit" className={`${icon} text-peach-200`} />,
        info: <InfoIcon fontSize="inherit" className={`${icon} text-cyan-200`} />,
        loading: <Spinner className="size-5 text-white/80" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: 'flex w-full items-start gap-3 rounded-2xl bg-ink-900 px-4 py-3.5 text-white shadow-float md:w-[22rem] font-sans',
          title: 'text-[0.9375rem] font-semibold',
          description: 'mt-0.5 text-sm text-white/75',
          actionButton: 'ml-auto shrink-0 rounded-pill bg-white px-3.5 py-1.5 text-sm font-semibold text-ink-900 press',
          cancelButton: 'shrink-0 rounded-pill px-3 py-1.5 text-sm font-semibold text-white/75',
          icon: 'mt-px flex size-6 shrink-0 items-center justify-center',
          error: 'bg-danger-700',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
