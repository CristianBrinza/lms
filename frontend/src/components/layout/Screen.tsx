import type { ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { THEME, useThemeColor } from '@/lib/themeColor';

/**
 * A signed-in screen's ground. `field`: the task app's lavender (Home). `white`: the mood app's
 * plain white screens (settings, profile, people); on desktop a white panel beside the rail.
 * Leaves room at the bottom for the tab bar.
 */
export function Screen({
  tone,
  children,
  className,
  clearTabBar = true,
}: {
  tone: 'field' | 'white';
  children: ReactNode;
  className?: string;
  /** False when the page's last block reaches the bottom itself and pads for the tab bar (Home's sheet). */
  clearTabBar?: boolean;
}) {
  useThemeColor(tone === 'white' ? THEME.white : THEME.field);
  return (
    <div
      className={cx(
        'animate-page min-h-dvh lg:min-h-[calc(100dvh-2rem)]',
        clearTabBar && 'pb-[calc(var(--tabbar-h)+var(--safe-bottom)+1.5rem)] lg:pb-10',
        tone === 'white' && 'bg-white lg:rounded-3xl lg:shadow-card',
        className,
      )}
    >
      {children}
    </div>
  );
}
