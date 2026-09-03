export type TestType =
  | 'SPIKE'
  | 'STRESS'
  | 'SMOKE'
  | 'AVG_LOAD'
  | 'SOAK'
  | 'BREAKPOINT';

export type TestCaseOwnerType = 'USER' | 'ORGANIZATION';

export type AuthStrategyKind =
  | 'NONE'
  | 'BEARER_TOKEN'
  | 'BASIC_AUTH'
  | 'API_KEY_HEADER'
  | 'LOGIN_FLOW';

export type LoadMode = 'CONSTANT' | 'RAMP';

export type TimeUnit = 'SECONDS' | 'MINUTES' | 'HOURS';

export type ResourceProfile = 'SMALL' | 'MEDIUM' | 'LARGE' | 'CUSTOM';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export type CheckKind =
  | 'STATUS_CODE'
  | 'RESPONSE_TIME_LT'
  | 'BODY_CONTAINS'
  | 'JSON_PATH_EQUALS';

export interface SecretRef {
  provider: string;
  key: string;
}

export type StepCheck =
  | { kind: 'STATUS_CODE'; expected: number }
  | { kind: 'RESPONSE_TIME_LT'; maxMs: number }
  | { kind: 'BODY_CONTAINS'; value: string }
  | {
      kind: 'JSON_PATH_EQUALS';
      path: string;
      expected: string | number | boolean;
    };

export interface Step {
  path: string;
  method: HttpMethod;
  checks: StepCheck[];
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
}

export type AuthStrategy =
  | { kind: 'NONE' }
  | { kind: 'BEARER_TOKEN'; tokenRef: SecretRef }
  | { kind: 'BASIC_AUTH'; username: string; passwordRef: SecretRef }
  | { kind: 'API_KEY_HEADER'; headerName: string; valueRef: SecretRef }
  | {
      kind: 'LOGIN_FLOW';
      loginRequest: {
        method: string;
        path: string;
        body?: Record<string, unknown>;
      };
      tokenExtraction: { kind: 'JSON_PATH'; path: string };
      applyAs: 'BEARER_TOKEN' | 'HEADER';
    };

export interface Stage {
  target: number;
  duration: number;
}

export type LoadProfile =
  | {
      mode: 'CONSTANT';
      config: { targetRate: number; duration: number; timeUnit: TimeUnit };
    }
  | {
      mode: 'RAMP';
      config: { initialRate: number; timeUnit: TimeUnit; stages: Stage[] };
    };

export interface ThresholdPolicy {
  maxErrorRate?: number;
  maxP95ResponseTimeMs?: number;
  maxP99ResponseTimeMs?: number;
  minCheckSuccessRate?: number;
  abortOnFail: boolean;
}

export interface ExecutionPolicy {
  resourceProfile: ResourceProfile;
  timeoutSeconds: number;
  cpuMillicores?: number;
  memoryMb?: number;
}

export interface TestCase {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  ownerType: TestCaseOwnerType;
  ownerId: string;
  testType: TestType;
  targetSystem: { baseUrl: string; environment: string };
  authStrategy: AuthStrategy;
  loadProfile: LoadProfile;
  thresholdPolicy: ThresholdPolicy;
  executionPolicy: ExecutionPolicy;
  steps: Step[];
}

export interface TestCaseSummary extends TestCase {
  runCount: number;
}

/** Knobs the backend turns into the load shape prescribed for a test type. */
export interface LoadPreset {
  peakRate: number;
  duration: number;
  timeUnit: TimeUnit;
}

/** Exactly one of loadProfile / loadPreset is sent. */
export type NewTestCaseInput = Omit<
  TestCase,
  'id' | 'createdAt' | 'loadProfile'
> & {
  loadProfile?: LoadProfile;
  loadPreset?: LoadPreset;
};

export interface CreateTestCaseResult {
  testCaseId: string;
  testRunId: string;
}
