import {
  type RunConfigurationFormValues,
  defaultRunConfigurationValues,
} from '@/features/test-cases/schemas/run-configuration-schema';
import type {
  ExecutionPolicy,
  LoadPreset,
  LoadProfile,
  Stage,
  VuPool,
} from '@/features/test-cases/types/test-case';

export function toNumber(value?: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toStages(stages: Array<{ target: string; duration: string }>) {
  return stages.map((stage) => ({
    target: Number(stage.target),
    duration: Number(stage.duration),
  }));
}

/** A blank pool is left out, so the runner estimates one from the rate. */
function toVuPool(pool: {
  preAllocated?: string;
  max?: string;
}): VuPool | undefined {
  const preAllocated = toNumber(pool.preAllocated);
  const max = toNumber(pool.max);
  return preAllocated !== undefined && max !== undefined
    ? { preAllocated, max }
    : undefined;
}

function toLoadProfile(values: RunConfigurationFormValues): LoadProfile {
  switch (values.loadMode) {
    case 'RAMP':
      return {
        mode: 'RAMP',
        config: {
          initialRate: Number(values.ramp.initialRate),
          timeUnit: values.ramp.timeUnit,
          stages: toStages(values.ramp.stages),
          vus: toVuPool(values.ramp.vus),
        },
      };
    case 'CONSTANT_VUS':
      return {
        mode: 'CONSTANT_VUS',
        config: {
          vus: Number(values.constantVus.vus),
          duration: Number(values.constantVus.duration),
          timeUnit: values.constantVus.timeUnit,
        },
      };
    case 'RAMPING_VUS':
      return {
        mode: 'RAMPING_VUS',
        config: {
          startVus: Number(values.rampingVus.startVus),
          timeUnit: values.rampingVus.timeUnit,
          stages: toStages(values.rampingVus.stages),
        },
      };
    default:
      return {
        mode: 'CONSTANT',
        config: {
          targetRate: Number(values.constant.targetRate),
          duration: Number(values.constant.duration),
          timeUnit: values.constant.timeUnit,
          vus: toVuPool(values.constant.vus),
        },
      };
  }
}

function toLoadPreset(values: RunConfigurationFormValues): LoadPreset {
  const peak = Number(values.preset.peak);
  return {
    ...(values.preset.driver === 'VUS'
      ? { peakVus: peak }
      : { peakRate: peak }),
    duration: Number(values.preset.duration),
    timeUnit: values.preset.timeUnit,
  };
}

/** Exactly one of loadProfile / loadPreset, as the backend requires. */
export function toLoad(
  values: RunConfigurationFormValues,
): { loadProfile: LoadProfile } | { loadPreset: LoadPreset } {
  return values.loadSource === 'PRESET'
    ? { loadPreset: toLoadPreset(values) }
    : { loadProfile: toLoadProfile(values) };
}

/** CPU and memory only mean something on a CUSTOM container. */
export function toExecutionPolicy(
  execution: RunConfigurationFormValues['execution'],
): Partial<ExecutionPolicy> {
  const isCustomProfile = execution.resourceProfile === 'CUSTOM';
  return {
    resourceProfile: execution.resourceProfile,
    timeoutSeconds: toNumber(execution.timeoutSeconds),
    cpuMillicores: isCustomProfile
      ? toNumber(execution.cpuMillicores)
      : undefined,
    memoryMb: isCustomProfile ? toNumber(execution.memoryMb) : undefined,
  };
}

function fromStages(stages: Stage[]) {
  return stages.map((stage) => ({
    target: String(stage.target),
    duration: String(stage.duration),
  }));
}

function fromVuPool(pool?: VuPool) {
  return {
    preAllocated: pool ? String(pool.preAllocated) : '',
    max: pool ? String(pool.max) : '',
  };
}

/**
 * Form values that reproduce a stored configuration as a hand-authored
 * profile, so a run can start from it and change only what it needs. The
 * timeout is left blank: the backend keeps the default and grows it to fit
 * a longer load.
 */
export function toRunConfigurationFormValues(
  loadProfile: LoadProfile,
  executionPolicy: ExecutionPolicy,
): RunConfigurationFormValues {
  const values: RunConfigurationFormValues = {
    ...structuredClone(defaultRunConfigurationValues),
    loadSource: 'MANUAL',
    loadMode: loadProfile.mode,
    execution: {
      resourceProfile: executionPolicy.resourceProfile,
      timeoutSeconds: '',
      cpuMillicores:
        executionPolicy.cpuMillicores !== undefined
          ? String(executionPolicy.cpuMillicores)
          : '',
      memoryMb:
        executionPolicy.memoryMb !== undefined
          ? String(executionPolicy.memoryMb)
          : '',
    },
  };

  switch (loadProfile.mode) {
    case 'CONSTANT':
      values.constant = {
        targetRate: String(loadProfile.config.targetRate),
        duration: String(loadProfile.config.duration),
        timeUnit: loadProfile.config.timeUnit,
        vus: fromVuPool(loadProfile.config.vus),
      };
      break;
    case 'RAMP':
      values.ramp = {
        initialRate: String(loadProfile.config.initialRate),
        timeUnit: loadProfile.config.timeUnit,
        stages: fromStages(loadProfile.config.stages),
        vus: fromVuPool(loadProfile.config.vus),
      };
      break;
    case 'CONSTANT_VUS':
      values.constantVus = {
        vus: String(loadProfile.config.vus),
        duration: String(loadProfile.config.duration),
        timeUnit: loadProfile.config.timeUnit,
      };
      break;
    case 'RAMPING_VUS':
      values.rampingVus = {
        startVus: String(loadProfile.config.startVus),
        timeUnit: loadProfile.config.timeUnit,
        stages: fromStages(loadProfile.config.stages),
      };
      break;
  }

  return values;
}
