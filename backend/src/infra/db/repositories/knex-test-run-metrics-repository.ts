import type { TransactionContext } from '@/application/ports/unit-of-work';
import type {
  TestRunMetricsProjection,
  TestRunMetricsReport,
  TestRunMetricsRepository,
} from '@/application/repositories/test-run-metrics-repository';
import { TestCaseOwnerType } from '@/domain/entities/test-case';
import { db } from '@/infra/db/knex';
import { randomUUIDv7 } from 'bun';
import type { Knex } from 'knex';

type TestRunMetricsRow = {
  id: UUID;
  test_run_id: UUID;
  status: string;
  runtime_ref?: string | null;
  completed_at?: Date | null;
  requested_rate?: number;
  requested_time_unit?: string | null;
  requested_duration_seconds?: number;
  achieved_rps?: number;
  total_requests?: number;
  dropped_iterations?: number;
  failure_rate?: number;
  success_rate?: number;
  p95_ms?: number;
  p99_ms?: number;
  median_ms?: number;
  generator_limited: boolean;
  timeouts_detected: boolean;
  created_at: Date;
  updated_at: Date;
};

const TABLE_NAME = 'test_run_metrics';

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

const toNumber = (value?: string | number | null): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) return Number(value);
  return undefined;
};

export class KnexTestRunMetricsRepository implements TestRunMetricsRepository {
  async upsert(
    projection: TestRunMetricsProjection,
    tx?: TransactionContext,
  ): Promise<void> {
    const conn = contextOrDb(tx);
    const now = new Date();

    await conn<TestRunMetricsRow>(TABLE_NAME)
      .insert({
        id: randomUUIDv7(),
        test_run_id: projection.testRunId,
        status: projection.status,
        runtime_ref: projection.runtimeRef,
        completed_at: projection.completedAt
          ? new Date(projection.completedAt)
          : null,
        requested_rate: projection.requestedRate,
        requested_time_unit: projection.requestedTimeUnit,
        requested_duration_seconds: projection.requestedDurationSeconds,
        achieved_rps: projection.achievedRps,
        total_requests: projection.totalRequests,
        dropped_iterations: projection.droppedIterations,
        failure_rate: projection.failureRate,
        success_rate: projection.successRate,
        p95_ms: projection.p95Ms,
        p99_ms: projection.p99Ms,
        median_ms: projection.medianMs,
        generator_limited: projection.generatorLimited,
        timeouts_detected: projection.timeoutsDetected,
        created_at: now,
        updated_at: now,
      })
      .onConflict('test_run_id')
      .merge({
        status: projection.status,
        runtime_ref: projection.runtimeRef,
        completed_at: projection.completedAt
          ? new Date(projection.completedAt)
          : null,
        requested_rate: projection.requestedRate,
        requested_time_unit: projection.requestedTimeUnit,
        requested_duration_seconds: projection.requestedDurationSeconds,
        achieved_rps: projection.achievedRps,
        total_requests: projection.totalRequests,
        dropped_iterations: projection.droppedIterations,
        failure_rate: projection.failureRate,
        success_rate: projection.successRate,
        p95_ms: projection.p95Ms,
        p99_ms: projection.p99Ms,
        median_ms: projection.medianMs,
        generator_limited: projection.generatorLimited,
        timeouts_detected: projection.timeoutsDetected,
        updated_at: now,
      });
  }

  async findOwnedReport(args: {
    testRunId: UUID;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestRunMetricsReport | null> {
    const row = await db<TestRunMetricsRow>(`${TABLE_NAME} as m`)
      .join('test_runs as tr', 'tr.id', 'm.test_run_id')
      .join('test_cases as tc', 'tc.id', 'tr.test_case_id')
      .join('results as r', 'r.test_run_id', 'tr.id')
      .where('m.test_run_id', args.testRunId)
      .andWhere((query) => {
        query
          .where('tc.owner_type', TestCaseOwnerType.USER)
          .where('tc.owner_id', args.actorUserId)
          .orWhere((ownerQuery) => {
            ownerQuery
              .where('tc.owner_type', TestCaseOwnerType.ORGANIZATION)
              .where('tc.owner_id', args.actorOrgId);
          });
      })
      .select(
        'm.*',
        db.raw(
          "COALESCE((r.payload->'artifacts')::jsonb, '[]'::jsonb) as artifacts",
        ),
      )
      .first();

    if (!row) return null;

    const artifacts = Array.isArray(
      (row as unknown as { artifacts?: unknown }).artifacts,
    )
      ? (row as unknown as { artifacts: string[] }).artifacts
      : [];

    return {
      testRunId: row.test_run_id,
      status: row.status,
      runtimeRef: row.runtime_ref,
      completedAt: row.completed_at?.toISOString(),
      requestedRate: toNumber(row.requested_rate),
      requestedTimeUnit: row.requested_time_unit,
      requestedDurationSeconds: row.requested_duration_seconds,
      achievedRps: toNumber(row.achieved_rps),
      totalRequests: row.total_requests,
      droppedIterations: row.dropped_iterations,
      failureRate: toNumber(row.failure_rate),
      successRate: toNumber(row.success_rate),
      p95Ms: toNumber(row.p95_ms),
      p99Ms: toNumber(row.p99_ms),
      medianMs: toNumber(row.median_ms),
      generatorLimited: row.generator_limited,
      timeoutsDetected: row.timeouts_detected,
      artifacts,
    };
  }
}
