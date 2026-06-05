import { TestCaseOwnerType, TestType } from '@/domain/entities/test-case';
import { AuthStrategyKind } from '@/domain/vos/auth-strategy';
import { ResourceProfile } from '@/domain/vos/execution-policy';
import { LoadMode, TimeUnit } from '@/domain/vos/load-profile';
import { CheckKind, HttpMethod } from '@/domain/vos/step';

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
