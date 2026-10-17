import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { daysUntil } from './format';
import { cachedFor } from './hooks';
import { everyone, seenCount, seenLabel, seenState } from './household';
import type { MemberProgress, TitleResponse } from './types';
import { defaultWho, remembersWho } from './view';

afterEach(() => setLocale('en'));

const member = (patch: Partial<MemberProgress> = {}): MemberProgress => ({
  userId: 'u1',
  name: 'Patricia',
  status: null,
  plays: 0,
  lastWatchedAt: null,
  progress: null,
  ...patch,
});

describe('who a new play is for', () => {
  it('is the person viewed, the people together, else who watched it last', () => {
    const remembered = ['me', 'pat'];
    expect(defaultWho({ kind: 'person', id: 'pat' }, ['me'])).toEqual(['pat']);
    expect(defaultWho({ kind: 'together', ids: ['me', 'pat'] }, ['me'])).toEqual(['me', 'pat']);
    expect(defaultWho({ kind: 'me' }, remembered)).toEqual(remembered);
    expect(defaultWho({ kind: 'household' }, ['me'])).toEqual(['me']);
    // A copy, never the remembered array itself.
    expect(defaultWho({ kind: 'me' }, remembered)).not.toBe(remembered);
  });

  it('remembers a choice only in my own views', () => {
    expect(remembersWho({ kind: 'me' })).toBe(true);
    expect(remembersWho({ kind: 'household' })).toBe(true);
    expect(remembersWho({ kind: 'person', id: 'pat' })).toBe(false);
    expect(remembersWho({ kind: 'together', ids: ['a', 'b'] })).toBe(false);
  });
});

describe('who has seen it', () => {
  it('a show: not yet, up to an episode, caught up or all of it', () => {
    expect(seenLabel(seenState(member(), 'tv'))).toBe('Not yet');
    expect(seenLabel(seenState(member({ status: 'watchlist' }), 'tv'))).toBe('On the watchlist');
    const partway = member({
      plays: 12,
      progress: { watched: 12, aired: 30, furthest: { season: 2, episode: 4 }, next: null },
    });
    expect(seenState(partway, 'tv')).toMatchObject({ kind: 'upTo', season: 2, episode: 4 });
    expect(seenLabel(seenState(partway, 'tv'))).toMatch(/^Up to S2.*E4 · 12 of 30$/);
    const done = member({
      plays: 30,
      progress: { watched: 30, aired: 30, furthest: { season: 3, episode: 10 }, next: null },
    });
    expect(seenLabel(seenState(done, 'tv', true))).toBe('Seen all of it');
    expect(seenLabel(seenState(done, 'tv', false))).toBe('All caught up');
  });

  it('a film: how many times and when last', () => {
    expect(seenLabel(seenState(member({ plays: 2 }), 'movie'))).toBe('Watched 2 times');
    expect(
      seenLabel(seenState(member({ plays: 1, lastWatchedAt: '2024-03-05T20:00:00Z' }), 'movie')),
    ).toBe('Watched once · last 5 Mar 2024');
    setLocale('ro');
    expect(seenLabel(seenState(member(), 'movie'))).toBe('Încă nu');
  });

  it('counts the household, the person viewed included', () => {
    const data = {
      title: { kind: 'movie' },
      mine: {
        status: 'completed',
        playCount: 1,
        lastWatchedAt: null,
        progress: null,
        next: null,
      },
      household: [member({ userId: 'ana', name: 'Ana' })],
    } as unknown as TitleResponse;
    // An older server without `members`: the viewed person comes from `mine`.
    const all = everyone(data, 'pat', 'Patricia');
    expect(all.map((m) => m.name)).toEqual(['Patricia', 'Ana']);
    expect(seenCount(all, 'movie')).toEqual({ seen: 1, of: 2 });
    const withMembers = { ...data, members: [member({ plays: 1 }), member({ userId: 'x' })] };
    expect(everyone(withMembers, 'pat', 'Patricia')).toBe(withMembers.members);
  });
});

describe('optimistic ticks', () => {
  it('reach only the cached views of the people a play is for', () => {
    // My view ('{}'), Patricia's ('{"userId":"pat"}').
    expect(cachedFor('{}', ['pat'], 'me')).toBe(false);
    expect(cachedFor('{"userId":"pat"}', ['pat'], 'me')).toBe(true);
    expect(cachedFor('{}', ['me', 'pat'], 'me')).toBe(true);
    expect(cachedFor('{}', undefined, 'me')).toBe(true);
    expect(cachedFor('{"userId":"pat"}', undefined, 'me')).toBe(false);
  });
});

describe('days until an air date', () => {
  it('counts whole days, across months and the clock change', () => {
    expect(daysUntil('2026-10-17', '2026-10-17')).toBe(0);
    expect(daysUntil('2026-10-20', '2026-10-17')).toBe(3);
    expect(daysUntil('2026-11-02', '2026-10-24')).toBe(9);
    expect(daysUntil('2026-10-16', '2026-10-17')).toBe(-1);
  });
});
