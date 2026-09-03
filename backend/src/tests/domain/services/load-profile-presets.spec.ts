import { describe, expect, it } from 'bun:test';
import { TestType } from '@/domain/entities/test-case';
import { ValidationError } from '@/domain/errors/custom-errors';
import { assertCompatibleLoadProfile } from '@/domain/services/load-profile-compatibility-policy';
import { deriveLoadProfile } from '@/domain/services/load-profile-presets';
import { LoadMode, TimeUnit } from '@/domain/vos/load-profile';
import type { RampLoadProfileSetup } from '@/domain/vos/load-profile';

describe('deriveLoadProfile', () => {
  it('gives SMOKE a short constant rate', () => {
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

  it('holds SOAK at a constant rate for the whole duration', () => {
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

  it('shapes AVG_LOAD as 10% ramp, 80% plateau, 10% ramp-down', () => {
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

  it('gives STRESS a longer ramp to a higher peak than AVG_LOAD', () => {
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

  it('gives SPIKE no plateau — it ramps up hard and comes straight back down', () => {
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

  it('gives BREAKPOINT one long escalating stage to the peak', () => {
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

  it('derives a profile whose mode the compatibility policy accepts, for every type', () => {
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

  it('rejects a duration too short to fit a three-phase shape', () => {
    expect(() =>
      deriveLoadProfile(TestType.AVG_LOAD, {
        peakRate: 100,
        duration: 2,
        timeUnit: TimeUnit.MINUTES,
      }),
    ).toThrow(ValidationError);
  });

  it('rejects a non-positive peak rate', () => {
    expect(() =>
      deriveLoadProfile(TestType.SMOKE, {
        peakRate: 0,
        duration: 1,
        timeUnit: TimeUnit.MINUTES,
      }),
    ).toThrow(ValidationError);
  });
});
