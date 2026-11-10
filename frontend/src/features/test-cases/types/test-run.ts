import type {
  ExecutionPolicy,
  LoadPreset,
  LoadProfile,
} from '@/features/test-cases/types/test-case';

export type TestRunStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMEOUT'
  | 'CANCELLED';

export interface TestRun {
  id: string;
  testCaseId: string;
  createdAt: string;
  status: TestRunStatus;
  startedAt?: string;
  completedAt?: string;
  runtimeRef?: string;
  /** The load this run executed with; may differ from its test case default. */
  loadProfile: LoadProfile;
  /** The runner container this run executed on. */
  executionPolicy: ExecutionPolicy;
}

/**
 * Body of `POST /test-runs/:testCaseId`. Every field is optional: an empty
 * body reruns the test case default. A new load replaces the default load;
 * execution fields replace the default one by one, and an omitted timeout
 * grows to fit a longer load.
 */
export interface NewTestRunInput {
  loadProfile?: LoadProfile;
  loadPreset?: LoadPreset;
  executionPolicy?: Partial<ExecutionPolicy>;
}

export interface TestRunMetricsSummary {
  /** Peak arrival rate a rate-driven run asked for. */
  requestedRate?: number;
  requestedTimeUnit?: string;
  requestedDurationSeconds?: number;
  /** Peak VU count a VU-driven run asked for. */
  requestedVus?: number;
  achievedRps?: number;
  /** Largest VU pool k6 actually ran with. */
  peakVus?: number;
  totalRequests?: number;
  droppedIterations?: number;
  failureRate?: number;
  successRate?: number;
  p95Ms?: number;
  p99Ms?: number;
  medianMs?: number;
  generatorLimited: boolean;
  timeoutsDetected: boolean;
  aborted: boolean;
  breakingPointRate?: number;
}

export interface TestCaseRunSummary extends TestRun {
  metrics: TestRunMetricsSummary | null;
}

export interface TestRunReport {
  testRunId: string;
  status: TestRunStatus;
  completedAt?: string;
  runtimeRef?: string;
  requested: {
    rate?: number;
    timeUnit?: string;
    durationSeconds?: number;
    vus?: number;
  };
  achieved: {
    rps?: number;
    peakVus?: number;
    totalRequests?: number;
    droppedIterations?: number;
    failureRate?: number;
    successRate?: number;
    p95Ms?: number;
    p99Ms?: number;
    medianMs?: number;
    breakingPointRate?: number;
  };
  flags: {
    generatorLimited: boolean;
    timeoutsDetected: boolean;
    aborted: boolean;
  };
  artifacts: string[];
}
