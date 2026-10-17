import { z } from 'zod';
import { AppError } from '../../lib/errors';
import { dateField } from '../food/schemas';
import type { Tool, ToolEnv } from '../mcp/tools';
import { because, discover, related, search, trending } from './discover';
import { calendar, home, library } from './home';
import { importHistory } from './import';
import { addToList, listByName, getList } from './lists';
import { householdIds, peopleOf, type Watch } from './people';
import { addPlays, seasonView, setAvailability, setStatus, titleView } from './plays';
import { LIBRARY_SORTS, STATUSES, titleIdField, watchedAtField } from './schemas';
import { watchStats, yearInReview } from './stats';
import type { Card } from './titles';

/**
 * Watching over MCP: the same services as the app, answers kept short (titles as id, name,
 * year; episodes as S1E3).
 */

type Def<S extends z.ZodType> = {
  name: string;
  title: string;
  description: string;
  access: 'read' | 'write';
  input: S;
  run: (env: ToolEnv, args: z.infer<S>) => Promise<unknown>;
};
const tool = <S extends z.ZodType>(def: Def<S>): Tool => def as unknown as Tool;

const watchOf = (env: ToolEnv): Watch => ({ deps: env.deps, ctx: env.ctx, locale: env.locale });

const peopleField = z
  .array(z.string().trim().min(1).max(80))
  .max(12)
  .optional()
  .describe(
    'Who: household members by name ("Maria") or id; default the key’s owner. Several = together.',
  );

/** Names or ids → household member ids (default: the key's owner). */
async function whom(w: Watch, people: string[] | undefined): Promise<string[] | undefined> {
  if (!people?.length) return undefined;
  const ids = await householdIds(w);
  const { rows } = await w.ctx.db.query<{ id: string; name: string; surname: string }>(
    'SELECT id, name, surname FROM users WHERE id = ANY($1)',
    [ids],
  );
  return people.map((who) => {
    const needle = who.toLowerCase();
    const found =
      rows.find((r) => r.id === who) ??
      rows.find((r) => `${r.name} ${r.surname}`.trim().toLowerCase() === needle) ??
      rows.find((r) => r.name.toLowerCase() === needle);
    if (!found)
      throw new AppError(400, 'VALIDATION', 'That person isn’t in this household', {
        fields: { people: who },
      });
    return found.id;
  });
}

const brief = (c: Card & { status?: string | null }) => ({
  id: c.id,
  title: c.title,
  year: c.year,
  ...(c.rating ? { tmdbRating: c.rating } : {}),
  ...(c.status ? { status: c.status } : {}),
});

const ep = (season: number | null, episode: number | null) =>
  season === null ? null : `S${season}E${episode}`;

