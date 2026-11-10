import { SpanStatusCode, metrics, trace } from '@opentelemetry/api';
import { OutboxEventType } from '../domain/events.js';
import type OutboxEvent from '../models/outbox_event.js';

/**
 * What became of one claimed event: delivered to its handler, scheduled for a
 * retry, or parked as FAILED (attempts exhausted, or no handler for its type).
 */
export type DispatchResult = 'published' | 'retried' | 'failed';

export interface DispatchOutcome {
  result: DispatchResult;
  /** Why the event was retried or parked. */
  error?: string;
}

/**
 * What the outbox reports about its own work. The dispatcher depends on this
 * interface rather than on OpenTelemetry, so tests can assert on outcomes
 * without an SDK.
 *
 * The backlog itself (events per status, age of the oldest pending one) is not
 * here: postgres-exporter reads it from the table, so it stays visible when the
 * worker is down, which is exactly when it matters.
 */
export interface OutboxTelemetry {
  /**
   * Runs one event's dispatch (handler call plus status update) and records
   * its outcome and duration. The handler's database and Kubernetes calls
   * become children of the event's span.
   */
  observeDispatch(
    event: OutboxEvent,
    dispatch: () => Promise<DispatchOutcome>,
  ): Promise<void>;
  /** One polling cycle; `error` when claiming or recording outcomes threw. */
  recordCycle(result: 'ok' | 'error'): void;
  /** Exports the zero baselines; call once before the first cycle. */
  publishBaseline(): Promise<void>;
}

const tracer = trace.getTracer('breakit.outbox');
const meter = metrics.getMeter('breakit.outbox');

/*
| Prometheus names after Alloy's OTLP translation, which the outbox dashboard
| and alert rules query:
|   breakit_outbox_events_processed_total{type,result}
|   breakit_outbox_dispatch_duration_seconds_bucket{type,result}
|   breakit_outbox_cycles_total{result}
*/
const processed = meter.createCounter('breakit.outbox.events.processed', {
  description: 'Outbox events claimed and dispatched, by outcome',
});
const dispatchDuration = meter.createHistogram(
  'breakit.outbox.dispatch.duration',
  {
    description: 'Time to hand one event to its handler and record the outcome',
    unit: 's',
    // The SDK's default buckets (0, 5, 10, 25 …) assume milliseconds; a
    // dispatch takes tens of milliseconds, which would all land in the first.
    advice: {
      explicitBucketBoundaries: [
        0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
      ],
    },
  },
);
const cycles = meter.createCounter('breakit.outbox.cycles', {
  description: 'Outbox polling cycles, by result',
});

// Every series starts at an exported 0 (see publishBaseline). Prometheus'
// increase() cannot see a series' first sample, so a worker that dispatched
// three events before its first export would otherwise show none of them.
// Unknown event types (parked as failed) start without a baseline.
const RESULTS: DispatchResult[] = ['published', 'retried', 'failed'];
for (const type of Object.values(OutboxEventType)) {
  for (const result of RESULTS) processed.add(0, { type, result });
}
cycles.add(0, { result: 'ok' });
cycles.add(0, { result: 'error' });

/**
 * The OpenTelemetry-backed implementation. Without an initialized SDK (tests,
 * OTEL_SDK_DISABLED=true) the API hands out no-op tracers and meters, so this
 * is safe to use everywhere.
 */
export const otelOutboxTelemetry: OutboxTelemetry = {
  observeDispatch(event, dispatch) {
    const attributes = {
      'outbox.event.id': event.id,
      'outbox.event.type': event.type,
      'outbox.event.attempt': event.attempts + 1,
    };

    return tracer.startActiveSpan(
      `outbox dispatch ${event.type}`,
      { attributes },
      async (span) => {
        const startedAt = performance.now();
        try {
          const { result, error } = await dispatch();
          const seconds = (performance.now() - startedAt) / 1000;
          processed.add(1, { type: event.type, result });
          dispatchDuration.record(seconds, { type: event.type, result });

          span.setAttribute('outbox.dispatch.result', result);
          if (result !== 'published') {
            span.setStatus({ code: SpanStatusCode.ERROR, message: error });
          }
        } catch (error) {
          // Recording the outcome itself failed, so there is no outcome to
          // count; the event stays PROCESSING and the cycle reports the error.
          span.recordException(error as Error);
          span.setStatus({ code: SpanStatusCode.ERROR });
          throw error;
        } finally {
          span.end();
        }
      },
    );
  },

  recordCycle(result) {
    cycles.add(1, { result });
  },

  async publishBaseline() {
    // The SDK's MeterProvider can flush; the API's no-op stand-in cannot.
    const provider = metrics.getMeterProvider() as {
      forceFlush?: () => Promise<void>;
    };
    await provider.forceFlush?.();
  },
};
