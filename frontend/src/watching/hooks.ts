import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useUser } from '@/app/auth';
import { toast } from '@/components/ui';
import { errorMessage } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import { watchingApi, watchingKeys, type EpisodeInput } from './api';
import { watchingT } from './i18n';
import type { WatchView } from './view';
import type {
  Play,
  PlayInput,
  Reaction,
  SeasonResponse,
  TitleResponse,
  WatchStatus,
} from './types';

/**
 * Watching's changes. Checks are optimistic: the cached title and season tick at once, the server
 * confirms behind, and the toast offers Undo (the whole sitting, together included). Whatever
 * happens, Watching refetches after, and live sync tells the rest of the household.
 */

const PENDING = 'pending-';
export const isPending = (play: Pick<Play, 'id'>) => play.id.startsWith(PENDING);

/**
 * Whether a cached title or season (its key ends in the view's query: '{}' for mine,
 * '{"userId":…}' for someone else's) shows one of the people a play is for.
 */
export function cachedFor(viewPart: unknown, userIds: readonly string[] | undefined, meId: string) {
  let viewed = meId;
  try {
    const parsed = JSON.parse(String(viewPart ?? '{}')) as { userId?: string };
    if (parsed.userId) viewed = parsed.userId;
  } catch {
    return true;
  }
  return (userIds?.length ? userIds : [meId]).includes(viewed);
}

/** Ticks the cached title and season before the server answers (only the views it is for). */
function addOptimistic(client: QueryClient, input: PlayInput, meId: string) {
  const now = new Date().toISOString();
  const single = input.season !== undefined && input.episode !== undefined;
  const wholeSeason = input.season !== undefined && input.all;
  const upTo = typeof input.upTo === 'number' && input.season !== undefined ? input.upTo : null;
  const isMovie = input.titleId.startsWith('movie:');
  const fake = (season: number | null, episode: number | null): Play => ({
    id: `${PENDING}${Math.random().toString(36).slice(2)}`,
    userId: input.userIds?.[0] ?? '',
    titleId: input.titleId,
    season,
    episode,
    watchedAt: now,
    precision: 'exact',
    runtime: 0,
    source: 'app',
    groupId: null,
    together: input.userIds?.slice(1) ?? [],
  });
  if (single || isMovie)
    client.setQueriesData<TitleResponse>(
      {
        queryKey: ['watching', 'title', input.titleId],
        predicate: (q) => cachedFor(q.queryKey[3], input.userIds, meId),
      },
      (old) =>
        old && {
          ...old,
          mine: {
            ...old.mine,
            plays: [fake(input.season ?? null, input.episode ?? null), ...old.mine.plays],
          },
        },
    );
  const picked =
    input.season !== undefined && input.episodes?.length ? new Set(input.episodes) : null;
  if (input.season === undefined || !(single || wholeSeason || upTo || picked)) return;
  client.setQueriesData<SeasonResponse>(
    {
      queryKey: ['watching', 'season', input.titleId, input.season],
      predicate: (q) => cachedFor(q.queryKey[4], input.userIds, meId),
    },
    (old) =>
      old && {
        ...old,
        episodes: old.episodes.map((ep) => {
          const hit = single
            ? ep.n === input.episode
            : ep.aired &&
              !ep.watched.length &&
              (wholeSeason || (picked ? picked.has(ep.n) : ep.n <= (upTo ?? 0)));
          return hit ? { ...ep, watched: [...ep.watched, now] } : ep;
        }),
      },
  );
}

/** Takes a play out of the cached title and season at once (uncheck). */
function removeOptimistic(client: QueryClient, play: Play) {
  client.setQueriesData<TitleResponse>(
    { queryKey: ['watching', 'title', play.titleId] },
    (old) =>
      old && {
        ...old,
        mine: { ...old.mine, plays: old.mine.plays.filter((p) => p.id !== play.id) },
      },
  );
  if (play.season !== null && play.episode !== null)
    client.setQueriesData<SeasonResponse>(
      { queryKey: ['watching', 'season', play.titleId, play.season] },
      (old) =>
        old && {
          ...old,
          episodes: old.episodes.map((ep) =>
            ep.n === play.episode
              ? {
                  ...ep,
                  watched: ep.watched.slice(0, -1),
                  plays: ep.plays.filter((p) => p.id !== play.id),
                }
              : ep,
          ),
        },
    );
}

