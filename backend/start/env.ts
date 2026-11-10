/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| Single source of configuration. `Env.create` validates and casts every
| variable at boot, so a missing secret fails the process before it serves a
| request rather than on the first code path that reads it.
|
*/

import { Env } from '@adonisjs/core/env';

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_NAME: Env.schema.string.optional(),
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Session (see ADR-008). Frontend and backend live on unrelated public
  // domains, so production needs SameSite=None + Secure for the browser to send
  // the session cookie on cross-site requests.
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory'] as const),
  SESSION_SAMESITE: Env.schema.enum.optional([
    'lax',
    'strict',
    'none',
  ] as const),
  SESSION_SECURE: Env.schema.boolean.optional(),

  // CORS: comma-separated origin allowlist, or `*` to reflect any origin
  // (local development convenience only).
  CORS_ORIGIN: Env.schema.string.optional(),

  // Database
  DATABASE_URL: Env.schema.string(),

  // Runner
  RUNNER_SHARED_SECRET: Env.schema.secret(),
  RUNNER_CALLBACK_BASE_URL: Env.schema.string(),
  RUNNER_IMAGE: Env.schema.string.optional(),
  RUNNER_RUNTIME_CLASS: Env.schema.string.optional(),
  RUNNER_NODE_SELECTOR: Env.schema.string.optional(),

  // Kubernetes
  KUBERNETES_NAMESPACE: Env.schema.string.optional(),
  // No default on purpose. Out of cluster, an unset context used to fall back
  // to a hardcoded cluster name; when that cluster did not exist the client
  // silently dispatched Jobs to whatever kubectl's current-context happened to
  // be. KubernetesJobClient fails loudly instead.
  KUBERNETES_CONTEXT: Env.schema.string.optional(),

  // OpenTelemetry (config/otel.ts). OTEL_SDK_DISABLED is deliberately absent:
  // the SDK reads it from the process env before this file is ever loaded.
  OTEL_EXPORTER_OTLP_ENDPOINT: Env.schema.string.optional(),
  // Set by bin/console.ts for the outbox worker; the API keeps APP_NAME.
  OTEL_SERVICE_NAME: Env.schema.string.optional(),
  // Export logs over OTLP (config/logger.ts), for processes whose stdout
  // nothing collects: the outbox worker on the host.
  OTEL_EXPORT_LOGS: Env.schema.boolean.optional(),
});
