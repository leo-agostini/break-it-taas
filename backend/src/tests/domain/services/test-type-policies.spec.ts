import { describe, expect, it } from 'bun:test';
import { TestType } from '@/domain/entities/test-case';
import { ValidationError } from '@/domain/errors/custom-errors';
import { assertTimeoutCoversProfile } from '@/domain/services/execution-policy-compatibility';
import { assertThresholdPolicyForType } from '@/domain/services/load-profile-compatibility-policy';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '@/domain/vos/execution-policy';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { Stage } from '@/domain/vos/stage';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';

const soakProfile = LoadProfile.create(LoadMode.CONSTANT, {
  targetRate: 100,
  duration: 8,
  timeUnit: TimeUnit.HOURS,
});

describe('assertTimeoutCoversProfile', () => {
  it('accepts a timeout that covers the profile plus startup grace', () => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 60,
      timeUnit: TimeUnit.SECONDS,
    });

    expect(() =>
      assertTimeoutCoversProfile(
        profile,
        new ExecutionPolicy(ResourceProfile.SMALL, 120),
      ),
    ).not.toThrow();
  });

  it('rejects a timeout shorter than the profile it must cover', () => {
    // An 8-hour soak under a 30-second timeout becomes the Job's
    // activeDeadlineSeconds and is killed mid-run.
    expect(() =>
      assertTimeoutCoversProfile(
        soakProfile,
        new ExecutionPolicy(ResourceProfile.SMALL, 30),
      ),
    ).toThrow(ValidationError);
  });

  it('rejects a timeout that leaves no room for startup and callback', () => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 60,
      timeUnit: TimeUnit.SECONDS,
    });

    expect(() =>
      assertTimeoutCoversProfile(
        profile,
        new ExecutionPolicy(ResourceProfile.SMALL, 61),
      ),
    ).toThrow(ValidationError);
  });

  it('measures RAMP stages in the profile time unit', () => {
    const profile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 0,
      timeUnit: TimeUnit.MINUTES,
      stages: [
        new Stage({ target: 100, duration: 5 }),
        new Stage({ target: 0, duration: 5 }),
      ],
    });

    expect(() =>
      assertTimeoutCoversProfile(
        profile,
        new ExecutionPolicy(ResourceProfile.SMALL, 120),
      ),
    ).toThrow(ValidationError);
  });
});

describe('assertThresholdPolicyForType', () => {
  it('requires abortOnFail for BREAKPOINT, which stops at the breaking point', () => {
    const policy = new ThresholdPolicy(0.05, 500, undefined, undefined, false);

    expect(() =>
      assertThresholdPolicyForType(TestType.BREAKPOINT, policy),
    ).toThrow(ValidationError);
  });

  it('requires BREAKPOINT to define a threshold to abort on', () => {
    const policy = new ThresholdPolicy(
      undefined,
      undefined,
      undefined,
      undefined,
      true,
    );

    expect(() =>
      assertThresholdPolicyForType(TestType.BREAKPOINT, policy),
    ).toThrow(ValidationError);
  });

  it('accepts a BREAKPOINT that aborts on a latency threshold', () => {
    const policy = new ThresholdPolicy(
      undefined,
      500,
      undefined,
      undefined,
      true,
    );

    expect(() =>
      assertThresholdPolicyForType(TestType.BREAKPOINT, policy),
    ).not.toThrow();
  });

  it('leaves other test types free to run without abortOnFail', () => {
    const policy = new ThresholdPolicy(
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );

    for (const testType of Object.values(TestType)) {
      if (testType === TestType.BREAKPOINT) continue;
      expect(() =>
        assertThresholdPolicyForType(testType, policy),
      ).not.toThrow();
    }
  });
});
