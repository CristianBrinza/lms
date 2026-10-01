import type { ActivityEntry, AdminUser, DeviceSession, Role, User } from '@/types/api';
import { api, query } from './client';

export const authApi = {
  login: (body: { email: string; password: string; remember: boolean }) => api.post<{ user: User }>('/auth/login', body),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<{ user: User }>('/me').then((r) => r.user),
};

export const meApi = {
  update: (body: { name: string; surname: string }) => api.patch<{ user: User }>('/me', body).then((r) => r.user),
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
  users: (q = '') => api.get<{ users: AdminUser[] }>(`/admin/users${query({ q })}`).then((r) => r.users),
  user: (id: string) => api.get<{ user: AdminUser }>(`/admin/users/${id}`).then((r) => r.user),
  create: (body: NewUserInput) => api.post<{ user: AdminUser; password: string | null }>('/admin/users', body),
  update: (id: string, body: Partial<Pick<AdminUser, 'email' | 'name' | 'surname' | 'role' | 'isActive'>>) =>
    api.patch<{ user: AdminUser }>(`/admin/users/${id}`, body).then((r) => r.user),
  resetPassword: (id: string, body: { password?: string; mustChangePassword: boolean }) =>
    api.post<{ user: AdminUser; password: string | null }>(`/admin/users/${id}/password`, body),
  signOut: (id: string) => api.post<{ user: AdminUser }>(`/admin/users/${id}/sign-out`).then((r) => r.user),
  remove: (id: string) => api.delete<void>(`/admin/users/${id}`),
  activity: () => api.get<{ activity: ActivityEntry[] }>('/admin/activity').then((r) => r.activity),
};
