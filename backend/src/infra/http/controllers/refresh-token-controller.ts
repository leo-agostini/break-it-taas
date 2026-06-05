import type { AppContainer } from '@/infra/http/container';
import { authCookieNames, buildAuthSetCookieHeaders, getCookieValue } from '@/infra/http/cookies';

export function refreshTokenController(container: AppContainer) {
  return async (cookieHeader: string | undefined) => {
    const refreshToken = getCookieValue(cookieHeader, authCookieNames.refresh);
    const result = await container.refreshTokenUseCase.execute(refreshToken);

    return {
      refreshed: true,
      setCookieHeaders: buildAuthSetCookieHeaders({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }),
    };
  };
}
