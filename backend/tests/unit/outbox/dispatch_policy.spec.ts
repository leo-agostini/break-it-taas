import { test } from '@japa/runner';
import {
  MAX_DISPATCH_ATTEMPTS,
  OutboxEventStatus,
  afterDispatchFailure,
} from '#modules/outbox/domain/dispatch_policy';
import { TestRunEvents } from '#modules/outbox/domain/events';

test.group('Outbox dispatch policy', () => {
  test('retries with exponential backoff', ({ expect }) => {
    const now = new Date('2026-01-01T00:00:00Z');

    const first = afterDispatchFailure({ attemptsSoFar: 0, now });
    expect(first).toEqual({
      status: OutboxEventStatus.PENDING,
      attempts: 1,
      nextAttemptAt: new Date('2026-01-01T00:00:10Z'),
    });

    const third = afterDispatchFailure({ attemptsSoFar: 2, now });
    expect(third).toMatchObject({ attempts: 3 });
    expect(
      third.status === OutboxEventStatus.PENDING && third.nextAttemptAt,
    ).toEqual(new Date('2026-01-01T00:00:40Z'));
  });

  test('caps the backoff at five minutes', ({ expect }) => {
    const now = new Date('2026-01-01T00:00:00Z');
    const outcome = afterDispatchFailure({
      attemptsSoFar: 6,
      maxAttempts: 20,
      now,
    });

    expect(outcome).toEqual({
      status: OutboxEventStatus.PENDING,
      attempts: 7,
      nextAttemptAt: new Date('2026-01-01T00:05:00Z'),
    });
  });

  test('parks the event as FAILED once attempts are exhausted', ({
    expect,
  }) => {
    const outcome = afterDispatchFailure({
      attemptsSoFar: MAX_DISPATCH_ATTEMPTS - 1,
    });

    expect(outcome).toEqual({
      status: OutboxEventStatus.FAILED,
      attempts: MAX_DISPATCH_ATTEMPTS,
    });
  });

  test('recognizes a test-run requested payload', ({ expect }) => {
    const event = TestRunEvents.requested(
      '0192f1d2-0000-7000-8000-000000000000',
    );
    expect(TestRunEvents.isRequestedPayload(event.payload)).toBe(true);
    expect(TestRunEvents.isRequestedPayload({})).toBe(false);
  });
});
