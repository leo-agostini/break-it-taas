import type { HttpContext } from '@adonisjs/core/http';
import type { ActorContext } from '#modules/shared/domain/types';

/**
 * The domain-facing identity of the logged-in user. Controllers hand this to
 * services so no service ever reads the HTTP context or the session.
 *
 * Only valid behind `middleware.auth()`.
 */
export function actorOf({ auth }: HttpContext): ActorContext {
  const user = auth.getUserOrFail();
  return { userId: user.id, orgId: user.orgId };
}
