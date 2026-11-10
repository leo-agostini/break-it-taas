# Spec: Outbox-Only Dispatch to K3s

## Objective
Use Postgres outbox as the single durable queue for test-run dispatch. A dedicated worker polls pending outbox events every 5 seconds, claims them atomically, and publishes to a K3s enqueue endpoint.

## Commands
- Dev API: `bun run dev`
- Dev worker: `bun run worker:dev`
- Test: `bun test ./src/tests`
- Typecheck: `bun run typecheck`

## Project Structure
- `src/index.ts`: API runtime only
- `src/worker.ts`: outbox dispatcher runtime only
- `src/application/workers`: worker orchestration logic
- `src/infra/db/repositories`: atomic outbox claim implementation
- `src/infra/queue`: outbound queue adapters

## Testing Strategy
- Unit-test worker dispatch behavior with in-memory repository and fake queue adapter.
- Verify retries are scheduled for transient K3s enqueue failures.
- Keep existing use-case tests passing.

## Boundaries
- Always: claim outbox rows atomically and avoid duplicate claims.
- Ask first: adding non-Postgres brokers for this flow.
- Never: silently drop unknown outbox event types.

## Success Criteria
- Outbox claim transitions `PENDING -> PROCESSING` atomically.
- Worker polls every 5 seconds and dispatches `TEST_RUN_REQUESTED` events.
- Transient enqueue failures are retried; terminal failures are marked `FAILED`.
- Redis is removed from backend runtime and compose stack for this flow.

## Observability
The worker is the one ace command booted with OpenTelemetry (`bin/console.ts`, service `breakit-worker`). It is off unless `OTEL_SDK_DISABLED=false`, which `ops/dev-up.sh` sets with `OBSERVABILITY=1`.
- Traces: one span per dispatched event (`outbox dispatch <type>`), with the handler's queries and Kubernetes API call as children. Retried or parked events mark the span as an error.
- Metrics (`app/modules/outbox/services/outbox_telemetry.ts`): `breakit_outbox_events_processed_total{type,result}`, `breakit_outbox_dispatch_duration_seconds`, and `breakit_outbox_cycles_total{result}`.
- Logs: retries (warn) and parked events (error) carry the event id and type, and go to Loki over OTLP through pino's OpenTelemetry transport (`config/logger.ts`).
- Backlog: `breakit_outbox_events{status}` and `breakit_outbox_oldest_age_seconds{status}` come from postgres-exporter reading the table, not from the worker, so they stay accurate while it is down.

See the Outbox Worker dashboard and `docs/05-operations/observability.md`.
