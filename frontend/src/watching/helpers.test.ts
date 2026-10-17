import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '@/i18n';
import { formatLongMinutes, formatMinutes, formatVote, monthLine } from './format';
import { posterSources, profileImage, stillSources, tmdbImage } from './images';
import type { Play } from './types';
import { toggleInView, viewQuery, watchedByAll } from './view';

afterEach(() => setLocale('en'));

describe('TMDB image URLs', () => {
  it('builds sized URLs and nothing without a path', () => {
    expect(tmdbImage('/abc.jpg', 'w185')).toBe('https://image.tmdb.org/t/p/w185/abc.jpg');
    expect(tmdbImage('abc.jpg', 'w92')).toBe('https://image.tmdb.org/t/p/w92/abc.jpg');
    expect(tmdbImage(null, 'w342')).toBeNull();
    expect(profileImage('/p.jpg')).toBe('https://image.tmdb.org/t/p/w185/p.jpg');
  });

  it('gives posters w185 and w342, stills w300 and w780', () => {
    expect(posterSources('/x.jpg')).toEqual({
      src: 'https://image.tmdb.org/t/p/w185/x.jpg',
      srcSet:
        'https://image.tmdb.org/t/p/w185/x.jpg 185w, https://image.tmdb.org/t/p/w342/x.jpg 342w',
    });
    expect(stillSources('/s.jpg')?.srcSet).toBe(
      'https://image.tmdb.org/t/p/w300/s.jpg 300w, https://image.tmdb.org/t/p/w780/s.jpg 780w',
    );
    expect(posterSources(undefined)).toBeNull();
  });
});

describe('stats formatting', () => {
  it('writes minutes the short way', () => {
    setLocale('en');
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(130)).toBe('2 h 10 min');
    expect(formatMinutes(120)).toBe('2 h');
    expect(formatMinutes(725)).toBe('12 h');
    expect(formatLongMinutes(1440 * 3 + 300)).toBe('3 days 5 h');
    expect(formatLongMinutes(90)).toBe('1 h 30 min');
  });

  it('writes the month line like the reference, skipping zeros', () => {
    setLocale('en');
    expect(monthLine({ episodes: 7, shows: 1, movies: 2, plays: 9, minutes: 400 })).toBe(
      '7 episodes · 1 show · 2 films · 9 plays',
    );
    expect(monthLine({ episodes: 0, shows: 0, movies: 1, plays: 1, minutes: 120 })).toBe(
      '1 film · 1 play',
    );
    setLocale('ru');
    expect(monthLine({ episodes: 5, shows: 2, movies: 0, plays: 5, minutes: 200 })).toBe(
      '5 серий · 2 сериала · 5 просмотров',
    );
    setLocale('ro');
    expect(monthLine({ episodes: 20, shows: 1, movies: 0, plays: 20, minutes: 900 })).toBe(
      '20 de episoade · 1 serial · 20 de vizionări',
    );
  });

  it('writes TMDB votes with one decimal in the language', () => {
    setLocale('en');
    expect(formatVote(7.84)).toBe('7.8');
    setLocale('ro');
    expect(formatVote(7.84)).toBe('7,8');
    expect(formatVote(0)).toBeNull();
  });
});

describe('whose watching', () => {
  it('asks the API for the right people', () => {
    expect(viewQuery({ kind: 'me' })).toEqual({});
    expect(viewQuery({ kind: 'person', id: 'b' })).toEqual({ userId: 'b' });
    expect(viewQuery({ kind: 'together', ids: ['c', 'a'] })).toEqual({ people: 'a,c' });
    expect(viewQuery({ kind: 'household' })).toEqual({ scope: 'household' });
  });

  it('switches between one person and several together', () => {
    expect(toggleInView({ kind: 'me' }, 'b', 'a', false)).toEqual({ kind: 'person', id: 'b' });
    expect(toggleInView({ kind: 'me' }, 'b', 'a', true)).toEqual({
      kind: 'together',
      ids: ['a', 'b'],
    });
    expect(toggleInView({ kind: 'together', ids: ['a', 'b'] }, 'a', 'a', true)).toEqual({
      kind: 'person',
      id: 'b',
    });
    expect(toggleInView({ kind: 'together', ids: ['a', 'b'] }, 'b', 'a', true)).toEqual({
      kind: 'me',
    });
  });

  it('counts an episode watched together only when everyone was there', () => {
    const p = (episode: number, together: string[]): Play => ({
      id: `${episode}`,
      userId: 'a',
      titleId: 'tv:1',
      season: 1,
      episode,
      watchedAt: null,
      precision: 'unknown',
      runtime: 30,
      source: 'app',
      groupId: together.length ? 'g' : null,
      together,
    });
    const seen = watchedByAll([p(1, ['b']), p(2, []), p(3, ['b', 'c'])], ['a', 'b']);
    expect([...seen].sort()).toEqual(['1:1', '1:3']);
  });
});
