import { randomUUIDv7 } from 'bun';

export enum TestRunStatus {
  CREATED = 'CREATED',
  RUNNING = 'RUNNING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

interface TestRunConstructorArgs {
  id: string;
  testCaseId: string;
  createdAt: Date;
  status: TestRunStatus;
  startedAt?: Date;
  completedAt?: Date;
}

export class TestRun {
  id: string;
  testCaseId: string;
  createdAt: Date;
  status: TestRunStatus;
  startedAt?: Date;
  completedAt?: Date;

  constructor(args: TestRunConstructorArgs) {
    this.id = args.id;
    this.testCaseId = args.testCaseId;
    this.createdAt = args.createdAt;
    this.status = args.status;
    this.startedAt = args.startedAt;
    this.completedAt = args.completedAt;
  }

  private complete(newStatus: TestRunStatus.SUCCEEDED | TestRunStatus.FAILED) {
    if (this.status !== TestRunStatus.RUNNING) {
      throw new Error('Can not complete a not running test');
    }

    this.status = newStatus;
    this.completedAt = new Date();
  }

  public start() {
    if (this.status !== TestRunStatus.CREATED) {
      throw new Error('Only runs with CREATED status can be started');
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

  static create(args: { testCaseId: string }) {
    return new TestRun({
      id: randomUUIDv7(),
      testCaseId: args.testCaseId,
      createdAt: new Date(),
      status: TestRunStatus.CREATED,
    });
  }
}
