import { currentPlatform } from '@/lib/platform';
import { settingsT } from './i18n';

/**
 * Web push on this device: whether it can, and turning it on and off. The service worker that
 * shows the messages is public/push-sw.js (imported into the app's worker by vite.config.ts).
 */

/** A VAPID public key (base64url) as the bytes pushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export type PushSupport = 'ok' | 'install-first' | 'unsupported';

/** iPhone and iPad get notifications only in the Home Screen app (iOS 16.4+). */
export function pushSupport(): PushSupport {
  const platform = currentPlatform();
  const apple = platform.os === 'ios' || platform.os === 'ipados';
  const apis =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window;
  if (apple && !platform.standalone) return 'install-first';
  return apis ? 'ok' : 'unsupported';
}

/** The app's service worker, or null when there is none (development, private windows). */
async function registration(timeoutMs = 4000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  // Installing right now: wait for it, but not forever.
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/** This device's subscription, if reminders are on here. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== 'ok') return null;
  // No worker registered: nothing can be subscribed here (no need to wait for one).
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export class PushError extends Error {}

/** Asks for permission and subscribes this device. Throws PushError with a sentence to show. */
export async function subscribeDevice(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission === 'denied') throw new PushError(settingsT().blocked);
  if (permission !== 'granted') throw new PushError(settingsT().notAllowed);
  const reg = await registration();
  if (!reg) throw new PushError(settingsT().needsApp);
  const key = urlBase64ToUint8Array(publicKey);
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // Made with another server key: replace it.
    const same =
      existing.options.applicationServerKey &&
      sameBytes(new Uint8Array(existing.options.applicationServerKey), key);
    if (same) return existing;
    await existing.unsubscribe();
  }
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
}

/** Unsubscribes this device; returns the endpoint it had, for the server to forget. */
export async function unsubscribeDevice(): Promise<string | null> {
  const subscription = await currentSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}
