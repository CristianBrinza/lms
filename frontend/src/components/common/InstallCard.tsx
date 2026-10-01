import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowOutIcon, CloseIcon } from '@/components/ui/icons';
import { currentPlatform } from '@/lib/platform';
import { useInstallPrompt } from '@/lib/pwa';
import { storage, STORAGE_KEYS } from '@/lib/storage';

/**
 * The featured card (the learning app's coloured course card, in butter): a label pill, a title,
 * a line of text. In the browser only, it offers the Home Screen app; dismissed once, it stays
 * away on this device.
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
    <div className="relative animate-rise rounded-[1.75rem] bg-[linear-gradient(155deg,#fae3a0_0%,#f6d47a_50%,#f1c65a_100%)] shadow-[var(--shadow-sheen-light),0_2px_4px_rgb(110_80_0/0.1),0_20px_36px_-20px_rgb(110_80_0/0.55)]">
      <Link to="/app" viewTransition className="press group/feature flex flex-col rounded-[1.75rem] p-5">
        <span className="inline-flex h-8 items-center self-start rounded-pill bg-ink-900 px-3.5 text-sm font-semibold text-white shadow-[var(--shadow-sheen-dark)]">The app</span>
        <span className="mt-7 pr-14 text-h2 font-bold text-ink-900">Put LMS on your Home Screen</span>
        <span className="mt-1.5 max-w-xs pr-14 text-[0.9375rem] leading-snug text-butter-800">It opens full screen, stays signed in and updates by itself.</span>
        <span
          aria-hidden="true"
          className="absolute bottom-5 right-5 flex size-12 items-center justify-center rounded-full bg-white text-[1.3rem] text-ink-900 shadow-[0_8px_16px_-8px_rgb(110_80_0/0.55)] transition-transform duration-300 ease-(--ease-lift) group-hover/feature:rotate-45"
        >
          <ArrowOutIcon fontSize="inherit" />
        </span>
      </Link>
      <button
        type="button"
        onClick={hide}
        aria-label="Hide this card"
        title="Hide this card"
        className="press absolute right-3 top-3 flex size-9 items-center justify-center rounded-full text-lg text-butter-800 hover:bg-white/50"
      >
        <CloseIcon fontSize="inherit" />
      </button>
    </div>
  );
}
