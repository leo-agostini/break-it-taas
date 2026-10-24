import { randomUUID } from 'node:crypto';
import {
  TestCaseOwnerType,
  TestType,
} from '#modules/test_cases/domain/test_type';
import { AuthStrategyKind } from '#modules/test_cases/domain/vos/auth_strategy';
import { ResourceProfile } from '#modules/test_cases/domain/vos/execution_policy';
import {
  LoadMode,
  TimeUnit,
} from '#modules/test_cases/domain/vos/load_profile';
import { CheckKind, HttpMethod } from '#modules/test_cases/domain/vos/step';

/**
 * A request body for `POST /api/test-cases` that passes every validation and
 * domain rule. Override fields to exercise one rule at a time.
 */
export function makeValidNewTestCaseInput(
  overrides?: Partial<Record<string, unknown>>,
) {
  return {
    name: 'Smoke test for API',
    description: 'Baseline smoke test',
    ownerType: TestCaseOwnerType.USER,
    ownerId: randomUUID(),
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
