import { describe, expect, it } from 'bun:test';
import { loadProfileDurationSeconds } from '@/domain/services/load-profile-duration';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { Stage } from '@/domain/vos/stage';

describe('loadProfileDurationSeconds', () => {
  it('returns the duration of a CONSTANT profile in seconds', () => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 30,
      timeUnit: TimeUnit.SECONDS,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(30);
  });

  it('converts CONSTANT minutes to seconds', () => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 5,
      timeUnit: TimeUnit.MINUTES,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(300);
  });

  it('converts CONSTANT hours to seconds, as a soak needs', () => {
    const profile = LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: 50,
      duration: 8,
      timeUnit: TimeUnit.HOURS,
    });

    expect(loadProfileDurationSeconds(profile)).toBe(28_800);
  });

  it('sums RAMP stage durations', () => {
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

  it('applies timeUnit to RAMP stage durations', () => {
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

  it('returns 0 for a RAMP profile with no stages', () => {
    const profile = LoadProfile.create(LoadMode.RAMP, {
      initialRate: 1,
      timeUnit: TimeUnit.SECONDS,
      stages: [],
    });

    expect(loadProfileDurationSeconds(profile)).toBe(0);
  });
});
