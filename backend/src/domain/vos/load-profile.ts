import type { Stage } from './stage';

export enum TimeUnit {
  SECONDS = 'SECONDS',
  MINUTES = 'MINUTES',
  HOURS = 'HOURS',
}

export enum LoadMode {
  CONSTANT = 'CONSTANT',
  RAMP = 'RAMP',
}

export type ConstantLoadProfileSetup = {
  targetRate: number;
  duration: number;
  timeUnit: TimeUnit;
};

export type RampLoadProfileSetup = {
  initialRate: number;
  timeUnit: TimeUnit;
  stages: Stage[];
};

type LoadProfileConfigByMode = {
  [LoadMode.CONSTANT]: ConstantLoadProfileSetup;
  [LoadMode.RAMP]: RampLoadProfileSetup;
};

export class LoadProfile<TMode extends LoadMode> {
  private constructor(
    public readonly mode: TMode,
    public readonly config: LoadProfileConfigByMode[TMode],
  ) {}

  static create<TMode extends LoadMode>(
    mode: TMode,
    config: LoadProfileConfigByMode[TMode],
  ): LoadProfile<TMode> {
    return new LoadProfile(mode, config);
  }
}
