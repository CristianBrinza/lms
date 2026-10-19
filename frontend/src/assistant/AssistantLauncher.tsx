import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '@/app/auth';
import { SparkleIcon } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';
import { useAssistantT } from './i18n';
import { FLOATING_ATTR, keyboardUp, overlayOpen, stackedBottom, type Box } from './floating';
import { assistantButtonVisible } from './visibility';

// The panel (chat, markdown, recorder) loads the first time it is opened, not with the app.
const AssistantPanel = lazy(() => import('./AssistantPanel'));

const SIZE = 56;
const SMALL = 44;
const INSET = 16;

/**
 * Watches the page for what the button must dodge: marked floating controls ([data-fab]: the
 * Kitchen FAB, selection and save bars) to stack above with a 12 px gap, and sheets, dialogs and
 * the on-screen keyboard, while which it hides. Pages declare nothing but the attribute.
 */
function useDodge(active: boolean) {
  const [state, setState] = useState<{ bottom: number | null; hidden: boolean }>({
    bottom: null,
    hidden: false,
  });
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const styles = getComputedStyle(document.documentElement);
      const tabbar = Number.parseFloat(styles.getPropertyValue('--tabbar-real')) || 0;
      const base = tabbar + INSET;
      const boxes: Box[] = [];
      document.querySelectorAll(`[${FLOATING_ATTR}]`).forEach((node) => {
        const r = node.getBoundingClientRect();
        boxes.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right });
      });
      const bottom = stackedBottom({
        obstacles: boxes,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        base,
        size: SIZE,
        inset: INSET,
      });
      const hidden = overlayOpen() || keyboardUp();
      setState((prev) => (prev.bottom === bottom && prev.hidden === hidden ? prev : { bottom, hidden }));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true });
    const events = ['scroll', 'resize', 'focusin', 'focusout', 'animationend', 'transitionend'];
    events.forEach((name) => window.addEventListener(name, schedule, { capture: true, passive: true }));
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      mutations.disconnect();
      events.forEach((name) => window.removeEventListener(name, schedule, { capture: true }));
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [active]);
  return state;
}

/**
 * The round sparkles button at the bottom right of every signed-in screen (admins), above the tab
 * bar on phones and inside the safe area, and the assistant it opens.
 */
export function AssistantLauncher() {
  const t = useAssistantT();
  const { isAdmin } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const dodge = useDodge(isAdmin && !open);

  if (!isAdmin) return null;
  const visible = assistantButtonVisible({ isAdmin, pathname, open }) && !dodge.hidden;
  const stacked = dodge.bottom !== null;
  return (
    <>
      {visible ? (
        <button
          type="button"
          aria-label={t.open}
          title={t.open}
          onClick={() => {
            haptic('tap');
            setMounted(true);
            setOpen(true);
          }}
          style={
            stacked
              ? { bottom: `${dodge.bottom}px`, width: SMALL, height: SMALL }
              : undefined
          }
          className={`press fixed right-[max(1rem,var(--safe-right,0px))] z-30 flex items-center justify-center rounded-full bg-lav-600 text-white shadow-fab transition-[bottom] duration-200 hover:bg-lav-700 ${
            stacked ? 'text-[1.35rem]' : 'bottom-[calc(var(--tabbar-real,0px)+1rem)] size-14 text-[1.6rem] md:bottom-[max(1rem,var(--safe-bottom))]'
          }`}
        >
          <SparkleIcon fontSize="inherit" />
        </button>
      ) : null}
      {mounted && open ? (
        <Suspense fallback={null}>
          <AssistantPanel onClose={close} />
        </Suspense>
      ) : null}
    </>
  );
}
