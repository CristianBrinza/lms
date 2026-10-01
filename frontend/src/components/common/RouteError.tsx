import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { Button } from '@/components/ui';
import { RefreshIcon, WarningIcon } from '@/components/ui/icons';
import { hideSplash } from '@/lib/splash';
import { session } from '@/lib/storage';

const RELOADED_FOR_CHUNK = 'lms:reloaded-for-chunk';

/** Last-resort screen for render errors and failed lazy chunks (a deploy while the app was open). */
export function RouteError() {
  const error = useRouteError();
  useEffect(() => {
    hideSplash();
    console.error('[route error]', error);
  }, [error]);

  const chunkFailed = error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed/i.test(error.message);
  if (chunkFailed && !session.get(RELOADED_FOR_CHUNK)) {
    // A new version went out while this page was open: reload once to pick it up.
    session.set(RELOADED_FOR_CHUNK, '1');
    window.location.reload();
    return null;
  }

  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-full bg-white text-[2rem] text-peach-800 shadow-card">
          <WarningIcon fontSize="inherit" />
        </span>
        <h1 className="text-h1 font-extrabold">{notFound ? 'This page doesn’t exist' : 'Something broke on this screen'}</h1>
        <p className="mt-3 text-ink-700">{notFound ? 'The link may be old. Home has everything.' : 'Reloading usually fixes it. Nothing you saved is lost.'}</p>
        <Button className="mt-8" icon={RefreshIcon} onClick={() => window.location.assign('/')}>
          Reload LMS
        </Button>
      </div>
    </main>
  );
}
