import type { Knex } from "knex";
import { db } from "@/db/knex";
import { OutboxEvent, OutboxEventStatus } from "@/domain/entities/outbox-event";
import type { TransactionContext } from "@/application/ports/unit-of-work";
import type { OutboxRepository } from "@/application/repositories/outbox-repository";

type OutboxRow = {
  id: string;
  type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  created_at: Date;
  published_at?: Date;
  last_error?: string;
};

const OUTBOX_TABLE = "outbox_events";

const toEntity = (row: OutboxRow): OutboxEvent => {
  return new OutboxEvent({
    id: row.id,
    type: row.type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    lastError: row.last_error,
  });
};

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

export class KnexOutboxRepository implements OutboxRepository {
  async enqueue(event: OutboxEvent, tx?: TransactionContext): Promise<void> {
    const conn = contextOrDb(tx);

    await conn<OutboxRow>(OUTBOX_TABLE).insert({
      id: event.id,
      type: event.type,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      status: event.status,
      attempts: event.attempts,
      created_at: event.createdAt,
      published_at: event.publishedAt,
      last_error: event.lastError,
    });
  }

  async claimBatch(limit: number): Promise<OutboxEvent[]> {
    const rows = await db<OutboxRow>(OUTBOX_TABLE)
      .where({ status: OutboxEventStatus.PENDING })
      .orderBy("created_at", "asc")
      .limit(limit);

    return rows.map(toEntity);
  }

  async markPublished(eventId: string): Promise<void> {
    await db<OutboxRow>(OUTBOX_TABLE).where({ id: eventId }).update({
      status: OutboxEventStatus.PUBLISHED,
      published_at: new Date(),
      last_error: db.raw("NULL"),
    });
  }

  async markFailed(eventId: string, errorMessage: string): Promise<void> {
    await db<OutboxRow>(OUTBOX_TABLE)
      .where({ id: eventId })
      .update({
        status: OutboxEventStatus.FAILED,
        last_error: errorMessage,
        attempts: db.raw("attempts + 1"),
      });
  }
}
