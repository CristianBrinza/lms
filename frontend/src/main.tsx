import '@/styles/index.css';
// Capture the install prompt before React mounts (it can fire very early).
import '@/lib/pwa';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { quietSkippedTransitions } from '@/lib/navDirection';
import { isStandalone } from '@/lib/platform';

// The dev server never uses a service worker: drop any left over from a production build on
// this address, so what's on screen is always the code being edited.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) void registration.unregister();
  });
}

quietSkippedTransitions();

// Installed on the Home Screen: ask the browser to keep this app's data (the session hint,
// preferences) even when the phone runs low on space.
if (isStandalone()) void navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
