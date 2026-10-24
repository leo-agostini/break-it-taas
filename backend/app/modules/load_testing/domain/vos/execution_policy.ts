import { ValidationError } from '#modules/shared/domain/errors';

export enum ResourceProfile {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  CUSTOM = 'CUSTOM',
}

export class ExecutionPolicy {
  constructor(
    public readonly resourceProfile: ResourceProfile,
    public readonly timeoutSeconds: number,
    public readonly cpuMillicores?: number,
    public readonly memoryMb?: number,
  ) {
    if (timeoutSeconds < 1) {
      throw new ValidationError('timeoutSeconds must be positive');
    }
  }
}
