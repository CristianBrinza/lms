/**
 * Timers kept as timestamps, never as counted ticks: what has run is worked out from the wall
 * clock whenever it's asked, so a throttled background tab or a phone locked mid-plank comes back
 * to the right number. Plain immutable objects, so they can be kept in React state and in
 * sessionStorage as they are. All times are milliseconds.
 */

export interface Watch {
  /** When the current run began (epoch ms); null while stopped. */
  readonly since: number | null;
  /** Time run before the current run. */
  readonly banked: number;
}

/** A countdown is a watch with a length; a null total counts up (a stopwatch). */
export interface Timer extends Watch {
  readonly total: number | null;
}

export const idleWatch: Watch = { since: null, banked: 0 };

export const isRunning = (watch: Watch) => watch.since !== null;

export function elapsed(watch: Watch, now = Date.now()): number {
  return watch.banked + (watch.since === null ? 0 : Math.max(0, now - watch.since));
}

export function start<T extends Watch>(watch: T, now = Date.now()): T {
  return watch.since === null ? { ...watch, since: now } : watch;
}

export function pause<T extends Watch>(watch: T, now = Date.now()): T {
  return watch.since === null ? watch : { ...watch, since: null, banked: elapsed(watch, now) };
}

/** A countdown of `seconds`, not yet running. */
export const countdown = (seconds: number): Timer => ({
  since: null,
  banked: 0,
  total: Math.max(0, seconds) * 1000,
});

/** A stopwatch, not yet running. */
export const stopwatch = (): Timer => ({ since: null, banked: 0, total: null });

/** Lengthens (or with a negative number shortens) a countdown; never below what has run. */
export function add(timer: Timer, seconds: number, now = Date.now()): Timer {
  if (timer.total === null) return timer;
  const ran = elapsed(timer, now);
  return { ...timer, total: Math.max(Math.min(ran, timer.total), timer.total + seconds * 1000) };
}

/** What's left of a countdown (Infinity for a stopwatch). */
export function remaining(timer: Timer, now = Date.now()): number {
  if (timer.total === null) return Infinity;
  return Math.max(0, timer.total - elapsed(timer, now));
}

export const isOver = (timer: Timer, now = Date.now()) =>
  timer.total !== null && remaining(timer, now) <= 0;

/** When a running countdown reaches 0 (epoch ms), or null. */
export function endsAt(timer: Timer): number | null {
  if (timer.total === null || timer.since === null) return null;
  return timer.since + (timer.total - timer.banked);
}

/** Whole seconds left, as a countdown shows them (0.2 s left still reads "1"). */
export const secondsLeft = (timer: Timer, now = Date.now()) =>
  Math.ceil(remaining(timer, now) / 1000);

/** Whole seconds run. */
export const secondsRun = (watch: Watch, now = Date.now()) =>
  Math.floor(elapsed(watch, now) / 1000);

/** How far through a countdown, 0…1 (0 for a stopwatch). */
export function fraction(timer: Timer, now = Date.now()): number {
  if (!timer.total) return timer.total === 0 ? 1 : 0;
  return Math.min(1, elapsed(timer, now) / timer.total);
}
