import { randomUUIDv7 } from 'bun';
import { InvariantViolationError } from '@/domain/errors/custom-errors';

export enum TestRunStatus {
  CREATED = 'CREATED',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  TIMEOUT = 'TIMEOUT',
  CANCELLED = 'CANCELLED',
}

type CompletetionStatus =
  | TestRunStatus.SUCCEEDED
  | TestRunStatus.FAILED
  | TestRunStatus.TIMEOUT
  | TestRunStatus.CANCELLED;

interface TestRunConstructorArgs {
  id: string;
  testCaseId: string;
  createdAt: Date;
  status: TestRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  runtimeRef?: string;
  resultSummary?: Record<string, unknown>;
  artifacts?: string[];
}

export class TestRun {
  id: string;
  testCaseId: string;
  createdAt: Date;
  status: TestRunStatus;
  startedAt?: Date;
  completedAt?: Date;
  runtimeRef?: string;
  resultSummary?: Record<string, unknown>;
  artifacts?: string[];

  constructor(args: TestRunConstructorArgs) {
    this.id = args.id;
    this.testCaseId = args.testCaseId;
    this.createdAt = args.createdAt;
    this.status = args.status;
    this.startedAt = args.startedAt;
    this.completedAt = args.completedAt;
    this.runtimeRef = args.runtimeRef;
    this.resultSummary = args.resultSummary;
    this.artifacts = args.artifacts;
  }

  private complete(newStatus: CompletetionStatus) {
    if (this.status !== TestRunStatus.RUNNING) {
      throw new InvariantViolationError('Can not complete a not running test');
    }

    this.status = newStatus;
    this.completedAt = new Date();
  }

  public start() {
    if (
      this.status !== TestRunStatus.CREATED &&
      this.status !== TestRunStatus.QUEUED
    ) {
      throw new InvariantViolationError(
        'Only runs with CREATED or QUEUED status can be started',
      );
    }
    this.startedAt = new Date();
    this.status = TestRunStatus.RUNNING;
  }

  public succeeded() {
    this.complete(TestRunStatus.SUCCEEDED);
  }

  public failed() {
    this.complete(TestRunStatus.FAILED);
  }

  public queue() {
    if (this.status !== TestRunStatus.CREATED) {
      throw new InvariantViolationError(
        'Only runs with CREATED status can be queued',
      );
    }
    this.status = TestRunStatus.QUEUED;
  }

  public timeout() {
    this.complete(TestRunStatus.TIMEOUT);
  }

  public cancel() {
    this.complete(TestRunStatus.CANCELLED);
  }

  static create(args: { testCaseId: string }) {
    return new TestRun({
      id: randomUUIDv7(),
      testCaseId: args.testCaseId,
      createdAt: new Date(),
      status: TestRunStatus.CREATED,
    });
  }
}
