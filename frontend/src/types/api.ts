export type Role = 'member' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  surname: string;
  role: Role;
  mustChangePassword: boolean;
  createdAt: string;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  heightCm: number | null;
  goal: 'lose' | 'keep' | 'gain' | null;
  goalWeight: number | null;
  goalRate: number | null;
  activity: Activity | null;
  /** The picture's address, or null. */
  avatarUrl: string | null;
  /** The app's language for this person; null until first chosen (the device's is used). */
  locale: 'en' | 'ro' | 'ru' | null;
  /** The day of the month the salary comes (1–31; a shorter month counts its last day), or null. */
  salaryDay: number | null;
  /** The day of the month the advance comes (1–31), or null when there is none. */
  advanceDay: number | null;
  /** The latest weight in kg, from any source: typed in, Apple Health, Health Connect. */
  weightKg: number | null;
  /** YYYY-MM-DD: when that weight was measured. */
  weightDay: string | null;
}

export type Gender = 'female' | 'male' | 'other';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'very';

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
