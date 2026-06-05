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
  K3S_QUEUE_ENDPOINT: process.env.K3S_QUEUE_ENDPOINT ?? '',
  RUNNER_SHARED_SECRET: process.env.RUNNER_SHARED_SECRET as string,
  RUNNER_CALLBACK_BASE_URL: process.env.RUNNER_CALLBACK_BASE_URL as string,
  RUNNER_IMAGE: process.env.RUNNER_IMAGE ?? 'breakit-runner:local',
  K3S_NAMESPACE: process.env.K3S_NAMESPACE ?? 'app',
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/app',
};
