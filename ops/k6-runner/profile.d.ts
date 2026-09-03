// Types for the runner's pure profile module, so the backend test suite can
// import it under strict TypeScript. The module itself stays plain JavaScript
// because k6 executes it directly.

export type K6Scenario = {
  executor: string;
  rate?: number;
  startRate?: number;
  duration?: string;
  timeUnit: string;
  preAllocatedVUs: number;
  maxVUs: number;
  stages?: Array<{ target: number; duration: string }>;
};

export type K6ThresholdExpression =
  | string
  | { threshold: string; abortOnFail: boolean; delayAbortEval: string };

export function toK6Duration(duration: unknown, timeUnit: unknown): string;
export function toK6TimeUnit(timeUnit: unknown): string;
export function estimateVuEnvelope(
  ratePerTimeUnit: unknown,
  timeUnit: unknown,
  config?: Record<string, unknown>,
): { preAllocatedVUs: number; maxVUs: number };
export function buildScenario(
  loadProfile: unknown,
  options?: Record<string, unknown>,
): K6Scenario;
export function buildThresholds(
  thresholdPolicy?: Record<string, unknown>,
): Record<string, K6ThresholdExpression[]>;
export function needsResponseBodies(steps: unknown): boolean;
export function resolveBreakingPoint(
  loadProfile: unknown,
  elapsedSeconds: unknown,
): number;
export function thresholdsBreached(summary: unknown): boolean;
