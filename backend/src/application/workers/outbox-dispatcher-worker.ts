import type { TestRunQueue } from "../ports/test-run-queue";
import type { OutboxRepository } from "../repositories/outbox-repository";
import type { TestRunRepository } from "../repositories/test-run-repository";
import { OutboxEventEnum } from "@/domain/events/outbox-event-map";
import { TestRunEvents } from "@/domain/events/test-run-events";

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
          throw new Error("Outbox event payload must include testRunId");
        }

        const testRunId = event.payload.testRunId;

        const testRun = await this.testRunRepository.find(testRunId);
        if (!testRun) {
          throw new Error(`Test run ${testRunId} not found`);
        }

        await this.testRunQueue.publish(testRun);
        await this.outboxRepository.markPublished(event.id);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected outbox error";
        await this.outboxRepository.markFailed(event.id, message);
      }
    }
  }
}
