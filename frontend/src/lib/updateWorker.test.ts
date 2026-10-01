import { afterEach, describe, expect, it, vi } from 'vitest';
import SOURCE from '../../public/update-sw.js?raw';
import { reloadsAtOnce } from './appUpdate';

/*
 * public/update-sw.js, run as the service worker runs it, against a fake activation: windows open
 * on an older version move to the new one, by themselves when their code can, else reloaded by the
 * worker; a first visit is never reloaded.
 */

/** A MessageChannel whose port2, handed to a window, answers straight to port1. */
class FakeChannel {
  port1: { onmessage: ((event: unknown) => void) | null } = { onmessage: null };
  port2 = { postMessage: (data: unknown) => this.port1.onmessage?.({ data }) };
}

interface FakeWindow {
  url: string;
  navigate: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
}

/** A window; `answers`: its code knows the message (a version with UpdatePrompt's listener). */
function fakeWindow(url: string, answers: boolean): FakeWindow {
  return {
    url,
    navigate: vi.fn(async () => undefined),
    postMessage: vi.fn((message: { type: string }, ports: FakeChannel['port2'][]) => {
      if (answers && message.type === 'lms:update-ready') ports[0]!.postMessage('ok');
    }),
  };
}

function worker(controlled: FakeWindow[]) {
  const listeners: Record<string, (event: unknown) => void> = {};
  const self = {
    skipWaiting: vi.fn(),
    clients: {
      // Only windows this registration controls: a first visit is not among them.
      matchAll: vi.fn(async () => controlled),
      claim: vi.fn(async () => undefined),
    },
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener;
    },
  };
  new Function('self', 'console', 'MessageChannel', 'setTimeout', SOURCE)(self, { warn: vi.fn() }, FakeChannel, setTimeout);
  const dispatch = async (type: string) => {
    const waits: Promise<unknown>[] = [];
    listeners[type]!({ waitUntil: (promise: Promise<unknown>) => waits.push(promise) });
    await Promise.all(waits);
  };
  return { self, listeners, dispatch };
}

afterEach(() => vi.useRealTimers());

describe('a new version takes over every open app', () => {
  it('installs without waiting for the old one to close', () => {
    const { self, listeners } = worker([]);
    listeners.install!({});
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('reloads windows of an app installed before, and lets newer ones update themselves', async () => {
    vi.useFakeTimers();
    const old = fakeWindow('https://lms.example.com/home', false);
    const current = fakeWindow('https://lms.example.com/profile', true);
    const { self, dispatch } = worker([old, current]);

    const activated = dispatch('activate');
    await vi.advanceTimersByTimeAsync(1500);
    await activated;

    expect(self.clients.claim).toHaveBeenCalled();
    expect(old.navigate).toHaveBeenCalledWith('https://lms.example.com/home');
    // Its own code decides (a form in progress is not reloaded under the person's thumb).
    expect(current.navigate).not.toHaveBeenCalled();
  });

  it('never reloads a first visit (no window was controlled yet)', async () => {
    const { self, dispatch } = worker([]);
    await dispatch('activate');
    expect(self.clients.claim).toHaveBeenCalled();
  });
});

describe('the app itself, when a new version is ready', () => {
  it('reloads at once wherever no form is open', () => {
    expect(reloadsAtOnce('/home')).toBe(true);
    expect(reloadsAtOnce('/app')).toBe(true);
    expect(reloadsAtOnce('/settings')).toBe(true);
    expect(reloadsAtOnce('/admin/users')).toBe(true);
  });

  it('waits for a tap in the middle of a form', () => {
    expect(reloadsAtOnce('/login')).toBe(false);
    expect(reloadsAtOnce('/welcome')).toBe(false);
    expect(reloadsAtOnce('/profile')).toBe(false);
    expect(reloadsAtOnce('/admin/users/new')).toBe(false);
    expect(reloadsAtOnce('/admin/users/66b70884-00f0-4cc4-beb3-7e5038f5fe4e')).toBe(false);
  });
});
