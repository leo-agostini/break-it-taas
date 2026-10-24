import { test } from '@japa/runner';
import { assertTimeoutCoversProfile } from '#modules/load_testing/domain/execution_policy_compatibility';
import { assertThresholdPolicyForType } from '#modules/load_testing/domain/load_profile_compatibility';
import { TestType } from '#modules/load_testing/domain/test_type';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '#modules/load_testing/domain/vos/execution_policy';
import {
  LoadMode,
  LoadProfile,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import { Stage } from '#modules/load_testing/domain/vos/stage';
import { ThresholdPolicy } from '#modules/load_testing/domain/vos/threshold_policy';
import { ValidationError } from '#modules/shared/domain/errors';

const soakProfile = LoadProfile.create(LoadMode.CONSTANT, {
  targetRate: 100,
  duration: 8,
  timeUnit: TimeUnit.HOURS,
});

test.group('assertTimeoutCoversProfile', () => {
  test('accepts a timeout that covers the profile plus startup grace', ({
    expect,
  }) => {
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

  test('rejects a timeout shorter than the profile it must cover', ({
    expect,
  }) => {
    // An 8-hour soak under a 30-second timeout becomes the Job's
    // activeDeadlineSeconds and is killed mid-run.
    expect(() =>
      assertTimeoutCoversProfile(
        soakProfile,
        new ExecutionPolicy(ResourceProfile.SMALL, 30),
      ),
    ).toThrow(ValidationError);
  });

  test('rejects a timeout that leaves no room for startup and callback', ({
    expect,
  }) => {
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

  test('measures RAMP stages in the profile time unit', ({ expect }) => {
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

test.group('assertThresholdPolicyForType', () => {
  test('requires abortOnFail for BREAKPOINT, which stops at the breaking point', ({
    expect,
  }) => {
    const policy = new ThresholdPolicy(0.05, 500, undefined, undefined, false);

    expect(() =>
      assertThresholdPolicyForType(TestType.BREAKPOINT, policy),
    ).toThrow(ValidationError);
  });

  test('requires BREAKPOINT to define a threshold to abort on', ({
    expect,
  }) => {
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

  test('accepts a BREAKPOINT that aborts on a latency threshold', ({
    expect,
  }) => {
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

  test('leaves other test types free to run without abortOnFail', ({
    expect,
  }) => {
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
