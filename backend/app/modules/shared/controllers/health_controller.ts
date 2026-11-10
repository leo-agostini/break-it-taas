import type { HttpContext } from '@adonisjs/core/http';
import db from '@adonisjs/lucid/services/db';

export default class HealthController {
  async show({ response, logger }: HttpContext) {
    let postgres = 'down';

    try {
      await db.rawQuery('select 1');
      postgres = 'up';
    } catch (error) {
      logger.error({ err: error }, 'Postgres check failed');
    }

    const allHealthy = postgres === 'up';
    response.status(allHealthy ? 200 : 503);

    return {
      status: allHealthy ? 'ok' : 'degraded',
      services: {
        postgres,
      },
    };
  }
}
