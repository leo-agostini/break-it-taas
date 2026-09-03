import 'dotenv/config';
import type { JwtStringExpiresIn } from '@/application/services/jwt-auth';
import { ConfigurationError } from '@/domain/errors/custom-errors';

const required = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'RUNNER_SHARED_SECRET',
  'RUNNER_CALLBACK_BASE_URL',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new ConfigurationError(
      `Missing required environment variable: ${key}`,
    );
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3001),
  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,
  JWT_ACCESS_TTL: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtStringExpiresIn,
  JWT_REFRESH_TTL: (process.env.JWT_REFRESH_TTL ?? '7d') as JwtStringExpiresIn,
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true',
  COOKIE_SAMESITE: process.env.COOKIE_SAMESITE ?? 'Lax',
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? '*',
  KUBERNETES_QUEUE_ENDPOINT: process.env.KUBERNETES_QUEUE_ENDPOINT ?? '',
  RUNNER_SHARED_SECRET: process.env.RUNNER_SHARED_SECRET as string,
  RUNNER_CALLBACK_BASE_URL: process.env.RUNNER_CALLBACK_BASE_URL as string,
  RUNNER_IMAGE: process.env.RUNNER_IMAGE ?? 'breakit-k6-runner:local',
  KUBERNETES_NAMESPACE: process.env.KUBERNETES_NAMESPACE ?? 'app',
  // No default on purpose. Out of cluster, an unset context used to fall back
  // to a hardcoded cluster name; when that cluster did not exist the client
  // silently dispatched Jobs to whatever kubectl's current-context happened to
  // be. KubernetesJobClient now fails loudly instead.
  KUBERNETES_CONTEXT:
    process.env.KUBERNETES_CONTEXT ??
    process.env.INTEGRATION_KUBECONFIG_CONTEXT,
  // Environment-specific runner scheduling. Unset locally (kind); set on
  // managed clusters, e.g. gvisor + sandbox.gke.io/runtime=gvisor on GKE.
  RUNNER_RUNTIME_CLASS: process.env.RUNNER_RUNTIME_CLASS,
  RUNNER_NODE_SELECTOR: process.env.RUNNER_NODE_SELECTOR,
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/app',
};
