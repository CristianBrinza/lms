import { useEffect, useState } from 'react';
import { CheckCircleIcon, WifiOffIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { uiT } from '../i18n';

type State = 'online' | 'offline' | 'back';

/**
 * Connection state at the top of the screen: an ink pill slides down while offline (what's on
 * screen stays, new changes wait), then turns mint for a moment when the connection returns.
 */
export function OfflineBanner() {
  const [state, setState] = useState<State>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  );

  useEffect(() => {
    let timer = 0;
    const offline = () => {
      window.clearTimeout(timer);
      setState('offline');
    };
    const online = () => {
      setState((current) => (current === 'offline' ? 'back' : current));
      timer = window.setTimeout(() => setState('online'), 2200);
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);

  const visible = state !== 'online';
  return (
    <div
      role="status"
      aria-live="polite"
      className={cx(
        'pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-[60] flex justify-center px-4 transition-[translate,opacity] duration-300 ease-(--ease-out)',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-[150%] opacity-0',
      )}
    >
      <span
        className={cx(
          'inline-flex h-10 items-center gap-2 rounded-pill px-4 text-sm font-semibold shadow-[var(--shadow-raised)] transition-colors duration-300',
          state === 'back' ? 'bg-mint-200 text-ink-900' : 'bg-ink-900 text-white',
        )}
      >
        {state === 'back' ? (
          <>
            <CheckCircleIcon fontSize="inherit" className="animate-pop text-base" />
            {uiT().offline.back}
          </>
        ) : visible ? (
          <>
            <WifiOffIcon fontSize="inherit" className="text-base text-butter-300" />
            {uiT().offline.away}
          </>
        ) : null}
      </span>
    </div>
  );
}
