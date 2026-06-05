import { describe, expect, it } from 'bun:test';
import { TestRun, TestRunStatus } from '@/domain/entities/test-run';
import { InvariantViolationError } from '@/domain/errors/custom-errors';

describe('TestRun entity', () => {
  it('queues from CREATED status', () => {
    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    run.queue();
    expect(run.status).toBe(TestRunStatus.QUEUED);
  });

  it('throws when queue is called from non-created status', () => {
    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    run.queue();
    expect(() => run.queue()).toThrow(InvariantViolationError);
  });

  it('starts from CREATED status', () => {
    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    run.start();
    expect(run.status).toBe(TestRunStatus.RUNNING);
  });

  it('throws when run is completed without running', () => {
    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    expect(() => run.succeeded()).toThrow(InvariantViolationError);
  });

  it('completes successfully from RUNNING status', () => {
    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    run.start();
    run.succeeded();
    expect(run.status).toBe(TestRunStatus.SUCCEEDED);
    expect(run.completedAt).toBeDefined();
  });
});
