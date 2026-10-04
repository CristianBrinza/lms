import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM = `${IPHONE_SAFARI.replace(' Safari/604.1', '')} Instagram 350.0.0.0`;
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const ANDROID_SAMSUNG =
  'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/28.0 Chrome/130.0.0.0 Mobile Safari/537.36';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

describe('detectPlatform (which install steps to show)', () => {
  it('recognises iPhone Safari and in-app browsers', () => {
    expect(detectPlatform(IPHONE_SAFARI)).toMatchObject({
      os: 'ios',
      browser: 'safari',
      inApp: null,
      mobile: true,
    });
    expect(detectPlatform(IPHONE_INSTAGRAM)).toMatchObject({ os: 'ios', inApp: 'instagram' });
  });

  it('treats a touch "Mac" as an iPad', () => {
    expect(detectPlatform(IPAD_DESKTOP_MODE, { maxTouchPoints: 5 }).os).toBe('ipados');
    expect(detectPlatform(IPAD_DESKTOP_MODE, { maxTouchPoints: 0 }).os).toBe('desktop');
  });

  it('recognises Android browsers', () => {
    expect(detectPlatform(ANDROID_CHROME)).toMatchObject({ os: 'android', browser: 'chrome' });
    expect(detectPlatform(ANDROID_SAMSUNG)).toMatchObject({ os: 'android', browser: 'samsung' });
  });

  it('treats laptops and desktops as computers', () => {
    expect(detectPlatform(MAC_CHROME)).toMatchObject({
      os: 'desktop',
      browser: 'chrome',
      mobile: false,
    });
  });

  it('knows when it runs as the installed app', () => {
    expect(detectPlatform(IPHONE_SAFARI, { standalone: true }).standalone).toBe(true);
  });
});
