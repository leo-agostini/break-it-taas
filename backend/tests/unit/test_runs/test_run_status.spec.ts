import { test } from '@japa/runner';
import { InvariantViolationError } from '#modules/shared/domain/errors';
import {
  TestRunStatus,
  completeTransition,
  isTerminalStatus,
  queueTransition,
  startTransition,
} from '#modules/test_runs/domain/test_run_status';

test.group('TestRun lifecycle', () => {
  test('queues from CREATED status', ({ expect }) => {
    expect(queueTransition(TestRunStatus.CREATED)).toBe(TestRunStatus.QUEUED);
  });

  test('throws when queue is called from non-created status', ({ expect }) => {
    expect(() => queueTransition(TestRunStatus.QUEUED)).toThrow(
      InvariantViolationError,
    );
  });

  test('starts from CREATED or QUEUED status', ({ expect }) => {
    expect(startTransition(TestRunStatus.CREATED)).toBe(TestRunStatus.RUNNING);
    expect(startTransition(TestRunStatus.QUEUED)).toBe(TestRunStatus.RUNNING);
  });

  test('throws when a running run is started again', ({ expect }) => {
    expect(() => startTransition(TestRunStatus.RUNNING)).toThrow(
      InvariantViolationError,
    );
  });

  test('throws when run is completed without running', ({ expect }) => {
    expect(() =>
      completeTransition(TestRunStatus.QUEUED, TestRunStatus.SUCCEEDED),
    ).toThrow(InvariantViolationError);
  });

  test('completes with the reported outcome from RUNNING', ({ expect }) => {
    expect(
      completeTransition(TestRunStatus.RUNNING, TestRunStatus.TIMEOUT),
    ).toBe(TestRunStatus.TIMEOUT);
  });

  test('only completion statuses are terminal', ({ expect }) => {
    expect(isTerminalStatus(TestRunStatus.SUCCEEDED)).toBe(true);
    expect(isTerminalStatus(TestRunStatus.CANCELLED)).toBe(true);
    expect(isTerminalStatus(TestRunStatus.RUNNING)).toBe(false);
    expect(isTerminalStatus(TestRunStatus.QUEUED)).toBe(false);
  });
});
