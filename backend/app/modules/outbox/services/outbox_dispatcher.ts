import db from '@adonisjs/lucid/services/db';
import {
  OutboxEventStatus,
  afterDispatchFailure,
} from '../domain/dispatch_policy.js';
import type { OutboxEventPayloads, OutboxEventType } from '../domain/events.js';
import OutboxEvent from '../models/outbox_event.js';

const TABLE = 'outbox_events';

export type OutboxEventHandler<TType extends OutboxEventType> = (
  payload: OutboxEventPayloads[TType] | Record<string, unknown>,
) => Promise<void>;

/**
 * The read side of the outbox: claims due events, hands each to the handler
 * registered for its type, and records the outcome.
 *
 * The dispatcher does not know what any event means. Modules that consume
 * events register a handler (see commands/outbox_work.ts), which keeps the
 * outbox free of dependencies on the modules that use it.
 */
export class OutboxDispatcher {
  private readonly handlers = new Map<
    string,
    OutboxEventHandler<OutboxEventType>
  >();

  on<TType extends OutboxEventType>(
    type: TType,
    handler: OutboxEventHandler<TType>,
  ): this {
    this.handlers.set(type, handler as OutboxEventHandler<OutboxEventType>);
    return this;
  }

  async dispatchPending(limit = 50): Promise<void> {
    const events = await this.claimBatch(limit);

    for (const event of events) {
      const handler = this.handlers.get(event.type);

      if (!handler) {
        await this.markFailed(
          event,
          `Unsupported outbox event type: ${event.type}`,
        );
        continue;
      }

      try {
        await handler(event.payload);
        await this.markPublished(event);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unexpected outbox error';
        const outcome = afterDispatchFailure({
          attemptsSoFar: event.attempts,
        });

        if (outcome.status === OutboxEventStatus.FAILED) {
          await this.markFailed(event, message);
        } else {
          await this.markRetry(event, message, outcome.nextAttemptAt);
        }
      }
    }
  }

  /**
   * Atomically moves up to `limit` due events from PENDING to PROCESSING.
   * `for update skip locked` lets several workers poll the same table without
   * ever claiming the same event twice.
   */
  async claimBatch(limit: number): Promise<OutboxEvent[]> {
    if (limit <= 0) return [];

    return db.transaction(async (trx) => {
      const result = await trx.rawQuery(
        `
          with claim as (
            select id
            from ${TABLE}
            where status = ?
              and next_attempt_at <= now()
            order by created_at asc
            for update skip locked
            limit ?
          )
          update ${TABLE} oe
          set status = ?,
              processing_started_at = now()
          from claim
          where oe.id = claim.id
          returning oe.*
        `,
        [OutboxEventStatus.PENDING, limit, OutboxEventStatus.PROCESSING],
      );

      return OutboxEvent.$createMultipleFromAdapterResult(result.rows);
    });
  }

  private async markPublished(event: OutboxEvent): Promise<void> {
    await db
      .from(TABLE)
      .where({ id: event.id, status: OutboxEventStatus.PROCESSING })
      .update({
        status: OutboxEventStatus.PUBLISHED,
        published_at: new Date(),
        processing_started_at: null,
        last_error: null,
      });
  }

  /*
  | Retry and failure updates are conditional on the attempt count the event
  | was claimed with, so a late writer can never overwrite a newer outcome.
  */

  private async markRetry(
    event: OutboxEvent,
    errorMessage: string,
    nextAttemptAt: Date,
  ): Promise<void> {
    await db
      .from(TABLE)
      .where({
        id: event.id,
        status: OutboxEventStatus.PROCESSING,
        attempts: event.attempts,
      })
      .update({
        status: OutboxEventStatus.PENDING,
        last_error: errorMessage,
        next_attempt_at: nextAttemptAt,
        processing_started_at: null,
        attempts: db.raw('attempts + 1'),
      });
  }

  private async markFailed(
    event: OutboxEvent,
    errorMessage: string,
  ): Promise<void> {
    await db
      .from(TABLE)
      .where({
        id: event.id,
        status: OutboxEventStatus.PROCESSING,
        attempts: event.attempts,
      })
      .update({
        status: OutboxEventStatus.FAILED,
        last_error: errorMessage,
        processing_started_at: null,
        attempts: db.raw('attempts + 1'),
      });
  }
}
