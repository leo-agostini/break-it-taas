import { loadProfileDurationSeconds } from '#modules/load_testing/domain/load_profile_duration';
import type {
  LoadMode,
  LoadProfile,
} from '#modules/load_testing/domain/vos/load_profile';
import type { UUID } from '#modules/shared/domain/types';
import type { TestRunStatus } from './test_run_status.js';

/**
 * The normalized, engine-agnostic view of a finished run's metrics: what was
 * requested versus what the load generator actually achieved.
 */
export interface TestRunMetricsProjection {
  testRunId: UUID;
  status: string;
  runtimeRef?: string;
  completedAt?: string;
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
  /** The run was stopped early by a breached abortOnFail threshold. */
  aborted: boolean;
  /** Arrival rate reached at the abort — a BREAKPOINT run's headline result. */
  breakingPointRate?: number;
}

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const roundNumber = (
  value: number | undefined,
  decimals: number,
): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const readMetric = (
  metrics: Record<string, unknown>,
  metricName: string,
): Record<string, unknown> => {
  return asRecord(metrics[metricName]);
};

const getMetricValue = (
  metrics: Record<string, unknown>,
  metricName: string,
  field: string,
): number | undefined => {
  const metric = readMetric(metrics, metricName);
  // k6 reports the same metric two ways: --summary-export flattens the fields
  // onto the metric, handleSummary nests them under `values`. Accept both so
  // the projection does not depend on which writer produced the summary.
  const nested = asNumber(asRecord(metric.values)[field]);
  if (typeof nested === 'number') return nested;
  return asNumber(metric[field]);
};

const getMetricPercentile = (
  metrics: Record<string, unknown>,
  metricName: string,
  percentile: string,
): number | undefined => {
  const metric = readMetric(metrics, metricName);
  const nestedValues = asRecord(metric.values);
  const nested = asNumber(nestedValues[percentile]);
  if (typeof nested === 'number') return nested;
  return asNumber(metric[percentile]);
};

const pickFirstNumber = (
  ...values: Array<number | undefined>
): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

const toRequestedDurationSeconds = (
  loadProfile: LoadProfile<LoadMode>,
): number | undefined => {
  const seconds = loadProfileDurationSeconds(loadProfile);
  return seconds > 0 ? seconds : undefined;
};

export const normalizeK6ResultMetrics = (args: {
  testRunId: UUID;
  status: TestRunStatus;
  runtimeRef?: string;
  completedAt?: string;
  artifacts: string[];
  resultSummary: Record<string, unknown>;
  loadProfile: LoadProfile<LoadMode>;
}): TestRunMetricsProjection => {
  const summary = asRecord(args.resultSummary.summary);
  const metrics = asRecord(summary.metrics);
  // Written by the runner's handleSummary alongside k6's own metrics.
  const execution = asRecord(summary.execution);

  const loadConfig = args.loadProfile.config as Record<string, unknown>;
  const requestedRate =
    args.loadProfile.mode === 'CONSTANT'
      ? asNumber(loadConfig.targetRate)
      : asNumber(loadConfig.initialRate);
  const requestedTimeUnit = String(loadConfig.timeUnit ?? 'SECONDS');

  const achievedRps = getMetricValue(metrics, 'http_reqs', 'rate');
  const totalRequests = getMetricValue(metrics, 'http_reqs', 'count');
  const droppedIterations = getMetricValue(
    metrics,
    'dropped_iterations',
    'count',
  );
  // Flat exports name this field `value`; the nested handleSummary shape calls
  // the same number `rate`.
  const failureRate = pickFirstNumber(
    getMetricValue(metrics, 'http_req_failed', 'value'),
    getMetricValue(metrics, 'http_req_failed', 'rate'),
  );
  const successRate =
    typeof failureRate === 'number'
      ? Math.max(0, Math.min(1, 1 - failureRate))
      : undefined;
  const p95Ms = pickFirstNumber(
    getMetricPercentile(metrics, 'http_req_duration', 'p(95)'),
    getMetricPercentile(metrics, 'http_req_duration', 'p(90)'),
    getMetricPercentile(metrics, 'http_req_duration', 'med'),
  );
  const p99Ms = pickFirstNumber(
    getMetricPercentile(metrics, 'http_req_duration', 'p(99)'),
    getMetricPercentile(metrics, 'http_req_duration', 'p(95)'),
    getMetricValue(metrics, 'http_req_duration', 'max'),
  );
  const medianMs = pickFirstNumber(
    getMetricPercentile(metrics, 'http_req_duration', 'med'),
    getMetricPercentile(metrics, 'http_req_duration', 'p(90)'),
  );
  const waitingP95Ms = getMetricPercentile(
    metrics,
    'http_req_waiting',
    'p(95)',
  );
  const vusCurrent = getMetricValue(metrics, 'vus', 'value');
  const vusMax = getMetricValue(metrics, 'vus_max', 'value');

  const generatorLimited =
    (typeof droppedIterations === 'number' && droppedIterations > 0) ||
    (typeof vusCurrent === 'number' &&
      typeof vusMax === 'number' &&
      vusCurrent >= vusMax);

  return {
    testRunId: args.testRunId,
    status: args.status,
    runtimeRef: args.runtimeRef,
    completedAt: args.completedAt,
    requestedRate,
    requestedTimeUnit,
    requestedDurationSeconds: toRequestedDurationSeconds(args.loadProfile),
    achievedRps: roundNumber(achievedRps, 4),
    totalRequests,
    droppedIterations,
    failureRate: roundNumber(failureRate, 6),
    successRate: roundNumber(successRate, 6),
    p95Ms: roundNumber(p95Ms, 4),
    p99Ms: roundNumber(p99Ms, 4),
    medianMs: roundNumber(medianMs, 4),
    generatorLimited,
    timeoutsDetected: typeof waitingP95Ms === 'number' && waitingP95Ms >= 2900,
    aborted: execution.aborted === true,
    breakingPointRate: roundNumber(asNumber(execution.breakingPointRate), 4),
  };
};
