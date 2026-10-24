import { test } from '@japa/runner';
import { assertCompatibleLoadProfile } from '#modules/load_testing/domain/load_profile_compatibility';
import { deriveLoadProfile } from '#modules/load_testing/domain/load_profile_presets';
import { TestType } from '#modules/load_testing/domain/test_type';
import {
  LoadMode,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import type { RampLoadProfileSetup } from '#modules/load_testing/domain/vos/load_profile';
import { ValidationError } from '#modules/shared/domain/errors';

test.group('deriveLoadProfile', () => {
  test('gives SMOKE a short constant rate', ({ expect }) => {
    const profile = deriveLoadProfile(TestType.SMOKE, {
      peakRate: 5,
      duration: 1,
      timeUnit: TimeUnit.MINUTES,
    });

    expect(profile.mode).toBe(LoadMode.CONSTANT);
    expect(profile.config).toEqual({
      targetRate: 5,
      duration: 1,
      timeUnit: TimeUnit.MINUTES,
    });
  });

  test('holds SOAK at a constant rate for the whole duration', ({ expect }) => {
    const profile = deriveLoadProfile(TestType.SOAK, {
      peakRate: 100,
      duration: 8,
      timeUnit: TimeUnit.HOURS,
    });

    expect(profile.mode).toBe(LoadMode.CONSTANT);
    expect(profile.config).toEqual({
      targetRate: 100,
      duration: 8,
      timeUnit: TimeUnit.HOURS,
    });
  });

  test('shapes AVG_LOAD as 10% ramp, 80% plateau, 10% ramp-down', ({
    expect,
  }) => {
    const profile = deriveLoadProfile(TestType.AVG_LOAD, {
      peakRate: 100,
      duration: 40,
      timeUnit: TimeUnit.MINUTES,
    });

    expect(profile.mode).toBe(LoadMode.RAMP);
    expect(profile.config).toMatchObject({
      initialRate: 0,
      timeUnit: TimeUnit.MINUTES,
    });
    expect((profile.config as RampLoadProfileSetup).stages).toEqual([
      { target: 100, duration: 4 },
      { target: 100, duration: 32 },
      { target: 0, duration: 4 },
    ]);
  });

  test('gives STRESS a longer ramp to a higher peak than AVG_LOAD', ({
    expect,
  }) => {
    const profile = deriveLoadProfile(TestType.STRESS, {
      peakRate: 200,
      duration: 50,
      timeUnit: TimeUnit.MINUTES,
    });

    expect((profile.config as RampLoadProfileSetup).stages).toEqual([
      { target: 200, duration: 10 },
      { target: 200, duration: 35 },
      { target: 0, duration: 5 },
    ]);
  });

  test('gives SPIKE no plateau — it ramps up hard and comes straight back down', ({
    expect,
  }) => {
    const profile = deriveLoadProfile(TestType.SPIKE, {
      peakRate: 2000,
      duration: 3,
      timeUnit: TimeUnit.MINUTES,
    });

    expect(profile.mode).toBe(LoadMode.RAMP);
    expect((profile.config as RampLoadProfileSetup).stages).toEqual([
      { target: 2000, duration: 2 },
      { target: 0, duration: 1 },
    ]);
  });

  test('gives BREAKPOINT one long escalating stage to the peak', ({
    expect,
  }) => {
    const profile = deriveLoadProfile(TestType.BREAKPOINT, {
      peakRate: 20_000,
      duration: 2,
      timeUnit: TimeUnit.HOURS,
    });

    expect(profile.mode).toBe(LoadMode.RAMP);
    expect((profile.config as RampLoadProfileSetup).stages).toEqual([
      { target: 20_000, duration: 2 },
    ]);
  });

  test('derives a profile whose mode the compatibility policy accepts, for every type', ({
    expect,
  }) => {
    for (const testType of Object.values(TestType)) {
      const profile = deriveLoadProfile(testType, {
        peakRate: 100,
        duration: 10,
        timeUnit: TimeUnit.MINUTES,
      });

      expect(() =>
        assertCompatibleLoadProfile(testType, profile.mode),
      ).not.toThrow();
    }
  });

  test('rejects a duration too short to fit a three-phase shape', ({
    expect,
  }) => {
    expect(() =>
      deriveLoadProfile(TestType.AVG_LOAD, {
        peakRate: 100,
        duration: 2,
        timeUnit: TimeUnit.MINUTES,
      }),
    ).toThrow(ValidationError);
  });

  test('rejects a non-positive peak rate', ({ expect }) => {
    expect(() =>
      deriveLoadProfile(TestType.SMOKE, {
        peakRate: 0,
        duration: 1,
        timeUnit: TimeUnit.MINUTES,
      }),
    ).toThrow(ValidationError);
  });
});
