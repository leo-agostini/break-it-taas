import { describe, expect, it } from 'bun:test';
import { GetTestRunReportUseCase } from '@/application/use-cases/get-test-run-report';
import { NotFoundError } from '@/domain/errors/custom-errors';
import { InMemoryTestRunMetricsRepository } from '@/tests/mocks/in-memory-test-run-metrics-repository';

describe('GetTestRunReportUseCase', () => {
  it('returns normalized report payload', async () => {
    const metrics = new InMemoryTestRunMetricsRepository();
    const useCase = new GetTestRunReportUseCase(metrics);
    const testRunId = crypto.randomUUID();

    await metrics.upsert({
      testRunId,
      status: 'SUCCEEDED',
      completedAt: new Date().toISOString(),
      runtimeRef: 'testrun-abc',
      requestedRate: 5000,
      requestedTimeUnit: 'SECONDS',
      requestedDurationSeconds: 20,
      achievedRps: 520,
      totalRequests: 12000,
      droppedIterations: 88000,
      failureRate: 0.8,
      successRate: 0.2,
      p95Ms: 3000,
      p99Ms: 3200,
      medianMs: 1800,
      generatorLimited: true,
      timeoutsDetected: true,
    });

    const report = await useCase.execute(testRunId, {
      userId: crypto.randomUUID(),
      orgId: null,
    });

    expect(report.requested.rate).toBe(5000);
    expect(report.achieved.rps).toBe(520);
    expect(report.flags.generatorLimited).toBe(true);
  });

  it('throws when report is missing', async () => {
    const useCase = new GetTestRunReportUseCase(
      new InMemoryTestRunMetricsRepository(),
    );

    await expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
