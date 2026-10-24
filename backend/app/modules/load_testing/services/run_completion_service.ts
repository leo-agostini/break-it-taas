import db from '@adonisjs/lucid/services/db';
import { DateTime } from 'luxon';
import {
  InvariantViolationError,
  NotFoundError,
} from '#modules/shared/domain/errors';
import type { UUID } from '#modules/shared/domain/types';
import { normalizeK6ResultMetrics } from '../domain/k6_result_metrics.js';
import {
  type CompletionStatus,
  TestRunStatus,
  isTerminalStatus,
} from '../domain/test_run_status.js';
import Result from '../models/result.js';
import TestCase from '../models/test_case.js';
import TestRun from '../models/test_run.js';
import TestRunMetric from '../models/test_run_metric.js';

export interface RunnerCallback {
  testRunId: UUID;
  status: CompletionStatus;
  resultSummary: Record<string, unknown>;
  artifacts?: string[];
  runtimeRef: string;
  completedAt?: string;
}

export class RunCompletionService {
  /**
   * Applies a (signature-verified) runner callback. Callbacks for runs that
   * already finished are acknowledged without changes, so a runner retrying
   * its POST is harmless.
   */
  async completeFromCallback(
    callback: RunnerCallback,
  ): Promise<{ updated: boolean }> {
    const artifacts = callback.artifacts ?? [];

    return db.transaction(async (trx) => {
      const run = await TestRun.query({ client: trx })
        .where('id', callback.testRunId)
        .forUpdate()
        .first();
      if (!run) {
        throw new NotFoundError(`Test run ${callback.testRunId} not found`);
      }

      if (isTerminalStatus(run.status)) {
        return { updated: false };
      }

      // The worker marks a run RUNNING after creating its Job; a fast runner
      // can call back before that write lands.
      if (run.status === TestRunStatus.QUEUED) {
        run.start();
      }

      if (run.status !== TestRunStatus.RUNNING) {
        throw new InvariantViolationError(
          `Cannot complete run in status ${run.status}`,
        );
      }

      run.runtimeRef = callback.runtimeRef;
      run.complete(callback.status);
      if (callback.completedAt) {
        run.completedAt = DateTime.fromISO(callback.completedAt);
      }
      await run.save();

      await Result.updateOrCreate(
        { testRunId: run.id },
        {
          payload: {
            testRunId: run.id,
            status: callback.status,
            runtimeRef: callback.runtimeRef,
            completedAt: callback.completedAt ?? new Date().toISOString(),
            resultSummary: callback.resultSummary,
            artifacts,
          },
        },
        { client: trx },
      );

      const testCase = await TestCase.find(run.testCaseId, { client: trx });
      if (testCase) {
        const projection = normalizeK6ResultMetrics({
          testRunId: run.id,
          status: callback.status,
          runtimeRef: callback.runtimeRef,
          completedAt: callback.completedAt,
          artifacts,
          resultSummary: callback.resultSummary,
          loadProfile: testCase.toDefinition().loadProfile,
        });

        await TestRunMetric.updateOrCreate(
          { testRunId: run.id },
          {
            status: projection.status,
            runtimeRef: projection.runtimeRef ?? null,
            completedAt: projection.completedAt
              ? DateTime.fromISO(projection.completedAt)
              : null,
            requestedRate: projection.requestedRate,
            requestedTimeUnit: projection.requestedTimeUnit ?? null,
            requestedDurationSeconds:
              projection.requestedDurationSeconds ?? null,
            achievedRps: projection.achievedRps,
            totalRequests: projection.totalRequests ?? null,
            droppedIterations: projection.droppedIterations ?? null,
            failureRate: projection.failureRate,
            successRate: projection.successRate,
            p95Ms: projection.p95Ms,
            p99Ms: projection.p99Ms,
            medianMs: projection.medianMs,
            generatorLimited: projection.generatorLimited,
            timeoutsDetected: projection.timeoutsDetected,
            aborted: projection.aborted,
            breakingPointRate: projection.breakingPointRate,
          },
          { client: trx },
        );
      }

      return { updated: true };
    });
  }
}
