import type { Locale } from '../../lib/i18n';
import { me, type Watch } from './people';
import { cached, DAY, tmdb, TMDB_LANGUAGE } from './tmdb';
import { getTitle, parseTitleId, toCards, type Card, type Kind, type RawList } from './titles';

/**
 * A title's extras, read from TMDB only when the title page asks for them and cached a week per
 * language in watch_tmdb_cache (no new tables): trailers, who made it (directors, creators,
 * writers, music), the age rating, keywords, a few reviews, and the film series it belongs to
 * with how much of it the person has seen.
 */

interface RawVideo {
  key: string;
  site: string;
  type: string;
  name: string;
  official?: boolean;
  iso_639_1?: string | null;
  published_at?: string;
}
interface RawReview {
  id: string;
  author: string;
  author_details?: { rating?: number | null };
  content: string;
  created_at: string;
  url: string;
}
interface RawCrew {
  id: number;
  name: string;
  job?: string;
  profile_path?: string | null;
}
interface RawExtras {
  belongs_to_collection?: { id: number; name: string } | null;
  created_by?: Array<{ id: number; name: string; profile_path?: string | null }>;
  credits?: { crew?: RawCrew[] };
  videos?: { results?: RawVideo[] };
  keywords?: {
    keywords?: Array<{ id: number; name: string }>;
    results?: Array<{ id: number; name: string }>;
  };
  reviews?: { results?: RawReview[]; total_results?: number };
  release_dates?: {
    results?: Array<{
      iso_3166_1: string;
      release_dates?: Array<{ certification?: string; type?: number }>;
    }>;
  };
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating?: string }> };
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
  rating: number | null;
  excerpt: string;
  long: boolean;
  url: string;
  createdAt: string;
}

interface StoredExtras {
  videos: Video[];
  crew: CrewMember[];
  certification: { rating: string; region: string } | null;
  keywords: Array<{ id: number; name: string }>;
  reviews: ReviewExcerpt[];
  reviewCount: number;
  collection: { id: number; name: string } | null;
}

const CREW_JOBS: Record<string, CrewMember['job']> = {
  Director: 'director',
  Screenplay: 'writer',
  Writer: 'writer',
  Novel: 'writer',
  'Original Music Composer': 'music',
  'Director of Photography': 'camera',
};
const JOB_ORDER: CrewMember['job'][] = ['director', 'creator', 'writer', 'music', 'camera'];

/** Trailers on YouTube: the reader's language first, then English, official trailers before teasers. */
export function pickVideos(raw: RawVideo[] | undefined, locale: Locale): Video[] {
  const score = (v: RawVideo) =>
    (v.type === 'Trailer' ? 0 : v.type === 'Teaser' ? 10 : 20) +
    (v.iso_639_1 === locale ? 0 : v.iso_639_1 === 'en' ? 3 : 6) +
    (v.official ? 0 : 1);
  return (raw ?? [])
    .filter((v) => v.site === 'YouTube' && /^[\w-]{6,20}$/.test(v.key))
    .filter((v) => ['Trailer', 'Teaser', 'Clip', 'Featurette'].includes(v.type))
    .sort(
      (a, b) => score(a) - score(b) || (b.published_at ?? '').localeCompare(a.published_at ?? ''),
    )
    .slice(0, 4)
    .map((v) => ({ key: v.key, name: v.name, type: v.type }));
}

/** The age rating where we live: Moldova, then Romania, then the US and UK. */
export function pickCertification(
  raw: RawExtras,
  kind: Kind,
): { rating: string; region: string } | null {
  const regions = ['MD', 'RO', 'US', 'GB'];
  for (const region of regions) {
    if (kind === 'movie') {
      const entry = raw.release_dates?.results?.find((r) => r.iso_3166_1 === region);
      const dates = [...(entry?.release_dates ?? [])].sort(
        (a, b) => (a.type === 3 ? 0 : 1) - (b.type === 3 ? 0 : 1),
      );
      const rating = dates.find((d) => d.certification?.trim())?.certification?.trim();
      if (rating) return { rating, region };
    } else {
      const rating = raw.content_ratings?.results
        ?.find((r) => r.iso_3166_1 === region)
        ?.rating?.trim();
      if (rating) return { rating, region };
    }
  }
  return null;
}

/** Plain text, a few hundred characters at most, cut at a word. */
export function excerptOf(content: string, max = 600): { excerpt: string; long: boolean } {
  const text = content
    .replace(/<[^>]+>/g, '')
    .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (text.length <= max) return { excerpt: text, long: false };
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return { excerpt: `${cut.slice(0, space > max * 0.6 ? space : max).trimEnd()}…`, long: true };
}

function reviewsOf(raw: RawReview[] | undefined): ReviewExcerpt[] {
  return (raw ?? [])
    .filter((r) => r.content?.trim())
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      author: r.author,
      rating: typeof r.author_details?.rating === 'number' ? r.author_details.rating : null,
      ...excerptOf(r.content),
      url: r.url,
      createdAt: r.created_at,
    }));
}

