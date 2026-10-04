import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (a workout running, the phone propped against the wall).
 * The browser drops the lock whenever the page is hidden, so it is taken again on return.
 * Released on pause and on leaving; a no-op where the Screen Wake Lock API doesn't exist.
 */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    const acquire = async () => {
      if (stopped || document.visibilityState !== 'visible' || (lock && !lock.released)) return;
      try {
        const sentinel = await navigator.wakeLock.request('screen');
        if (stopped) void sentinel.release().catch(() => undefined);
        else lock = sentinel;
      } catch {
        // Refused (low battery, not allowed here): the screen may sleep, nothing else breaks.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibility);
      if (lock && !lock.released) void lock.release().catch(() => undefined);
      lock = null;
    };
  }, [active]);
}
