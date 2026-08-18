import { describe, expect, it } from 'bun:test';
import { ListTestCaseRunsUseCase } from '@/application/use-cases/list-test-case-runs';
import { TestRun } from '@/domain/entities/test-run';
import {
  AuthorizationError,
  NotFoundError,
} from '@/domain/errors/custom-errors';
import { makeTestCase } from '@/tests/fixtures/test-case-fixtures';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunMetricsRepository } from '@/tests/mocks/in-memory-test-run-metrics-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';

function makeUseCase() {
  const testCaseRepository = new InMemoryTestCaseRepository();
  const testRunRepository = new InMemoryTestRunRepository(testCaseRepository);
  const metricsRepository = new InMemoryTestRunMetricsRepository();
  const useCase = new ListTestCaseRunsUseCase(
    testCaseRepository,
    testRunRepository,
    metricsRepository,
  );

  return { useCase, testCaseRepository, testRunRepository, metricsRepository };
}

describe('ListTestCaseRunsUseCase', () => {
  it('returns null metrics for runs that have not completed', async () => {
    const { useCase, testCaseRepository, testRunRepository } = makeUseCase();

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);
    const run = TestRun.create({ testCaseId: testCase.id });
    run.queue();
    await testRunRepository.save(run);

    const result = await useCase.execute(testCase.id as UUID, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(run.id);
    expect(result[0]?.metrics).toBeNull();
  });

  it('merges metrics into runs that have them', async () => {
    const {
      useCase,
      testCaseRepository,
      testRunRepository,
      metricsRepository,
    } = makeUseCase();

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);
    const run = TestRun.create({ testCaseId: testCase.id });
    await testRunRepository.save(run);

    await metricsRepository.upsert({
      testRunId: run.id as UUID,
      status: 'SUCCEEDED',
      achievedRps: 196,
      p95Ms: 294,
      successRate: 0.99,
      generatorLimited: false,
      timeoutsDetected: false,
    });

    const result = await useCase.execute(testCase.id as UUID, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(result[0]?.metrics?.achievedRps).toBe(196);
    expect(result[0]?.metrics?.p95Ms).toBe(294);
    expect(result[0]?.metrics?.generatorLimited).toBe(false);
  });

  it('returns an empty list when the test case has no runs', async () => {
    const { useCase, testCaseRepository } = makeUseCase();

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    const result = await useCase.execute(testCase.id as UUID, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(result).toEqual([]);
  });

  it('throws not found when the test case does not exist', async () => {
    const { useCase } = makeUseCase();

    expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws authorization error when the actor does not own it', async () => {
    const { useCase, testCaseRepository } = makeUseCase();

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    expect(
      useCase.execute(testCase.id as UUID, {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