function crewOf(raw: RawExtras): CrewMember[] {
  const out: CrewMember[] = [];
  const seen = new Set<string>();
  const add = (id: number, name: string, job: CrewMember['job'], profilePath?: string | null) => {
    const key = `${id}:${job}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, name, job, profilePath: profilePath ?? null });
  };
  for (const c of raw.created_by ?? []) add(c.id, c.name, 'creator', c.profile_path);
  for (const c of raw.credits?.crew ?? []) {
    const job = c.job ? CREW_JOBS[c.job] : undefined;
    if (job) add(c.id, c.name, job, c.profile_path);
  }
  out.sort((a, b) => JOB_ORDER.indexOf(a.job) - JOB_ORDER.indexOf(b.job));
  // A few of each: two directors, three writers, one of the rest.
  const limit: Record<CrewMember['job'], number> = {
    director: 2,
    creator: 3,
    writer: 3,
    music: 1,
    camera: 1,
  };
  const count = new Map<string, number>();
  return out.filter((c) => {
    const n = (count.get(c.job) ?? 0) + 1;
    count.set(c.job, n);
    return n <= limit[c.job];
  });
}

async function storedExtras(w: Watch, id: string): Promise<StoredExtras> {
  const { kind, tmdbId } = parseTitleId(id);
  const language = TMDB_LANGUAGE[w.locale];
  const lang = language.slice(0, 2);
  return cached(w.deps, `extras:${id}:${language}`, 7 * DAY, async () => {
    const raw = await tmdb(w.deps).get<RawExtras>(`/${kind}/${tmdbId}`, {
      language,
      append_to_response: [
        'videos',
        'keywords',
        'reviews',
        'credits',
        kind === 'movie' ? 'release_dates' : 'content_ratings',
      ].join(','),
      include_video_language: `${lang},en,null`,
    });
    let reviews = reviewsOf(raw.reviews?.results);
    let reviewCount = raw.reviews?.total_results ?? reviews.length;
    // Most reviews on TMDB are in English: those, when there are none in the reader's language.
    if (!reviews.length && w.locale !== 'en') {
      const en = await tmdb(w.deps)
        .get<{ results?: RawReview[]; total_results?: number }>(`/${kind}/${tmdbId}/reviews`, {
          language: 'en-US',
        })
        .catch(() => null);
      reviews = reviewsOf(en?.results);
      reviewCount = en?.total_results ?? reviews.length;
    }
    const keywords = raw.keywords?.keywords ?? raw.keywords?.results ?? [];
    return {
      videos: pickVideos(raw.videos?.results, w.locale),
      crew: crewOf(raw),
      certification: pickCertification(raw, kind),
      keywords: keywords.slice(0, 12).map((k) => ({ id: k.id, name: k.name })),
      reviews,
      reviewCount,
      collection: raw.belongs_to_collection
        ? { id: raw.belongs_to_collection.id, name: raw.belongs_to_collection.name }
        : null,
    };
  });
}

interface RawCollection {
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  parts?: RawList[];
}

async function collectionOf(w: Watch, id: number) {
  const language = TMDB_LANGUAGE[w.locale];
  return cached(w.deps, `collection:${id}:${language}`, 7 * DAY, async () => {
    const raw = await tmdb(w.deps).get<RawCollection>(`/collection/${id}`, { language });
    const parts = toCards(raw.parts, 'movie', 30).sort(
      (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.tmdbId - b.tmdbId,
    );
    return {
      id: raw.id,
      name: raw.name,
      posterPath: raw.poster_path ?? null,
      backdropPath: raw.backdrop_path ?? null,
      parts,
    };
  });
}

/**
 * Everything extra about a title, for one person (the viewed one, else the caller): the stored
 * extras, and the film series with which parts they have seen.
 */
export async function titleExtras(w: Watch, id: string, userId?: string) {
  await getTitle(w.deps, id, w.locale);
  const extras = await storedExtras(w, id);
  const person = userId ?? me(w);
  let collection: null | {
    id: number;
    name: string;
    posterPath: string | null;
    backdropPath: string | null;
    parts: Array<Card & { seen: boolean; status: string | null }>;
    seen: number;
  } = null;
  if (extras.collection) {
    const found = await collectionOf(w, extras.collection.id).catch(() => null);
    if (found && found.parts.length > 1) {
      const ids = found.parts.map((p) => p.id);
      const [{ rows: plays }, { rows: statuses }] = await Promise.all([
        w.ctx.db.query<{ title_id: string }>(
          'SELECT DISTINCT title_id FROM watch_plays WHERE user_id = $1 AND title_id = ANY($2)',
          [person, ids],
        ),
        w.ctx.db.query<{ title_id: string; status: string }>(
          'SELECT title_id, status FROM watch_list WHERE user_id = $1 AND title_id = ANY($2)',
          [person, ids],
        ),
      ]);
      const watched = new Set(plays.map((r) => r.title_id));
      const status = new Map(statuses.map((r) => [r.title_id, r.status]));
      const parts = found.parts.map((p) => ({
        ...p,
        seen: watched.has(p.id) || status.get(p.id) === 'completed',
        status: status.get(p.id) ?? null,
      }));
      collection = { ...found, parts, seen: parts.filter((p) => p.seen).length };
    }
  }
  return {
    videos: extras.videos,
    crew: extras.crew,
    certification: extras.certification,
    keywords: extras.keywords,
    reviews: extras.reviews,
    reviewCount: extras.reviewCount,
    collection,
  };
}
