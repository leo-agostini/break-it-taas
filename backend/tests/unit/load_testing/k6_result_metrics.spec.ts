import { test } from '@japa/runner';
import { normalizeK6ResultMetrics } from '#modules/load_testing/domain/k6_result_metrics';
import { TestRunStatus } from '#modules/load_testing/domain/test_run_status';
import {
  LoadMode,
  LoadProfile,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import { Stage } from '#modules/load_testing/domain/vos/stage';

/** The projection only reads the test case's load profile. */
function makeLoadProfile() {
  return LoadProfile.create(LoadMode.CONSTANT, {
    duration: 30,
    targetRate: 1200,
    timeUnit: TimeUnit.SECONDS,
  });
}

test.group('normalizeK6ResultMetrics', () => {
  test('falls back p99 to p95 and rounds numeric fields', ({ expect }) => {
    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-x',
      completedAt: new Date().toISOString(),
      artifacts: [],
      loadProfile: makeLoadProfile(),
      resultSummary: {
        summary: {
          metrics: {
            http_reqs: { rate: 232.0671333333, count: 4991 },
            dropped_iterations: { count: 31008 },
            http_req_failed: { value: 0.1180743 },
            http_req_duration: { 'p(95)': 3000.4089123, med: 1470.85103 },
            http_req_waiting: { 'p(95)': 3000.788899 },
            vus: { value: 360 },
            vus_max: { value: 360 },
          },
        },
      },
    });

    expect(projection.achievedRps).toBe(232.0671);
    expect(projection.failureRate).toBe(0.118074);
    expect(projection.successRate).toBe(0.881926);
    expect(projection.p95Ms).toBe(3000.4089);
    expect(projection.p99Ms).toBe(3000.4089);
    expect(projection.medianMs).toBe(1470.851);
  });

  test('reads metrics from the nested handleSummary shape as well as the flat one', ({
    expect,
  }) => {
    // --summary-export emits {http_reqs: {rate, count}}; handleSummary emits
    // {http_reqs: {values: {rate, count}}}. Both must project identically.
    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-nested',
      completedAt: new Date().toISOString(),
      artifacts: [],
      loadProfile: makeLoadProfile(),
      resultSummary: {
        summary: {
          metrics: {
            http_reqs: { values: { rate: 120.5, count: 3600 } },
            http_req_failed: { values: { rate: 0.25 } },
            http_req_duration: { values: { 'p(95)': 812.5, med: 300.25 } },
            dropped_iterations: { values: { count: 12 } },
          },
        },
      },
    });

    expect(projection.achievedRps).toBe(120.5);
    expect(projection.totalRequests).toBe(3600);
    expect(projection.failureRate).toBe(0.25);
    expect(projection.p95Ms).toBe(812.5);
    expect(projection.droppedIterations).toBe(12);
    expect(projection.generatorLimited).toBe(true);
  });

  test('records where a breakpoint run aborted', ({ expect }) => {
    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-breakpoint',
      completedAt: new Date().toISOString(),
      artifacts: [],
      loadProfile: makeLoadProfile(),
      resultSummary: {
        summary: {
          metrics: {},
          execution: { aborted: true, breakingPointRate: 1487.25 },
        },
      },
    });

    expect(projection.aborted).toBe(true);
    expect(projection.breakingPointRate).toBe(1487.25);
  });

  test('reports a run that held its thresholds as not aborted', ({
    expect,
  }) => {
    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-ok',
      completedAt: new Date().toISOString(),
      artifacts: [],
      loadProfile: makeLoadProfile(),
      resultSummary: {
        summary: {
          metrics: {},
          execution: { aborted: false, breakingPointRate: null },
        },
      },
    });

    expect(projection.aborted).toBe(false);
    expect(projection.breakingPointRate).toBeUndefined();
  });

  test('reports the requested duration of a RAMP profile in its own time unit', ({
    expect,
  }) => {
    const loadProfile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 1,
      timeUnit: TimeUnit.MINUTES,
      stages: [
        new Stage({ target: 100, duration: 5 }),
        new Stage({ target: 100, duration: 30 }),
        new Stage({ target: 0, duration: 5 }),
      ],
    });

    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-ramp',
      completedAt: new Date().toISOString(),
      artifacts: [],
      loadProfile,
      resultSummary: { summary: { metrics: {} } },
    });

    // 40 minutes of stages, not 40 seconds.
    expect(projection.requestedDurationSeconds).toBe(2_400);
  });
});
