import { AuthenticationError } from '@/domain/errors/custom-errors';
import type { AppContainer } from '@/infra/http/container';
import { authCookieNames, getCookieValue } from '@/infra/http/cookies';

export function checkAuthController(container: AppContainer) {
  return async (cookieHeader: string | undefined) => {
    const accessToken = getCookieValue(cookieHeader, authCookieNames.access);
    if (!accessToken) {
      throw new AuthenticationError('Missing access token');
    }

    return container.checkAuthUseCase.execute(accessToken);
  };
}
