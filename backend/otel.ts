/**
 * OpenTelemetry bootstrap. bin/server.ts imports this before anything else so
 * the instrumentations can hook http, pg and pino before those modules load.
 *
 * Set OTEL_SDK_DISABLED=true in the process environment to skip it entirely,
 * including the ESM loader hook (config/otel.ts explains what is exported).
 */
import { init } from '@adonisjs/otel/init';

await init(import.meta.dirname);
