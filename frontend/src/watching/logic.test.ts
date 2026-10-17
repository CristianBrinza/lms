import { describe, expect, it } from 'vitest';
import {
  backfillCount,
  backfillInput,
  episodeCode,
  fillDays,
  latestPlay,
  monthRange,
  nextEpisode,
  peakPart,
  percent,
  shiftMonth,
  showProgress,
  splitMinutes,
  whenValue,
} from './logic';
import type { Play, TitleSeason } from './types';

const season = (n: number, count: number): TitleSeason => ({
  n,
  name: `Season ${n}`,
  episodeCount: count,
  airDate: null,
  posterPath: null,
});
const SEASONS = [season(0, 3), season(1, 3), season(2, 2)];
let id = 0;
const play = (s: number | null, e: number | null, watchedAt = '2026-10-01T20:00:00Z'): Play => ({
  id: String(++id),
  userId: 'me',
  titleId: 'tv:1',
  season: s,
  episode: e,
  watchedAt,
  precision: 'exact',
  runtime: 45,
  source: 'app',
  groupId: null,
  together: [],
});

describe('next episode and progress', () => {
  it('starts at the first episode and ignores specials', () => {
    expect(nextEpisode(SEASONS, [])).toEqual({ season: 1, episode: 1 });
    expect(nextEpisode(SEASONS, [play(0, 2)])).toEqual({ season: 1, episode: 1 });
  });

  it('follows the furthest episode seen, across seasons', () => {
    expect(nextEpisode(SEASONS, [play(1, 1), play(1, 3)])).toEqual({ season: 2, episode: 1 });
  });

  it('is null when everything aired is seen', () => {
    const all = [play(1, 1), play(1, 2), play(1, 3), play(2, 1), play(2, 2)];
    expect(nextEpisode(SEASONS, all)).toBeNull();
    // S2E2 isn't out yet: nothing next after S2E1.
    expect(nextEpisode(SEASONS, all.slice(0, 4), { season: 2, episode: 2 })).toBeNull();
  });

  it('takes a set worked out elsewhere (watching together)', () => {
    expect(nextEpisode(SEASONS, new Set(['1:1', '1:2']))).toEqual({ season: 1, episode: 3 });
  });

  it('counts progress over aired episodes, a rewatch once', () => {
    expect(showProgress(SEASONS, [play(1, 1), play(1, 1), play(2, 1)])).toEqual({
      watched: 2,
      total: 5,
      share: 0.4,
    });
    expect(showProgress([], []).share).toBe(0);
  });

  it('writes codes and shares', () => {
    expect(episodeCode(3, 12)).toBe('S3 E12');
    expect(percent(0.456)).toBe(46);
    expect(percent(2)).toBe(100);
    expect(percent(Number.NaN)).toBe(0);
  });

  it('finds the latest play to undo', () => {
    const plays = [
      play(1, 1, '2026-01-01T00:00:00Z'),
      play(1, 1, '2026-05-01T00:00:00Z'),
      play(null, null),
    ];
    expect(latestPlay(plays, 1, 1)?.watchedAt).toBe('2026-05-01T00:00:00Z');
    expect(latestPlay(plays, null, null)?.season).toBeNull();
    expect(latestPlay(plays, 2, 1)).toBeNull();
  });
});

describe('marking the past', () => {
  it('asks the server for the whole show, a season or up to an episode', () => {
    expect(backfillInput({ kind: 'show' })).toEqual({ all: true });
    expect(backfillInput({ kind: 'season', season: 2 })).toEqual({ season: 2, all: true });
    expect(backfillInput({ kind: 'through', season: 2, episode: 1 })).toEqual({
      upTo: { season: 2, episode: 1 },
    });
  });

  it('counts what a choice covers, never what has not aired', () => {
    expect(backfillCount(SEASONS, { kind: 'show' })).toBe(5);
    expect(backfillCount(SEASONS, { kind: 'season', season: 1 })).toBe(3);
    expect(backfillCount(SEASONS, { kind: 'through', season: 2, episode: 1 })).toBe(4);
    expect(backfillCount(SEASONS, { kind: 'show' }, { season: 2, episode: 1 })).toBe(3);
  });

  it('turns "when" into what the server reads', () => {
    const today = '2026-10-17';
    expect(whenValue({ kind: 'now' }, today)).toBeUndefined();
    expect(whenValue({ kind: 'date', date: '2025-03-02' }, today)).toBe('2025-03-02');
    expect(whenValue({ kind: 'date', date: '2026-10-17' }, today)).toBeUndefined();
    expect(whenValue({ kind: 'month', month: '2024-07' }, today)).toBe('2024-07');
    expect(whenValue({ kind: 'month', month: '2026-10' }, today)).toBe('2026-10-17');
    expect(whenValue({ kind: 'month', month: '2026-11' }, today)).toBeUndefined();
    expect(whenValue({ kind: 'unknown' }, today)).toBe('unknown');
  });
});

describe('time', () => {
  it('walks months', () => {
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2024-02').to).toBe('2024-02-29');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('fills missing days with zero', () => {
    expect(fillDays('2026-10-01', '2026-10-03', [{ date: '2026-10-02', minutes: 45 }])).toEqual([
      { date: '2026-10-01', minutes: 0 },
      { date: '2026-10-02', minutes: 45 },
      { date: '2026-10-03', minutes: 0 },
    ]);
  });

  it('finds the peak part of the day', () => {
    expect(peakPart({ morning: 10, afternoon: 0, evening: 90, night: 30 })).toBe('evening');
    expect(peakPart({ morning: 0, afternoon: 0, evening: 0, night: 0 })).toBeNull();
  });

  it('splits minutes into days and hours', () => {
    expect(splitMinutes(1440 * 2 + 125)).toEqual({ days: 2, hours: 2, minutes: 5 });
  });
});
