import { OutboxEventEnum, type OutboxEventMap } from './outbox-event-map';

type TestRunRequestedPayload =
  OutboxEventMap[typeof OutboxEventEnum.TEST_RUN_REQUESTED];

export const TestRunEvents = {
  requested(testRunId: UUID) {
    return {
      type: OutboxEventEnum.TEST_RUN_REQUESTED,
      aggregateId: testRunId,
      payload: { testRunId },
    } as const;
  },

  isRequestedPayload(
    payload: Record<string, unknown>,
  ): payload is TestRunRequestedPayload {
    return typeof payload.testRunId === 'string';
  },
};
