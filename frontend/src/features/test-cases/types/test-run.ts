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
}

export interface TestRunMetricsSummary {
  requestedRate?: number;
  requestedTimeUnit?: string;
  requestedDurationSeconds?: number;
  achievedRps?: number;
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
  };
  achieved: {
    rps?: number;
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
