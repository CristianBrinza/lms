import { api, query } from '@/services/api/client';

/** /api/drinks: the household's cellar, everyone's tastings and the label photos. */

export const CATEGORIES = [
  'wine',
  'sparkling',
  'fortified',
  'brandy',
  'whisky',
  'rum',
  'vodka',
  'gin',
  'agave',
  'liqueur',
  'beer',
  'cider',
  'sake',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];
export type WineColor = 'white' | 'rose' | 'red' | 'orange';
export type PhotoKind = 'front' | 'back' | 'other';
export type SheetKind = 'wine' | 'spirit' | 'beer';

/** Which tasting sheet a kind of drink uses (the API's rule). */
export function sheetKind(category: Category): SheetKind {
  if (category === 'beer' || category === 'cider') return 'beer';
  if (category === 'wine' || category === 'sparkling' || category === 'fortified' || category === 'sake')
    return 'wine';
  return 'spirit';
}

export interface PhotoRef {
  id: string;
  thumb: string;
  full: string;
}

export interface Drink {
  id: string;
  category: Category;
  name: string;
  producer: string;
  line: string;
  variant: string;
  vintage: number | null;
  producedOn: string | null;
  ageYears: number | null;
  abv: number | null;
  volumeMl: number | null;
  country: string;
  region: string;
  appellation: string;
  grapes: string[];
  color: WineColor | '';
  style: string;
  cask: string;
  labelText: string;
  tags: string[];
  notes: string;
  price: number | null;
  currency: string;
  boughtAt: string;
  stock: number;
  location: string;
  opened: boolean;
  boughtOn: string | null;
  wanted: boolean;
  /** The average across tastings and people, 1–10 (half stars). */
  rating: number | null;
  ratings: number;
  tastings: number;
  lastTasted: string | null;
  myRating: number | null;
  cover: PhotoRef | null;
  photos: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DrinkPerson {
  id: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
}

export interface DrinksResponse {
  drinks: Drink[];
  people: DrinkPerson[];
  tags: string[];
  countries: string[];
  currency: string;
}

export interface Photo extends PhotoRef {
  tastingId: string | null;
  kind: PhotoKind;
  width: number | null;
  height: number | null;
  bytes: number;
  createdAt: string;
}

// The tasting sheet: the same shape the API checks (backend/src/modules/drinks/schemas.ts).

export interface WineSheet {
  v: 1;
  kind: 'wine';
  appearance?: { clarity?: string; intensity?: string; colour?: string; other?: string[] };
  nose?: { condition?: string; intensity?: string; aromas?: string[]; development?: string };
  palate?: {
    sweetness?: string;
    acidity?: string;
    tannin?: string;
    alcohol?: string;
    body?: string;
    mousse?: string;
    intensity?: string;
    flavours?: string[];
    finish?: string;
  };
  conclusions?: {
    quality?: string;
    readiness?: string;
    balance?: boolean;
    length?: boolean;
    intensity?: boolean;
    complexity?: boolean;
  };
}

export interface SpiritSheet {
  v: 1;
  kind: 'spirit';
  appearance?: { intensity?: string; colour?: string };
  nose?: { intensity?: string; aromas?: string[] };
  palate?: {
    sweetness?: string;
    texture?: string[];
    flavours?: string[];
    finish?: string;
    complexity?: string;
  };
  conclusions?: { quality?: string };
}

export interface BeerScores {
  aroma?: number;
  appearance?: number;
  flavour?: number;
  mouthfeel?: number;
  overall?: number;
}

export interface BeerSheet {
  v: 1;
  kind: 'beer';
  scores?: BeerScores;
  aromas?: string[];
  offFlavours?: string[];
}

export type TastingSheet = WineSheet | SpiritSheet | BeerSheet;

export interface Tasting {
  id: string;
  drinkId: string;
  person: { id: string; name: string };
  mine: boolean;
  tastedOn: string;
  place: string;
  occasion: string;
  country: string;
  withPeople: string[];
  withOthers: string;
  rating: number | null;
  score: number | null;
  buyAgain: boolean | null;
  comment: string;
  pairing: string;
  mode: 'quick' | 'full';
  sheet: TastingSheet | null;
  photos: PhotoRef[];
  createdAt: string;
  updatedAt: string;
}

export interface Insights {
  rating: number | null;
  ratings: number;
  tastings: number;
  firstTasted: string | null;
  lastTasted: string | null;
  best: number | null;
  buyAgain: { yes: number; of: number } | null;
  people: { id: string; name: string; tastings: number; rating: number | null; last: string }[];
}

export interface PricePoint {
  id: string;
  price: number;
  currency: string;
  boughtAt: string;
  boughtOn: string;
}

export interface DrinkDetail {
  drink: Drink;
  photos: Photo[];
  tastings: Tasting[];
  insights: Insights;
  prices: PricePoint[];
  family: Drink[];
  people: DrinkPerson[];
}

export interface JournalEntry extends Tasting {
  drink: { id: string; name: string; category: Category; vintage: number | null; cover: string | null };
}

export interface GroupStat {
  drinks: number;
  tastings: number;
  rating: number | null;
}

export interface DrinkStats {
  totals: {
    drinks: number;
    tried: number;
    tastings: number;
    bottles: number;
    inCellar: number;
    wanted: number;
    countries: number;
    tastedIn: number;
  };
  mostLoved: Drink[];
  byCategory: (GroupStat & { category: Category })[];
  byCountry: (GroupStat & { country: string })[];
  tastedIn: { country: string; tastings: number }[];
  years: { year: number; tastings: number; drinks: number }[];
  thisYear: {
    year: number;
    tastings: number;
    drinks: number;
    firsts: number;
    top: { drink: Drink; rating: number | null }[];
  };
  people: { id: string; name: string; tastings: number; rating: number | null }[];
}

/** What a drink may be given: every field the API takes. */
export type DrinkFields = Partial<
  Pick<
    Drink,
    | 'category'
    | 'name'
    | 'producer'
    | 'line'
    | 'variant'
    | 'vintage'
    | 'producedOn'
    | 'ageYears'
    | 'abv'
    | 'volumeMl'
    | 'country'
    | 'region'
    | 'appellation'
    | 'grapes'
    | 'color'
    | 'style'
    | 'cask'
    | 'labelText'
    | 'tags'
    | 'notes'
    | 'price'
    | 'currency'
    | 'boughtAt'
    | 'stock'
    | 'location'
    | 'opened'
    | 'boughtOn'
    | 'wanted'
  >
>;

export interface StockChange {
  stock?: number;
  delta?: number;
  location?: string;
  opened?: boolean;
  boughtOn?: string | null;
  wanted?: boolean;
  price?: number | null;
  boughtAt?: string;
}

export interface TastingFields {
  tastedOn?: string;
  place?: string;
  occasion?: string;
  country?: string;
  withPeople?: string[];
  withOthers?: string;
  rating?: number | null;
  score?: number | null;
  buyAgain?: boolean | null;
  comment?: string;
  pairing?: string;
  mode?: 'quick' | 'full';
  sheet?: TastingSheet | null;
  personId?: string;
}

export const drinksKeys = {
  all: ['drinks'] as const,
  list: ['drinks', 'list'] as const,
  drink: (id: string) => ['drinks', 'drink', id] as const,
  journal: ['drinks', 'journal'] as const,
  stats: ['drinks', 'stats'] as const,
};

export const drinksApi = {
  list: () => api.get<DrinksResponse>('/drinks'),
  get: (id: string) => api.get<DrinkDetail>(`/drinks/${id}`),
  add: (fields: DrinkFields & { category: Category; name: string; fromId?: string }) =>
    api.post<{ drink: Drink }>('/drinks', fields),
  update: (id: string, fields: DrinkFields) => api.patch<{ drink: Drink }>(`/drinks/${id}`, fields),
  remove: (id: string) => api.delete<void>(`/drinks/${id}`),
  stock: (id: string, change: StockChange) => api.put<{ drink: Drink }>(`/drinks/${id}/stock`, change),
  addTasting: (id: string, fields: TastingFields) =>
    api.post<{ tasting: Tasting }>(`/drinks/${id}/tastings`, fields),
  updateTasting: (id: string, fields: TastingFields) =>
    api.patch<{ tasting: Tasting }>(`/drinks/tastings/${id}`, fields),
  removeTasting: (id: string) => api.delete<void>(`/drinks/tastings/${id}`),
  addPhoto: (id: string, image: string, kind: PhotoKind, tastingId?: string) =>
    api.post<{ photo: Photo }>(`/drinks/${id}/photos`, { image, kind, tastingId }),
  updatePhoto: (id: string, patch: { kind?: PhotoKind; cover?: true }) =>
    api.patch<{ photo: Photo }>(`/drinks/photos/${id}`, patch),
  removePhoto: (id: string) => api.delete<void>(`/drinks/photos/${id}`),
  journal: (limit = 200) => api.get<{ tastings: JournalEntry[] }>(`/drinks/tastings${query({ limit })}`),
  stats: () => api.get<DrinkStats>('/drinks/stats'),
};
