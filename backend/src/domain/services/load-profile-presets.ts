import { TestType } from '@/domain/entities/test-case';
import { ValidationError } from '@/domain/errors/custom-errors';
import {
  LoadMode,
  LoadProfile,
  type TimeUnit,
} from '@/domain/vos/load-profile';
import { Stage } from '@/domain/vos/stage';

export type LoadPreset = {
  peakRate: number;
  duration: number;
  timeUnit: TimeUnit;
};

/**
 * Fraction of the total duration each phase takes, per the k6 test-type guide
 * (https://grafana.com/docs/k6/latest/testing-guides/test-types/).
 *
 * The guide expresses these types in virtual users; this system is open-model
 * throughout, so the same shapes are applied to the request rate instead. The
 * shape is what distinguishes the types — a spike is a spike because it has no
 * plateau, whatever the load is measured in.
 */
const RAMP_SHAPE: Partial<
  Record<TestType, { rampUp: number; plateau: number; rampDown: number }>
> = {
  [TestType.AVG_LOAD]: { rampUp: 0.1, plateau: 0.8, rampDown: 0.1 },
  [TestType.STRESS]: { rampUp: 0.2, plateau: 0.7, rampDown: 0.1 },
  // No plateau: the load comes straight back down after the peak.
  [TestType.SPIKE]: { rampUp: 0.65, plateau: 0, rampDown: 0.35 },
};

function assertUsablePreset(preset: LoadPreset): void {
  if (!Number.isFinite(preset.peakRate) || preset.peakRate < 1) {
    throw new ValidationError('Peak rate must be at least 1');
  }
  if (!Number.isInteger(preset.duration) || preset.duration < 1) {
    throw new ValidationError('Duration must be a whole number of at least 1');
  }
}

function buildRampStages(testType: TestType, preset: LoadPreset): Stage[] {
  const shape = RAMP_SHAPE[testType];
  if (!shape) {
    // BREAKPOINT: one continuously escalating stage, stopped by an
    // abortOnFail threshold rather than by reaching the end of the profile.
    return [new Stage({ target: preset.peakRate, duration: preset.duration })];
  }

  const hasPlateau = shape.plateau > 0;
  const phases = hasPlateau ? 3 : 2;
  if (preset.duration < phases) {
    throw new ValidationError(
      `A ${testType} profile needs a duration of at least ${phases} ${preset.timeUnit.toLowerCase()} to fit its phases`,
    );
  }

  const rampUp = Math.max(1, Math.round(preset.duration * shape.rampUp));
  const rampDown = Math.max(1, Math.round(preset.duration * shape.rampDown));

  if (!hasPlateau) {
    // Give the ramp-down whatever the ramp-up did not take, so the phases
    // always add up to exactly the duration the user asked for.
    return [
      new Stage({ target: preset.peakRate, duration: rampUp }),
      new Stage({ target: 0, duration: Math.max(1, preset.duration - rampUp) }),
    ];
  }

  const plateau = preset.duration - rampUp - rampDown;
  if (plateau < 1) {
    throw new ValidationError(
      `A ${testType} profile needs a longer duration to fit a plateau between its ramps`,
    );
  }

  return [
    new Stage({ target: preset.peakRate, duration: rampUp }),
    new Stage({ target: preset.peakRate, duration: plateau }),
    new Stage({ target: 0, duration: rampDown }),
  ];
}

/**
 * Builds the load profile the k6 guide prescribes for a test type.
 *
 * The result is the same `LoadProfile` the manual authoring path produces, so
 * nothing downstream needs to know whether a profile was derived or written by
 * hand.
 */
export function deriveLoadProfile(
  testType: TestType,
  preset: LoadPreset,
): LoadProfile<LoadMode> {
  assertUsablePreset(preset);

  if (testType === TestType.SMOKE || testType === TestType.SOAK) {
    return LoadProfile.create(LoadMode.CONSTANT, {
      targetRate: preset.peakRate,
      duration: preset.duration,
      timeUnit: preset.timeUnit,
    });
  }

  return LoadProfile.create(LoadMode.RAMP, {
    initialRate: 0,
    timeUnit: preset.timeUnit,
    stages: buildRampStages(testType, preset),
  });
}
