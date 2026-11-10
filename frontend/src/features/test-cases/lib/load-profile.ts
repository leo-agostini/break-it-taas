import type {
  ExecutionPolicy,
  LoadMode,
  LoadProfile,
  TimeUnit,
} from '@/features/test-cases/types/test-case';

export const LOAD_MODES = [
  'CONSTANT',
  'RAMP',
  'CONSTANT_VUS',
  'RAMPING_VUS',
] as const satisfies readonly LoadMode[];

export const loadModeLabels: Record<LoadMode, string> = {
  CONSTANT: 'Constant rate',
  RAMP: 'Ramping rate',
  CONSTANT_VUS: 'Constant VUs',
  RAMPING_VUS: 'Ramping VUs',
};

/** Arrival-rate (open model) modes, as opposed to virtual-user modes. */
export function isRateMode(mode: LoadMode): mode is 'CONSTANT' | 'RAMP' {
  return mode === 'CONSTANT' || mode === 'RAMP';
}

const UNIT_SUFFIX: Record<TimeUnit, string> = {
  SECONDS: 's',
  MINUTES: 'm',
  HOURS: 'h',
};

function profileDuration(profile: LoadProfile): number {
  if (profile.mode === 'CONSTANT' || profile.mode === 'CONSTANT_VUS') {
    return profile.config.duration;
  }
  return profile.config.stages.reduce((sum, stage) => sum + stage.duration, 0);
}

function profilePeak(profile: LoadProfile): number {
  switch (profile.mode) {
    case 'CONSTANT':
      return profile.config.targetRate;
    case 'CONSTANT_VUS':
      return profile.config.vus;
    case 'RAMP':
      return Math.max(
        profile.config.initialRate,
        ...profile.config.stages.map((stage) => stage.target),
      );
    case 'RAMPING_VUS':
      return Math.max(
        profile.config.startVus,
        ...profile.config.stages.map((stage) => stage.target),
      );
  }
}

/** The highest load a profile asks for, e.g. "50/s" or "20 VUs". */
export function describeLoadPeak(profile: LoadProfile): string {
  const peak = profilePeak(profile).toLocaleString('en-US');
  return isRateMode(profile.mode)
    ? `${peak}/${UNIT_SUFFIX[profile.config.timeUnit]}`
    : `${peak} VUs`;
}

/** The planned length of the load, e.g. "5m". */
export function describeLoadDuration(profile: LoadProfile): string {
  return `${profileDuration(profile)}${UNIT_SUFFIX[profile.config.timeUnit]}`;
}

/** One line summarizing a load profile, e.g. "Ramping rate to 100/s over 3 stages (5m)". */
export function describeLoadProfile(profile: LoadProfile): string {
  const peak = describeLoadPeak(profile);
  const duration = describeLoadDuration(profile);

  if (profile.mode === 'CONSTANT' || profile.mode === 'CONSTANT_VUS') {
    return `${peak} for ${duration}`;
  }
  const stages = profile.config.stages.length;
  return `To ${peak} over ${stages} stage${stages === 1 ? '' : 's'} (${duration})`;
}

/** e.g. "500m CPU · 512 MB · timeout 330s" for CUSTOM, "Timeout 330s" otherwise. */
export function describeExecutionPolicy(policy: ExecutionPolicy): string {
  const timeout = `timeout ${policy.timeoutSeconds}s`;
  if (policy.resourceProfile !== 'CUSTOM') {
    return timeout.charAt(0).toUpperCase() + timeout.slice(1);
  }
  return `${policy.cpuMillicores}m CPU · ${policy.memoryMb} MB · ${timeout}`;
}
