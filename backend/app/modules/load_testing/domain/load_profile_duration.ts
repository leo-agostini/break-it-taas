import {
  type LoadMode,
  type LoadProfile,
  TimeUnit,
} from './vos/load_profile.js';

const SECONDS_PER_TIME_UNIT: Record<TimeUnit, number> = {
  [TimeUnit.SECONDS]: 1,
  [TimeUnit.MINUTES]: 60,
  [TimeUnit.HOURS]: 3600,
};

export function timeUnitToSeconds(timeUnit: TimeUnit): number {
  return SECONDS_PER_TIME_UNIT[timeUnit] ?? 1;
}

/**
 * Wall-clock length of a load profile, in seconds.
 *
 * Both modes express their durations in the profile's own `timeUnit` — a RAMP
 * stage of `duration: 30` with `timeUnit: MINUTES` runs for half an hour, not
 * half a minute. Callers that need to compare a profile against something
 * measured in seconds (an execution timeout, a reported duration) must go
 * through here rather than reading the raw numbers.
 */
export function loadProfileDurationSeconds(
  loadProfile: LoadProfile<LoadMode>,
): number {
  const config = loadProfile.config as Record<string, unknown>;
  const timeUnit = (config.timeUnit as TimeUnit) ?? TimeUnit.SECONDS;
  const secondsPerUnit = timeUnitToSeconds(timeUnit);

  const stages = config.stages;
  if (Array.isArray(stages)) {
    return stages.reduce((total: number, stage) => {
      const duration = Number((stage as { duration?: unknown }).duration ?? 0);
      return (
        total + (Number.isFinite(duration) ? duration : 0) * secondsPerUnit
      );
    }, 0);
  }

  const duration = Number(config.duration ?? 0);
  return (Number.isFinite(duration) ? duration : 0) * secondsPerUnit;
}
