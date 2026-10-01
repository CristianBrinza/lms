import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { Button, Toaster } from '@/components/ui';
import { RefreshIcon, WarningIcon } from '@/components/ui/icons';
import { hideSplash } from '@/lib/splash';
import { queryClient } from '@/services/queries';
import { AuthProvider, useAuth } from './auth';
import { getRouter } from './router';

/** Waits for the session check (under the splash) so guards never flash the wrong screen. */
function AuthGate() {
  const { status, retry } = useAuth();
  if (status === 'loading') return null;
  if (status === 'error') {
    hideSplash();
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-6 inline-flex size-16 items-center justify-center rounded-full bg-white text-[2rem] text-peach-800 shadow-card">
            <WarningIcon fontSize="inherit" />
          </span>
          <h1 className="text-h1 font-extrabold">LMS can’t connect</h1>
          <p className="mt-3 text-ink-700">Check your connection. If it works elsewhere, the server may be restarting; try again in a minute.</p>
          <Button className="mt-8" icon={RefreshIcon} onClick={retry}>
            Try again
          </Button>
        </div>
      </main>
    );
  }
  return <RouterProvider router={getRouter()} />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthGate />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
