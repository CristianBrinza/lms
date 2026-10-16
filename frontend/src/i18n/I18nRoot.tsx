import { useQueryClient } from '@tanstack/react-query';
import { Fragment, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/app/auth';
import { meApi } from '@/services/api/endpoints';
import { isLocale, setLocale, useLocale, type Locale } from './index';

/**
 * Keeps the language and the account in step, and remounts the app when the language changes, so
 * every screen, formatter and cached label is drawn again in the new words.
 *
 * On sign-in the account's language wins (a new phone opens in the person's language); an account
 * without one takes the device's.
 */
export function I18nRoot({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { user, setUser } = useAuth();
  const saved = user?.locale ?? null;
  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    if (isLocale(saved)) {
      setLocale(saved);
      return;
    }
    meApi
      .update({ locale })
      .then(setUser)
      .catch(() => undefined);
    // Only when the person (or their saved language) changes, not on every switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, saved]);

  return <Fragment key={locale}>{children}</Fragment>;
}

/** Switches the language here and on the account (when signed in). */
export function useChangeLocale(): (locale: Locale) => void {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  return useCallback(
    (next: Locale) => {
      setLocale(next);
      // Answers the server words (messages, notifications' previews) are fetched again.
      void queryClient.invalidateQueries();
      if (user && user.locale !== next)
        meApi
          .update({ locale: next })
          .then(setUser)
          .catch(() => undefined);
    },
    [user, setUser, queryClient],
  );
}
