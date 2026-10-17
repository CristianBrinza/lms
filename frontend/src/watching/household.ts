import { watchedWhen } from './format';
import { watchingT } from './i18n';
import { episodeCode } from './logic';
import type { MemberProgress, Mine, TitleKind, TitleResponse } from './types';

/**
 * Who at home has seen a title, and how far: the line under a title's actions and the faces in
 * "Watched", so nobody marks something twice or for the wrong person.
 */

export type SeenState =
  | { kind: 'none'; listed: boolean }
  | { kind: 'all'; ended: boolean }
  | { kind: 'upTo'; season: number; episode: number; watched: number; aired: number }
  | { kind: 'film'; plays: number; last: string | null };

/** Where one person is with a title. */
export function seenState(
  member: Pick<MemberProgress, 'plays' | 'status' | 'progress' | 'lastWatchedAt'>,
  kind: TitleKind,
  ended = false,
): SeenState {
  if (kind === 'movie')
    return member.plays > 0
      ? { kind: 'film', plays: member.plays, last: member.lastWatchedAt ?? null }
      : { kind: 'none', listed: member.status === 'watchlist' };
  const p = member.progress;
  if (p && p.aired > 0 && p.watched >= p.aired) return { kind: 'all', ended };
  if (p?.furthest)
    return {
      kind: 'upTo',
      season: p.furthest.season,
      episode: p.furthest.episode,
      watched: p.watched,
      aired: p.aired,
    };
  return { kind: 'none', listed: member.status === 'watchlist' };
}

/** The state in words: "Not yet", "Up to S2 E4 · 12 of 30", "Watched twice · last 5 Oct". */
export function seenLabel(state: SeenState): string {
  const t = watchingT();
  switch (state.kind) {
    case 'all':
      return state.ended ? t.seen.all : t.seen.caughtUp;
    case 'upTo':
      return t.seen.upTo(episodeCode(state.season, state.episode), state.watched, state.aired);
    case 'film':
      return t.seen.film(t.common.times(state.plays), state.last ? watchedWhen(state.last) : null);
    default:
      return state.listed ? t.seen.onList : t.seen.notYet;
  }
}

export const hasSeen = (state: SeenState) => state.kind !== 'none';

/** Everyone at home with this title: the person viewed (from `mine` when the server is older) first. */
export function everyone(
  data: TitleResponse,
  viewedId: string,
  viewedName: string,
): MemberProgress[] {
  if (data.members?.length) return data.members;
  const mine: Mine = data.mine;
  const viewed: MemberProgress = {
    userId: viewedId,
    name: viewedName,
    status: mine.status,
    plays: mine.playCount,
    lastWatchedAt: mine.lastWatchedAt,
    progress: mine.progress
      ? {
          watched: mine.progress.watched,
          aired: mine.progress.aired,
          furthest: null,
          next: mine.next,
        }
      : null,
  };
  return [viewed, ...data.household.filter((m) => m.userId !== viewedId)];
}

/** "Seen by 1 of 2 at home". */
export function seenCount(members: readonly MemberProgress[], kind: TitleKind) {
  return {
    seen: members.filter((m) => hasSeen(seenState(m, kind))).length,
    of: members.length,
  };
}
