import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import {
  type OutboxEvent,
  OutboxEventStatus,
} from '@/domain/entities/outbox-event';

export class InMemoryOutboxRepository implements OutboxRepository {
  items: OutboxEvent[] = [];

  async enqueue(event: OutboxEvent, _tx?: TransactionContext): Promise<void> {
    this.items.push(event);
  }

  async claimBatch(limit: number): Promise<OutboxEvent[]> {
    return this.items
      .filter((event) => event.status === OutboxEventStatus.PENDING)
      .slice(0, limit)
      .map((event) => {
        event.markProcessing();
        return event;
      });
  }

  async markPublished(eventId: string): Promise<void> {
    const event = this.items.find((item) => item.id === eventId);
    if (!event) return;
    event.status = OutboxEventStatus.PUBLISHED;
    event.publishedAt = new Date();
    event.processingStartedAt = undefined;
    event.lastError = undefined;
  }

  async markRetry(
    eventId: string,
    errorMessage: string,
    nextAttemptAt: Date,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void> {
    const event = this.items.find((item) => item.id === eventId);
    if (!event) return;
    if (
      event.status !== OutboxEventStatus.PROCESSING ||
      event.attempts !== expectedAttemptsBeforeIncrement + 1
    ) {
      return;
    }

    event.attempts = expectedAttemptsBeforeIncrement + 1;
    event.lastError = errorMessage;
    event.status = OutboxEventStatus.PENDING;
    event.nextAttemptAt = nextAttemptAt;
    event.processingStartedAt = undefined;
  }

  async markFailed(
    eventId: string,
    errorMessage: string,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void> {
    const event = this.items.find((item) => item.id === eventId);
    if (!event) return;
    if (
      event.status !== OutboxEventStatus.PROCESSING ||
      event.attempts !== expectedAttemptsBeforeIncrement + 1
    ) {
      return;
    }

    event.attempts = expectedAttemptsBeforeIncrement + 1;
    event.lastError = errorMessage;
    event.status = OutboxEventStatus.FAILED;
    event.processingStartedAt = undefined;
    event.nextAttemptAt = undefined;
  }
}
