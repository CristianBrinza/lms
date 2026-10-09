import { api, query } from '@/services/api/client';
import type {
  Bag,
  BagInput,
  Gear,
  GearInput,
  ItemInput,
  PackingItem,
  TravelHome,
  Trip,
  TripCheck,
  TripInput,
} from './types';

/** /api/travel: the household's trips, bags and packing list. */

export const travelKeys = {
  all: ['travel'] as const,
  home: (today: string) => ['travel', 'home', today] as const,
  trip: (id: string) => ['travel', 'trip', id] as const,
};

type TripWithChecks = { trip: Trip; checks: TripCheck[] };

export const travelApi = {
  home: (today: string) => api.get<TravelHome>(`/travel${query({ today })}`),
  trip: (id: string) => api.get<TripWithChecks>(`/travel/trips/${id}`),
  createTrip: (body: TripInput) => api.post<TripWithChecks>('/travel/trips', body),
  updateTrip: (id: string, body: Partial<TripInput>) =>
    api.patch<TripWithChecks>(`/travel/trips/${id}`, body),
  removeTrip: (id: string) => api.delete<void>(`/travel/trips/${id}`),
  addCheck: (tripId: string, body: { name: string; group?: string; quantity?: number }) =>
    api.post<{ check: TripCheck }>(`/travel/trips/${tripId}/checks`, body),
  updateCheck: (
    tripId: string,
    id: string,
    body: { checked?: boolean; name?: string; quantity?: number; toBuy?: boolean },
  ) => api.patch<{ check: TripCheck }>(`/travel/trips/${tripId}/checks/${id}`, body),
  removeCheck: (tripId: string, id: string) =>
    api.delete<void>(`/travel/trips/${tripId}/checks/${id}`),
  shop: (tripId: string) => api.post<{ listed: number }>(`/travel/trips/${tripId}/shop`),
  addBag: (body: BagInput) => api.post<{ bag: Bag }>('/travel/bags', body),
  updateBag: (id: string, body: Partial<BagInput>) =>
    api.patch<{ bag: Bag }>(`/travel/bags/${id}`, body),
  removeBag: (id: string) => api.delete<void>(`/travel/bags/${id}`),
  addGear: (body: GearInput) => api.post<{ gear: Gear }>('/travel/gear', body),
  updateGear: (id: string, body: Partial<GearInput>) =>
    api.patch<{ gear: Gear }>(`/travel/gear/${id}`, body),
  removeGear: (id: string) => api.delete<void>(`/travel/gear/${id}`),
  addItem: (body: ItemInput) => api.post<{ item: PackingItem }>('/travel/items', body),
  updateItem: (id: string, body: Partial<ItemInput>) =>
    api.patch<{ item: PackingItem }>(`/travel/items/${id}`, body),
  removeItem: (id: string) => api.delete<void>(`/travel/items/${id}`),
};
