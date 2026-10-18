import { createMiddleware } from 'hono/factory';
import type { AppDeps, AppEnv } from '../../context';
import type { LiveArea, LiveAudience } from './hub';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Requests that change nothing the family sees: signing in and out, devices, keys, passwords,
 * this device's push subscription. MCP is published by its own handler (modules/mcp/server.ts),
 * per tool that wrote, since every JSON-RPC call is a POST, reads included.
 */
const QUIET = [
  /^\/api\/auth\//,
  /^\/api\/oauth\//,
  /^\/api\/mcp(\/|$)/,
  /^\/api\/events$/,
  /^\/api\/me\/(sessions|tokens|password|push)(\/|$)/,
];

/** The part of the app a change belongs to, from the request path; null when nobody needs it. */
export function areaOf(path: string): LiveArea | null {
  if (QUIET.some((pattern) => pattern.test(path))) return null;
  // The House lives on the kitchen's routes (/api/food with area=house): the app refreshes both.
  if (/^\/api\/food(\/|$)/.test(path)) return 'food';
  if (/^\/api\/training(\/|$)/.test(path)) return 'training';
  if (/^\/api\/travel(\/|$)/.test(path)) return 'travel';
  if (/^\/api\/watching(\/|$)/.test(path)) return 'watching';
  if (/^\/api\/wishlist(\/|$)/.test(path)) return 'wishlist';
  if (/^\/api\/drinks(\/|$)/.test(path)) return 'drinks';
  if (/^\/api\/closet(\/|$)/.test(path)) return 'closet';
  if (/^\/api\/medication(\/|$)/.test(path)) return 'medication';
  if (/^\/api\/me\/reminders(\/|$)/.test(path)) return 'reminders';
  // Names, pictures, paydays and household seats: the profile, the admin's people screens.
  if (/^\/api\/me(\/avatar)?$/.test(path)) return 'people';
  if (/^\/api\/(admin|users)(\/|$)/.test(path)) return 'people';
  return 'other';
}

/** The area of an MCP tool that wrote, by its name (tools are named for what they touch). */
export function toolArea(name: string): LiveArea {
  if (/^watching_/.test(name)) return 'watching';
  if (/^buy_list/.test(name)) return 'wishlist';
  if (/^drinks_/.test(name)) return 'drinks';
  if (/^closet_/.test(name)) return 'closet';
  if (/^medication_/.test(name)) return 'medication';
  if (/trip|packing|gear|bag/.test(name)) return 'travel';
  if (/exercise|routine|equipment|workout|training|health|nutrition|energy|goal/.test(name))
    return 'training';
  if (/person|people|share_kitchen|kitchens/.test(name)) return 'people';
  if (/reminder/.test(name)) return 'reminders';
  return 'food';
}

/**
 * Who hears about a change. Profiles and paydays are shown to every member (/api/me/paydays), so
 * people changes go to everyone signed in; reminders are the person's own; the rest is the
 * household's (food, house, training's shared equipment and each other's workouts, travel).
 */
export function audienceOf(
  area: LiveArea,
  userId: string,
  householdId: string | null,
): LiveAudience {
  if (area === 'people' || area === 'paydays') return 'everyone';
  if (area === 'reminders') return { userId, householdId: null };
  return { userId, householdId };
}

export function publishChange(
  deps: AppDeps,
  change: { area: LiveArea; path: string; userId: string; householdId: string | null },
): void {
  deps.live.publish(
    { area: change.area, path: change.path, by: change.userId, at: deps.now().toISOString() },
    audienceOf(change.area, change.userId, change.householdId),
  );
}

const ADMIN_USER = /^\/api\/admin\/users\/([0-9a-f-]{36})(\/|$)/i;

/**
 * After every change that worked (in the app, through an access key, or a tool calling the API
 * for Claude), tells the person's household so their open apps refetch it. Never fails the
 * request: the change is made whether or not anyone is listening.
 */
export function liveSync(deps: AppDeps) {
  return createMiddleware<AppEnv>(async (c, next) => {
    await next();
    try {
      const user = c.get('user');
      if (!user) return;
      const actor = c.get('actor');
      const householdId = actor?.householdId ?? user.householdId;
      // Opening Food the first time makes the person's kitchen: their stream joins it now.
      if (householdId !== user.householdId) deps.live.rehome(user.id, householdId);
      if (!UNSAFE_METHODS.has(c.req.method) || c.res.status >= 400) return;
      const path = c.req.path;

      // Sessions ended, a password changed, someone deactivated or moved: their open streams
      // check their session now rather than at the next heartbeat.
      if (/^\/api\/me\/(sessions|password)(\/|$)/.test(path)) deps.live.wake(user.id);
      const target = ADMIN_USER.exec(path)?.[1];
      if (target) deps.live.wake(target);

      const area = areaOf(path);
      if (area) publishChange(deps, { area, path, userId: user.id, householdId });
    } catch (error) {
      console.error('[live] publish failed', error);
    }
  });
}
