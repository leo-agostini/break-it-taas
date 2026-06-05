import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { mapErrorToHttp } from '@/application/errors/http-error-mapper';
import { db } from '@/infra/db/knex';
import { env } from '@/infra/config/env';
import { createContainer } from '@/infra/http/container';
import { createInternalRoutes } from '@/infra/http/routes/internal-routes';
import { createProtectedRoutes } from '@/infra/http/routes/protected-routes';
import { createPublicRoutes } from '@/infra/http/routes/public-routes';

const container = createContainer();

const app = new Elysia()
  .use(
    swagger({
      path: '/docs',
      documentation: {
        info: {
          title: 'Break It TaaS API',
          version: '1.0.0',
          description: 'API for test case and test run orchestration',
        },
        tags: [
          { name: 'health', description: 'Service and dependency health' },
          { name: 'auth', description: 'Authentication and user access' },
          { name: 'test-cases', description: 'Test case management' },
          { name: 'test-runs', description: 'Test run execution' },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
    }),
  )
  .options('*', ({ set, request }) => {
    const requestOrigin = request.headers.get('origin');
    const allowOrigin = env.CORS_ORIGIN === '*' && requestOrigin
      ? requestOrigin
      : env.CORS_ORIGIN;

    set.headers['Access-Control-Allow-Origin'] = allowOrigin;
    set.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cookie';
    set.headers['Access-Control-Allow-Credentials'] = 'true';
    set.headers.Vary = 'Origin';
    set.status = 204;
    return null;
  })
  .onAfterHandle(({ set, request }) => {
    const requestOrigin = request.headers.get('origin');
    const allowOrigin = env.CORS_ORIGIN === '*' && requestOrigin
      ? requestOrigin
      : env.CORS_ORIGIN;

    set.headers['Access-Control-Allow-Origin'] = allowOrigin;
    set.headers.Vary = 'Origin';
    set.headers['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS';
    set.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization,Cookie';
    set.headers['Access-Control-Allow-Credentials'] = 'true';
  })
  .onError(({ error, set }) => {
    console.error('Request failed', error);
    const mapped = mapErrorToHttp(error);
    set.status = mapped.status;
    return mapped.body;
  })
  .use(createPublicRoutes(container))
  .use(createProtectedRoutes(container))
  .use(createInternalRoutes(container))
  .all('*', ({ set }) => {
    set.status = 404;
    return { status: 'not_found' };
  });

app.listen(env.PORT);

console.info(`Backend listening on http://0.0.0.0:${env.PORT}`);

const shutdown = async () => {
  app.stop();
  await db.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
