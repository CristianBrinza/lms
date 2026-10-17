import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { UpdatePrompt } from '@/components/common/UpdatePrompt';
import { hideSplash } from '@/lib/splash';
import { useAppT } from './i18n';

/** Every screen: the update watcher, focus and scroll reset on navigation, and the splash hand-off. */
export function Root() {
  const t = useAppT();
  const { pathname } = useLocation();
  useEffect(() => hideSplash(), []);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return (
    <>
      <a
        href="#main"
        className="sr-only z-50 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-[calc(var(--safe-top)+0.75rem)]"
      >
        {t.skip}
      </a>
      <Outlet />
      <UpdatePrompt />
    </>
  );
}
