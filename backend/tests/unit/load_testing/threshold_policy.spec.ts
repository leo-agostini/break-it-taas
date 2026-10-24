import { test } from '@japa/runner';
import { ThresholdPolicy } from '#modules/load_testing/domain/vos/threshold_policy';
import { ValidationError } from '#modules/shared/domain/errors';

test.group('ThresholdPolicy VO', () => {
  test('creates with valid bounds', ({ expect }) => {
    const policy = new ThresholdPolicy(0.1, 200, 400, 0.95, true);
    expect(policy.maxErrorRate).toBe(0.1);
  });

  test('throws when maxErrorRate is lower than 0', ({ expect }) => {
    expect(() => {
      new ThresholdPolicy(-0.01, 200, 400, 0.95, false);
    }).toThrow(ValidationError);
  });

  test('throws when maxErrorRate is higher than 1', ({ expect }) => {
    expect(() => {
      new ThresholdPolicy(1.01, 200, 400, 0.95, false);
    }).toThrow(ValidationError);
  });

  test('throws when minCheckSuccessRate is out of range', ({ expect }) => {
    expect(() => {
      new ThresholdPolicy(0.1, 200, 400, 1.1, false);
    }).toThrow(ValidationError);
  });
});
