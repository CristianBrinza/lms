/**
 * /api/watching's shapes, as backend/src/modules/watching answers them (titles.ts, plays.ts,
 * home.ts, stats.ts, discover.ts, lists.ts, import.ts).
 */

export type TitleKind = 'movie' | 'tv';
export type WatchStatus =
  'watchlist' | 'watching' | 'rewatching' | 'completed' | 'paused' | 'dropped';
export type PlaySource = 'app' | 'ai' | 'import';
/** How sure a play's date is: the moment, the day, the month, or not at all. */
export type DatePrecision = 'exact' | 'day' | 'month' | 'unknown';

/** A title in rows and lists (search, trending, home, library…). */
export interface TitleCard {
  /** 'movie:603' / 'tv:1399'. */
  id: string;
  kind: TitleKind;
  tmdbId?: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  backdropPath?: string | null;
  overview?: string;
  rating?: number | null;
  genreIds?: number[];
  /** The library adds the genre names. */
  genres?: string[];
  /** Mine, where the server adds it (search, discover, person credits). */
  status?: WatchStatus | null;
}

export interface Provider {
  id?: number;
  name: string;
  logoPath: string | null;
}

/** A household member's check of where a title really plays in Moldova (often by Claude). */
export interface AvailabilityCheck {
  id: string;
  provider: string;
  available: boolean;
  note: string;
  checkedAt: string;
  checkedBy: { id: string; name: string } | null;
}

export interface Providers {
  region: 'MD' | 'RO';
  /** Romania's list stands in for Moldova's: check before counting on it. */
  check: boolean;
  link: string | null;
  flatrate: Provider[];
  free: Provider[];
  rent: Provider[];
  buy: Provider[];
  checked: AvailabilityCheck[];
}

