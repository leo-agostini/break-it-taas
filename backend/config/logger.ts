import { defineConfig, syncDestination, targets } from '@adonisjs/core/logger';
import app from '@adonisjs/core/services/app';
import { trace } from '@opentelemetry/api';
import env from '#start/env';

/**
 * Set for the outbox worker by bin/console.ts. The worker runs on the host,
 * where nothing tails stdout, so its logs also go over OTLP to Alloy (and on to
 * Loki) through pino's OpenTelemetry transport, which reads the collector URL
 * from OTEL_EXPORTER_OTLP_ENDPOINT. The API leaves it unset: Alloy tails its
 * container's stdout, and pino's OTel instrumentation already adds trace ids.
 */
const exportLogs = env.get('OTEL_EXPORT_LOGS', false);

const loggerConfig = defineConfig({
  /**
   * Default logger name used by ctx.logger and app logger calls.
   */
  default: 'app',

  loggers: {
    app: {
      /**
       * Toggle this logger on/off.
       */
      enabled: true,

      /**
       * Logger name shown in log records.
       */
      name: env.get('APP_NAME', 'breakit-backend'),

      /**
       * Minimum level to output (trace, debug, info, warn, error, fatal).
       */
      level: env.get('LOG_LEVEL'),

      /**
       * Use sync destination in non-production for immediate flush. Not when
       * exporting logs: pino ignores `transport` once a destination is set.
       */
      destination:
        !app.inProduction && !exportLogs ? await syncDestination() : undefined,

      /**
       * Configure where logs are written.
       */
      transport: {
        targets: targets()
          .push(targets.file({ destination: 1 }))
          .pushIf(exportLogs, {
            target: 'pino-opentelemetry-transport',
            options: {
              resourceAttributes: {
                'service.name': env.get('OTEL_SERVICE_NAME', 'breakit-backend'),
              },
            },
          })
          .toArray(),
      },

      /**
       * Stamps the active span on each line. The transport turns these fields
       * into the record's trace context (it needs all three), so a worker log
       * in Loki links to the dispatch trace it was written in.
       */
      mixin: exportLogs
        ? () => {
            const span = trace.getActiveSpan()?.spanContext();
            if (!span) return {};
            return {
              trace_id: span.traceId,
              span_id: span.spanId,
              trace_flags: span.traceFlags,
            };
          }
        : undefined,
    },
  },
});

export default loggerConfig;

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
