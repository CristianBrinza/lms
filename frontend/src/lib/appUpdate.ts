import { BUILD } from '@/build-info';

/**
 * Whether the server has a different build from the one running: another version, or the same
 * version built again.
 */
export async function newBuildOnServer(): Promise<boolean> {
  try {
    const response = await fetch('/version.json', { cache: 'no-store' });
    if (!response.ok) return false;
    const live = (await response.json()) as { version?: unknown; builtAt?: unknown };
    if (typeof live.version !== 'string' || typeof live.builtAt !== 'string') return false;
    return live.version !== BUILD.version || live.builtAt !== BUILD.builtAt;
  } catch {
    return false;
  }
}

/** What the new service worker asks every open window (public/update-sw.js); answering means "I update myself". */
export const UPDATE_MESSAGE = 'lms:update-ready';

/** Screens where a reload could lose what the person is typing. */
export const BUSY_PATHS = /^\/(login|welcome|profile|admin\/users\/[^/]+)(\/|$)/;

/**
 * A new version is ready: everyone moves to it straight away (the page reloads where it is, on
 * screen or in the background), except in the middle of a form, where "Update" waits for a tap
 * and nothing typed is lost.
 */
export function reloadsAtOnce(path: string): boolean {
  return !BUSY_PATHS.test(path);
}
