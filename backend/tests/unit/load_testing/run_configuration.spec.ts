import { test } from '@japa/runner';
import { EXECUTION_GRACE_SECONDS } from '#modules/load_testing/domain/execution_policy_compatibility';
import {
  type RunConfiguration,
  applyRunConfigurationOverride,
  buildRunConfiguration,
} from '#modules/load_testing/domain/run_configuration';
import { TestType } from '#modules/load_testing/domain/test_type';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '#modules/load_testing/domain/vos/execution_policy';
import {
  type ConstantLoadProfileSetup,
  LoadMode,
  LoadProfile,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import {
  LoadProfileCompatibilityError,
  ValidationError,
} from '#modules/shared/domain/errors';

const defaults: RunConfiguration = {
  loadProfile: LoadProfile.create(LoadMode.CONSTANT, {
    targetRate: 5000,
    duration: 60,
    timeUnit: TimeUnit.SECONDS,
  }),
  executionPolicy: new ExecutionPolicy(ResourceProfile.LARGE, 120),
};

test.group('buildRunConfiguration', () => {
  test('accepts a VU profile for a type that allows it', ({ expect }) => {
    const config = buildRunConfiguration(TestType.STRESS, {
      loadProfile: {
        mode: LoadMode.CONSTANT_VUS,
        config: { vus: 50, duration: 30, timeUnit: TimeUnit.SECONDS },
      },
      executionPolicy: {
        resourceProfile: ResourceProfile.SMALL,
        timeoutSeconds: 120,
      },
    });

    expect(config.loadProfile.mode).toBe(LoadMode.CONSTANT_VUS);
  });

  test('rejects a VU profile for BREAKPOINT', ({ expect }) => {
    expect(() =>
      buildRunConfiguration(TestType.BREAKPOINT, {
        loadProfile: {
          mode: LoadMode.RAMPING_VUS,
          config: {
            startVus: 0,
            timeUnit: TimeUnit.SECONDS,
            stages: [{ target: 100, duration: 30 }],
          },
        },
        executionPolicy: {
          resourceProfile: ResourceProfile.SMALL,
          timeoutSeconds: 120,
        },
      }),
    ).toThrow(LoadProfileCompatibilityError);
  });

  test('rejects a rate profile whose VU pool is inverted', ({ expect }) => {
    expect(() =>
      buildRunConfiguration(TestType.SMOKE, {
        loadProfile: {
          mode: LoadMode.CONSTANT,
          config: {
            targetRate: 10,
            duration: 5,
            timeUnit: TimeUnit.SECONDS,
            vus: { preAllocated: 50, max: 10 },
          },
        },
        executionPolicy: {
          resourceProfile: ResourceProfile.SMALL,
          timeoutSeconds: 120,
        },
      }),
    ).toThrow(ValidationError);
  });
});

test.group('applyRunConfigurationOverride', () => {
  test('reruns the defaults unchanged without an override', ({ expect }) => {
    const config = applyRunConfigurationOverride(TestType.STRESS, defaults);

    expect(config.loadProfile.config).toEqual(defaults.loadProfile.config);
    expect(config.executionPolicy).toEqual(defaults.executionPolicy);
  });

  test('replaces the load and keeps the default container', ({ expect }) => {
    const config = applyRunConfigurationOverride(TestType.STRESS, defaults, {
      loadProfile: {
        mode: LoadMode.CONSTANT,
        config: { targetRate: 2500, duration: 60, timeUnit: TimeUnit.SECONDS },
      },
    });

    expect(
      (config.loadProfile.config as ConstantLoadProfileSetup).targetRate,
    ).toBe(2500);
    expect(config.executionPolicy.resourceProfile).toBe(ResourceProfile.LARGE);
    expect(config.executionPolicy.timeoutSeconds).toBe(120);
  });

  test('grows the timeout to fit a longer load when none is given', ({
    expect,
  }) => {
    const config = applyRunConfigurationOverride(TestType.STRESS, defaults, {
      loadPreset: { peakRate: 3750, duration: 10, timeUnit: TimeUnit.MINUTES },
    });

    expect(config.loadProfile.mode).toBe(LoadMode.RAMP);
    expect(config.executionPolicy.timeoutSeconds).toBe(
      600 + EXECUTION_GRACE_SECONDS,
    );
  });

  test('keeps an explicit timeout, and rejects it when too short', ({
    expect,
  }) => {
    expect(() =>
      applyRunConfigurationOverride(TestType.STRESS, defaults, {
        loadPreset: {
          peakRate: 3750,
          duration: 10,
          timeUnit: TimeUnit.MINUTES,
        },
        executionPolicy: { timeoutSeconds: 60 },
      }),
    ).toThrow(ValidationError);
  });

  test('changes only the container', ({ expect }) => {
    const config = applyRunConfigurationOverride(TestType.STRESS, defaults, {
      executionPolicy: {
        resourceProfile: ResourceProfile.CUSTOM,
        cpuMillicores: 2000,
        memoryMb: 4096,
      },
    });

    expect(config.loadProfile.config).toEqual(defaults.loadProfile.config);
    expect(config.executionPolicy).toEqual(
      new ExecutionPolicy(ResourceProfile.CUSTOM, 120, 2000, 4096),
    );
  });

  test('drops a CUSTOM default size when switching to a preset profile', ({
    expect,
  }) => {
    const customDefaults: RunConfiguration = {
      ...defaults,
      executionPolicy: new ExecutionPolicy(
        ResourceProfile.CUSTOM,
        120,
        2000,
        4096,
      ),
    };

    const config = applyRunConfigurationOverride(
      TestType.STRESS,
      customDefaults,
      { executionPolicy: { resourceProfile: ResourceProfile.SMALL } },
    );

    expect(config.executionPolicy).toEqual(
      new ExecutionPolicy(ResourceProfile.SMALL, 120),
    );
  });

  test('still enforces the test type on the override', ({ expect }) => {
    expect(() =>
      applyRunConfigurationOverride(TestType.SMOKE, defaults, {
        loadProfile: {
          mode: LoadMode.RAMP,
          config: {
            initialRate: 0,
            timeUnit: TimeUnit.SECONDS,
            stages: [{ target: 10, duration: 5 }],
          },
        },
      }),
    ).toThrow(LoadProfileCompatibilityError);
  });
});
