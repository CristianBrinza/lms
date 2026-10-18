import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RefreshIcon } from '@/components/ui/icons';
import { cx } from '@/lib/cx';
import { uiT } from '../i18n';
import { haptic } from '@/lib/haptics';

const THRESHOLD = 76;
const MAX = 120;
const HOLD = 64;

/**
 * Pull down at the top of a screen to refresh it — the installed app has no browser reload. A
 * white disc follows the finger (turning as it comes), the page gives way with resistance, and
 * past the threshold everything on screen is fetched again and the app checks for a new version.
 * Touch screens only; the page springs back when done.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const armed = useRef(false);
  const startX = useRef(0);
  const axis = useRef<'x' | 'y' | null>(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;
    const set = (value: number) => {
      pullRef.current = value;
      setPull(value);
    };
    const onStart = (event: TouchEvent) => {
      const blocked =
        refreshing ||
        (event.target instanceof Element && event.target.closest('[data-no-pull]') !== null) ||
        window.scrollY > 0 ||
        document.documentElement.hasAttribute('data-scroll-locked');
      startY.current = blocked ? null : (event.touches[0]?.clientY ?? null);
      startX.current = event.touches[0]?.clientX ?? 0;
      axis.current = null;
      armed.current = false;
    };
    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return;
      const dy = (event.touches[0]?.clientY ?? 0) - startY.current;
      // A sideways swipe (a photo strip, a row of cards) belongs to the browser's own scrolling:
      // decide the direction once, early, and never cancel a horizontal gesture because the
      // finger drifted down a little.
      if (axis.current === null) {
        const dx = (event.touches[0]?.clientX ?? 0) - startX.current;
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axis.current === 'x') {
        startY.current = null;
        return;
      }
      if (dy <= 0 || window.scrollY > 0) {
        if (pullRef.current) set(0);
        setDragging(false);
        return;
      }
      setDragging(true);
      // Resistance: the further you pull, the less it gives.
      const resisted = Math.min(MAX, dy * 0.55 - (dy * dy) / 5000);
      set(Math.max(0, resisted));
      if (!armed.current && resisted >= THRESHOLD) {
        armed.current = true;
        haptic('tap');
      } else if (armed.current && resisted < THRESHOLD) {
        armed.current = false;
      }
      if (event.cancelable) event.preventDefault();
    };
    const onEnd = () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);
      if (pullRef.current < THRESHOLD) {
        set(0);
        return;
      }
      set(HOLD);
      setRefreshing(true);
      const done = Promise.all([
        queryClient.refetchQueries({ type: 'active' }),
        navigator.serviceWorker
          ?.getRegistration()
          .then((registration) => registration?.update())
          .catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      void done.finally(() => {
        setRefreshing(false);
        haptic('success');
        set(0);
      });
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [queryClient, refreshing]);

  const progress = Math.min(1, pull / THRESHOLD);
  const moving = pull > 0 || refreshing;
  return (
    <>
      <div
        aria-hidden={!refreshing}
        role="status"
        aria-label={refreshing ? uiT().refreshing : undefined}
        className={cx(
          'pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.5rem)] z-50 flex justify-center',
          !dragging && 'transition-[translate,opacity] duration-300 ease-(--ease-out)',
        )}
        style={{ translate: `0 ${pull - 52}px`, opacity: moving ? 1 : 0 }}
      >
        <span
          className={cx(
            'flex size-11 items-center justify-center rounded-full bg-white text-[1.35rem] shadow-[var(--shadow-raised)] transition-colors duration-200',
            progress >= 1 || refreshing ? 'text-ink-900' : 'text-ink-400',
          )}
        >
          <RefreshIcon
            fontSize="inherit"
            className={cx(refreshing && 'animate-spin')}
            style={refreshing ? undefined : { rotate: `${progress * 300}deg` }}
          />
        </span>
      </div>
      <div
        className={cx(!dragging && 'transition-[translate] duration-500 ease-(--ease-out)')}
        style={moving ? { translate: `0 ${pull * 0.5}px` } : undefined}
      >
        {children}
      </div>
    </>
  );
}
