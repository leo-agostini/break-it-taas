import type { TransactionContext } from '@/application/ports/unit-of-work';

export interface TestRunMetricsProjection {
  testRunId: UUID;
  status: string;
  runtimeRef?: string;
  completedAt?: string;
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

export interface TestRunMetricsReport extends TestRunMetricsProjection {
  artifacts: string[];
}

export interface TestRunMetricsRepository {
  upsert(
    projection: TestRunMetricsProjection,
    tx?: TransactionContext,
  ): Promise<void>;
  findOwnedReport(args: {
    testRunId: UUID;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestRunMetricsReport | null>;
}
