import app from '@adonisjs/core/services/app';
import testUtils from '@adonisjs/core/services/test_utils';
import type { ApiClient } from '@japa/api-client';
import { test } from '@japa/runner';
import type User from '#modules/identity/models/user';
import Result from '#modules/load_testing/models/result';
import TestRun from '#modules/load_testing/models/test_run';
import TestRunMetric from '#modules/load_testing/models/test_run_metric';
import RunDispatchService from '#modules/load_testing/services/run_dispatch_service';
import OutboxEvent from '#modules/outbox/models/outbox_event';
import { type RunnerJob, TestRunQueue } from '#modules/runner/test_run_queue';
import { makeValidNewTestCaseInput } from '#tests/fixtures/test_case_fixtures';
import { createUser, signRunnerCallback } from '#tests/helpers/factories';

async function createTestCase(client: ApiClient, user: User) {
  const response = await client
    .post('/api/test-cases')
    .json(
      makeValidNewTestCaseInput({
        ownerId: user.id,
        loadProfile: {
          mode: 'CONSTANT',
          config: { duration: 10, targetRate: 5000, timeUnit: 'SECONDS' },
        },
      }),
    )
    .loginAs(user);
  return response.body() as { testCaseId: string; testRunId: string };
}

function callbackBody(
  testRunId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    testRunId,
    status: 'SUCCEEDED',
    runtimeRef: 'testrun-abc',
    completedAt: '2026-05-17T12:00:00.000Z',
    artifacts: ['s3://bucket/summary.json'],
    resultSummary: {
      summary: {
        metrics: {
          http_reqs: { count: 48000, rate: 4800.12345 },
          http_req_failed: { value: 0.0123456789 },
          http_req_duration: { 'p(95)': 120.555555, 'p(99)': 240.1, med: 80 },
          dropped_iterations: { count: 0 },
        },
      },
    },
    ...overrides,
  };
}

/**
 * The api client serializes `.json()` bodies with JSON.stringify, so signing
 * that same string reproduces the exact bytes the server verifies.
 */
function postCallback(
  client: ApiClient,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return client
    .post('/api/internal/test-runs/callback')
    .headers({ ...signRunnerCallback(JSON.stringify(body)), ...headers })
    .json(body);
}

test.group('load_testing / test runs', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('queues a new run for an owned test case', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .loginAs(user);

    response.assertStatus(201);
    response.assertBodyContains({
      testCaseId,
      status: 'QUEUED',
      startedAt: null,
      completedAt: null,
    });
    assert.lengthOf(await OutboxEvent.all(), 2);
  });

  test('refuses runs on someone else’s or a missing test case', async ({
    client,
  }) => {
    const owner = await createUser();
    const stranger = await createUser();
    const { testCaseId } = await createTestCase(client, owner);

    const foreign = await client
      .post(`/api/test-runs/${testCaseId}`)
      .loginAs(stranger);
    foreign.assertStatus(403);

    const missing = await client
      .post('/api/test-runs/0192f1d2-0000-7000-8000-000000000000')
      .loginAs(owner);
    missing.assertStatus(404);
  });

  test('a run is only visible to the owner of its test case', async ({
    client,
  }) => {
    const owner = await createUser();
    const stranger = await createUser();
    const { testRunId } = await createTestCase(client, owner);

    const own = await client.get(`/api/test-runs/${testRunId}`).loginAs(owner);
    own.assertStatus(200);
    own.assertBodyContains({ id: testRunId, status: 'QUEUED' });

    const foreign = await client
      .get(`/api/test-runs/${testRunId}`)
      .loginAs(stranger);
    foreign.assertStatus(404);
  });
});

class FakeQueue extends TestRunQueue {
  published: RunnerJob[] = [];

  async publish(job: RunnerJob) {
    this.published.push(job);
    return { runtimeRef: `job-${job.testRunId.slice(0, 8)}` };
  }
}

