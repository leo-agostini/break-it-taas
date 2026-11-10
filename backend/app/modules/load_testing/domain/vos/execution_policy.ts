import { ValidationError } from '#modules/shared/domain/errors';

export enum ResourceProfile {
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  CUSTOM = 'CUSTOM',
}

/** Upper bounds for a CUSTOM runner container, so one run cannot starve the cluster. */
export const MAX_CPU_MILLICORES = 8000;
export const MAX_MEMORY_MB = 16384;

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

    const hasCustomSize = cpuMillicores !== undefined || memoryMb !== undefined;

    if (resourceProfile !== ResourceProfile.CUSTOM) {
      if (hasCustomSize) {
        throw new ValidationError(
          'cpuMillicores and memoryMb are only allowed with the CUSTOM resource profile',
        );
      }
      return;
    }

    // Without both values the runner cannot size the container, and silently
    // falling back to a preset would run the test on resources nobody chose.
    if (cpuMillicores === undefined || memoryMb === undefined) {
      throw new ValidationError(
        'A CUSTOM resource profile needs both cpuMillicores and memoryMb',
      );
    }
    if (cpuMillicores < 1 || cpuMillicores > MAX_CPU_MILLICORES) {
      throw new ValidationError(
        `cpuMillicores must be between 1 and ${MAX_CPU_MILLICORES}`,
      );
    }
    if (memoryMb < 1 || memoryMb > MAX_MEMORY_MB) {
      throw new ValidationError(
        `memoryMb must be between 1 and ${MAX_MEMORY_MB}`,
      );
    }
  }
}
