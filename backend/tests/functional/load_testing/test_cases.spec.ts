import testUtils from '@adonisjs/core/services/test_utils';
import { test } from '@japa/runner';
import TestCase from '#modules/load_testing/models/test_case';
import TestRun from '#modules/load_testing/models/test_run';
import OutboxEvent from '#modules/outbox/models/outbox_event';
import { makeValidNewTestCaseInput } from '#tests/fixtures/test_case_fixtures';
import { createUser, createUserInOrganization } from '#tests/helpers/factories';

test.group('load_testing / create test case', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('creates the case, its first run, and the outbox event atomically', async ({
    client,
    assert,
  }) => {
    const user = await createUser();

    const response = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: user.id }))
      .loginAs(user);

    response.assertStatus(201);
    const { testCaseId, testRunId } = response.body();

    const testCase = await TestCase.findOrFail(testCaseId);
    assert.equal(testCase.ownerId, user.id);
    assert.deepEqual(testCase.steps, [
      {
        path: '/health',
        method: 'GET',
        checks: [{ kind: 'STATUS_CODE', expected: 200 }],
      },
    ]);

    const run = await TestRun.findOrFail(testRunId);
    assert.equal(run.status, 'QUEUED');
    assert.equal(run.testCaseId, testCaseId);

    const events = await OutboxEvent.all();
    assert.lengthOf(events, 1);
    assert.equal(events[0].type, 'test-run.requested');
    assert.equal(events[0].aggregateId, testRunId);
    assert.equal(events[0].status, 'PENDING');
    assert.deepEqual(events[0].payload, { testRunId });
  });

  test('derives the profile from a preset', async ({ client, assert }) => {
    const user = await createUser();

    const response = await client
      .post('/api/test-cases')
      .json(
        makeValidNewTestCaseInput({
          ownerId: user.id,
          testType: 'AVG_LOAD',
          loadProfile: undefined,
          loadPreset: { peakRate: 50, duration: 10, timeUnit: 'MINUTES' },
          executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 900 },
        }),
      )
      .loginAs(user);

    response.assertStatus(201);
    const testCase = await TestCase.findOrFail(response.body().testCaseId);
    assert.equal(testCase.loadProfile.mode, 'RAMP');
  });

  test('lets a member create a case owned by their organization', async ({
    client,
  }) => {
    const { user, organization } = await createUserInOrganization();

    const response = await client
      .post('/api/test-cases')
      .json(
        makeValidNewTestCaseInput({
          ownerType: 'ORGANIZATION',
          ownerId: organization.id,
        }),
      )
      .loginAs(user);

    response.assertStatus(201);
  });

  test('rejects a case owned by someone else', async ({ client, assert }) => {
    const user = await createUser();

    const response = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput())
      .loginAs(user);

    response.assertStatus(403);
    response.assertBodyContains({ error: { code: 'AUTHORIZATION_ERROR' } });
    assert.lengthOf(await TestCase.all(), 0);
  });

  test('rejects a load mode incompatible with the test type', async ({
    client,
  }) => {
    const user = await createUser();

    const response = await client
      .post('/api/test-cases')
      .json(
        makeValidNewTestCaseInput({
          ownerId: user.id,
          loadProfile: {
            mode: 'RAMP',
            config: {
              initialRate: 5,
              timeUnit: 'SECONDS',
              stages: [{ target: 20, duration: 2 }],
            },
          },
        }),
      )
      .loginAs(user);

    response.assertStatus(422);
    response.assertBodyContains({
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'Load profile mode RAMP is not compatible with test type SMOKE',
      },
    });
  });

  test('reports structurally invalid payloads field by field', async ({
    client,
    assert,
  }) => {
    const user = await createUser();

    const response = await client
      .post('/api/test-cases')
      .json(
        makeValidNewTestCaseInput({
          ownerId: user.id,
          executionPolicy: { resourceProfile: 'HUGE', timeoutSeconds: '60' },
        }),
      )
      .loginAs(user);

    response.assertStatus(422);
    const { message } = response.body().error;
    assert.include(message, 'executionPolicy.resourceProfile');
    assert.include(message, 'executionPolicy.timeoutSeconds');
  });

  test('requires a session', async ({ client }) => {
    const response = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput());

    response.assertStatus(401);
  });
});

test.group('load_testing / read test cases', (group) => {
  group.each.setup(() => testUtils.db().truncate());

  test('lists only the actor’s cases, newest first, with run counts', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const stranger = await createUser();

    for (const name of ['first', 'second']) {
      await client
        .post('/api/test-cases')
        .json(makeValidNewTestCaseInput({ ownerId: user.id, name }))
        .loginAs(user);
    }
    await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: stranger.id }))
      .loginAs(stranger);

    const response = await client.get('/api/test-cases').loginAs(user);

    response.assertStatus(200);
    const body = response.body();
    assert.deepEqual(
      body.map((testCase: { name: string }) => testCase.name),
      ['second', 'first'],
    );
    assert.equal(body[0].runCount, 1);
  });

  test('returns one case in the established shape', async ({
    client,
    assert,
  }) => {
    const user = await createUser();
    const created = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: user.id }))
      .loginAs(user);
    const { testCaseId } = created.body();

    const response = await client
      .get(`/api/test-cases/${testCaseId}`)
      .loginAs(user);

    response.assertStatus(200);
    assert.deepEqual(Object.keys(response.body()), [
      'id',
      'name',
      'description',
      'createdAt',
      'ownerType',
      'ownerId',
      'testType',
      'targetSystem',
      'authStrategy',
      'loadProfile',
      'thresholdPolicy',
      'executionPolicy',
      'steps',
    ]);
    response.assertBodyContains({
      id: testCaseId,
      targetSystem: {
        baseUrl: 'https://api.example.com',
        environment: 'staging',
      },
      thresholdPolicy: { maxErrorRate: 0.05, abortOnFail: true },
      executionPolicy: { resourceProfile: 'SMALL', timeoutSeconds: 120 },
    });
  });

  test('distinguishes a missing case from someone else’s', async ({
    client,
  }) => {
    const owner = await createUser();
    const stranger = await createUser();
    const created = await client
      .post('/api/test-cases')
      .json(makeValidNewTestCaseInput({ ownerId: owner.id }))
      .loginAs(owner);

    const foreign = await client
      .get(`/api/test-cases/${created.body().testCaseId}`)
      .loginAs(stranger);
    foreign.assertStatus(403);

    const missing = await client
      .get('/api/test-cases/0192f1d2-0000-7000-8000-000000000000')
      .loginAs(owner);
    missing.assertStatus(404);
  });

  test('treats a non-uuid id as an unknown route', async ({ client }) => {
    const user = await createUser();
    const response = await client
      .get('/api/test-cases/not-a-uuid')
      .loginAs(user);

    response.assertStatus(404);
  });
});
