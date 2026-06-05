import type { TestRunMetricsRepository } from '@/application/repositories/test-run-metrics-repository';
import type { AuthContext } from '@/infra/http/middlewares/authenticator';
import { NotFoundError } from '@/domain/errors/custom-errors';

export class GetTestRunReportUseCase {
  constructor(private readonly metricsRepository: TestRunMetricsRepository) {}

  async execute(testRunId: UUID, actor: AuthContext) {
    const report = await this.metricsRepository.findOwnedReport({
      testRunId,
      actorUserId: actor.userId,
      actorOrgId: actor.orgId,
    });

    if (!report) {
      throw new NotFoundError('Test run report not found');
    }

    return {
      testRunId: report.testRunId,
      status: report.status,
      completedAt: report.completedAt,
      runtimeRef: report.runtimeRef,
      requested: {
        rate: report.requestedRate,
        timeUnit: report.requestedTimeUnit,
        durationSeconds: report.requestedDurationSeconds,
      },
      achieved: {
        rps: report.achievedRps,
        totalRequests: report.totalRequests,
        droppedIterations: report.droppedIterations,
        failureRate: report.failureRate,
        successRate: report.successRate,
        p95Ms: report.p95Ms,
        p99Ms: report.p99Ms,
        medianMs: report.medianMs,
      },
      flags: {
        generatorLimited: report.generatorLimited,
        timeoutsDetected: report.timeoutsDetected,
      },
      artifacts: report.artifacts,
    };
  }
}
