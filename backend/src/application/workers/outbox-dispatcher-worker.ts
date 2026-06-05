import type { TestRunQueue } from '@/application/ports/test-run-queue';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { OutboxEventStatus } from '@/domain/entities/outbox-event';
import {
  NotFoundError,
  OutboxEventPayloadError,
} from '@/domain/errors/custom-errors';
import { OutboxEventEnum } from '@/domain/events/outbox-event-map';
import { TestRunEvents } from '@/domain/events/test-run-events';

// TODO: Refactor this class.
export class OutboxDispatcherWorker {
  private readonly maxAttempts = 8;

  constructor(
    private outboxRepository: OutboxRepository,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private testRunQueue: TestRunQueue,
  ) {}

  async dispatchPending(limit = 50): Promise<void> {
    const events = await this.outboxRepository.claimBatch(limit);

    for (const event of events) {
      try {
        if (event.type !== OutboxEventEnum.TEST_RUN_REQUESTED) {
          event.markFailed(`Unsupported outbox event type: ${event.type}`);
          await this.outboxRepository.markFailed(
            event.id,
            event.lastError ?? 'Unsupported outbox event type',
            event.attempts - 1,
          );
          continue;
        }

        if (!TestRunEvents.isRequestedPayload(event.payload)) {
          throw new OutboxEventPayloadError(
            'Outbox event payload must include testRunId',
          );
        }

        const testRunId = event.payload.testRunId;

        const testRun = await this.testRunRepository.find(testRunId);
        if (!testRun) {
          throw new NotFoundError(`Test run ${testRunId} not found`);
        }

        const testCase = await this.testCaseRepository.find(testRun.testCaseId);
        if (!testCase) {
          throw new NotFoundError(`Test case ${testRun.testCaseId} not found`);
        }

        const { runtimeRef } = await this.testRunQueue.publish(
          testRun,
          testCase,
        );
        testRun.runtimeRef = runtimeRef;
        testRun.start();
        await this.testRunRepository.save(testRun);
        await this.outboxRepository.markPublished(event.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unexpected outbox error';
        event.registerDispatchFailure(message, this.maxAttempts);

        if (event.status === OutboxEventStatus.FAILED) {
          await this.outboxRepository.markFailed(
            event.id,
            event.lastError ?? message,
            event.attempts - 1,
          );
          continue;
        }

        await this.outboxRepository.markRetry(
          event.id,
          event.lastError ?? message,
          event.nextAttemptAt ?? new Date(),
          event.attempts - 1,
        );
      }
    }
  }
}
