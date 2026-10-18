import webpush from 'web-push';
import type { AppConfig } from '../../config';

/** A message for a phone's notification centre. `url` opens when it is tapped. */
export interface PushMessage {
  title: string;
  body: string;
  url: string;
  /** Same tag replaces the previous notification instead of piling up. */
  tag: string;
  /**
   * Buttons on the notification (where the phone shows them): tapping one sends `post` (a path of
   * this API) as the signed-in person, without opening the app.
   */
  actions?: Array<{ action: string; title: string; post: string }>;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Sends one web-push message. `gone`: the subscription no longer exists (forget it). */
export interface PushSender {
  publicKey: string;
  send(target: PushTarget, message: PushMessage): Promise<'ok' | 'gone' | 'error'>;
}

export function createPushSender(config: AppConfig['push']): PushSender | null {
  if (!config) return null;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return {
    publicKey: config.publicKey,
    async send(target, message) {
      try {
        await webpush.sendNotification(
          { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
          JSON.stringify(message),
          {
            TTL: 4 * 60 * 60,
            urgency: 'normal',
          },
        );
        return 'ok';
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: the subscription expired. 403: Apple's answer when the subscription was made
        // with another server key (VapidPkHashMismatch); it can never be delivered, so the device
        // is forgotten and shows reminders off until it subscribes again with the current key.
        if (status === 404 || status === 410 || status === 403) return 'gone';
        console.error('[push] send failed', status ?? (error as Error).message);
        return 'error';
      }
    },
  };
}
