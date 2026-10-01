import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppConfig } from '../../config';

/**
 * Cookie layout
 * - access  (`__Host-lms_at`): short-lived JWT, httpOnly, SameSite=Strict, Path=/
 * - refresh (`__Secure-lms_rt`): opaque rotating token, httpOnly, SameSite=Strict, Path=/api/auth
 * - hint    (`lms_sess`): non-secret "a session probably exists" flag, so the app skips a
 *   network round-trip at start for signed-out visitors. Holds no credentials.
 * "Keep me signed in" makes the refresh token and the hint persistent (REMEMBER_DAYS); without
 * it they last until the browser closes. Prefixes need HTTPS, so plain-HTTP development uses
 * unprefixed names.
 */
export function cookieNames(config: AppConfig) {
  const secure = config.cookieSecure;
  return {
    access: secure ? '__Host-lms_at' : 'lms_at',
    refresh: secure ? '__Secure-lms_rt' : 'lms_rt',
    hint: 'lms_sess',
  };
}

export const REFRESH_PATH = '/api/auth';

export function setSessionCookies(
  c: Context,
  config: AppConfig,
  tokens: { accessToken: string; refreshToken: string; remember: boolean },
): void {
  const names = cookieNames(config);
  const secure = config.cookieSecure;
  const persistentMaxAge = tokens.remember ? config.session.rememberDays * 86_400 : undefined;

  setAccessCookie(c, config, tokens.accessToken);
  setCookie(c, names.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'Strict',
    path: REFRESH_PATH,
    ...(persistentMaxAge ? { maxAge: persistentMaxAge } : {}),
  });
  setCookie(c, names.hint, '1', {
    httpOnly: false,
    secure,
    sameSite: 'Strict',
    path: '/',
    ...(persistentMaxAge ? { maxAge: persistentMaxAge } : {}),
  });
}

export function setAccessCookie(c: Context, config: AppConfig, accessToken: string): void {
  setCookie(c, cookieNames(config).access, accessToken, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'Strict',
    path: '/',
    maxAge: config.jwt.accessTtlSec,
  });
}

export function clearSessionCookies(c: Context, config: AppConfig): void {
  const names = cookieNames(config);
  const secure = config.cookieSecure;
  deleteCookie(c, names.access, { path: '/', secure });
  deleteCookie(c, names.refresh, { path: REFRESH_PATH, secure });
  deleteCookie(c, names.hint, { path: '/', secure });
}

export const readAccessToken = (c: Context, config: AppConfig) => getCookie(c, cookieNames(config).access);
export const readRefreshToken = (c: Context, config: AppConfig) => getCookie(c, cookieNames(config).refresh);
