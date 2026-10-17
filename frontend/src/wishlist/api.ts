import { api } from '@/services/api/client';

/** /api/wishlist: the priority buy list, what the household wants to buy one day, in order. */

export const URGENCIES = ['now', 'soon', 'someday'] as const;
export type Urgency = (typeof URGENCIES)[number];
export type WishStatus = 'wanted' | 'bought' | 'dropped';

export interface Wish {
  id: string;
  name: string;
  note: string;
  url: string;
  price: number | null;
  currency: string;
  urgency: Urgency;
  category: string;
  position: number;
  status: WishStatus;
  boughtPrice: number | null;
  boughtOn: string | null;
  shared: boolean;
  owner: { id: string; name: string };
  mine: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WishlistResponse {
  items: Wish[];
  categories: string[];
  currency: string;
}

export interface WishInput {
  name: string;
  note?: string;
  url?: string;
  price?: number | null;
  currency?: string;
  urgency?: Urgency;
  category?: string;
  shared?: boolean;
  top?: boolean;
}

export type WishPatch = Partial<Omit<WishInput, 'top'>> & {
  status?: WishStatus;
  boughtPrice?: number | null;
  boughtOn?: string | null;
};

export const wishlistKeys = { all: ['wishlist'] as const };

export const wishlistApi = {
  list: () => api.get<WishlistResponse>('/wishlist'),
  add: (input: WishInput) => api.post<{ item: Wish }>('/wishlist', input),
  update: (id: string, patch: WishPatch) => api.patch<{ item: Wish }>(`/wishlist/${id}`, patch),
  remove: (id: string) => api.delete<void>(`/wishlist/${id}`),
  reorder: (ids: string[]) => api.put<WishlistResponse>('/wishlist/order', { ids }),
};
