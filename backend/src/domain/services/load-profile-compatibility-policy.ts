import { TestType } from '@/domain/entities/test-case';
import {
  LoadProfileCompatibilityError,
  ValidationError,
} from '@/domain/errors/custom-errors';
import { LoadMode } from '@/domain/vos/load-profile';
import type { ThresholdPolicy } from '@/domain/vos/threshold-policy';

const compatibility: Record<TestType, LoadMode[]> = {
  [TestType.SMOKE]: [LoadMode.CONSTANT],
  [TestType.AVG_LOAD]: [LoadMode.CONSTANT, LoadMode.RAMP],
  [TestType.STRESS]: [LoadMode.CONSTANT, LoadMode.RAMP],
  [TestType.SOAK]: [LoadMode.CONSTANT],
  [TestType.SPIKE]: [LoadMode.RAMP],
  [TestType.BREAKPOINT]: [LoadMode.RAMP],
};

export function assertCompatibleLoadProfile(
  testType: TestType,
  mode: LoadMode,
): void {
  const allowedModes = compatibility[testType];
  if (!allowedModes.includes(mode)) {
    throw new LoadProfileCompatibilityError(
      `Load profile mode ${mode} is not compatible with test type ${testType}`,
    );
  }
}

/**
 * A BREAKPOINT test is defined by where it stops: load escalates until a
 * threshold breaks, and k6 aborts the run there. Without `abortOnFail` — and
 * without a threshold to evaluate it against — the run simply plays out its
 * whole ramp and reports nothing about the system's limit, which is the one
 * thing the test exists to find.
 */
export function assertThresholdPolicyForType(
  testType: TestType,
  thresholdPolicy: ThresholdPolicy,
): void {
  if (testType !== TestType.BREAKPOINT) return;

  if (!thresholdPolicy.abortOnFail) {
    throw new ValidationError(
      'A BREAKPOINT test must set thresholdPolicy.abortOnFail so the run stops at the breaking point',
    );
  }

  const hasThreshold =
    typeof thresholdPolicy.maxErrorRate === 'number' ||
    typeof thresholdPolicy.maxP95ResponseTimeMs === 'number' ||
    typeof thresholdPolicy.maxP99ResponseTimeMs === 'number' ||
    typeof thresholdPolicy.minCheckSuccessRate === 'number';

  if (!hasThreshold) {
    throw new ValidationError(
      'A BREAKPOINT test must define at least one threshold to abort on',
    );
  }
}