const refetch = (client: QueryClient) => client.invalidateQueries({ queryKey: watchingKeys.all });
const failed = (error: unknown) =>
  toast.error(watchingT().common.failed, { description: errorMessage(error) });

/** Marks plays (one, or a bulk form), with Undo in the toast. */
export function useAddPlays() {
  const client = useQueryClient();
  const meId = useUser().id;
  return useMutation({
    mutationFn: async ({ input }: { input: PlayInput; message: string }) =>
      watchingApi.addPlay(input),
    onMutate: ({ input }) => {
      haptic('success');
      addOptimistic(client, input, meId);
    },
    onSuccess: (result, { message }) => {
      const groupId = result.groupId;
      toast.success(message, {
        action: groupId
          ? {
              label: watchingT().common.undo,
              onClick: () => {
                void watchingApi
                  .removeGroup(groupId)
                  .catch(failed)
                  .finally(() => refetch(client));
              },
            }
          : undefined,
      });
    },
    onError: failed,
    onSettled: () => refetch(client),
  });
}

/** Removes a play (an episode unchecked, a film's last watch); together, everyone's of that sitting. */
export function useRemovePlay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ play, together }: { play: Play; together?: boolean; message: string }) =>
      watchingApi.removePlay(play.id, together),
    onMutate: ({ play }) => {
      haptic('tap');
      removeOptimistic(client, play);
    },
    onSuccess: (_, { message }) => toast(message),
    onError: failed,
    onSettled: () => refetch(client),
  });
}

/** Status, favourite and rating of a title, for me or everyone who watches it together. */
export function useSetStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: {
        /** null takes the title out of my library. */
        status?: WatchStatus | null;
        favorite?: boolean;
        rating?: number | null;
        notes?: string;
        reactions?: Reaction[];
        userIds?: string[];
      };
      message?: string;
    }) =>
      body.status === null
        ? watchingApi.clearStatus(id, body.userIds)
        : watchingApi.setStatus(id, { ...body, status: body.status ?? undefined }),
    onMutate: ({ id, body }) => {
      client.setQueriesData<TitleResponse>(
        { queryKey: ['watching', 'title', id] },
        (old) =>
          old && {
            ...old,
            mine: {
              ...old.mine,
              ...(body.status !== undefined ? { status: body.status } : {}),
              ...(body.favorite !== undefined ? { favorite: body.favorite } : {}),
              ...(body.rating !== undefined ? { rating: body.rating } : {}),
              ...(body.notes !== undefined ? { notes: body.notes } : {}),
              ...(body.reactions !== undefined ? { reactions: body.reactions } : {}),
            },
          },
      );
    },
    onSuccess: (_, { message }) => {
      if (message) toast.success(message);
    },
    onError: failed,
    onSettled: () => refetch(client),
  });
}

/** A title's extras (trailers, crew, series, reviews): after the page, never holding it up. */
export function useExtras(id: string, view: WatchView) {
  return useQuery({
    queryKey: watchingKeys.extras(id, view),
    queryFn: () => watchingApi.extras(id, view),
    staleTime: 60 * 60_000,
    retry: false,
  });
}

/** An episode's own rating, note and favourite. */
export function useSetEpisode() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      titleId,
      season,
      episode,
      body,
    }: {
      titleId: string;
      season: number;
      episode: number;
      body: EpisodeInput;
    }) => watchingApi.setEpisode(titleId, season, episode, body),
    onMutate: ({ titleId, season, episode, body }) => {
      client.setQueriesData<SeasonResponse>(
        { queryKey: ['watching', 'season', titleId, season] },
        (old) =>
          old && {
            ...old,
            episodes: old.episodes.map((ep) =>
              ep.n === episode
                ? {
                    ...ep,
                    mine: {
                      rating: ep.mine?.rating ?? null,
                      note: ep.mine?.note ?? '',
                      favorite: ep.mine?.favorite ?? false,
                      ...body,
                    },
                  }
                : ep,
            ),
          },
      );
    },
    onError: failed,
    onSettled: () => refetch(client),
  });
}
