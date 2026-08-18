import type { ActorContext } from '@/application/ports/actor-context';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type {
  TestRunMetricsProjection,
  TestRunMetricsRepository,
} from '@/application/repositories/test-run-metrics-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import type { TestRun } from '@/domain/entities/test-run';
import {
  AuthorizationError,
  NotFoundError,
} from '@/domain/errors/custom-errors';

export interface TestRunMetricsSummary {
  requestedRate?: number;
  requestedTimeUnit?: string;
  requestedDurationSeconds?: number;
  achievedRps?: number;
  totalRequests?: number;
  droppedIterations?: number;
  failureRate?: number;
  successRate?: number;
  p95Ms?: number;
  p99Ms?: number;
  medianMs?: number;
  generatorLimited: boolean;
  timeoutsDetected: boolean;
}

export interface TestCaseRunSummary {
  id: string;
  testCaseId: string;
  createdAt: Date;
  status: string;
  startedAt?: Date;
  completedAt?: Date;
  runtimeRef?: string;
  metrics: TestRunMetricsSummary | null;
}

function toMetricsSummary(
  projection?: TestRunMetricsProjection,
): TestRunMetricsSummary | null {
  if (!projection) return null;

  return {
    requestedRate: projection.requestedRate,
    requestedTimeUnit: projection.requestedTimeUnit,
    requestedDurationSeconds: projection.requestedDurationSeconds,
    achievedRps: projection.achievedRps,
    totalRequests: projection.totalRequests,
    droppedIterations: projection.droppedIterations,
    failureRate: projection.failureRate,
    successRate: projection.successRate,
    p95Ms: projection.p95Ms,
    p99Ms: projection.p99Ms,
    medianMs: projection.medianMs,
    generatorLimited: projection.generatorLimited,
    timeoutsDetected: projection.timeoutsDetected,
  };
}

export class ListTestCaseRunsUseCase {
  constructor(
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private testRunMetricsRepository: TestRunMetricsRepository,
  ) {}

  async execute(
    testCaseId: UUID,
    actor: ActorContext,
  ): Promise<TestCaseRunSummary[]> {
    const testCase = await this.testCaseRepository.find(testCaseId);
    if (!testCase) {
      throw new NotFoundError('Test case not found');
    }

    const ownedTestCase = await this.testCaseRepository.findOwnedByActor({
      testCaseId,
      actorUserId: actor.userId,
      actorOrgId: actor.orgId,
    });

    if (!ownedTestCase) {
      throw new AuthorizationError();
    }

    const runs = await this.testRunRepository.findAllByTestCaseId(testCaseId);
    const metrics = await this.testRunMetricsRepository.findByTestRunIds(
      runs.map((run) => run.id as UUID),
    );

    const metricsByRunId = new Map(
      metrics.map((projection) => [projection.testRunId, projection]),
    );

    return runs.map((run: TestRun) => ({
      id: run.id,
      testCaseId: run.testCaseId,
      createdAt: run.createdAt,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      runtimeRef: run.runtimeRef,
      metrics: toMetricsSummary(metricsByRunId.get(run.id as UUID)),
    }));
  }
}
