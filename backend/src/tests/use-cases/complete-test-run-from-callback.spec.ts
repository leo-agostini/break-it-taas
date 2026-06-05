import { describe, expect, it } from 'bun:test';
import { CompleteTestRunFromCallbackUseCase } from '@/application/use-cases/complete-test-run-from-callback';
import { TestCase, TestCaseOwnerType, TestType } from '@/domain/entities/test-case';
import { TestRun, TestRunStatus } from '@/domain/entities/test-run';
import { ValidationError } from '@/domain/errors/custom-errors';
import { AuthStrategyKind } from '@/domain/vos/auth-strategy';
import { ExecutionPolicy, ResourceProfile } from '@/domain/vos/execution-policy';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { CheckKind, HttpMethod, Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';
import { InMemoryResultRepository } from '@/tests/mocks/in-memory-result-repository';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunMetricsRepository } from '@/tests/mocks/in-memory-test-run-metrics-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';

function makeTestCase(ownerId: UUID) {
  return TestCase.create({
    name: 'metrics case',
    description: 'desc',
    ownerType: TestCaseOwnerType.USER,
    ownerId,
    testType: TestType.SMOKE,
    targetSystem: new TargetSystem('https://api.example.com', 'staging'),
    authStrategy: { kind: AuthStrategyKind.NONE },
    loadProfile: LoadProfile.create(LoadMode.CONSTANT, {
      duration: 10,
      targetRate: 5000,
      timeUnit: TimeUnit.SECONDS,
    }),
    thresholdPolicy: new ThresholdPolicy(undefined, undefined, undefined, undefined, false),
    executionPolicy: new ExecutionPolicy(ResourceProfile.LARGE, 120),
    steps: [new Step('/', HttpMethod.GET, [{ kind: CheckKind.STATUS_CODE, expected: 200 }])],
  });
}

describe('CompleteTestRunFromCallbackUseCase', () => {
  it('completes a running run and persists callback result', async () => {
    const runs = new InMemoryTestRunRepository();
    const results = new InMemoryResultRepository();
    const testCases = new InMemoryTestCaseRepository();
    const metrics = new InMemoryTestRunMetricsRepository();
    const useCase = new CompleteTestRunFromCallbackUseCase(
      new InMemoryUnitOfWork(),
      runs,
      results,
      testCases,
      metrics,
    );

    const testCase = makeTestCase(crypto.randomUUID());
    await testCases.create(testCase);
    const run = TestRun.create({ testCaseId: testCase.id });
    run.queue();
    run.start();
    await runs.save(run);

    const response = await useCase.execute({
      testRunId: run.id,
      status: TestRunStatus.SUCCEEDED,
      resultSummary: {
        summary: {
          metrics: {
            http_reqs: { rate: 522.85, count: 11992 },
            dropped_iterations: { count: 88010 },
            http_req_failed: { value: 0.8445 },
            http_req_duration: { 'p(95)': 3000.8222375, 'p(99)': 3200.51234, med: 1987.21239 },
            http_req_waiting: { 'p(95)': 3000.788899 },
            vus: { value: 1500 },
            vus_max: { value: 1500 },
          },
        },
      },
      artifacts: ['result.json'],
      runtimeRef: 'job-123',
      completedAt: new Date().toISOString(),
    });

    expect(response.updated).toBe(true);
    const savedRun = await runs.find(run.id);
    expect(savedRun?.status).toBe(TestRunStatus.SUCCEEDED);
    expect(results.items.get(run.id)?.status).toBe(TestRunStatus.SUCCEEDED);
    expect(metrics.items.get(run.id)?.requestedRate).toBe(5000);
    expect(metrics.items.get(run.id)?.achievedRps).toBe(522.85);
    expect(metrics.items.get(run.id)?.p95Ms).toBe(3000.8222);
    expect(metrics.items.get(run.id)?.successRate).toBe(0.1555);
    expect(metrics.items.get(run.id)?.generatorLimited).toBe(true);
    expect(metrics.items.get(run.id)?.timeoutsDetected).toBe(true);
  });

  it('is idempotent for duplicated terminal callback', async () => {
    const runs = new InMemoryTestRunRepository();
    const results = new InMemoryResultRepository();
    const testCases = new InMemoryTestCaseRepository();
    const metrics = new InMemoryTestRunMetricsRepository();
    const useCase = new CompleteTestRunFromCallbackUseCase(
      new InMemoryUnitOfWork(),
      runs,
      results,
      testCases,
      metrics,
    );

    const run = TestRun.create({ testCaseId: crypto.randomUUID() });
    run.queue();
    run.start();
    run.succeeded();
    await runs.save(run);

    const response = await useCase.execute({
      testRunId: run.id,
      status: TestRunStatus.SUCCEEDED,
      resultSummary: { random: 7 },
      artifacts: [],
      runtimeRef: 'job-123',
    });

    expect(response.updated).toBe(false);
  });

  it('rejects malformed callback payload', async () => {
    const runs = new InMemoryTestRunRepository();
    const results = new InMemoryResultRepository();
    const testCases = new InMemoryTestCaseRepository();
    const metrics = new InMemoryTestRunMetricsRepository();
    const useCase = new CompleteTestRunFromCallbackUseCase(
      new InMemoryUnitOfWork(),
      runs,
      results,
      testCases,
      metrics,
    );

    await expect(
      useCase.execute({ status: TestRunStatus.SUCCEEDED }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
