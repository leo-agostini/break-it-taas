import { db } from '@/infra/db/knex';
import type { AppContainer } from '@/infra/http/container';
import { checkAuthController } from '@/infra/http/controllers/check-auth-controller';
import { createUserController } from '@/infra/http/controllers/create-user-controller';
import { loginUserController } from '@/infra/http/controllers/login-user-controller';
import { logoutController } from '@/infra/http/controllers/logout-controller';
import { refreshTokenController } from '@/infra/http/controllers/refresh-token-controller';
import {
  jsonWithSetCookies,
  noContentWithSetCookies,
} from '@/infra/http/set-cookie-response';
import { Elysia, t } from 'elysia';

export function createPublicRoutes(container: AppContainer) {
  const createUser = createUserController(container);
  const loginUser = loginUserController(container);
  const checkAuth = checkAuthController(container);
  const refreshToken = refreshTokenController(container);
  const logout = logoutController();

  return new Elysia({ prefix: '/api' })
    .get(
      '/health',
      async ({ set }) => {
        let postgres = 'down';

        try {
          await db.raw('select 1');
          postgres = 'up';
        } catch (error) {
          console.error('Postgres check failed', error);
        }

        const allHealthy = postgres === 'up';
        set.status = allHealthy ? 200 : 503;

        return {
          status: allHealthy ? 'ok' : 'degraded',
          services: {
            postgres,
          },
        };
      },
      {
        detail: {
          tags: ['health'],
          summary: 'Get API health status',
        },
      },
    )
    .post(
      '/login',
      async ({ body }) => {
        const result = await loginUser(body);
        return jsonWithSetCookies(
          { user: result.user },
          result.setCookieHeaders,
        );
      },
      {
        detail: {
          tags: ['auth'],
          summary: 'Authenticate user and issue auth cookies',
        },
        body: t.Object({
          email: t.String({ format: 'email' }),
          password: t.String(),
        }),
      },
    )
    .get(
      '/auth/check',
      async ({ headers }) => {
        return checkAuth(headers.cookie);
      },
      {
        detail: {
          tags: ['auth'],
          summary: 'Check current auth session',
        },
      },
    )
    .post(
      '/auth/refresh',
      async ({ headers }) => {
        const result = await refreshToken(headers.cookie);
        return jsonWithSetCookies({ refreshed: true }, result.setCookieHeaders);
      },
      {
        detail: {
          tags: ['auth'],
          summary: 'Refresh auth session cookies',
        },
      },
    )
    .post(
      '/auth/logout',
      async () => {
        const result = await logout();
        return noContentWithSetCookies(result.setCookieHeaders);
      },
      {
        detail: {
          tags: ['auth'],
          summary: 'Clear auth session cookies',
        },
      },
    )
    .post(
      '/users',
      async ({ body, set }) => {
        const createdUser = await createUser(body);
        set.status = 201;
        return createdUser;
      },
      {
        detail: {
          tags: ['auth'],
          summary: 'Create a new user account',
        },
        body: t.Object({
          name: t.String(),
          nickname: t.String(),
          photoUrl: t.Optional(t.String()),
          email: t.String({ format: 'email' }),
          password: t.String({ minLength: 12 }),
        }),
      },
    );
}
