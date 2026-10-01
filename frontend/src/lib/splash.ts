import { SPLASH_SEEN_KEY } from './splashGate';
import { session } from './storage';

/**
 * The splash in index.html is painted before any JS runs when the app starts. It stays a short
 * brand moment (~1.1 s on a cold start), then fades once the first screen is ready. A page that
 * comes back within the same session skips it: the <head> gate (splashGate.ts) hides it before
 * the first paint, and it is removed here.
 */
const FIRST_OPEN_MS = 1100;
const RELOAD_MS = 300;
let hidden = false;

if (typeof document !== 'undefined' && document.documentElement.getAttribute('data-splash') === 'skip') {
  document.getElementById('splash')?.remove();
  session.set(SPLASH_SEEN_KEY, '1');
  hidden = true;
}

export function hideSplash(): void {
  if (hidden) return;
  hidden = true;
  const splash = document.getElementById('splash');
  if (!splash) return;
  const minimum = session.get(SPLASH_SEEN_KEY) ? RELOAD_MS : FIRST_OPEN_MS;
  window.setTimeout(
    () => {
      session.set(SPLASH_SEEN_KEY, '1');
      splash.classList.add('is-leaving');
      window.setTimeout(() => splash.remove(), 450);
    },
    Math.max(0, minimum - performance.now()),
  );
}
