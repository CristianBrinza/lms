import { useEffect } from 'react';

/** The browser bar / status bar colour of each kind of screen. */
export const THEME = { field: '#BABBF4', white: '#ffffff', butter: '#F6D47A' } as const;

/** Paints the phone's bars to match the top of the screen showing. */
export function useThemeColor(color: string): void {
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
    document.documentElement.style.background = color;
  }, [color]);
}