test.group('load_testing / per-run configuration', (group) => {
  group.each.setup(() => testUtils.db().truncate());
  group.each.teardown(() => app.container.restore(TestRunQueue));

  test('a run without a body runs at the test case default', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testCaseId, testRunId: firstRunId } = await createTestCase(
      client,
      user,
    );

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .loginAs(user);

    response.assertStatus(201);
    response.assertBodyContains({
      loadProfile: {
        mode: 'CONSTANT',
        config: { targetRate: 5000, duration: 10, timeUnit: 'SECONDS' },
      },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 120 },
    });
    const first = await TestRun.findOrFail(firstRunId);
    assert.deepEqual(first.loadProfile, response.body().loadProfile);
  });

  test('runs the same case at a different rate and container', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({
        loadProfile: {
          mode: 'CONSTANT',
          config: {
            targetRate: 2500,
            duration: 10,
            timeUnit: 'SECONDS',
            vus: { preAllocated: 300, max: 900 },
          },
        },
        executionPolicy: {
          resourceProfile: 'CUSTOM',
          cpuMillicores: 2000,
          memoryMb: 4096,
        },
      })
      .loginAs(user);

    response.assertStatus(201);
    const run = await TestRun.findOrFail(response.body().id);
    assert.deepEqual(run.loadProfile.config, {
      targetRate: 2500,
      duration: 10,
      timeUnit: 'SECONDS',
      vus: { preAllocated: 300, max: 900 },
    });
    assert.deepEqual(run.executionPolicy, {
      resourceProfile: 'CUSTOM',
      timeoutSeconds: 120,
      cpuMillicores: 2000,
      memoryMb: 4096,
    });

    // The default is untouched: the next plain run is back at 5000 req/s.
    const plain = await client
      .post(`/api/test-runs/${testCaseId}`)
      .loginAs(user);
    assert.equal(plain.body().loadProfile.config.targetRate, 5000);
  });

  test('runs a case with virtual users and stretches the timeout to fit', async ({
    client,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({ loadPreset: { peakVus: 50, duration: 5, timeUnit: 'MINUTES' } })
      .loginAs(user);

    response.assertStatus(201);
    response.assertBodyContains({
      loadProfile: {
        mode: 'CONSTANT_VUS',
        config: { vus: 50, duration: 5, timeUnit: 'MINUTES' },
      },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 330 },
    });
  });

  test('rejects an override the test type does not allow', async ({
    client,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({
        loadProfile: {
          mode: 'RAMPING_VUS',
          config: {
            startVus: 0,
            timeUnit: 'SECONDS',
            stages: [{ target: 100, duration: 10 }],
          },
        },
      })
      .loginAs(user);

    response.assertStatus(422);
  });

  test('rejects a CUSTOM container without a size', async ({ client }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);

    const response = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({ executionPolicy: { resourceProfile: 'CUSTOM' } })
      .loginAs(user);

    response.assertStatus(422);
  });

  test('dispatches the run with its own load and container', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);
    const created = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({
        loadProfile: {
          mode: 'CONSTANT',
          config: { targetRate: 3750, duration: 10, timeUnit: 'SECONDS' },
        },
        executionPolicy: { resourceProfile: 'LARGE' },
      })
      .loginAs(user);

    const queue = new FakeQueue();
    app.container.swap(TestRunQueue, () => queue);
    const dispatcher = await app.container.make(RunDispatchService);
    await dispatcher.dispatch({ testRunId: created.body().id });

    const [job] = queue.published;
    assert.equal(job.testCase.id, testCaseId);
    assert.deepEqual(job.testCase.loadProfile, {
      mode: 'CONSTANT',
      config: { targetRate: 3750, duration: 10, timeUnit: 'SECONDS' },
    });
    assert.equal(job.testCase.executionPolicy.resourceProfile, 'LARGE');
  });

  test('measures a run against its own load, not the default', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testCaseId } = await createTestCase(client, user);
    const created = await client
      .post(`/api/test-runs/${testCaseId}`)
      .json({
        loadProfile: {
          mode: 'CONSTANT_VUS',
          config: { vus: 40, duration: 20, timeUnit: 'SECONDS' },
        },
      })
      .loginAs(user);
    const testRunId = created.body().id;

    await postCallback(
      client,
      callbackBody(testRunId, {
        resultSummary: {
          summary: {
            metrics: {
              http_reqs: { count: 9000, rate: 450 },
              vus: { value: 40 },
              vus_max: { value: 40 },
            },
          },
        },
      }),
    );

    const metrics = await TestRunMetric.findByOrFail('testRunId', testRunId);
    assert.isUndefined(metrics.requestedRate);
    assert.equal(metrics.requestedVus, 40);
    assert.equal(metrics.peakVus, 40);
    assert.equal(metrics.requestedDurationSeconds, 20);
    assert.isFalse(metrics.generatorLimited);

    const report = await client
      .get(`/api/test-runs/${testRunId}/report`)
      .loginAs(user);
    report.assertBodyContains({
      requested: { vus: 40, durationSeconds: 20 },
      achieved: { rps: 450, peakVus: 40 },
    });
  });
});

