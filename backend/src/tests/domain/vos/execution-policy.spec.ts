import { describe, expect, it } from 'bun:test';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '@/domain/vos/execution-policy';
import { ValidationError } from '@/domain/errors/custom-errors';

describe('ExecutionPolicy VO', () => {
  it('creates with valid values', () => {
    const policy = new ExecutionPolicy(ResourceProfile.SMALL, 30);
    expect(policy.timeoutSeconds).toBe(30);
  });

  it('throws when timeout is less than 1', () => {
    expect(() => {
      new ExecutionPolicy(ResourceProfile.SMALL, 0);
    }).toThrow(ValidationError);
  });
});
