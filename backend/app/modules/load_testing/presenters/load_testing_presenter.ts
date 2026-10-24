import { toIso } from '#modules/shared/http/serialize';
import type TestCase from '../models/test_case.js';
import type TestRun from '../models/test_run.js';
import type TestRunMetric from '../models/test_run_metric.js';

/*
| Response bodies for the load-testing endpoints. They are written out field
| by field — rather than relying on model serialization — so the wire format
| is exactly what the frontend already consumes, independent of Lucid's
| naming strategy.
*/

export function presentTestCase(testCase: TestCase) {
  const definition = testCase.toDefinition();
  return {
    id: testCase.id,
    name: definition.name,
    description: definition.description,
    createdAt: toIso(testCase.createdAt),
    ownerType: definition.ownerType,
    ownerId: definition.ownerId,
    testType: definition.testType,
    targetSystem: definition.targetSystem,
    authStrategy: definition.authStrategy,
    loadProfile: definition.loadProfile,
    thresholdPolicy: definition.thresholdPolicy,
    executionPolicy: definition.executionPolicy,
    steps: definition.steps,
  };
}

export function presentTestCaseSummary(testCase: TestCase) {
  return {
    ...presentTestCase(testCase),
    runCount: Number(testCase.$extras.runs_count ?? 0),
  };
}

export function presentTestRun(run: TestRun) {
  return {
    id: run.id,
    testCaseId: run.testCaseId,
    createdAt: toIso(run.createdAt),
    status: run.status,
    startedAt: toIso(run.startedAt) ?? null,
    completedAt: toIso(run.completedAt) ?? null,
    runtimeRef: run.runtimeRef ?? null,
  };
}

function presentMetricsSummary(metrics: TestRunMetric) {
  return {
    requestedRate: metrics.requestedRate,
    requestedTimeUnit: metrics.requestedTimeUnit ?? undefined,
    requestedDurationSeconds: metrics.requestedDurationSeconds,
    achievedRps: metrics.achievedRps,
    totalRequests: metrics.totalRequests,
    droppedIterations: metrics.droppedIterations,
    failureRate: metrics.failureRate,
    successRate: metrics.successRate,
    p95Ms: metrics.p95Ms,
    p99Ms: metrics.p99Ms,
    medianMs: metrics.medianMs,
    generatorLimited: metrics.generatorLimited,
    timeoutsDetected: metrics.timeoutsDetected,
  };
}

export function presentRunWithMetrics(entry: {
  run: TestRun;
  metrics: TestRunMetric | null;
}) {
  return {
    ...presentTestRun(entry.run),
    metrics: entry.metrics ? presentMetricsSummary(entry.metrics) : null,
  };
}

export function presentReport({
  metrics,
  artifacts,
}: {
  metrics: TestRunMetric;
  artifacts: string[];
}) {
  return {
    testRunId: metrics.testRunId,
    status: metrics.status,
    completedAt: toIso(metrics.completedAt),
    runtimeRef: metrics.runtimeRef ?? undefined,
    requested: {
      rate: metrics.requestedRate,
      timeUnit: metrics.requestedTimeUnit ?? undefined,
      durationSeconds: metrics.requestedDurationSeconds,
    },
    achieved: {
      rps: metrics.achievedRps,
      totalRequests: metrics.totalRequests,
      droppedIterations: metrics.droppedIterations,
      failureRate: metrics.failureRate,
      successRate: metrics.successRate,
      p95Ms: metrics.p95Ms,
      p99Ms: metrics.p99Ms,
      medianMs: metrics.medianMs,
      // Non-null only when the run was aborted by a breached threshold.
      breakingPointRate: metrics.breakingPointRate,
    },
    flags: {
      generatorLimited: metrics.generatorLimited,
      timeoutsDetected: metrics.timeoutsDetected,
      aborted: metrics.aborted,
    },
    artifacts,
  };
}