test.group('load_testing / runner callback', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('completes the run and stores result and metrics', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testRunId } = await createTestCase(client, user);

    const response = await postCallback(client, callbackBody(testRunId));

    response.assertStatus(200);
    response.assertBody({ status: 'accepted', updated: true });

    const run = await TestRun.findOrFail(testRunId);
    assert.equal(run.status, 'SUCCEEDED');
    assert.equal(run.runtimeRef, 'testrun-abc');
    assert.equal(run.completedAt?.toUTC().toISO(), '2026-05-17T12:00:00.000Z');
    assert.isNotNull(run.startedAt);

    const result = await Result.findByOrFail('testRunId', testRunId);
    assert.deepEqual(result.payload.artifacts, ['s3://bucket/summary.json']);

    const metrics = await TestRunMetric.findByOrFail('testRunId', testRunId);
    assert.equal(metrics.requestedRate, 5000);
    assert.equal(metrics.requestedDurationSeconds, 10);
    assert.equal(metrics.achievedRps, 4800.1235);
    assert.equal(metrics.failureRate, 0.012346);
    assert.equal(metrics.p95Ms, 120.5556);
  });

  test('acknowledges a repeated callback without changing anything', async ({
    client,
  }) => {
    const user = await createUser();
    const { testRunId } = await createTestCase(client, user);

    await postCallback(client, callbackBody(testRunId));
    const again = await postCallback(
      client,
      callbackBody(testRunId, { status: 'FAILED' }),
    );

    again.assertStatus(200);
    again.assertBody({ status: 'accepted', updated: false });
  });

  test('rejects a bad signature before touching the run', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const { testRunId } = await createTestCase(client, user);

    const response = await postCallback(client, callbackBody(testRunId), {
      'x-runner-signature': `sha256=${'0'.repeat(64)}`,
    });

    response.assertStatus(401);
    response.assertBodyContains({
      error: { message: 'Invalid runner callback signature' },
    });
    assert.equal((await TestRun.findOrFail(testRunId)).status, 'QUEUED');
  });

  test('rejects an expired timestamp', async ({ client }) => {
    const body = callbackBody('0192f1d2-0000-7000-8000-000000000000');
    const stale = Math.floor(Date.now() / 1000) - 3600;

    const response = await client
      .post('/api/internal/test-runs/callback')
      .headers(signRunnerCallback(JSON.stringify(body), { timestamp: stale }))
      .json(body);

    response.assertStatus(401);
    response.assertBodyContains({
      error: { message: 'Runner callback timestamp expired' },
    });
  });

  test('rejects a signed but malformed payload', async ({ client }) => {
    const response = await postCallback(client, {
      testRunId: 'nope',
      status: 'DONE',
    });

    response.assertStatus(422);
    response.assertBodyContains({ error: { code: 'VALIDATION_ERROR' } });
  });

  test('a signed callback for an unknown run is a 404', async ({ client }) => {
    const response = await postCallback(
      client,
      callbackBody('0192f1d2-0000-7000-8000-000000000000'),
    );
    response.assertStatus(404);
  });
});

test.group('load_testing / reports', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('lists runs with their metrics summary', async ({ client, assert }) => {
    const user = await createUser();
    const { testCaseId, testRunId } = await createTestCase(client, user);
    await postCallback(client, callbackBody(testRunId));
    await client.post(`/api/test-runs/${testCaseId}`).loginAs(user);

    const response = await client
      .get(`/api/test-cases/${testCaseId}/runs`)
      .loginAs(user);

    response.assertStatus(200);
    const [latest, first] = response.body();
    assert.equal(latest.status, 'QUEUED');
    assert.isNull(latest.metrics);
    assert.equal(first.id, testRunId);
    assert.include(first.metrics, {
      requestedRate: 5000,
      achievedRps: 4800.1235,
      generatorLimited: false,
    });
  });

  test('returns the normalized report of a finished run', async ({
    client,
  }) => {
    const user = await createUser();
    const { testRunId } = await createTestCase(client, user);
    await postCallback(client, callbackBody(testRunId));

    const response = await client
      .get(`/api/test-runs/${testRunId}/report`)
      .loginAs(user);

    response.assertStatus(200);
    response.assertBodyContains({
      testRunId,
      status: 'SUCCEEDED',
      completedAt: '2026-05-17T12:00:00.000Z',
      runtimeRef: 'testrun-abc',
      requested: { rate: 5000, timeUnit: 'SECONDS', durationSeconds: 10 },
      achieved: { rps: 4800.1235, totalRequests: 48000, p99Ms: 240.1 },
      flags: { generatorLimited: false, aborted: false },
      artifacts: ['s3://bucket/summary.json'],
    });
  });

  test('a run without a result has no report', async ({ client }) => {
    const user = await createUser();
    const { testRunId } = await createTestCase(client, user);

    const response = await client
      .get(`/api/test-runs/${testRunId}/report`)
      .loginAs(user);

    response.assertStatus(404);
  });
});
