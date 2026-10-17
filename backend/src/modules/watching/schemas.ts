import { z } from 'zod';
import { Translations } from '../../lib/i18n';
import { dateField, idField } from '../food/schemas';
import { TITLE_ID } from './titles';

export const STATUSES = [
  'watchlist',
  'watching',
  'rewatching',
  'completed',
  'paused',
  'dropped',
] as const;
export type Status = (typeof STATUSES)[number];

export const titleIdField = z
  .string()
  .regex(TITLE_ID, 'Use a title id like movie:603 or tv:1399')
  .describe('A title: "movie:<tmdb id>" or "tv:<tmdb id>", e.g. movie:603, tv:1399');

/** When something was watched: a moment, a day, a month, or not known. */
export const watchedAtField = z
  .union([
    z.literal('unknown'),
    z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    dateField,
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/),
  ])
  .describe(
    'When: an ISO date-time ("2026-10-17T21:30", local unless it has an offset), a day ("2025-03-14"), a month only ("2025-03"), or "unknown". Leave out for now.',
  );

const userIdsField = z
  .array(idField)
  .min(1)
  .max(12)
  .optional()
  .describe('Who watched (household members’ ids); default only you. Several: watched together.');

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const PlayPatch = z.object({
  watchedAt: watchedAtField,
  together: z.boolean().optional(),
});

export const PlayInput = z.object({
  titleId: titleIdField,
  season: int(0, 500).optional().describe('Season number (episodes only; 0 is specials)'),
  episode: int(1, 5000).optional().describe('Episode number in the season'),
  upTo: z
    .union([int(1, 5000), z.object({ season: int(1, 500), episode: int(1, 5000) })])
    .optional()
    .describe(
      'Bulk: a number with season marks episodes 1..upTo of that season; { season, episode } marks every aired episode up to that one (S3E5), across seasons.',
    ),
  all: z
    .boolean()
    .optional()
    .describe('Bulk: with season, the whole season; without, every aired episode of the show.'),
  episodes: z
    .array(int(1, 5000))
    .min(1)
    .max(500)
    .optional()
    .describe('Bulk: with season, exactly these episodes of it (the ones picked in the app).'),
  watchedAt: watchedAtField.optional(),
  rewatch: z
    .boolean()
    .optional()
    .describe('Bulk only: also add a play for episodes already watched (a rewatch).'),
  userIds: userIdsField,
});
export type PlayInput = z.infer<typeof PlayInput>;

/** How a title made someone feel: up to three, next to the rating and the review. */
export const REACTIONS = [
  'loved',
  'funny',
  'wow',
  'moving',
  'tense',
  'scary',
  'meh',
  'disliked',
] as const;

export const StatusInput = z.object({
  status: z.enum(STATUSES).optional(),
  favorite: z.boolean().optional(),
  rating: int(1, 10).nullable().optional().describe('Your rating, 1–10; null clears it'),
  notes: z.string().trim().max(2000).optional().describe('Your review: what you liked or not'),
  reactions: z
    .array(z.enum(REACTIONS))
    .max(3)
    .optional()
    .describe('How it made you feel, up to three; [] clears them'),
  userIds: userIdsField,
});

export const EpisodeMarkInput = z.object({
  rating: int(1, 10).nullable().optional(),
  note: z.string().trim().max(500).optional(),
  favorite: z.boolean().optional(),
  reactions: z.array(z.enum(REACTIONS)).max(3).optional(),
});

export const SettingsInput = z.object({ hideSpoilers: z.boolean() });

export const AvailabilityInput = z.object({
  titleId: titleIdField,
  provider: z.string().trim().min(1).max(60).describe('The service, e.g. Netflix, Prime Video'),
  available: z.boolean().describe('Whether it really plays in Moldova on that service'),
  note: z.string().trim().max(500).optional(),
  checkedAt: z.iso.datetime({ offset: true }).optional(),
});

export const ListInput = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  shared: z.boolean().optional().describe('true: the whole household sees and edits it'),
  translations: Translations.optional(),
});
export const ListPatch = ListInput.partial();
export const ListItemInput = z.object({
  titleId: titleIdField,
  note: z.string().trim().max(500).optional(),
});
export const ListOrder = z.object({ titleIds: z.array(titleIdField).max(1000) });

const csvIds = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
  )
  .pipe(z.array(idField).max(12));

/** Whose: one person (userId), several (people=a,b) or everyone at home (scope=household). */
export const PeopleQuery = z.object({
  userId: idField.optional(),
  people: csvIds,
  scope: z.enum(['me', 'household']).optional(),
});
export type PeopleQuery = z.infer<typeof PeopleQuery>;

const flag = z.enum(['true', 'false']).optional();
const numberParam = (min: number, max: number) =>
  z.coerce.number().int().min(min).max(max).optional();

export const LIBRARY_SORTS = [
  'recent',
  'added',
  'title',
  'rating',
  'year',
  'progress',
  'minutes',
] as const;

export const LibraryQuery = PeopleQuery.extend({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter(Boolean) : []))
    .pipe(z.array(z.enum(STATUSES))),
  kind: z.enum(['movie', 'tv']).optional(),
  genre: numberParam(1, 1_000_000),
  year: numberParam(1870, 2200),
  provider: z.string().trim().max(60).optional(),
  rated: flag,
  favorite: flag,
  q: z.string().trim().max(100).optional(),
  sort: z.enum(LIBRARY_SORTS).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: numberParam(1, 10_000),
  pageSize: numberParam(1, 100),
});
export type LibraryQuery = z.infer<typeof LibraryQuery>;

export const RangeQuery = PeopleQuery.extend({
  from: dateField.optional(),
  to: dateField.optional(),
});

export const SearchQuery = z.object({
  q: z.string().trim().min(1, 'Required').max(100),
  kind: z.enum(['movie', 'tv', 'all']).optional(),
  page: numberParam(1, 50),
});

export const DiscoverQuery = z.object({
  kind: z.enum(['movie', 'tv']).optional(),
  genre: numberParam(1, 1_000_000),
  year: numberParam(1870, 2200),
  provider: numberParam(1, 1_000_000),
  keyword: numberParam(1, 100_000_000),
  region: z.enum(['MD', 'RO']).optional(),
  sort: z.enum(['popular', 'rating', 'newest']).optional(),
  page: numberParam(1, 50),
});

export const IMPORT_SOURCES = ['tvtime', 'trakt'] as const;
export const ImportInput = z.object({
  source: z.enum(IMPORT_SOURCES),
  /** A CSV file's text, a JSON file (array or object), or { "file name": contents, … }. */
  data: z.union([
    z.string().max(12_000_000),
    z.array(z.unknown()).max(200_000),
    z.record(z.string(), z.unknown()),
  ]),
  filename: z.string().max(200).optional(),
});
