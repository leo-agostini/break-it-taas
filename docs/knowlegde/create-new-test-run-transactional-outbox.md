# CreateNewTestRun Dispatch Decision

## Problem

`CreateNewTestRunUseCase` previously published to queue and persisted the run in separate steps.

That flow had two failure windows:

1. Queue publish could happen before DB persistence, so consumers might read a run that does not exist yet.
2. If publish succeeds and persistence fails (or process crashes), state becomes inconsistent and hard to recover.

## How this was solved

The use case now follows the same Transactional Outbox approach used for first-run dispatch.

Inside one transaction we:

1. Create `TestRun`
2. Persist `TestRun`
3. Persist outbox event `test-run.requested` with payload `{ testRunId }`

A background outbox dispatcher publishes pending events to `TestRunQueue` and marks events as published/failed.

## Why this pattern

- Guarantees dispatch intent is persisted atomically with domain state.
- Avoids lost messages and ordering issues in crash scenarios.
- Enables retry and observability through outbox status (`PENDING`, `PUBLISHED`, `FAILED`).

## Scope of code changes

- `backend/src/application/use-cases/create-new-test-run.ts`
  - removed direct queue publish from the command use case
  - added `UnitOfWork` and `OutboxRepository`
  - enqueues `test-run.requested` event in the same transaction as `TestRun` persistence

## References

- Martin Fowler - Transactional Outbox:
  https://martinfowler.com/articles/patterns-of-distributed-systems/transactional-outbox.html
- Chris Richardson - Transactional Outbox pattern:
  https://microservices.io/patterns/data/transactional-outbox.html
- Enterprise Integration Patterns:
  https://www.enterpriseintegrationpatterns.com/
