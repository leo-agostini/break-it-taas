import { test } from '@japa/runner';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '#modules/load_testing/domain/vos/execution_policy';
import { ValidationError } from '#modules/shared/domain/errors';

test.group('ExecutionPolicy VO', () => {
  test('creates with valid values', ({ expect }) => {
    const policy = new ExecutionPolicy(ResourceProfile.SMALL, 30);
    expect(policy.timeoutSeconds).toBe(30);
  });

  test('throws when timeout is less than 1', ({ expect }) => {
    expect(() => {
      new ExecutionPolicy(ResourceProfile.SMALL, 0);
    }).toThrow(ValidationError);
  });
});
