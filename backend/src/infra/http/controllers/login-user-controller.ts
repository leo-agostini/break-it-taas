import { loginUserSchema } from '@/application/validators/new-user-validator';
import type { AppContainer } from '@/infra/http/container';
import { buildAuthSetCookieHeaders } from '@/infra/http/cookies';

export function loginUserController(container: AppContainer) {
  return async (body: unknown) => {
    const payload = loginUserSchema.parse(body);
    const result = await container.loginUserUseCase.execute(payload);

    return {
      user: result.user,
      setCookieHeaders: buildAuthSetCookieHeaders({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }),
    };
  };
}
