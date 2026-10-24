import { test } from '@japa/runner';
import { loadProfileDurationSeconds } from '#modules/load_testing/domain/load_profile_duration';
import {
  LoadMode,
  LoadProfile,
  TimeUnit,
} from '#modules/load_testing/domain/vos/load_profile';
import { Stage } from '#modules/load_testing/domain/vos/stage';

test.group('loadProfileDurationSeconds', () => {
  test('returns the duration of a CONSTANT profile in seconds', ({
    expect,
  }) => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 30,
      timeUnit: TimeUnit.SECONDS,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(30);
  });

  test('converts CONSTANT minutes to seconds', ({ expect }) => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 5,
      timeUnit: TimeUnit.MINUTES,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(300);
  });

  test('converts CONSTANT hours to seconds, as a soak needs', ({ expect }) => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 8,
      timeUnit: TimeUnit.HOURS,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(28_800);
  });

  test('sums RAMP stage durations', ({ expect }) => {
    const profile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 1,
      timeUnit: TimeUnit.SECONDS,
      stages: [
        new Stage({ target: 50, duration: 10 }),
        new Stage({ target: 50, duration: 20 }),
        new Stage({ target: 0, duration: 5 }),
      ],
    });

    expect(loadProfileDurationSeconds(profile)).toBe(35);
  });

  test('applies timeUnit to RAMP stage durations', ({ expect }) => {
    // The stage durations are expressed in the profile's timeUnit, exactly as
    // the CONSTANT branch treats its own duration. Summing them raw reports a
    // 40-minute ramp as 40 seconds.
    const profile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 1,
      timeUnit: TimeUnit.MINUTES,
      stages: [
        new Stage({ target: 100, duration: 5 }),
        new Stage({ target: 100, duration: 30 }),
        new Stage({ target: 0, duration: 5 }),
      ],
    });

    expect(loadProfileDurationSeconds(profile)).toBe(2_400);
  });

  test('returns 0 for a RAMP profile with no stages', ({ expect }) => {
    const profile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 1,
      timeUnit: TimeUnit.SECONDS,
      stages: [],
    });

    expect(loadProfileDurationSeconds(profile)).toBe(0);
  });
});
