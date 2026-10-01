import { useState } from 'react';
import { CloseIcon } from '@/components/ui/icons';
import { currentPlatform } from '@/lib/platform';
import { useInstallPrompt } from '@/lib/pwa';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import { FeatureCard } from './FeatureCard';

/**
 * The yellow app's featured card: in the browser only, it offers the Home Screen app. Dismissed
 * once, it stays away on this device.
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
    <FeatureCard
      to="/app"
      tone="butter"
      title="Put LMS on your Home Screen"
      pills={['1 minute', 'No store']}
      className="pr-8"
      corner={
        <button
          type="button"
          onClick={hide}
          aria-label="Hide this card"
          title="Hide this card"
          className="press absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full text-base text-butter-800 hover:bg-white/50"
        >
          <CloseIcon fontSize="inherit" />
        </button>
      }
    />
  );
}
