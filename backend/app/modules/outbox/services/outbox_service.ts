import type { TransactionClientContract } from '@adonisjs/lucid/types/database';
import { DateTime } from 'luxon';
import { OutboxEventStatus } from '../domain/dispatch_policy.js';
import type { OutboxEventDraft } from '../domain/events.js';
import OutboxEvent from '../models/outbox_event.js';

/**
 * The write side of the transactional outbox (ADR-001). `enqueue` requires the
 * caller's transaction: an event is only ever written together with the state
 * change it announces, so neither can exist without the other.
 */
export class OutboxService {
  async enqueue(
    draft: OutboxEventDraft,
    trx: TransactionClientContract,
  ): Promise<OutboxEvent> {
    return OutboxEvent.create(
      {
        type: draft.type,
        aggregateId: draft.aggregateId,
        payload: draft.payload,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        nextAttemptAt: DateTime.now(),
      },
      { client: trx },
    );
  }
}
