import { inject } from '@adonisjs/core';
import { TestRunEvents } from '#modules/outbox/domain/events';
import { TestRunQueue } from '#modules/runner/test_run_queue';
import {
  NotFoundError,
  OutboxEventPayloadError,
} from '#modules/shared/domain/errors';
import TestCase from '../models/test_case.js';
import TestRun from '../models/test_run.js';

/**
 * Handles `test-run.requested` outbox events: hands the run to the runner
 * queue and marks it RUNNING. Throwing here makes the outbox retry the event
 * with backoff.
 */
@inject()
export default class RunDispatchService {
  constructor(private readonly queue: TestRunQueue) {}

  async dispatch(payload: Record<string, unknown>): Promise<void> {
    if (!TestRunEvents.isRequestedPayload(payload)) {
      throw new OutboxEventPayloadError(
        'Outbox event payload must include testRunId',
      );
    }

    const run = await TestRun.find(payload.testRunId);
    if (!run) {
      throw new NotFoundError(`Test run ${payload.testRunId} not found`);
    }

    const testCase = await TestCase.find(run.testCaseId);
    if (!testCase) {
      throw new NotFoundError(`Test case ${run.testCaseId} not found`);
    }

    const definition = JSON.parse(JSON.stringify(testCase.toDefinition()));
    const { runtimeRef } = await this.queue.publish({
      testRunId: run.id,
      testCase: { id: testCase.id, ...definition },
    });

    run.runtimeRef = runtimeRef;
    run.start();
    await run.save();
  }
}
