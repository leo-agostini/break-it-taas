import type { UUID } from '#modules/shared/domain/types';

/**
 * Every event that can be written to the outbox, with its payload. Producers
 * enqueue these inside the transaction that changed state (ADR-001); the
 * outbox dispatcher routes each type to exactly one handler.
 */
export enum OutboxEventType {
  TEST_RUN_REQUESTED = 'test-run.requested',
}

export interface OutboxEventPayloads {
  [OutboxEventType.TEST_RUN_REQUESTED]: {
    testRunId: UUID;
  };
}

export interface OutboxEventDraft<
  TType extends OutboxEventType = OutboxEventType,
> {
  type: TType;
  aggregateId: UUID;
  payload: OutboxEventPayloads[TType];
}

export const TestRunEvents = {
  requested(
    testRunId: UUID,
  ): OutboxEventDraft<OutboxEventType.TEST_RUN_REQUESTED> {
    return {
      type: OutboxEventType.TEST_RUN_REQUESTED,
      aggregateId: testRunId,
      payload: { testRunId },
    };
  },

  isRequestedPayload(
    payload: Record<string, unknown>,
  ): payload is OutboxEventPayloads[OutboxEventType.TEST_RUN_REQUESTED] {
    return typeof payload.testRunId === 'string';
  },
};
