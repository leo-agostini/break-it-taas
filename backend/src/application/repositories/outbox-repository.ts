import type { TransactionContext } from "../ports/unit-of-work";
import type { OutboxEvent } from "@/domain/entities/outbox-event";

export interface OutboxRepository {
  enqueue(event: OutboxEvent, tx?: TransactionContext): Promise<void>;
  claimBatch(limit: number): Promise<OutboxEvent[]>;
  markPublished(eventId: string): Promise<void>;
  markFailed(eventId: string, errorMessage: string): Promise<void>;
}
