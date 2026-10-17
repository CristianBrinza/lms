import type { Reaction } from './types';

/** The face next to each reaction: one glance says which feeling it is. */
export const FACE: Record<Reaction, string> = {
  loved: '😍',
  funny: '😂',
  wow: '😮',
  moving: '😢',
  tense: '😬',
  scary: '😱',
  meh: '😐',
  disliked: '👎',
};

/** At most this many reactions on a title or an episode. */
export const MAX_REACTIONS = 3;
