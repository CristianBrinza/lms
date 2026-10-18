import type { Locale } from '@/i18n';
import type {
  Activity,
  ActivityEntry,
  AdminUser,
  DeviceSession,
  Household,
  Gender,
  Role,
  User,
} from '@/types/api';

/** The profile beyond a name (null clears a field). */
export interface ProfileInput {
  gender?: Gender | null;
  birthDate?: string | null;
  heightCm?: number | null;
  goal?: User['goal'];
  goalWeight?: number | null;
  goalRate?: number | null;
  activity?: Activity | null;
  locale?: Locale | null;
  /** Day of the month, 1–31; null clears. */
  salaryDay?: number | null;
  /** Day of the month, 1–31; null clears. */
  advanceDay?: number | null;
  /** 20–400 kg, recorded as today's weight; null does nothing (weights are history). */
  weightKg?: number | null;
}
import { api, query } from './client';

export const authApi = {
  login: (body: { email: string; password: string; remember: boolean }) =>
    api.post<{ user: User }>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<{ user: User }>('/me').then((r) => r.user),
};

export const meApi = {
  update: (body: { name?: string; surname?: string } & ProfileInput) =>
    api.patch<{ user: User }>('/me', body).then((r) => r.user),
  /** A data URL made by shrinkPhoto; null removes the picture. */
  setAvatar: (image: string | null) =>
    (image === null
      ? api.delete<{ user: User }>('/me/avatar')
      : api.put<{ user: User }>('/me/avatar', { image })
    ).then((r) => r.user),
  changePassword: (body: { currentPassword?: string; newPassword: string }) =>
    api.post<{ user: User }>('/me/password', body).then((r) => r.user),
  sessions: () => api.get<{ sessions: DeviceSession[] }>('/me/sessions').then((r) => r.sessions),
  endSession: (id: string) => api.delete<void>(`/me/sessions/${id}`),
  signOutOthers: () => api.post<void>('/me/sessions/sign-out-others'),
};

export interface NewUserInput {
  email: string;
  name: string;
  surname: string;
  role: Role;
  password?: string;
  mustChangePassword: boolean;
}

export const adminApi = {
  users: (q = '') =>
    api.get<{ users: AdminUser[] }>(`/admin/users${query({ q })}`).then((r) => r.users),
  user: (id: string) => api.get<{ user: AdminUser }>(`/admin/users/${id}`).then((r) => r.user),
  create: (body: NewUserInput) =>
    api.post<{ user: AdminUser; password: string | null }>('/admin/users', body),
  update: (
    id: string,
    body: Partial<Pick<AdminUser, 'email' | 'name' | 'surname' | 'role' | 'isActive'>> &
      ProfileInput,
  ) => api.patch<{ user: AdminUser }>(`/admin/users/${id}`, body).then((r) => r.user),
  setAvatar: (id: string, image: string | null) =>
    (image === null
      ? api.delete<{ user: AdminUser }>(`/admin/users/${id}/avatar`)
      : api.put<{ user: AdminUser }>(`/admin/users/${id}/avatar`, { image })
    ).then((r) => r.user),
  resetPassword: (id: string, body: { password?: string; mustChangePassword: boolean }) =>
    api.post<{ user: AdminUser; password: string | null }>(`/admin/users/${id}/password`, body),
  signOut: (id: string) =>
    api.post<{ user: AdminUser }>(`/admin/users/${id}/sign-out`).then((r) => r.user),
  remove: (id: string) => api.delete<void>(`/admin/users/${id}`),
  activity: () => api.get<{ activity: ActivityEntry[] }>('/admin/activity').then((r) => r.activity),
  households: () =>
    api.get<{ households: Household[] }>('/admin/households').then((r) => r.households),
  createHousehold: (name: string) =>
    api.post<{ household: Household }>('/admin/households', { name }).then((r) => r.household),
  deleteHousehold: (id: string) => api.delete<void>(`/admin/households/${id}`),
  renameHousehold: (id: string, name: string) => api.patch<unknown>(`/admin/households/${id}`, { name }),
  /** Seats someone in a household; null gives them one of their own. */
  setKitchen: (id: string, householdId: string | null) =>
    api.put<{ user: AdminUser }>(`/admin/users/${id}/kitchen`, { householdId }).then((r) => r.user),
};
