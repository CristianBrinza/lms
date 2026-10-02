import { useState } from 'react';
import { Link } from 'react-router';
import { CloseIcon, InstallIcon } from '@/components/ui/icons';
import { currentPlatform } from '@/lib/platform';
import { useInstallPrompt } from '@/lib/pwa';
import { storage, STORAGE_KEYS } from '@/lib/storage';

/**
 * The featured card (the learning app's "UX Lab" card, in butter): a white icon circle, a title,
 * a line of text and a black pill to act. In the browser only, and only where LMS isn't installed
 * yet: never inside the app, and not in the browser of a device that has the app. Dismissed once,
 * it stays away on this device.
 */
export function InstallCard() {
  const { installed } = useInstallPrompt();
  const [hidden, setHidden] = useState(() => storage.get(STORAGE_KEYS.installCardHidden) !== null);
  if (hidden || installed || currentPlatform().standalone) return null;

  const hide = () => {
    storage.set(STORAGE_KEYS.installCardHidden, new Date().toISOString());
    setHidden(true);
  };
  return (
    <section className="relative flex animate-rise flex-col rounded-[1.75rem] bg-butter-300 p-5 shadow-[0_18px_32px_-20px_rgb(110_80_0/0.55)]" aria-labelledby="install-card-title">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-white text-[1.6rem] text-ink-900">
        <InstallIcon fontSize="inherit" />
      </span>
      <h3 id="install-card-title" className="mt-5 pr-6 text-h2 font-bold text-ink-900">
        Put LMS on your Home Screen
      </h3>
      <p className="mt-1.5 max-w-xs text-[0.9375rem] leading-snug text-butter-800">It opens full screen, stays signed in and updates by itself.</p>
      <Link
        to="/app"
        viewTransition
        className="press mt-5 inline-flex h-12 items-center self-start rounded-pill bg-ink-900 px-6 text-[0.9375rem] font-semibold text-white shadow-[0_10px_20px_-12px_rgb(29_29_36/0.8)] hover:bg-ink-800"
      >
        Show me how
      </Link>
      <button
        type="button"
        onClick={hide}
        aria-label="Hide this card"
        title="Hide this card"
        className="press absolute right-2.5 top-2.5 flex size-11 items-center justify-center rounded-full text-xl text-butter-800 hover:bg-white/50"
      >
        <CloseIcon fontSize="inherit" />
      </button>
    </section>
  );
}
