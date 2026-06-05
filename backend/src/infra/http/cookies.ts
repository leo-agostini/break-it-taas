import { env } from '@/infra/config/env';

const ACCESS_COOKIE_NAME = 'access_token';
const REFRESH_COOKIE_NAME = 'refresh_token';

interface CookieOptions {
  value: string;
  path: string;
  maxAge: number;
  httpOnly: boolean;
  sameSite: string;
  secure: boolean;
  domain?: string;
}

function parseMaxAgeSeconds(ttl: string, fallbackSeconds: number): number {
  const match = ttl.match(/^(\d+)([smhd])$/i);
  if (!match) return fallbackSeconds;

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return value;
  if (unit === 'm') return value * 60;
  if (unit === 'h') return value * 60 * 60;
  return value * 60 * 60 * 24;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    path: string;
  },
) {
  const normalizedSameSite = env.COOKIE_SAMESITE;
  const shouldUseSecure =
    env.COOKIE_SECURE || normalizedSameSite.toLowerCase() === 'none';

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    `SameSite=${normalizedSameSite}`,
  ];

  if (env.COOKIE_DOMAIN) {
    parts.push(`Domain=${env.COOKIE_DOMAIN}`);
  }
  if (shouldUseSecure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}

export function buildAuthSetCookieHeaders(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  return [
    serializeCookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
      path: '/',
      maxAge: parseMaxAgeSeconds(env.JWT_ACCESS_TTL, 900),
    }),
    serializeCookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      path: '/',
      maxAge: parseMaxAgeSeconds(env.JWT_REFRESH_TTL, 604800),
    }),
  ];
}

export function buildAuthCookieOptions(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  return {
    access: {
      value: tokens.accessToken,
      path: '/',
      maxAge: parseMaxAgeSeconds(env.JWT_ACCESS_TTL, 900),
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE.toLowerCase(),
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
    } satisfies CookieOptions,
    refresh: {
      value: tokens.refreshToken,
      path: '/',
      maxAge: parseMaxAgeSeconds(env.JWT_REFRESH_TTL, 604800),
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE.toLowerCase(),
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
    } satisfies CookieOptions,
  };
}

export function buildAuthClearCookieHeaders() {
  return [
    serializeCookie(ACCESS_COOKIE_NAME, '', { path: '/', maxAge: 0 }),
    serializeCookie(REFRESH_COOKIE_NAME, '', { path: '/', maxAge: 0 }),
  ];
}

export function buildAuthClearCookieOptions() {
  return {
    access: {
      value: '',
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE.toLowerCase(),
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
    } satisfies CookieOptions,
    refresh: {
      value: '',
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: env.COOKIE_SAMESITE.toLowerCase(),
      secure: env.COOKIE_SECURE,
      domain: env.COOKIE_DOMAIN,
    } satisfies CookieOptions,
  };
}

export function getCookieValue(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return undefined;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [rawKey, ...rest] = pair.trim().split('=');
    if (rawKey !== name) continue;
    return decodeURIComponent(rest.join('='));
  }

  return undefined;
}

export const authCookieNames = {
  access: ACCESS_COOKIE_NAME,
  refresh: REFRESH_COOKIE_NAME,
};
