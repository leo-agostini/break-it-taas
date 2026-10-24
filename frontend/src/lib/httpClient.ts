import { API_SERVER_URL, API_URL } from '@/lib/env';
import axios from 'axios';

/*
 * Auth is a session cookie set by the API (ADR-008). There is no token to
 * refresh: a 401 means the session is gone, and the caller sends the user to
 * /login.
 */

export const publicHttpClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const privateHttpClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function resolveServerBaseUrl(request: Request) {
  const requestUrl = new URL(request.url);

  return API_SERVER_URL.startsWith('http')
    ? API_SERVER_URL
    : `${requestUrl.origin}${API_SERVER_URL}`;
}

/**
 * For loaders: calls the API server-side, forwarding the browser's cookies so
 * the request runs in the user's session.
 */
function createServerHttpClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';

  return axios.create({
    baseURL: resolveServerBaseUrl(request),
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
  });
}

export function createServerPrivateHttpClient(request: Request) {
  return createServerHttpClient(request);
}

export function createServerCheckHttpClient(request: Request) {
  return createServerHttpClient(request);
}
