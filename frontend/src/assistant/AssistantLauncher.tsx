import { lazy, Suspense, useCallback, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '@/app/auth';
import { SparkleIcon } from '@/components/ui/icons';
import { haptic } from '@/lib/haptics';
import { useAssistantT } from './i18n';
import { assistantButtonVisible } from './visibility';

// The panel (chat, markdown, recorder) loads the first time it is opened, not with the app.
const AssistantPanel = lazy(() => import('./AssistantPanel'));

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

  if (!isAdmin) return null;
  const visible = assistantButtonVisible({ isAdmin, pathname, open });
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
          className="press fixed bottom-[calc(var(--tabbar-real,0px)+1rem)] right-[max(1rem,var(--safe-right,0px))] z-30 flex size-14 items-center justify-center rounded-full bg-lav-600 text-[1.6rem] text-white shadow-fab hover:bg-lav-700 md:bottom-[max(1rem,var(--safe-bottom))]"
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
