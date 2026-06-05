import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import { OutboxEvent, OutboxEventStatus } from '@/domain/entities/outbox-event';
import { db } from '@/infra/db/knex';
import type { Knex } from 'knex';

type OutboxRow = {
  id: string;
  type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  created_at: Date;
  next_attempt_at: Date;
  processing_started_at?: Date;
  published_at?: Date;
  last_error?: string;
};

const OUTBOX_TABLE = 'outbox_events';

const toEntity = (row: OutboxRow): OutboxEvent => {
  return new OutboxEvent({
    id: row.id,
    type: row.type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.created_at,
    nextAttemptAt: row.next_attempt_at,
    processingStartedAt: row.processing_started_at,
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
      next_attempt_at: event.nextAttemptAt ?? event.createdAt,
      processing_started_at: event.processingStartedAt,
      published_at: event.publishedAt,
      last_error: event.lastError,
    });
  }

  async claimBatch(limit: number): Promise<OutboxEvent[]> {
    if (limit <= 0) {
      return [];
    }

    return db.transaction(async (trx) => {
      const claimedResult = await trx.raw(
        `
          with claim as (
            select id
            from ${OUTBOX_TABLE}
            where status = ?
              and next_attempt_at <= now()
            order by created_at asc
            for update skip locked
            limit ?
          )
          update ${OUTBOX_TABLE} oe
          set status = ?,
              processing_started_at = now()
          from claim
          where oe.id = claim.id
          returning oe.*
        `,
        [OutboxEventStatus.PENDING, limit, OutboxEventStatus.PROCESSING],
      );

      const claimedRows = claimedResult.rows as OutboxRow[];
      return claimedRows.map(toEntity);
    });
  }

  async markPublished(eventId: string): Promise<void> {
    await db<OutboxRow>(OUTBOX_TABLE)
      .where({ id: eventId, status: OutboxEventStatus.PROCESSING })
      .update({
        status: OutboxEventStatus.PUBLISHED,
        published_at: new Date(),
        processing_started_at: db.raw('NULL'),
        last_error: db.raw('NULL'),
      });
  }

  async markRetry(
    eventId: string,
    errorMessage: string,
    nextAttemptAt: Date,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void> {
    await db<OutboxRow>(OUTBOX_TABLE)
      .where({
        id: eventId,
        status: OutboxEventStatus.PROCESSING,
        attempts: expectedAttemptsBeforeIncrement,
      })
      .update({
        status: OutboxEventStatus.PENDING,
        last_error: errorMessage,
        next_attempt_at: nextAttemptAt,
        processing_started_at: db.raw('NULL'),
        attempts: db.raw('attempts + 1'),
      });
  }

  async markFailed(
    eventId: string,
    errorMessage: string,
    expectedAttemptsBeforeIncrement: number,
  ): Promise<void> {
    await db<OutboxRow>(OUTBOX_TABLE)
      .where({
        id: eventId,
        status: OutboxEventStatus.PROCESSING,
        attempts: expectedAttemptsBeforeIncrement,
      })
      .update({
        status: OutboxEventStatus.FAILED,
        last_error: errorMessage,
        processing_started_at: db.raw('NULL'),
        attempts: db.raw('attempts + 1'),
      });
  }
}
