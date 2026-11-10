import {
  LoadProfileCompatibilityError,
  ValidationError,
} from '#modules/shared/domain/errors';
import { TestType } from './test_type.js';
import { LoadMode } from './vos/load_profile.js';
import type { ThresholdPolicy } from './vos/threshold_policy.js';

// Each type allows the rate mode and the VU mode of the same shape, except
// BREAKPOINT: its result is the arrival rate the target gave out at, which a
// closed-model (VU) run cannot measure — the rate there is whatever the target
// lets through.
const compatibility: Record<TestType, LoadMode[]> = {
  [TestType.SMOKE]: [LoadMode.CONSTANT, LoadMode.CONSTANT_VUS],
  [TestType.AVG_LOAD]: [
    LoadMode.CONSTANT,
    LoadMode.RAMP,
    LoadMode.CONSTANT_VUS,
    LoadMode.RAMPING_VUS,
  ],
  [TestType.STRESS]: [
    LoadMode.CONSTANT,
    LoadMode.RAMP,
    LoadMode.CONSTANT_VUS,
    LoadMode.RAMPING_VUS,
  ],
  [TestType.SOAK]: [LoadMode.CONSTANT, LoadMode.CONSTANT_VUS],
  [TestType.SPIKE]: [LoadMode.RAMP, LoadMode.RAMPING_VUS],
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
