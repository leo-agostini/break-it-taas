import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@/domain/errors/custom-errors';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';

describe('ThresholdPolicy VO', () => {
  it('creates with valid bounds', () => {
    const policy = new ThresholdPolicy(0.1, 200, 400, 0.95, true);
    expect(policy.maxErrorRate).toBe(0.1);
  });

  it('throws when maxErrorRate is lower than 0', () => {
    expect(() => {
      new ThresholdPolicy(-0.01, 200, 400, 0.95, false);
    }).toThrow(ValidationError);
  });

  it('throws when maxErrorRate is higher than 1', () => {
    expect(() => {
      new ThresholdPolicy(1.01, 200, 400, 0.95, false);
    }).toThrow(ValidationError);
  });

  it('throws when minCheckSuccessRate is out of range', () => {
    expect(() => {
      new ThresholdPolicy(0.1, 200, 400, 1.1, false);
    }).toThrow(ValidationError);
  });
});
