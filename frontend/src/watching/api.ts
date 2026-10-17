import { api, query } from '@/services/api/client';
import type {
  BecauseGroup,
  CalendarResponse,
  Genre,
  ImportReport,
  ImportSource,
  LibraryResponse,
  PersonDetail,
  PlayInput,
  PlaysResponse,
  Provider,
  SeasonResponse,
  TitleCard,
  TitleKind,
  TitleResponse,
  WatchingConfig,
  WatchingHome,
  WatchingStats,
  WatchList,
  WatchListDetail,
  WatchStatus,
  YearInReview,
} from './types';
import { titleQuery, viewKey, viewQuery, type WatchView } from './view';

/** /api/watching: shows and films from TMDB, each person's plays, lists and statistics. */

export interface LibraryParams {
  q?: string;
  kind?: TitleKind;
  status?: WatchStatus[];
  genre?: number;
  year?: number;
  provider?: string;
  rated?: boolean;
  favorite?: boolean;
  sort?: string;
}

export interface DiscoverParams {
  kind: TitleKind;
  genre?: number;
  provider?: number;
  page?: number;
}

export const watchingKeys = {
  all: ['watching'] as const,
  config: ['watching', 'config'] as const,
  settings: ['watching', 'settings'] as const,
  home: (view: WatchView) => ['watching', 'home', viewKey(view)] as const,
  search: (q: string, kind: string) => ['watching', 'search', q, kind] as const,
  title: (id: string, view: WatchView) =>
    ['watching', 'title', id, JSON.stringify(titleQuery(view))] as const,
  season: (id: string, n: number, view: WatchView) =>
    ['watching', 'season', id, n, JSON.stringify(titleQuery(view))] as const,
  similar: (id: string) => ['watching', 'similar', id] as const,
  stats: (view: WatchView, from: string, to: string) =>
    ['watching', 'stats', viewKey(view), from, to] as const,
  year: (view: WatchView, year: number) => ['watching', 'year', viewKey(view), year] as const,
  person: (id: string) => ['watching', 'person', id] as const,
  library: (view: WatchView, params: LibraryParams) =>
    ['watching', 'library', viewKey(view), JSON.stringify(params)] as const,
  trending: (kind: string) => ['watching', 'trending', kind] as const,
  because: (kind: string) => ['watching', 'because', kind] as const,
  genres: (kind: string) => ['watching', 'genres', kind] as const,
  providers: (kind: string) => ['watching', 'providers', kind] as const,
  discover: (params: DiscoverParams) => ['watching', 'discover', JSON.stringify(params)] as const,
  calendar: (view: WatchView, from: string, to: string) =>
    ['watching', 'calendar', viewKey(view), from, to] as const,
  lists: ['watching', 'lists'] as const,
  list: (id: string) => ['watching', 'list', id] as const,
};

const enc = encodeURIComponent;
const t = (id: string) => `/watching/titles/${enc(id)}`;

export interface EpisodeInput {
  rating?: number | null;
  note?: string;
  favorite?: boolean;
}

