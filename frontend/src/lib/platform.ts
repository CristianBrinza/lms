import { storage, STORAGE_KEYS } from './storage';

/**
 * Device detection for the install guide (/app) and the web-or-app start page. Pure function
 * of the user agent + a few navigator facts, so it is unit-testable.
 */

export type OS = 'ios' | 'ipados' | 'android' | 'desktop';
export type Browser = 'safari' | 'chrome' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'other';
export type InAppBrowser = 'instagram' | 'facebook' | 'tiktok' | 'telegram' | 'other' | null;

export interface Platform {
  os: OS;
  browser: Browser;
  inApp: InAppBrowser;
  standalone: boolean;
  /** Phones and tablets — where the landing page and "add to home screen" make sense. */
  mobile: boolean;
}

export function detectPlatform(
  ua: string,
  opts: { maxTouchPoints?: number; standalone?: boolean } = {},
): Platform {
  const isIPadOS = /Macintosh/.test(ua) && (opts.maxTouchPoints ?? 0) > 1;
  const os: OS = /iPhone|iPod/.test(ua)
    ? 'ios'
    : /iPad/.test(ua) || isIPadOS
      ? 'ipados'
      : /Android/i.test(ua)
        ? 'android'
        : 'desktop';

  const inApp: InAppBrowser = /Instagram/i.test(ua)
    ? 'instagram'
    : /FBAN|FBAV|FB_IAB|FBIOS|Messenger/i.test(ua)
      ? 'facebook'
      : /musical_ly|TikTok|BytedanceWebview|ByteLocale/i.test(ua)
        ? 'tiktok'
        : /Telegram/i.test(ua)
          ? 'telegram'
          : /; wv\)|\bLine\/|Snapchat|Pinterest/i.test(ua)
            ? 'other'
            : null;

  let browser: Browser = 'other';
  if (/EdgiOS|EdgA|Edg\//.test(ua)) browser = 'edge';
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/OPR\/|OPiOS|OPT\//.test(ua)) browser = 'opera';
  else if (/FxiOS|Firefox\//.test(ua)) browser = 'firefox';
  else if (/CriOS|Chrome\//.test(ua)) browser = 'chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari';

  return { os, browser, inApp, standalone: Boolean(opts.standalone), mobile: os !== 'desktop' };
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    // Every way an installed app can be shown (fullscreen on some Androids, window controls on desktops).
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches ||
    window.matchMedia?.('(display-mode: window-controls-overlay)').matches ||
    nav.standalone === true
  );
}

let cached: Platform | null = null;
export function currentPlatform(): Platform {
  if (!cached) {
    cached = detectPlatform(navigator.userAgent, {
      maxTouchPoints: navigator.maxTouchPoints,
      standalone: isStandalone(),
    });
  }
  return cached;
}

/**
 * A browser (phone or computer) that has not been offered "web or app" yet. Remembered per
 * browser, so a link opened in Telegram's or Instagram's own browser and then in Safari gets the
 * choice in each (their storage is separate). The installed app never sees it.
 */
export function needsLanding(): boolean {
  if (currentPlatform().standalone) return false;
  return storage.get(STORAGE_KEYS.landingSeen) === null;
}

export function markLandingSeen(): void {
  storage.set(STORAGE_KEYS.landingSeen, new Date().toISOString());
}

/** Where a signed-out visitor starts: the web-or-app choice the first time, else sign-in. */
export function signedOutStart(): '/' | '/login' {
  return needsLanding() ? '/' : '/login';
}
