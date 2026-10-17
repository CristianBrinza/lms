/**
 * The LMS app for iPhone (ios/) shows this web app in a native shell and adds what a web page
 * can't do: read Apple Health, and location in the background. It puts `window.LMSNative` on the
 * page before any of the app's code runs; in a browser it is absent. Every call answers with a
 * Promise; a failure rejects with an Error whose message is a short code (`notSignedIn`, …).
 * The app also tells the page when something changed, with a `lmsnative` event on window.
 */

export interface NativeHealthStatus {
  /** HealthKit exists on this device. */
  available: boolean;
  /** Apple Health was connected in the app. */
  connected: boolean;
  /** The app holds its own access key (made for it on connecting, never shown). */
  linked: boolean;
  syncing: boolean;
  /** ISO time of the last sync that reached LMS. */
  lastSync: string | null;
  /** Why the last sync failed: `signedOut`, `network`, `server`, `health`… */
  lastError: string | null;
  /** Days and workouts the last sync sent. */
  days: number;
  workouts: number;
  /** Allowed to write what was eaten into Apple Health. */
  writesEaten: boolean;
}

export type NativeLocationAuthorization =
  'notDetermined' | 'restricted' | 'denied' | 'whenInUse' | 'always';

export interface NativeLocationStatus {
  authorization: NativeLocationAuthorization;
  precise: boolean;
  /** Places being watched for arriving or leaving. */
  regions: number;
}

export interface NativeLocation {
  lat: number;
  lng: number;
  /** Metres. */
  accuracy: number;
  at: string;
}

/** A place to watch (at most 20). With `message`, arriving (or leaving) shows it as a notification. */
export interface NativeRegion {
  id: string;
  lat: number;
  lng: number;
  /** Metres, 100 at least; 150 when left out. */
  radius?: number;
  message?: string;
  onEnter?: boolean;
  onExit?: boolean;
}

export type NativeEvent =
  | { type: 'health'; status: NativeHealthStatus }
  | { type: 'location'; status: NativeLocationStatus }
  | { type: 'region'; id: string; event: 'enter' | 'exit' };

export interface LMSNative {
  platform: 'ios';
  version: string;
  health: {
    /** Makes the app's key if needed, asks for Apple Health, then syncs. */
    connect(): Promise<NativeHealthStatus>;
    syncNow(): Promise<NativeHealthStatus>;
    status(): Promise<NativeHealthStatus>;
  };
  location: {
    /** "While using" first, then "Always" (each asked once, as iOS allows). */
    request(): Promise<NativeLocationStatus>;
    current(): Promise<NativeLocation>;
    status(): Promise<NativeLocationStatus>;
    setRegions(regions: NativeRegion[]): Promise<NativeLocationStatus>;
    regions(): Promise<{
      regions: NativeRegion[];
      events: Array<{ id: string; event: 'enter' | 'exit'; at: string }>;
    }>;
  };
}

declare global {
  interface Window {
    LMSNative?: LMSNative;
  }
}

/** The event the app dispatches on window; its `detail` is a NativeEvent. */
export const NATIVE_EVENT = 'lmsnative';

/** The iPhone app's bridge, or null in a browser. */
export function nativeApp(): LMSNative | null {
  if (typeof window === 'undefined') return null;
  return window.LMSNative?.platform === 'ios' ? window.LMSNative : null;
}
