import type { Authenticators } from '@adonisjs/auth/types';
import type { HttpContext } from '@adonisjs/core/http';
import type { NextFn } from '@adonisjs/core/types/http';

/**
 * Denies the request unless the session belongs to a logged-in user. The
 * failure surfaces as `E_UNAUTHORIZED_ACCESS`, which the exception handler maps
 * to the same 401 `AUTHENTICATION_ERROR` body the API has always returned.
 */
export default class AuthMiddleware {
  async handle(
    ctx: HttpContext,
    next: NextFn,
    options: {
      guards?: (keyof Authenticators)[];
    } = {},
  ) {
    await ctx.auth.authenticateUsing(options.guards);
    return next();
  }
}
