import app from '@adonisjs/core/services/app';
import testUtils from '@adonisjs/core/services/test_utils';
import { test } from '@japa/runner';
import { DateTime } from 'luxon';
import TestRun from '#modules/load_testing/models/test_run';
import RunDispatchService from '#modules/load_testing/services/run_dispatch_service';
import { OutboxEventType } from '#modules/outbox/domain/events';
import OutboxEvent from '#modules/outbox/models/outbox_event';
import { OutboxDispatcher } from '#modules/outbox/services/outbox_dispatcher';
import { type RunnerJob, TestRunQueue } from '#modules/runner/test_run_queue';
import { makeValidNewTestCaseInput } from '#tests/fixtures/test_case_fixtures';
import { createUser } from '#tests/helpers/factories';

class FakeQueue extends TestRunQueue {
  published: RunnerJob[] = [];
  failWith?: Error;

  async publish(job: RunnerJob) {
    if (this.failWith) throw this.failWith;
    this.published.push(job);
    return { runtimeRef: `job-${job.testRunId.slice(0, 8)}` };
  }
}

async function dispatcherWith(queue: FakeQueue) {
  app.container.swap(TestRunQueue, () => queue);
  const runs = await app.container.make(RunDispatchService);
  return new OutboxDispatcher().on(
    OutboxEventType.TEST_RUN_REQUESTED,
    (payload) => runs.dispatch(payload),
  );
}

test.group('outbox / dispatcher', (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.teardown(() => app.container.restore(TestRunQueue));

  test('publishes a requested run and marks it RUNNING', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const created = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: user.id }))
      .loginAs(user);
    const { testCaseId, testRunId } = created.body();

    const queue = new FakeQueue();
    await (await dispatcherWith(queue)).dispatchPending();

    assert.lengthOf(queue.published, 1);
    assert.equal(queue.published[0].testRunId, testRunId);
    assert.equal(queue.published[0].testCase.id, testCaseId);
    assert.equal(queue.published[0].testCase.testType, 'SMOKE');

    const run = await TestRun.findOrFail(testRunId);
    assert.equal(run.status, 'RUNNING');
    assert.equal(run.runtimeRef, `job-${testRunId.slice(0, 8)}`);

    const [event] = await OutboxEvent.all();
    assert.equal(event.status, 'PUBLISHED');
    assert.isNotNull(event.publishedAt);
  });

  test('schedules a retry with backoff when publishing fails', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: user.id }))
      .loginAs(user);

    const queue = new FakeQueue();
    queue.failWith = new Error('cluster unreachable');
    await (await dispatcherWith(queue)).dispatchPending();

    const [event] = await OutboxEvent.all();
    assert.equal(event.status, 'PENDING');
    assert.equal(event.attempts, 1);
    assert.equal(event.lastError, 'cluster unreachable');
    assert.isTrue(event.nextAttemptAt > DateTime.now());

    // Not due yet, so a second cycle leaves it alone.
    await (await dispatcherWith(queue)).dispatchPending();
    assert.equal((await OutboxEvent.findOrFail(event.id)).attempts, 1);
  });

  test('parks events of an unknown type as FAILED', async ({ assert }) => {
    const event = await OutboxEvent.create({
      type: 'something.else',
      aggregateId: '0192f1d2-0000-7000-8000-000000000000',
      payload: {},
      status: 'PENDING' as never,
      attempts: 0,
      nextAttemptAt: DateTime.now().minus({ seconds: 1 }),
    });

    await (await dispatcherWith(new FakeQueue())).dispatchPending();

    const stored = await OutboxEvent.findOrFail(event.id);
    assert.equal(stored.status, 'FAILED');
    assert.equal(
      stored.lastError,
      'Unsupported outbox event type: something.else',
    );
  });
});
