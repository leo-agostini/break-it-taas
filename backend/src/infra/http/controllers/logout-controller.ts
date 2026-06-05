import { buildAuthClearCookieHeaders } from '@/infra/http/cookies';

export function logoutController() {
  return async () => {
    return {
      setCookieHeaders: buildAuthClearCookieHeaders(),
    };
  };
}
