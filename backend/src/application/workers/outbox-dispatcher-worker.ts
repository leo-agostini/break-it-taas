import type { TestRunQueue } from '@/application/ports/test-run-queue';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { OutboxEventEnum } from '@/domain/events/outbox-event-map';
import { TestRunEvents } from '@/domain/events/test-run-events';
import {
  NotFoundError,
  OutboxEventPayloadError,
} from '@/domain/errors/custom-errors';

export class OutboxDispatcherWorker {
  constructor(
    private outboxRepository: OutboxRepository,
    private testRunRepository: TestRunRepository,
    private testRunQueue: TestRunQueue,
  ) {}

  async dispatchPending(limit = 50): Promise<void> {
    const events = await this.outboxRepository.claimBatch(limit);

    for (const event of events) {
      try {
        if (event.type !== OutboxEventEnum.TEST_RUN_REQUESTED) {
          await this.outboxRepository.markPublished(event.id);
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

        await this.testRunQueue.publish(testRun);
        await this.outboxRepository.markPublished(event.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unexpected outbox error';
        await this.outboxRepository.markFailed(event.id, message);
      }
    }
  }
}
