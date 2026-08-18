import type { AppContainer } from '@/infra/http/container';
import { createTestCaseController } from '@/infra/http/controllers/create-test-case-controller';
import { createTestRunController } from '@/infra/http/controllers/create-test-run-controller';
import { getTestCaseController } from '@/infra/http/controllers/get-test-case-controller';
import { getTestRunController } from '@/infra/http/controllers/get-test-run-controller';
import { getTestRunReportController } from '@/infra/http/controllers/get-test-run-report-controller';
import { listTestCaseRunsController } from '@/infra/http/controllers/list-test-case-runs-controller';
import { listTestCasesController } from '@/infra/http/controllers/list-test-cases-controller';
import { authenticateRequest } from '@/infra/http/middlewares/authenticator';
import { Elysia, t } from 'elysia';

export function createProtectedRoutes(container: AppContainer) {
  const createTestCase = createTestCaseController(container);
  const createTestRun = createTestRunController(container);
  const getTestRunReport = getTestRunReportController(container);
  const listTestCases = listTestCasesController(container);
  const getTestCase = getTestCaseController(container);
  const listTestCaseRuns = listTestCaseRunsController(container);
  const getTestRun = getTestRunController(container);

  return new Elysia({ prefix: '/api' })
    .derive(({ headers }) => {
      const actor = authenticateRequest({
        authorizationHeader: headers.authorization,
        cookieHeader: headers.cookie,
      });
      return { actor };
    })
    .post(
      '/test-cases',
      async ({ body, actor, set }) => {
        const result = await createTestCase(body as never, actor);
        set.status = 201;
        return result;
      },
      {
        detail: {
          tags: ['test-cases'],
          summary: 'Create a new test case',
          security: [{ bearerAuth: [] }],
        },
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          ownerType: t.String(),
          ownerId: t.String(),
          testType: t.String(),
          targetSystem: t.Object({
            baseUrl: t.String(),
            environment: t.String(),
          }),
          authStrategy: t.Record(t.String(), t.Unknown()),
          loadProfile: t.Record(t.String(), t.Unknown()),
          thresholdPolicy: t.Record(t.String(), t.Unknown()),
          executionPolicy: t.Record(t.String(), t.Unknown()),
          steps: t.Optional(t.Array(t.Record(t.String(), t.Unknown()))),
        }),
      },
    )
    .get(
      '/test-cases',
      async ({ actor }) => {
        return listTestCases(actor);
      },
      {
        detail: {
          tags: ['test-cases'],
          summary: 'List test cases owned by the actor',
          security: [{ bearerAuth: [] }],
        },
      },
    )
    .get(
      '/test-cases/:testCaseId',
      async ({ params, actor }) => {
        return getTestCase(params.testCaseId as UUID, actor);
      },
      {
        detail: {
          tags: ['test-cases'],
          summary: 'Get a test case by id',
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({
          testCaseId: t.String({ format: 'uuid' }),
        }),
      },
    )
    .get(
      '/test-cases/:testCaseId/runs',
      async ({ params, actor }) => {
        return listTestCaseRuns(params.testCaseId as UUID, actor);
      },
      {
        detail: {
          tags: ['test-runs'],
          summary: 'List runs of a test case with their metrics summary',
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({
          testCaseId: t.String({ format: 'uuid' }),
        }),
      },
    )
    .get(
      '/test-runs/:testRunId',
      async ({ params, actor }) => {
        return getTestRun(params.testRunId as UUID, actor);
      },
      {
        detail: {
          tags: ['test-runs'],
          summary: 'Get a test run by id',
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({
          testRunId: t.String({ format: 'uuid' }),
        }),
      },
    )
    .post(
      '/test-runs/:testCaseId',
      async ({ params, actor, set }) => {
        const run = await createTestRun(params.testCaseId as UUID, actor);
        set.status = 201;
        return run;
      },
      {
        detail: {
          tags: ['test-runs'],
          summary: 'Create a new test run for a test case',
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({
          testCaseId: t.String({ format: 'uuid' }),
        }),
      },
    )
    .get(
      '/test-runs/:testRunId/report',
      async ({ params, actor }) => {
        return getTestRunReport(params.testRunId as UUID, actor);
      },
      {
        detail: {
          tags: ['test-runs'],
          summary: 'Get normalized test run report',
          security: [{ bearerAuth: [] }],
        },
        params: t.Object({
          testRunId: t.String({ format: 'uuid' }),
        }),
      },
    );
}
