import { describe, expect, it } from 'vitest';
import { episodesLine, groupPlays } from './components/rows';
import type { PlayLine } from './types';

const title = { id: 'tv:1', kind: 'tv', title: 'Eden', year: 2026, posterPath: null } as never;
const play = (episode: number, userId: string, together: string[] = [], day = '2026-10-17'): PlayLine => ({
  id: `${userId}-${episode}-${Math.random()}`,
  userId,
  together,
  title,
  season: 1,
  episode,
  watchedAt: `${day}T12:00:00.000Z`,
  precision: 'day',
});
const count = (n: number) => `${n} episodes`;

describe('recent: one line per show per day', () => {
  it('a season and part of it again is one line', () => {
    const plays = [
      ...[1, 2, 3].map((e) => play(e, 'a', ['b'])),
      ...[1, 2, 3].map((e) => play(e, 'b', ['a'])),
      ...[1, 2, 3, 4, 5, 6, 7].map((e) => play(e, 'a')),
    ];
    const groups = groupPlays(plays);
    expect(groups).toHaveLength(1);
    expect(episodesLine(groups[0]!, count, 'again')).toBe('S1 E1–7 · again E1–3');
  });
  it('two people in one sitting count once; other days stay apart', () => {
    const plays = [play(1, 'a', ['b']), play(1, 'b', ['a']), play(2, 'a', [], '2026-10-16')];
    const groups = groupPlays(plays);
    expect(groups).toHaveLength(2);
    expect(episodesLine(groups[0]!, count, 'again')).toBe('S1 E1');
  });
});
