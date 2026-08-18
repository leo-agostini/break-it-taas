import {
  TestCase,
  TestCaseOwnerType,
  TestType,
} from '@/domain/entities/test-case';
import { AuthStrategyKind } from '@/domain/vos/auth-strategy';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '@/domain/vos/execution-policy';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { CheckKind, HttpMethod, Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';

export function makeTestCase(overrides?: {
  ownerType?: TestCaseOwnerType;
  ownerId?: UUID;
  testType?: TestType;
}) {
  return TestCase.create({
    name: 'test case',
    description: 'desc',
    ownerType: overrides?.ownerType ?? TestCaseOwnerType.USER,
    ownerId: overrides?.ownerId ?? crypto.randomUUID(),
    testType: overrides?.testType ?? TestType.SMOKE,
    targetSystem: new TargetSystem('https://api.example.com', 'staging'),
    authStrategy: { kind: AuthStrategyKind.NONE },
    loadProfile: LoadProfile.create(LoadMode.CONSTANT, {
      duration: 5,
      targetRate: 10,
      timeUnit: TimeUnit.SECONDS,
    }),
    thresholdPolicy: new ThresholdPolicy(0.1, 200, 400, 0.9, false),
    executionPolicy: new ExecutionPolicy(ResourceProfile.SMALL, 60),
    steps: [
      new Step('/health', HttpMethod.GET, [
        { kind: CheckKind.STATUS_CODE, expected: 200 },
      ]),
    ],
  });
}

export function makeValidNewTestCaseInput(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    name: 'Smoke test for API',
    description: 'Baseline smoke test',
    ownerType: TestCaseOwnerType.USER,
    ownerId: crypto.randomUUID(),
    testType: TestType.SMOKE,
    targetSystem: {
      baseUrl: 'https://api.example.com',
      environment: 'staging',
    },
    authStrategy: {
      kind: AuthStrategyKind.NONE,
    } as const,
    loadProfile: {
      mode: LoadMode.CONSTANT,
      config: {
        duration: 5,
        targetRate: 10,
        timeUnit: TimeUnit.SECONDS,
      },
    },
    thresholdPolicy: {
      maxErrorRate: 0.05,
      maxP95ResponseTimeMs: 250,
      maxP99ResponseTimeMs: 500,
      minCheckSuccessRate: 0.98,
      abortOnFail: true,
    },
    executionPolicy: {
      resourceProfile: ResourceProfile.SMALL,
      timeoutSeconds: 120,
    },
    steps: [
      {
        path: '/health',
        method: HttpMethod.GET,
        checks: [{ kind: CheckKind.STATUS_CODE, expected: 200 }],
      },
    ],
    ...overrides,
  };
}
