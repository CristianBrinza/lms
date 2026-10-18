import { api, query } from '@/services/api/client';
import type { Category, ClosetColor, Material } from './catalog';

/** /api/closet: each person's pieces, their photos, where they're kept, days worn. */

export type Status =
  | 'clean'
  | 'to_wash'
  | 'at_cleaners'
  | 'lent'
  | 'wishlist'
  | 'archived'
  | 'sold'
  | 'donated';
export type Storage = '' | 'folded' | 'hanging' | 'drawer' | 'box' | 'laundry' | 'worn' | 'lent' | 'vacuum';
export type PhotoKind = 'front' | 'back' | 'label' | 'detail';
export type PlaceKind = 'room' | 'furniture' | 'shelf' | 'rail' | 'drawer' | 'box' | 'vacuum_bag' | 'hook' | 'section';
export type Side = '' | 'left' | 'middle' | 'right';

export interface Care {
  wash?: { method: 'machine' | 'hand' | 'none'; temp?: 30 | 40 | 50 | 60 | 70 | 95; gentle?: 0 | 1 | 2 };
  bleach?: 'any' | 'non_chlorine' | 'none';
  tumble?: 'low' | 'normal' | 'none';
  dry?: ('line' | 'drip' | 'flat' | 'shade')[];
  iron?: 'low' | 'medium' | 'high' | 'none';
  steam?: boolean;
  professional?: { method: 'P' | 'F' | 'W' | 'none'; gentle?: boolean };
}

export interface MaterialPart {
  material: Material;
  percent: number | null;
}

export interface Cover {
  id: string;
  thumb: string;
  full: string;
  hasAlpha: boolean;
}

export interface Item {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  category: Category | '';
  subcategory: string;
  colors: ClosetColor[];
  materials: MaterialPart[];
  size: string;
  sizeSystem: string;
  brand: string;
  price: number | null;
  currency: string;
  boughtOn: string | null;
  store: string;
  seasons: string[];
  occasions: string[];
  fit: string;
  condition: string;
  issues: string[];
  conditionNotes: string;
  tags: string[];
  notes: string;
  url: string;
  status: Status;
  lentTo: string;
  favorite: boolean;
  placeId: string | null;
  storage: Storage;
  care: Care | null;
  storageAdvice: string;
  madeIn: string;
  labelText: string;
  cover: Cover | null;
  photos: number;
  needsCutout: boolean;
  hasLabel: boolean;
  vectorRequested: boolean;
  wears: number;
  lastWorn: string | null;
  costPerWear: number | null;
  needsDetails: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Place {
  id: string;
  parentId: string | null;
  kind: PlaceKind;
  name: string;
  number: number | null;
  side: Side;
  position: number;
  items: number;
}

export interface Person {
  id: string;
  name: string;
  surname: string;
  avatarUrl: string | null;
}

export interface Overview {
  owner: string;
  items: Item[];
  people: Person[];
  places: Place[];
  tags: string[];
  brands: string[];
  currency: string;
}

export interface Photo {
  id: string;
  kind: PhotoKind;
  width: number | null;
  height: number | null;
  bytes: number;
  hasAlpha: boolean;
  needsCutout: boolean;
  cutoutOf: string | null;
  superseded: boolean;
  thumb: string;
  full: string;
  createdAt: string;
}

export interface ItemDetail {
  item: Item;
  photos: Photo[];
  originals: Photo[];
  placePath: string[];
  worn: string[];
  planned: string[];
  looks: { id: string; name: string }[];
  trips: { id: string; name: string; packed: boolean }[];
}

/** What a piece may be given: every field the API takes. */
export type ItemFields = Partial<
  Pick<
    Item,
    | 'name'
    | 'category'
    | 'subcategory'
    | 'colors'
    | 'materials'
    | 'size'
    | 'sizeSystem'
    | 'brand'
    | 'price'
    | 'currency'
    | 'boughtOn'
    | 'store'
    | 'seasons'
    | 'occasions'
    | 'fit'
    | 'condition'
    | 'issues'
    | 'conditionNotes'
    | 'tags'
    | 'notes'
    | 'url'
    | 'status'
    | 'lentTo'
    | 'favorite'
    | 'placeId'
    | 'storage'
    | 'care'
    | 'storageAdvice'
    | 'madeIn'
    | 'labelText'
  >
> & { ownerId?: string };

export interface PlaceFields {
  kind: PlaceKind;
  name?: string;
  parentId?: string | null;
  number?: number | null;
  side?: Side;
  position?: number;
}

export interface Storage_ {
  bytes: number;
  warn: boolean;
  full: boolean;
}

export const closetKeys = {
  all: ['closet'] as const,
  overview: (owner: string) => ['closet', 'overview', owner] as const,
  item: (id: string) => ['closet', 'item', id] as const,
};

export const closetApi = {
  overview: (owner: string) => api.get<Overview>(`/closet${query({ owner })}`),
  item: (id: string) => api.get<ItemDetail>(`/closet/items/${id}`),
  add: (fields: ItemFields) => api.post<{ item: Item }>('/closet/items', fields),
  update: (id: string, fields: ItemFields) => api.patch<{ item: Item }>(`/closet/items/${id}`, fields),
  remove: (id: string) => api.delete<void>(`/closet/items/${id}`),
  bulk: (ids: string[], patch: Partial<Pick<Item, 'status' | 'placeId' | 'storage' | 'favorite'>>) =>
    api.post<{ items: Item[] }>('/closet/items/bulk', { ids, patch }),
  worn: (id: string, wornOn?: string) => api.post<unknown>(`/closet/items/${id}/worn`, { wornOn }),
  addPhoto: (
    id: string,
    body: { image: string; kind?: PhotoKind; needsCutout?: boolean; replaces?: string; rotates?: string },
  ) => api.post<{ photo: Photo; storage: Storage_ }>(`/closet/items/${id}/photos`, body),
  requestVector: (id: string) => api.post<{ item: Item }>(`/closet/items/${id}/vector-request`, {}),
  cancelVector: (id: string) => api.delete<{ item: Item }>(`/closet/items/${id}/vector-request`),
  updatePhoto: (id: string, patch: { kind?: PhotoKind; cover?: true; needsCutout?: boolean }) =>
    api.patch<{ photo: Photo }>(`/closet/photos/${id}`, patch),
  removePhoto: (id: string) => api.delete<void>(`/closet/photos/${id}`),
  addPlace: (fields: PlaceFields) => api.post<{ place: Place }>('/closet/places', fields),
  updatePlace: (id: string, fields: Partial<PlaceFields>) =>
    api.patch<{ place: Place }>(`/closet/places/${id}`, fields),
  removePlace: (id: string) => api.delete<void>(`/closet/places/${id}`),
};
