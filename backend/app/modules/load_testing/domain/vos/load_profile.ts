import { ValidationError } from '#modules/shared/domain/errors';
import type { Stage } from './stage.js';

export enum TimeUnit {
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
}

/**
 * How the load is driven. CONSTANT and RAMP are open-model (a request arrival
 * rate, k6's arrival-rate executors); CONSTANT_VUS and RAMPING_VUS are
 * closed-model (a number of concurrent virtual users, each looping as fast as
 * the target answers).
 */
export enum LoadMode {
  CONSTANT = 'CONSTANT',
  RAMP = 'RAMP',
  CONSTANT_VUS = 'CONSTANT_VUS',
  RAMPING_VUS = 'RAMPING_VUS',
}

const RATE_MODES: readonly LoadMode[] = [LoadMode.CONSTANT, LoadMode.RAMP];

export function isRateMode(mode: LoadMode): boolean {
  return RATE_MODES.includes(mode);
}

/**
 * The VU pool an arrival-rate executor draws from. Optional: without it the
 * runner estimates one from the rate.
 */
export type VuPool = { preAllocated: number; max: number };

export type ConstantLoadProfileSetup = {
  targetRate: number;
  duration: number;
  timeUnit: TimeUnit;
  vus?: VuPool;
};

export type RampLoadProfileSetup = {
  initialRate: number;
  timeUnit: TimeUnit;
  stages: Stage[];
  vus?: VuPool;
};

export type ConstantVusLoadProfileSetup = {
  vus: number;
  duration: number;
  timeUnit: TimeUnit;
};

/** Stage targets are VU counts here, not rates. */
export type RampingVusLoadProfileSetup = {
  startVus: number;
  timeUnit: TimeUnit;
  stages: Stage[];
};

type LoadProfileConfigByMode = {
  [LoadMode.CONSTANT]: ConstantLoadProfileSetup;
  [LoadMode.RAMP]: RampLoadProfileSetup;
  [LoadMode.CONSTANT_VUS]: ConstantVusLoadProfileSetup;
  [LoadMode.RAMPING_VUS]: RampingVusLoadProfileSetup;
};

function assertUsableVuPool(pool: VuPool): void {
  if (!Number.isInteger(pool.preAllocated) || pool.preAllocated < 1) {
    throw new ValidationError('vus.preAllocated must be at least 1');
  }
  if (!Number.isInteger(pool.max) || pool.max < pool.preAllocated) {
    throw new ValidationError(
      'vus.max must be a whole number no smaller than vus.preAllocated',
    );
  }
}

export class LoadProfile<TMode extends LoadMode> {
  private constructor(
    public readonly mode: TMode,
    public readonly config: LoadProfileConfigByMode[TMode],
  ) {}

  static create<TMode extends LoadMode>(
    mode: TMode,
    config: LoadProfileConfigByMode[TMode],
  ): LoadProfile<TMode> {
    const raw = config as Record<string, unknown>;

    if (isRateMode(mode) && raw.vus !== undefined && raw.vus !== null) {
      assertUsableVuPool(raw.vus as VuPool);
    }
    if (mode === LoadMode.CONSTANT_VUS && Number(raw.vus) < 1) {
      throw new ValidationError('A CONSTANT_VUS profile needs at least 1 VU');
    }

    return new LoadProfile(mode, config);
  }
}
