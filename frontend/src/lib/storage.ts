/**
 * Safe wrappers around Web Storage: private modes, blocked storage and quota errors must
 * never break the app. Only non-sensitive preferences are stored here (never tokens).
 */
export const storage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore: preference simply won't persist.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  },
  getJson<T>(key: string): T | null {
    const raw = storage.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson(key: string, value: unknown): void {
    storage.set(key, JSON.stringify(value));
  },
};

export const session = {
  get(key: string): string | null {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Ignore.
    }
  },
  remove(key: string): void {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Ignore.
    }
  },
};

/** Every key this app keeps in Web Storage, in one place. */
export const STORAGE_KEYS = {
  /** The last email used to sign in on this device (pre-filled on the sign-in screen). */
  lastEmail: 'lms:last-email',
  /** The "web or app" start page was answered on this browser. */
  landingSeen: 'lms:landing-seen',
  /** The "add LMS to your Home Screen" card was dismissed on Home. */
  installCardHidden: 'lms:install-card-hidden',
  /** LMS is installed on this device (it has run as the app, or was just installed). */
  installed: 'lms:installed',
} as const;
