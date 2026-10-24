import { InvariantViolationError } from '#modules/shared/domain/errors';

export enum TestRunStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

export type CompletionStatus =
  | TestRunStatus.SUCCEEDED
  | TestRunStatus.FAILED
  | TestRunStatus.TIMEOUT
  | TestRunStatus.CANCELLED;

export const COMPLETION_STATUSES: readonly CompletionStatus[] = [
  TestRunStatus.SUCCEEDED,
  TestRunStatus.FAILED,
  TestRunStatus.TIMEOUT,
  TestRunStatus.CANCELLED,
];

export function isTerminalStatus(status: TestRunStatus): boolean {
  return (COMPLETION_STATUSES as readonly TestRunStatus[]).includes(status);
}

/*
| The TestRun lifecycle, as pure transitions. Each returns the next status or
| throws when the move is illegal; the model applies the result and stamps the
| timestamps, so the rules stay testable without a database.
|
|   CREATED ─queue─▶ QUEUED ─start─▶ RUNNING ─complete─▶ SUCCEEDED | FAILED
|      └──────────────start──────────────┘                TIMEOUT | CANCELLED
*/

export function queueTransition(from: TestRunStatus): TestRunStatus {
  if (from !== TestRunStatus.CREATED) {
    throw new InvariantViolationError(
      'Only runs with CREATED status can be queued',
    );
  }
  return TestRunStatus.QUEUED;
}

export function startTransition(from: TestRunStatus): TestRunStatus {
  if (from !== TestRunStatus.CREATED && from !== TestRunStatus.QUEUED) {
    throw new InvariantViolationError(
      'Only runs with CREATED or QUEUED status can be started',
    );
  }
  return TestRunStatus.RUNNING;
}

export function completeTransition(
  from: TestRunStatus,
  outcome: CompletionStatus,
): CompletionStatus {
  if (from !== TestRunStatus.RUNNING) {
    throw new InvariantViolationError('Can not complete a not running test');
  }
  return outcome;
}