export const watchingApi = {
  config: () => api.get<WatchingConfig>('/watching/config'),
  settings: () => api.get<{ hideSpoilers: boolean }>('/watching/settings'),
  saveSettings: (body: { hideSpoilers: boolean }) =>
    api.put<{ hideSpoilers: boolean }>('/watching/settings', body),
  home: (view: WatchView) => api.get<WatchingHome>(`/watching/home${query(viewQuery(view))}`),
  search: (q: string, kind?: TitleKind) =>
    api.get<{ results: TitleCard[] }>(`/watching/search${query({ q, kind })}`),
  title: (id: string, view: WatchView) =>
    api.get<TitleResponse>(`${t(id)}${query(titleQuery(view))}`),
  season: (id: string, n: number, view: WatchView) =>
    api.get<SeasonResponse>(`${t(id)}/seasons/${n}${query(titleQuery(view))}`),
  similar: (id: string) => api.get<{ results: TitleCard[] }>(`${t(id)}/similar`),
  setStatus: (
    id: string,
    body: {
      status?: WatchStatus;
      favorite?: boolean;
      rating?: number | null;
      userIds?: string[];
    },
  ) => api.put<unknown>(`${t(id)}/status`, body),
  clearStatus: (id: string, userIds?: string[]) =>
    api.delete<void>(
      `${t(id)}/status${query({ people: userIds && userIds.length > 1 ? userIds.join(',') : undefined })}`,
    ),
  setEpisode: (id: string, season: number, episode: number, body: EpisodeInput) =>
    api.put<unknown>(`${t(id)}/episodes/${season}/${episode}`, body),
  addPlay: (body: PlayInput) => api.post<PlaysResponse>('/watching/plays', body),
  removePlay: (id: string, together = false) =>
    api.delete<unknown>(`/watching/plays/${enc(id)}${together ? '?together=true' : ''}`),
  removeGroup: (groupId: string) => api.delete<unknown>(`/watching/plays/groups/${enc(groupId)}`),
  stats: (view: WatchView, from: string, to: string) =>
    api.get<WatchingStats>(`/watching/stats${query({ from, to, ...viewQuery(view) })}`),
  year: (view: WatchView, year: number) =>
    api.get<YearInReview>(`/watching/stats/year${query({ year, ...viewQuery(view) })}`),
  person: (id: string) => api.get<{ person: PersonDetail }>(`/watching/people/${enc(id)}`),
  library: (view: WatchView, params: LibraryParams, page: number) =>
    api.get<LibraryResponse>(
      `/watching/library${query({
        ...viewQuery(view),
        q: params.q,
        kind: params.kind,
        status: params.status?.join(','),
        genre: params.genre,
        year: params.year,
        provider: params.provider,
        rated: params.rated ? 'true' : undefined,
        favorite: params.favorite ? 'true' : undefined,
        sort: params.sort,
        page,
        pageSize: 60,
      })}`,
    ),
  trending: (kind: TitleKind) =>
    api.get<{ results: TitleCard[] }>(`/watching/trending${query({ kind })}`),
  because: (kind: TitleKind) =>
    api.get<{ groups: BecauseGroup[] }>(`/watching/because${query({ kind })}`),
  genres: (kind: TitleKind) => api.get<{ genres: Genre[] }>(`/watching/genres${query({ kind })}`),
  providers: (kind: TitleKind) =>
    api.get<{ region: 'MD' | 'RO'; check: boolean; providers: Provider[] }>(
      `/watching/providers${query({ kind, region: 'MD' })}`,
    ),
  discover: (params: DiscoverParams) =>
    api.get<{ results: TitleCard[]; page: number; totalPages: number; region: 'MD' | 'RO' }>(
      `/watching/discover${query({
        kind: params.kind,
        genre: params.genre,
        provider: params.provider,
        region: params.provider ? 'MD' : undefined,
        page: params.page,
      })}`,
    ),
  calendar: (view: WatchView, from: string, to: string) =>
    api.get<CalendarResponse>(`/watching/calendar${query({ from, to, ...viewQuery(view) })}`),
  lists: () => api.get<{ lists: WatchList[] }>('/watching/lists'),
  list: (id: string) => api.get<WatchListDetail>(`/watching/lists/${enc(id)}`),
  createList: (body: { name: string; shared: boolean }) =>
    api.post<{ list: WatchList }>('/watching/lists', body),
  updateList: (id: string, body: { name?: string; shared?: boolean }) =>
    api.patch<{ list: WatchList }>(`/watching/lists/${enc(id)}`, body),
  removeList: (id: string) => api.delete<void>(`/watching/lists/${enc(id)}`),
  addToList: (id: string, titleId: string) =>
    api.post<unknown>(`/watching/lists/${enc(id)}/items`, { titleId }),
  removeFromList: (id: string, titleId: string) =>
    api.delete<void>(`/watching/lists/${enc(id)}/items/${enc(titleId)}`),
  importHistory: (body: {
    source: ImportSource;
    data: string | Record<string, string>;
    filename?: string;
  }) => api.post<ImportReport>('/watching/import', body),
};
