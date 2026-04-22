# First TestRun Dispatch Decision

## Problem

When a `TestCase` is created, the platform should dispatch the first `TestRun` automatically.

The reliability issue is the gap between two operations:

1. Persisting data in Postgres (`TestCase`, `TestRun`)
2. Publishing a queue message for execution

If the process crashes between those two steps, the system can persist a `TestRun` but never dispatch it.

## Who this solves for

- API users and product workflows that expect new tests to start immediately.
- Operations and SRE teams that need fewer "stuck run" incidents.
- Backend maintainers who need deterministic recovery after crashes.

## Why this was solved this way

We implemented a Transactional Outbox flow instead of direct publish from the use case because it is safer under partial failures.

Direct publish can lose messages in crash windows. The outbox persists dispatch intent in the same DB transaction as domain writes, making dispatch eventually consistent and recoverable.

## Implemented pattern

### 1) Atomic write in the create test case use case

Inside one `UnitOfWork` transaction we now:

- Create the `TestCase`
- Create the first `TestRun` (`CREATED`)
- Enqueue an `OutboxEvent` with type `test-run.requested` and payload `{ testRunId }`

Code location:

- `backend/src/application/use-cases/create-new-test-case.ts`

### 2) Outbox abstraction

We introduced an application repository contract for outbox operations:

- `enqueue`
- `claimBatch`
- `markPublished`
- `markFailed`

Code location:

- `backend/src/application/repositories/outbox-repository.ts`

### 3) Background dispatcher worker

The dispatcher reads pending outbox events, validates payload, finds the run, publishes to queue, and updates event status.

Code location:

- `backend/src/application/workers/outbox-dispatcher-worker.ts`

### 4) Transaction boundary abstraction

We introduced a `UnitOfWork` contract and a Knex-backed implementation to support transactional orchestration.

Code locations:

- `backend/src/application/ports/unit-of-work.ts`
- `backend/src/db/knex-unit-of-work.ts`

## Benefits

- No lost first run when service crashes between DB write and queue publish.
- Retryable dispatch pipeline via outbox statuses.
- Cleaner separation between command-side writes and async delivery.

## Trade-offs

- More moving parts (worker + outbox table + status handling).
- Eventual, not immediate, queue publish.

## References

- Martin Fowler - Transactional Outbox:
  https://martinfowler.com/articles/patterns-of-distributed-systems/transactional-outbox.html
- Chris Richardson - Transactional Outbox pattern:
  https://microservices.io/patterns/data/transactional-outbox.html
- Enterprise Integration Patterns - Message Channel and reliability context:
  https://www.enterpriseintegrationpatterns.com/
