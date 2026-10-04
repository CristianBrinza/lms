import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  add,
  countdown,
  elapsed,
  endsAt,
  fraction,
  idleWatch,
  isOver,
  isRunning,
  pause,
  remaining,
  secondsLeft,
  secondsRun,
  start,
  stopwatch,
} from './clock';

describe('clock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T08:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('counts nothing until started', () => {
    vi.advanceTimersByTime(5000);
    expect(elapsed(idleWatch)).toBe(0);
    expect(isRunning(idleWatch)).toBe(false);
  });

  it('counts from the wall clock, not from ticks', () => {
    const watch = start(idleWatch);
    // A locked phone: no timers fire, the clock still moves.
    vi.setSystemTime(Date.now() + 90_000);
    expect(secondsRun(watch)).toBe(90);
  });

  it('leaves pauses out', () => {
    let watch = start(idleWatch);
    vi.advanceTimersByTime(10_000);
    watch = pause(watch);
    vi.advanceTimersByTime(60_000);
    expect(elapsed(watch)).toBe(10_000);
    watch = start(watch);
    vi.advanceTimersByTime(5_000);
    expect(elapsed(watch)).toBe(15_000);
  });

  it('ignores a second start or pause', () => {
    const running = start(idleWatch);
    vi.advanceTimersByTime(1000);
    expect(start(running)).toBe(running);
    const paused = pause(running);
    expect(pause(paused)).toBe(paused);
  });

  it('counts a countdown down and says when it ends', () => {
    let timer = start(countdown(30));
    expect(endsAt(timer)).toBe(Date.now() + 30_000);
    vi.advanceTimersByTime(29_200);
    expect(secondsLeft(timer)).toBe(1);
    expect(isOver(timer)).toBe(false);
    vi.advanceTimersByTime(800);
    expect(isOver(timer)).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(remaining(timer)).toBe(0);
    expect(fraction(timer)).toBe(1);
    timer = pause(timer);
    expect(endsAt(timer)).toBeNull();
  });

  it('holds a paused countdown where it was', () => {
    let timer = start(countdown(60));
    vi.advanceTimersByTime(20_000);
    timer = pause(timer);
    vi.advanceTimersByTime(120_000);
    expect(secondsLeft(timer)).toBe(40);
    expect(fraction(timer)).toBeCloseTo(1 / 3);
  });

  it('adds and takes away time, never below what has run', () => {
    let timer = start(countdown(60));
    vi.advanceTimersByTime(10_000);
    timer = add(timer, 15);
    expect(secondsLeft(timer)).toBe(65);
    timer = add(timer, -15);
    expect(secondsLeft(timer)).toBe(50);
    timer = add(timer, -120);
    expect(remaining(timer)).toBe(0);
    expect(isOver(timer)).toBe(true);
  });

  it('counts a stopwatch up without end', () => {
    const watch = start(stopwatch());
    vi.advanceTimersByTime(3_600_000);
    expect(secondsRun(watch)).toBe(3600);
    expect(isOver(watch)).toBe(false);
    expect(remaining(watch)).toBe(Infinity);
    expect(add(watch, 15)).toBe(watch);
  });

  it('survives a round trip through JSON (sessionStorage)', () => {
    const timer = start(countdown(45));
    vi.advanceTimersByTime(5_000);
    const back = JSON.parse(JSON.stringify(timer)) as typeof timer;
    vi.advanceTimersByTime(5_000);
    expect(secondsLeft(back)).toBe(35);
  });
});
