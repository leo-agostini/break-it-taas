import { describe, expect, it } from 'bun:test';
import type { TestRunQueue } from '@/application/ports/test-run-queue';
import { OutboxDispatcherWorker } from '@/application/workers/outbox-dispatcher-worker';
import { OutboxEvent } from '@/domain/entities/outbox-event';
import { OutboxEventStatus } from '@/domain/entities/outbox-event';
import { TestRun } from '@/domain/entities/test-run';
import { TestRunStatus } from '@/domain/entities/test-run';
import { TestRunEvents } from '@/domain/events/test-run-events';
import { InMemoryOutboxRepository } from '@/tests/mocks/in-memory-outbox-repository';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';

class FakeTestRunQueue implements TestRunQueue {
  published: TestRun[] = [];

  constructor(private shouldFail = false) {}

  async publish(run: TestRun): Promise<{ runtimeRef: string }> {
    if (this.shouldFail) {
      throw new Error('enqueue failed');
    }
    this.published.push(run);
    return { runtimeRef: `job-${run.id}` };
  }

  async acknowledge(_runId: string): Promise<void> {
    return Promise.resolve();
  }
}

describe('OutboxDispatcherWorker', () => {
  it('publishes requested test run events', async () => {
    const outboxRepository = new InMemoryOutboxRepository();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const queue = new FakeTestRunQueue();
    const worker = new OutboxDispatcherWorker(
      outboxRepository,
      testCaseRepository,
      testRunRepository,
      queue,
    );

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    testCaseRepository.items.set(run.testCaseId, {
      id: run.testCaseId,
    } as never);
    await testRunRepository.save(run);
    await outboxRepository.enqueue(
      OutboxEvent.create(TestRunEvents.requested(run.id)),
    );

    await worker.dispatchPending(10);

    expect(queue.published).toHaveLength(1);
    expect(queue.published[0]?.id).toBe(run.id);
    expect(outboxRepository.items[0]?.status).toBe(OutboxEventStatus.PUBLISHED);
    const savedRun = await testRunRepository.find(run.id);
    expect(savedRun?.status).toBe(TestRunStatus.RUNNING);
    expect(savedRun?.runtimeRef).toBe(`job-${run.id}`);
  });

  it('marks event as pending again when enqueue fails', async () => {
    const outboxRepository = new InMemoryOutboxRepository();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const queue = new FakeTestRunQueue(true);
    const worker = new OutboxDispatcherWorker(
      outboxRepository,
      testCaseRepository,
      testRunRepository,
      queue,
    );

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    testCaseRepository.items.set(run.testCaseId, {
      id: run.testCaseId,
    } as never);
    await testRunRepository.save(run);
    await outboxRepository.enqueue(
      OutboxEvent.create(TestRunEvents.requested(run.id)),
    );

    await worker.dispatchPending(10);

    expect(outboxRepository.items[0]?.status).toBe(OutboxEventStatus.PENDING);
    expect(outboxRepository.items[0]?.attempts).toBe(1);
  });

  it('marks event as failed when failure reaches max attempts', async () => {
    const outboxRepository = new InMemoryOutboxRepository();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const queue = new FakeTestRunQueue(true);
    const worker = new OutboxDispatcherWorker(
      outboxRepository,
      testCaseRepository,
      testRunRepository,
      queue,
    );

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    testCaseRepository.items.set(run.testCaseId, {
      id: run.testCaseId,
    } as never);
    await testRunRepository.save(run);

    outboxRepository.items.push(
      new OutboxEvent({
        id: crypto.randomUUID(),
        type: TestRunEvents.requested(run.id).type,
        aggregateId: run.id,
        payload: TestRunEvents.requested(run.id).payload,
        status: OutboxEventStatus.PENDING,
        attempts: 7,
        createdAt: new Date(),
      }),
    );

    await worker.dispatchPending(10);

    expect(outboxRepository.items[0]?.status).toBe(OutboxEventStatus.FAILED);
    expect(outboxRepository.items[0]?.attempts).toBe(8);
  });
});
