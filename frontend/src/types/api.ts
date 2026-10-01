export type Role = 'member' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface AdminUser extends User {
  isActive: boolean;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  activeSessions: number;
  updatedAt: string;
}

export interface DeviceSession {
  id: string;
  userAgent: string;
  ip: string;
  remember: boolean;
  createdAt: string;
  lastUsedAt: string;
  current: boolean;
}

export interface ActivityEntry {
  id: string;
  action: string;
  meta: Record<string, unknown>;
  createdAt: string;
  actor: { id: string; name: string } | null;
  target: { id: string; name: string } | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string>; requestId?: string };
}
