export enum OutboxEventEnum {
  TEST_RUN_REQUESTED = "test-run.requested",
}

export interface OutboxEventMap {
  [OutboxEventEnum.TEST_RUN_REQUESTED]: {
    testRunId: UUID;
  };
}
