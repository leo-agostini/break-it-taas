import { defineConfig } from '@adonisjs/otel';
import env from '#start/env';

/**
 * Two processes run with this config: the API (bin/server.ts) and the outbox
 * worker (bin/console.ts, for `outbox:work` only), told apart by
 * OTEL_SERVICE_NAME. Traces and metrics go to Alloy over OTLP/HTTP, which fans
 * them out to Tempo and Prometheus.
 *
 * Logs never go through this SDK. The API writes pino JSON to stdout and Alloy
 * tails it into Loki; the pino instrumentation stamps trace_id/span_id on each
 * line so Grafana can jump from a log to its trace. The worker exports its logs
 * through a pino transport instead (config/logger.ts), because it starts
 * without the ESM loader hook the pino instrumentation needs (bin/console.ts).
 *
 * Disabled in tests by the package itself, and anywhere OTEL_SDK_DISABLED=true
 * is set in the process environment (docker-compose.yml and ops/dev-up.sh do
 * this unless OBSERVABILITY=1).
 */
// Both are read when the SDK starts, which happens after this file loads, in
// the API and the worker alike.
//
// Stable HTTP semantic conventions: http.server.request.duration in seconds,
// labelled http_route and http_response_status_code. The Grafana dashboards and
// the ApiHighErrorRate rule query those names; the instrumentation's default is
// still the legacy http.server.duration (milliseconds, different labels).
process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http';
// With no log destination configured the SDK falls back to this variable, whose
// default is "otlp": the API would ship every line a second time next to the
// stdout copy Alloy already tails.
process.env.OTEL_LOGS_EXPORTER ??= 'none';

export default defineConfig({
  serviceName: env.get(
    'OTEL_SERVICE_NAME',
    env.get('APP_NAME', 'breakit-backend'),
  ),
  environment: env.get('NODE_ENV'),
  instrumentations: {
    // The worker polls every 5 seconds. Without a parent requirement each
    // claim query would start a trace of its own; with it, queries are traced
    // only inside a request or an event's dispatch span.
    '@opentelemetry/instrumentation-pg': { requireParentSpan: true },
    '@opentelemetry/instrumentation-knex': { requireParentSpan: true },
  },
  destinations: {
    alloy: {
      type: 'otlp',
      enabled: true,
      endpoint: env.get('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://localhost:4318'),
      signals: ['traces', 'metrics'],
      // The SDK default is 60s, too coarse for a "requests in the last minute"
      // panel: a 1m window would often hold a single sample, or none.
      metricExportIntervalMillis: 15_000,
    },
  },
});