export interface TitleSeason {
  n: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string | null;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

export interface EpisodeRef {
  season: number;
  episode: number;
  airDate: string | null;
  name: string | null;
  runtime?: number | null;
}

export interface TitleDetail {
  id: string;
  kind: TitleKind;
  tmdbId: number;
  title: string;
  originalTitle: string;
  year: number | null;
  date: string | null;
  runtime: number | null;
  genres: string[];
  genreIds: number[];
  overview: string;
  tagline: string;
  posterPath: string | null;
  backdropPath: string | null;
  rating: number | null;
  votes: number;
  imdbId: string | null;
  status: string | null;
  seasons: TitleSeason[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  lastEpisode: EpisodeRef | null;
  nextEpisode: EpisodeRef | null;
  cast: CastMember[];
  providers: Providers;
}

export interface Play {
  id: string;
  userId: string;
  titleId: string;
  season: number | null;
  episode: number | null;
  watchedAt: string | null;
  precision: DatePrecision;
  runtime: number;
  source: PlaySource;
  groupId: string | null;
  /** The others who watched it in the same sitting. */
  together: string[];
}

export interface Progress {
  watched: number;
  aired: number;
  total: number;
  percent: number;
  left: number;
}

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
export type Reaction = (typeof REACTIONS)[number];

export interface Mine {
  status: WatchStatus | null;
  favorite: boolean;
  rating: number | null;
  /** My review: what I liked or not. */
  notes: string;
  /** How it made me feel, up to three. */
  reactions: Reaction[];
  addedAt: string | null;
  plays: Play[];
  playCount: number;
  rewatches: number;
  minutes: number;
  lastWatchedAt: string | null;
  progress: Progress | null;
  next: { season: number; episode: number } | null;
}

/** One person at home and this title: what they have of it, and how far they are. */
export interface MemberProgress {
  userId: string;
  name: string;
  status: WatchStatus | null;
  favorite?: boolean;
  rating?: number | null;
  /** Every play: a film's viewings, a show's episodes. */
  plays: number;
  lastWatchedAt?: string | null;
  /** Shows: aired episodes seen, the furthest seen, the next to watch. */
  progress?: {
    watched: number;
    aired: number;
    furthest: { season: number; episode: number } | null;
    next: { season: number; episode: number } | null;
  } | null;
}

export interface TitleResponse {
  title: TitleDetail;
  mine: Mine;
  /** Everyone else at home (not the person viewed), seen or not, and how far. */
  household: MemberProgress[];
  /** Everyone at home, the person viewed first. */
  members?: MemberProgress[];
}

export interface Video {
  key: string;
  name: string;
  type: string;
}

export interface CrewMember {
  id: number;
  name: string;
  job: 'director' | 'creator' | 'writer' | 'music' | 'camera';
  profilePath: string | null;
}

export interface ReviewExcerpt {
  id: string;
  author: string;
  /** TMDB's 0–10, when the author gave one. */
  rating: number | null;
  excerpt: string;
  long: boolean;
  url: string;
  createdAt: string;
}

/** A title's extras: trailers, who made it, age rating, keywords, reviews, its film series. */
export interface TitleExtras {
  videos: Video[];
  crew: CrewMember[];
  certification: { rating: string; region: string } | null;
  keywords: Array<{ id: number; name: string }>;
  reviews: ReviewExcerpt[];
  reviewCount: number;
  collection: {
    id: number;
    name: string;
    posterPath: string | null;
    backdropPath: string | null;
    parts: Array<TitleCard & { seen: boolean }>;
    seen: number;
  } | null;
}

/** Someone else's take on an episode. */
export interface EpisodeTake {
  userId: string;
  rating: number | null;
  note: string;
  favorite: boolean;
  reactions: Reaction[];
}

export interface Episode {
  n: number;
  name: string;
  overview: string;
  airDate: string | null;
  aired: boolean;
  runtime: number | null;
  stillPath: string | null;
  /** TMDB's vote. */
  rating: number | null;
  /** When it was watched, once per play (a rewatch adds one). */
  watched: Array<string | null>;
  plays: Play[];
  /** Everyone at home who has watched it. */
  watchedBy: string[];
  mine: {
    rating: number | null;
    note: string;
    favorite: boolean;
    reactions?: Reaction[];
  } | null;
  /** The others at home who rated, reacted or wrote a line. */
  others?: EpisodeTake[];
}

export interface SeasonResponse {
  season: {
    n: number;
    name: string;
    overview: string;
    airDate: string | null;
    posterPath: string | null;
    episodeCount: number;
  };
  hideSpoilers: boolean;
  episodes: Episode[];
}

export interface ContinueItem {
  title: TitleCard;
  status: 'watching' | 'rewatching';
  next: EpisodeRef & { stillPath: string | null };
  /** Aired episodes left. */
  left: number;
  watched: number;
  aired: number;
  /** 0–1. */
  progress: number;
  lastWatchedAt: string | null;
}

export interface UpcomingItem {
  title: TitleCard;
  airDate: string;
  /** Null for a film coming out. */
  episode: { season: number; episode: number; name: string | null } | null;
}

/** A play as lists show it: the play, its title and the episode's name. */
export interface PlayLine {
  id: string;
  userId?: string;
  together?: string[];
  title: TitleCard | null;
  season: number | null;
  episode: number | null;
  name?: string | null;
  watchedAt: string | null;
  precision?: DatePrecision;
}

export interface WatchingHome {
  continueWatching: ContinueItem[];
  startWatching: Array<TitleCard & { addedAt: string }>;
  upcoming: UpcomingItem[];
  recent: Array<Play & { title: TitleCard; name: string | null }>;
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export interface Summary {
  episodes: number;
  shows: number;
  movies: number;
  plays: number;
  minutes: number;
}

export interface TopGenre {
  id: number;
  name: string;
  minutes: number;
  plays: number;
}

export interface TopActor {
  id: number;
  name: string;
  profilePath: string | null;
  titles: number;
  minutes: number;
}

export interface TopTitle {
  title: TitleCard;
  plays: number;
  minutes: number;
}

export interface Binge {
  date: string;
  minutes: number;
  plays: number;
  episodes: number;
}

export interface WatchingStats {
  from: string;
  to: string;
  month: Summary;
  perDay: Array<{ date: string; minutes: number; plays: number }>;
  perHour: Record<DayPart, number>;
  hours: number[];
  favorites: TitleCard[];
  history: Array<{
    id: string;
    userId: string;
    title: TitleCard | null;
    titleId: string;
    season: number | null;
    episode: number | null;
    watchedAt: string | null;
    precision: DatePrecision;
    minutes: number;
  }>;
  total: Summary & { titles: number; unknownDates: number; monthOnlyDates: number; days: number };
  perYear: Array<{ year: number; minutes: number; plays: number }>;
  perMonth: Array<{ month: string; minutes: number; plays: number }>;
  topGenres: TopGenre[];
  topActors: TopActor[];
  topShows: TopTitle[];
  topMovies: TopTitle[];
  streak: { current: number; best: number };
  bingeDay: Binge | null;
}

export interface YearInReview extends Summary {
  year: number;
  activeDays: number;
  months: Array<{ month: string; minutes: number; plays: number }>;
  busiestMonth: { month: string; minutes: number; plays: number } | null;
  startedShows: number;
  topGenres: TopGenre[];
  topActors: TopActor[];
  topShows: TopTitle[];
  topMovies: TopTitle[];
  bingeDay: Binge | null;
  longestStreak: number;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownFor: string | null;
  imdbId: string | null;
  credits: Array<TitleCard & { role: string }>;
}

export interface WatchingConfig {
  configured: boolean;
}

export interface PlayInput {
  titleId: string;
  season?: number;
  episode?: number;
  /** Bulk: a number with `season` (1..upTo), or every aired episode up to { season, episode }. */
  upTo?: number | { season: number; episode: number };
  /** Bulk: with `season` the whole season, without it the whole show. */
  all?: boolean;
  /** Bulk: with `season`, exactly these episodes. */
  episodes?: number[];
  /** Left out: now. Else an ISO moment, a day, a month ('2025-03') or 'unknown'. */
  watchedAt?: string;
  /** Everyone who watched (default: me). */
  userIds?: string[];
}

export interface PlaysResponse {
  plays: Play[];
  added: number;
  skipped: number;
  groupId: string | null;
  status: WatchStatus | null;
}

// ---------------------------------------------------------------- library

export interface LibraryItem {
  title: TitleCard & { genres: string[] };
  status: WatchStatus;
  favorite: boolean;
  rating: number | null;
  addedAt: string;
  plays: number;
  minutes: number;
  lastWatchedAt: string | null;
  rewatches: number;
  progress: Progress | null;
  people: Array<{ userId: string; status: WatchStatus }>;
}

export interface LibraryResponse {
  items: LibraryItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: {
    genres: Array<{ id: number; name: string; count: number }>;
    years: number[];
    providers: string[];
    statuses: Partial<Record<WatchStatus, number>>;
  };
}

// ---------------------------------------------------------------- discover

export interface Genre {
  id: number;
  name: string;
}

export interface BecauseGroup {
  because: TitleCard;
  results: TitleCard[];
}

// ---------------------------------------------------------------- calendar

export interface CalendarItem {
  kind: 'episode' | 'movie';
  title: TitleCard;
  season: number | null;
  episode: number | null;
  name: string | null;
  stillPath: string | null;
  runtime: number | null;
  watched: boolean;
}

export interface CalendarResponse {
  from: string;
  to: string;
  days: Array<{ date: string; items: CalendarItem[] }>;
}

// ---------------------------------------------------------------- lists

export interface WatchList {
  id: string;
  name: string;
  shared: boolean;
  owner: { id: string; name: string };
  mine: boolean;
  count: number;
  posters: string[];
  updatedAt: string;
}

export interface WatchListDetail {
  list: WatchList;
  items: Array<{
    title: TitleCard;
    position: number;
    note: string;
    addedBy: string;
    addedAt: string;
    status: WatchStatus | null;
  }>;
}

// ---------------------------------------------------------------- import

export type ImportSource = 'tvtime' | 'trakt';

export interface ImportReport {
  source: ImportSource;
  rows: number;
  titles: { matched: number; unmatched: number; pending: number };
  plays: { added: number; duplicates: number };
  statuses: number;
  ratings: number;
  unmatched: Array<{ title: string | null; year: number | null; rows: number; reason: string }>;
}
