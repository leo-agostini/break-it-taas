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

/**
 * CONSTANT and RAMP drive a request arrival rate (open model); CONSTANT_VUS and
 * RAMPING_VUS drive a number of concurrent virtual users (closed model).
 */
export type LoadMode = 'CONSTANT' | 'RAMP' | 'CONSTANT_VUS' | 'RAMPING_VUS';

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

/** VU pool an arrival-rate run draws from; the runner estimates one when unset. */
export interface VuPool {
  preAllocated: number;
  max: number;
}

export type LoadProfile =
  | {
      mode: 'CONSTANT';
      config: {
        targetRate: number;
        duration: number;
        timeUnit: TimeUnit;
        vus?: VuPool;
      };
    }
  | {
      mode: 'RAMP';
      config: {
        initialRate: number;
        timeUnit: TimeUnit;
        stages: Stage[];
        vus?: VuPool;
      };
    }
  | {
      mode: 'CONSTANT_VUS';
      config: { vus: number; duration: number; timeUnit: TimeUnit };
    }
  | {
      // Stage targets are VU counts here, not rates.
      mode: 'RAMPING_VUS';
      config: { startVus: number; timeUnit: TimeUnit; stages: Stage[] };
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
  /** Default load for runs that do not override it. */
  loadProfile: LoadProfile;
  thresholdPolicy: ThresholdPolicy;
  /** Default runner container for runs that do not override it. */
  executionPolicy: ExecutionPolicy;
  steps: Step[];
}

export interface TestCaseSummary extends TestCase {
  runCount: number;
}

/**
 * Knobs the backend turns into the load shape prescribed for a test type. The
 * peak is exactly one of an arrival rate or a number of virtual users.
 */
export interface LoadPreset {
  peakRate?: number;
  peakVus?: number;
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
