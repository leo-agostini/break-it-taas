import type { NewTestCaseFormValues } from '@/features/test-cases/schemas/new-test-case-schema';
import type {
  AuthStrategy,
  LoadProfile,
  NewTestCaseInput,
  Step,
  StepCheck,
  TestCaseOwnerType,
} from '@/features/test-cases/types/test-case';

function toNumber(value?: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRequiredNumber(value: string): number {
  return Number(value);
}

function parseJsonObject(raw?: string): Record<string, unknown> | undefined {
  if (!raw || raw.trim() === '') return undefined;
  return JSON.parse(raw) as Record<string, unknown>;
}

function toAuthStrategy(auth: NewTestCaseFormValues['auth']): AuthStrategy {
  switch (auth.kind) {
    case 'BEARER_TOKEN':
      return {
        kind: 'BEARER_TOKEN',
        tokenRef: {
          provider: auth.tokenRef.provider ?? '',
          key: auth.tokenRef.key ?? '',
        },
      };
    case 'BASIC_AUTH':
      return {
        kind: 'BASIC_AUTH',
        username: auth.basicUsername ?? '',
        passwordRef: {
          provider: auth.passwordRef.provider ?? '',
          key: auth.passwordRef.key ?? '',
        },
      };
    case 'API_KEY_HEADER':
      return {
        kind: 'API_KEY_HEADER',
        headerName: auth.apiKeyHeaderName ?? '',
        valueRef: {
          provider: auth.valueRef.provider ?? '',
          key: auth.valueRef.key ?? '',
        },
      };
    case 'LOGIN_FLOW':
      return {
        kind: 'LOGIN_FLOW',
        loginRequest: {
          method: auth.loginMethod,
          path: auth.loginPath ?? '',
          body: parseJsonObject(auth.loginBodyJson),
        },
        tokenExtraction: {
          kind: 'JSON_PATH',
          path: auth.tokenExtractionPath ?? '',
        },
        applyAs: auth.applyAs,
      };
    default:
      return { kind: 'NONE' };
  }
}

function toLoadProfile(values: NewTestCaseFormValues): LoadProfile {
  if (values.loadMode === 'RAMP') {
    return {
      mode: 'RAMP',
      config: {
        initialRate: toRequiredNumber(values.ramp.initialRate),
        timeUnit: values.ramp.timeUnit,
        stages: values.ramp.stages.map((stage) => ({
          target: toRequiredNumber(stage.target),
          duration: toRequiredNumber(stage.duration),
        })),
      },
    };
  }

  return {
    mode: 'CONSTANT',
    config: {
      targetRate: toRequiredNumber(values.constant.targetRate),
      duration: toRequiredNumber(values.constant.duration),
      timeUnit: values.constant.timeUnit,
    },
  };
}

function toStepCheck(
  check: NewTestCaseFormValues['steps'][number]['checks'][number],
): StepCheck {
  switch (check.kind) {
    case 'RESPONSE_TIME_LT':
      return { kind: 'RESPONSE_TIME_LT', maxMs: Number(check.maxMs) };
    case 'BODY_CONTAINS':
      return { kind: 'BODY_CONTAINS', value: check.value ?? '' };
    case 'JSON_PATH_EQUALS':
      return {
        kind: 'JSON_PATH_EQUALS',
        path: check.path ?? '',
        expected: check.expected ?? '',
      };
    default:
      return { kind: 'STATUS_CODE', expected: Number(check.expected) };
  }
}

function toSteps(values: NewTestCaseFormValues): Step[] {
  return values.steps.map((step) => ({
    path: step.path,
    method: step.method,
    checks: step.checks.map(toStepCheck),
    body: parseJsonObject(step.bodyJson),
  }));
}

export function toNewTestCaseInput(
  values: NewTestCaseFormValues,
  owner: { ownerType: TestCaseOwnerType; ownerId: string },
): NewTestCaseInput {
  const isCustomProfile = values.execution.resourceProfile === 'CUSTOM';

  return {
    name: values.name,
    description: values.description?.trim() ? values.description : undefined,
    ownerType: owner.ownerType,
    ownerId: owner.ownerId,
    testType: values.testType,
    targetSystem: {
      baseUrl: values.baseUrl,
      environment: values.environment,
    },
    authStrategy: toAuthStrategy(values.auth),
    loadProfile: toLoadProfile(values),
    thresholdPolicy: {
      maxErrorRate: toNumber(values.thresholds.maxErrorRate),
      minCheckSuccessRate: toNumber(values.thresholds.minCheckSuccessRate),
      maxP95ResponseTimeMs: toNumber(values.thresholds.maxP95ResponseTimeMs),
      maxP99ResponseTimeMs: toNumber(values.thresholds.maxP99ResponseTimeMs),
      abortOnFail: values.thresholds.abortOnFail,
    },
    executionPolicy: {
      resourceProfile: values.execution.resourceProfile,
      timeoutSeconds: toRequiredNumber(values.execution.timeoutSeconds),
      cpuMillicores: isCustomProfile
        ? toNumber(values.execution.cpuMillicores)
        : undefined,
      memoryMb: isCustomProfile
        ? toNumber(values.execution.memoryMb)
        : undefined,
    },
    steps: toSteps(values),
  };
}
