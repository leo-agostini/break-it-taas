import { describe, expect, it } from 'bun:test';
import { normalizeK6ResultMetrics } from '@/application/projections/normalize-k6-result-metrics';
import { TestCase, TestCaseOwnerType, TestType } from '@/domain/entities/test-case';
import { TestRunStatus } from '@/domain/entities/test-run';
import { AuthStrategyKind } from '@/domain/vos/auth-strategy';
import { ExecutionPolicy, ResourceProfile } from '@/domain/vos/execution-policy';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { CheckKind, HttpMethod, Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';

function makeTestCase() {
  return TestCase.create({
    name: 'projection case',
    ownerType: TestCaseOwnerType.USER,
    ownerId: crypto.randomUUID(),
    testType: TestType.SMOKE,
    targetSystem: new TargetSystem('https://api.example.com', 'staging'),
    authStrategy: { kind: AuthStrategyKind.NONE },
    loadProfile: LoadProfile.create(LoadMode.CONSTANT, {
      duration: 30,
      targetRate: 1200,
      timeUnit: TimeUnit.SECONDS,
    }),
    thresholdPolicy: new ThresholdPolicy(undefined, undefined, undefined, undefined, false),
    executionPolicy: new ExecutionPolicy(ResourceProfile.LARGE, 120),
    steps: [new Step('/', HttpMethod.GET, [{ kind: CheckKind.STATUS_CODE, expected: 200 }])],
  });
}

describe('normalizeK6ResultMetrics', () => {
  it('falls back p99 to p95 and rounds numeric fields', () => {
    const projection = normalizeK6ResultMetrics({
      testRunId: crypto.randomUUID(),
      status: TestRunStatus.SUCCEEDED,
      runtimeRef: 'testrun-x',
      completedAt: new Date().toISOString(),
      artifacts: [],
      testCase: makeTestCase(),
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
});
