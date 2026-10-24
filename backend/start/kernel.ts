/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| Registers the server and router middleware stacks.
|
*/

import router from '@adonisjs/core/services/router';
import server from '@adonisjs/core/services/server';

/**
 * Converts every exception to an HTTP response. Domain errors are mapped in
 * exactly one place (ADR-003): `#modules/shared/http/error_mapper`.
 */
server.errorHandler(() => import('#exceptions/handler'));

/**
 * Runs on every request, even when no route matches.
 */
server.use([
  () => import('#middleware/force_json_response_middleware'),
  () => import('#middleware/container_bindings_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
]);

/**
 * Runs on every request with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
]);

/**
 * Named middleware, assigned explicitly to routes or groups.
 */
export const middleware = router.named({
  auth: () => import('#middleware/auth_middleware'),
});
