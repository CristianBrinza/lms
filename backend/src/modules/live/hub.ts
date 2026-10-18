/**
 * Live sync: who is listening right now, and to what. One API process serves everyone (the PC,
 * behind one tunnel), so an in-memory list is the whole publish/subscribe: no broker.
 *
 * An event says only what changed and where (the area and the request path), never the data:
 * the app refetches what it shows, through the usual routes and their checks.
 */

export const LIVE_AREAS = [
  'food',
  'house',
  'training',
  'travel',
  'watching',
  'wishlist',
  'drinks',
  'closet',
  'medication',
  'assistant',
  'reminders',
  'people',
  'paydays',
  'other',
] as const;
export type LiveArea = (typeof LIVE_AREAS)[number];

export interface LiveEvent {
  area: LiveArea;
  /** The request that made the change, e.g. /api/food/stock (no query string). */
  path: string;
  /** Who made it. */
  by: string;
  /** When, ISO 8601. */
  at: string;
}

/** Who an event is for: the person and their household, or everyone signed in. */
export type LiveAudience = { userId: string; householdId: string | null } | 'everyone';

export interface LiveListener {
  readonly userId: string;
  /** Mutable: the admin can seat someone in another household while their stream is open. */
  householdId: string | null;
  send(event: LiveEvent): void;
  /** Look at the session again now (signed out, deactivated, moved), instead of at the next beat. */
  wake(): void;
  close(): void;
}

export class LiveHub {
  private readonly listeners = new Set<LiveListener>();

  subscribe(listener: LiveListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Each listener gets the event once, even when it is both the person and their household. */
  publish(event: LiveEvent, audience: LiveAudience): void {
    for (const listener of this.listeners) {
      const reaches =
        audience === 'everyone' ||
        listener.userId === audience.userId ||
        (audience.householdId !== null && listener.householdId === audience.householdId);
      if (reaches) listener.send(event);
    }
  }

  /** The person's household changed (their kitchen was just made, or the admin moved them). */
  rehome(userId: string, householdId: string | null): void {
    for (const listener of this.listeners)
      if (listener.userId === userId) listener.householdId = householdId;
  }

  wake(userId: string): void {
    for (const listener of this.listeners) if (listener.userId === userId) listener.wake();
  }

  /** Shutting down: end every stream, so the apps reconnect to the next process at once. */
  closeAll(): void {
    for (const listener of [...this.listeners]) listener.close();
    this.listeners.clear();
  }

  get size(): number {
    return this.listeners.size;
  }
}
