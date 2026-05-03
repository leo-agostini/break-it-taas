import { ValidationError } from '@/domain/errors/custom-errors';

export class ThresholdPolicy {
  constructor(
    public readonly maxErrorRate?: number,
    public readonly maxP95ResponseTimeMs?: number,
    public readonly maxP99ResponseTimeMs?: number,
    public readonly minCheckSuccessRate?: number,
    public readonly abortOnFail = false,
  ) {
    if (maxErrorRate != null && (maxErrorRate < 0 || maxErrorRate > 1)) {
      throw new ValidationError('maxErrorRate must be between 0 and 1');
    }

    if (
      minCheckSuccessRate != null &&
      (minCheckSuccessRate < 0 || minCheckSuccessRate > 1)
    ) {
      throw new ValidationError('minCheckSuccessRate must be between 0 and 1');
    }
  }
}
