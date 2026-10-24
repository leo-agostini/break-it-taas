import { ExceptionHandler, type HttpContext } from '@adonisjs/core/http';
import app from '@adonisjs/core/services/app';
import { mapErrorToHttp } from '#modules/shared/http/error_mapper';

export default class HttpExceptionHandler extends ExceptionHandler {
  protected debug = !app.inProduction;

  async handle(error: unknown, ctx: HttpContext) {
    if ((error as { code?: unknown } | null)?.code === 'E_ROUTE_NOT_FOUND') {
      return ctx.response.status(404).send({ status: 'not_found' });
    }

    const mapped = mapErrorToHttp(error);
    return ctx.response.status(mapped.status).send(mapped.body);
  }

  /**
   * Client errors (validation, auth, ownership, not found) are expected
   * outcomes, not incidents; only 5xx responses are logged as errors.
   */
  async report(error: unknown, ctx: HttpContext) {
    if (mapErrorToHttp(error).status < 500) return;
    return super.report(error, ctx);
  }
}
