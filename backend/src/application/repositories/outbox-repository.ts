import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { OutboxEvent } from '@/domain/entities/outbox-event';

export interface OutboxRepository {
  enqueue(event: OutboxEvent, tx?: TransactionContext): Promise<void>;
  claimBatch(limit: number): Promise<OutboxEvent[]>;
  markPublished(eventId: string): Promise<void>;
  markRetry(
    eventId: string,
    errorMessage: string,
    nextAttemptAt: Date,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void>;
  markFailed(
    eventId: string,
    errorMessage: string,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void>;
}
