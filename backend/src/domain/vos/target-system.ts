import { ValidationError } from '@/domain/errors/custom-errors';

export class TargetSystem {
  constructor(
    public readonly baseUrl: string,
    public readonly environment: string,
  ) {
    if (!baseUrl.trim()) {
      throw new ValidationError('Target system baseUrl is required');
    }
    if (!environment.trim()) {
      throw new ValidationError('Target system environment is required');
    }
  }
}