export const WATCHING_TOOLS: Tool[] = [
  tool({
    name: 'watching_search',
    title: 'Find a film or series',
    description:
      'Search TMDB for films and series. Gives title ids (movie:603, tv:1399) for the other watching tools, with the person’s status when it is in their library.',
    access: 'read',
    input: z.object({
      q: z.string().trim().min(1).max(100),
      kind: z.enum(['movie', 'tv', 'all']).optional(),
    }),
    run: async (env, args) =>
      (await search(watchOf(env), args.q, args.kind)).results.slice(0, 10).map(brief),
  }),
  tool({
    name: 'watching_title',
    title: 'A film or series in detail',
    description:
      'Details (overview, genres, runtime, seasons, cast, where to watch in Moldova incl. checks recorded), the person’s status, rating and progress. With season: that season’s episodes and which are watched.',
    access: 'read',
    input: z.object({ titleId: titleIdField, season: z.number().int().min(0).max(500).optional() }),
    run: async (env, args) => {
      const w = watchOf(env);
      const view = await titleView(w, args.titleId);
      const t = view.title;
      const out = {
        id: t.id,
        title: t.title,
        year: t.year,
        kind: t.kind,
        genres: t.genres,
        runtime: t.runtime,
        overview: t.overview,
        tmdbRating: t.rating,
        status: t.status,
        seasons:
          t.kind === 'tv' ? t.seasons.map((s) => `${s.n}: ${s.episodeCount} episodes`) : undefined,
        nextEpisode: t.nextEpisode,
        cast: t.cast.slice(0, 6).map((c) => `${c.name}${c.character ? ` (${c.character})` : ''}`),
        whereToWatch: {
          region: t.providers.region,
          needsChecking: t.providers.check,
          streaming: t.providers.flatrate.map((p) => p.name),
          checkedInMoldova: t.providers.checked.map((c) => ({
            provider: c.provider,
            available: c.available,
            note: c.note,
            checkedAt: c.checkedAt.slice(0, 10),
          })),
        },
        mine: {
          status: view.mine.status,
          favorite: view.mine.favorite,
          rating: view.mine.rating,
          plays: view.mine.playCount,
          progress: view.mine.progress,
          next: view.mine.next ? ep(view.mine.next.season, view.mine.next.episode) : null,
        },
        household: view.household,
      };
      if (args.season === undefined) return out;
      const season = await seasonView(w, args.titleId, args.season);
      return {
        ...out,
        episodes: season.episodes.map((e) => ({
          episode: ep(args.season!, e.n),
          name: e.name,
          airDate: e.airDate,
          watched: e.watched.length,
          ...(e.mine?.rating ? { myRating: e.mine.rating } : {}),
        })),
      };
    },
  }),
  tool({
    name: 'watching_mark_watched',
    title: 'Mark watched',
    description:
      'Record that a film or one episode was watched (rewatching adds another play). watchedAt can be a moment, a day, a month only ("2025-03") or "unknown" for backfilling. people: who watched (together = one play each).',
    access: 'write',
    input: z.object({
      titleId: titleIdField,
      season: z.number().int().min(0).max(500).optional(),
      episode: z.number().int().min(1).max(5000).optional(),
      watchedAt: watchedAtField.optional(),
      people: peopleField,
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      const result = await addPlays(w, {
        titleId: args.titleId,
        season: args.season,
        episode: args.episode,
        watchedAt: args.watchedAt,
        userIds: await whom(w, args.people),
      });
      return { added: result.added, status: result.status, groupId: result.groupId };
    },
  }),
  tool({
    name: 'watching_mark_up_to',
    title: 'Mark many episodes watched',
    description:
      'Bulk: every aired episode up to season/episode (e.g. season 3, episode 5 = S1E1…S3E5), a whole season (season + all), or the whole show (all). Episodes already watched are skipped unless rewatch.',
    access: 'write',
    input: z.object({
      titleId: titleIdField,
      season: z.number().int().min(0).max(500).optional(),
      episode: z.number().int().min(1).max(5000).optional(),
      all: z.boolean().optional(),
      rewatch: z.boolean().optional(),
      watchedAt: watchedAtField.optional(),
      people: peopleField,
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      const userIds = await whom(w, args.people);
      const base = {
        titleId: args.titleId,
        watchedAt: args.watchedAt,
        rewatch: args.rewatch,
        userIds,
      };
      const result =
        args.season !== undefined && args.episode !== undefined
          ? await addPlays(w, {
              ...base,
              upTo: { season: Math.max(1, args.season), episode: args.episode },
            })
          : args.season !== undefined
            ? await addPlays(w, { ...base, season: args.season, all: true })
            : await addPlays(w, { ...base, all: true });
      return {
        added: result.added,
        skipped: result.skipped,
        status: result.status,
        groupId: result.groupId,
      };
    },
  }),
  tool({
    name: 'watching_set_status',
    title: 'Library status, rating, favourite',
    description:
      'Put a title in the library or change it: status (watchlist, watching, rewatching, completed, paused, dropped), favorite, rating 1–10 (null clears), notes. people: for several family members at once.',
    access: 'write',
    input: z.object({
      titleId: titleIdField,
      status: z.enum(STATUSES).optional(),
      favorite: z.boolean().optional(),
      rating: z.number().int().min(1).max(10).nullable().optional(),
      notes: z.string().max(2000).optional(),
      people: peopleField,
    }),
    run: async (env, { people, ...args }) => {
      const w = watchOf(env);
      const { mine } = await setStatus(w, args.titleId, {
        ...args,
        userIds: await whom(w, people),
      });
      return { status: mine.status, favorite: mine.favorite, rating: mine.rating };
    },
  }),
  tool({
    name: 'watching_overview',
    title: 'Continue watching, watchlist, upcoming',
    description:
      'The Watching home: what to continue (next episode, how many left), the watchlist, upcoming episodes and recent plays. people: several = what they watch together.',
    access: 'read',
    input: z.object({ people: peopleField, kind: z.enum(['movie', 'tv']).optional() }),
    run: async (env, args) => {
      const w = watchOf(env);
      const people = (await whom(w, args.people)) ?? [env.ctx.actor.userId];
      const h = await home(w, people, args.kind);
      return {
        continueWatching: h.continueWatching.map((c) => ({
          ...brief(c.title),
          next: ep(c.next.season, c.next.episode),
          nextName: c.next.name,
          left: c.left,
        })),
        watchlist: h.startWatching.map((c) => brief(c!)),
        upcoming: h.upcoming.map((u) => ({
          ...brief(u.title),
          airDate: u.airDate,
          episode: u.episode ? ep(u.episode.season, u.episode.episode) : null,
        })),
        recent: h.recent.slice(0, 10).map((r) => ({
          ...brief(r.title),
          episode: ep(r.season, r.episode),
          watchedAt: r.watchedAt,
        })),
      };
    },
  }),
  tool({
    name: 'watching_library',
    title: 'A person’s library',
    description:
      'Films and series in someone’s library, filtered (status, kind, genre id, year, provider, favorite, rated, q) and sorted (recent, added, title, rating, year, progress, minutes).',
    access: 'read',
    input: z.object({
      person: z.string().optional(),
      status: z.array(z.enum(STATUSES)).optional(),
      kind: z.enum(['movie', 'tv']).optional(),
      genre: z.number().int().optional(),
      year: z.number().int().optional(),
      provider: z.string().max(60).optional(),
      favorite: z.boolean().optional(),
      rated: z.boolean().optional(),
      q: z.string().max(100).optional(),
      sort: z.enum(LIBRARY_SORTS).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      const people = (await whom(w, args.person ? [args.person] : undefined)) ?? [
        env.ctx.actor.userId,
      ];
      const result = await library(w, people, {
        people: [],
        status: args.status ?? [],
        kind: args.kind,
        genre: args.genre,
        year: args.year,
        provider: args.provider,
        favorite: args.favorite === undefined ? undefined : args.favorite ? 'true' : 'false',
        rated: args.rated === undefined ? undefined : args.rated ? 'true' : 'false',
        q: args.q,
        sort: args.sort,
        pageSize: args.limit ?? 30,
      });
      return {
        total: result.total,
        items: result.items.map((i) => ({
          ...brief(i.title),
          status: i.status,
          ...(i.favorite ? { favorite: true } : {}),
          ...(i.rating ? { rating: i.rating } : {}),
          ...(i.progress ? { progress: `${i.progress.watched}/${i.progress.aired}` } : {}),
          minutes: i.minutes,
        })),
      };
    },
  }),
  tool({
    name: 'watching_similar',
    title: 'Similar titles and suggestions',
    description:
      'TMDB’s recommendations (default) or similar titles for one title; without titleId, "because you watched" groups from the person’s favourites and recent titles. Check availability in Moldova before recommending.',
    access: 'read',
    input: z.object({
      titleId: titleIdField.optional(),
      which: z.enum(['recommendations', 'similar']).optional(),
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      if (args.titleId)
        return (await related(w, args.titleId, args.which ?? 'recommendations')).results.map(brief);
      const { groups } = await because(w);
      return groups.map((g) => ({ because: brief(g.because), suggestions: g.results.map(brief) }));
    },
  }),
  tool({
    name: 'watching_discover',
    title: 'Trending and discover',
    description:
      'Trending this week (trending: true), or TMDB discover by kind, genre id, year, streaming provider id (in region MD, else RO) and sort (popular, rating, newest).',
    access: 'read',
    input: z.object({
      trending: z.boolean().optional(),
      kind: z.enum(['movie', 'tv']).optional(),
      genre: z.number().int().optional(),
      year: z.number().int().optional(),
      provider: z.number().int().optional(),
      region: z.enum(['MD', 'RO']).optional(),
      sort: z.enum(['popular', 'rating', 'newest']).optional(),
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      if (args.trending) return (await trending(w, args.kind ?? 'all')).results.map(brief);
      return (await discover(w, args)).results.map(brief);
    },
  }),
  tool({
    name: 'watching_calendar',
    title: 'Upcoming episodes by date',
    description:
      'Episodes (and films on the watchlist) coming out between from and to (default the next 30 days) for the shows a person follows.',
    access: 'read',
    input: z.object({ from: dateField.optional(), to: dateField.optional(), people: peopleField }),
    run: async (env, args) => {
      const w = watchOf(env);
      const people = (await whom(w, args.people)) ?? [env.ctx.actor.userId];
      const cal = await calendar(w, people, args.from, args.to);
      return cal.days.map((d) => ({
        date: d.date,
        items: d.items.map((i) => ({
          ...brief(i.title),
          episode: ep(i.season, i.episode),
          name: i.name,
          watched: i.watched,
        })),
      }));
    },
  }),
  tool({
    name: 'watching_stats',
    title: 'Screen time',
    description:
      'Statistics for a person (or several together): totals for from–to (default this month), per day, peak hours, top genres and actors, streak, longest binge day, all-time totals. With year: that year in review.',
    access: 'read',
    input: z.object({
      people: peopleField,
      from: dateField.optional(),
      to: dateField.optional(),
      year: z.number().int().min(1900).max(2200).optional(),
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      const ids = await whom(w, args.people);
      const people = await peopleOf(w, ids ? { people: ids } : {});
      if (args.year) {
        const y = await yearInReview(w, people, args.year);
        return {
          ...y,
          topShows: y.topShows.map((t) => ({ ...brief(t.title), minutes: t.minutes })),
          topMovies: y.topMovies.map((t) => ({ ...brief(t.title), minutes: t.minutes })),
          first: undefined,
          last: undefined,
        };
      }
      const s = await watchStats(w, people, args.from, args.to);
      return {
        from: s.from,
        to: s.to,
        range: s.month,
        total: s.total,
        perHour: s.perHour,
        topGenres: s.topGenres.slice(0, 5).map((g) => `${g.name}: ${g.minutes} min`),
        topActors: s.topActors.slice(0, 5).map((a) => a.name),
        topShows: s.topShows.slice(0, 5).map((t) => ({ ...brief(t.title), minutes: t.minutes })),
        streak: s.streak,
        bingeDay: s.bingeDay,
      };
    },
  }),
  tool({
    name: 'watching_set_availability',
    title: 'Record where a title plays in Moldova',
    description:
      'After checking on the web that a title really plays (or doesn’t) in Moldova on a service, record it: provider (Netflix, Prime Video, …), available, a short note (how you checked, the link). Shown to the family on the title.',
    access: 'write',
    input: z.object({
      titleId: titleIdField,
      provider: z.string().trim().min(1).max(60),
      available: z.boolean(),
      note: z.string().max(500).optional(),
    }),
    run: async (env, args) => (await setAvailability(watchOf(env), args)).checked,
  }),
  tool({
    name: 'watching_add_to_list',
    title: 'Add to a list',
    description:
      'Add a title to one of the person’s lists by name ("Movie night", "For Patricia"); the list is made when there is none (shared: the household’s).',
    access: 'write',
    input: z.object({
      list: z.string().trim().min(1).max(80).describe('The list’s name (or id)'),
      titleId: titleIdField,
      note: z.string().max(500).optional(),
      shared: z.boolean().optional(),
    }),
    run: async (env, args) => {
      const w = watchOf(env);
      const id = /^[0-9a-f-]{36}$/i.test(args.list)
        ? (await getList(w, args.list)).list.id
        : await listByName(w, args.list, args.shared);
      const result = await addToList(w, id, { titleId: args.titleId, note: args.note });
      return { list: result.list.name, items: result.items.map((i) => brief(i.title)) };
    },
  }),
  tool({
    name: 'watching_import',
    title: 'Import from TV Time or Trakt',
    description:
      'Bring over a history: source tvtime (CSV text of its export, e.g. seen_episode.csv) or trakt (JSON text of watched-history, watchlist or ratings). Matches by TMDB, IMDb or TVDB id, else name; importing again adds nothing twice. Small files only here (the app takes big ones).',
    access: 'write',
    input: z.object({
      source: z.enum(['tvtime', 'trakt']),
      data: z.string().max(30_000),
      filename: z.string().max(200).optional(),
    }),
    run: async (env, args) => importHistory(watchOf(env), args),
  }),
];
