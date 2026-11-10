import { test } from '@japa/runner';
import {
  ExecutionPolicy,
  MAX_CPU_MILLICORES,
  MAX_MEMORY_MB,
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

  test('requires both cpuMillicores and memoryMb for CUSTOM', ({ expect }) => {
    expect(() => new ExecutionPolicy(ResourceProfile.CUSTOM, 30, 500)).toThrow(
      ValidationError,
    );
    expect(
      () => new ExecutionPolicy(ResourceProfile.CUSTOM, 30, undefined, 512),
    ).toThrow(ValidationError);
  });

  test('accepts a CUSTOM size within the bounds', ({ expect }) => {
    const policy = new ExecutionPolicy(ResourceProfile.CUSTOM, 30, 2000, 4096);
    expect(policy.cpuMillicores).toBe(2000);
    expect(policy.memoryMb).toBe(4096);
  });

  test('rejects a CUSTOM size above the bounds', ({ expect }) => {
    expect(
      () =>
        new ExecutionPolicy(
          ResourceProfile.CUSTOM,
          30,
          MAX_CPU_MILLICORES + 1,
          512,
        ),
    ).toThrow(ValidationError);
    expect(
      () =>
        new ExecutionPolicy(ResourceProfile.CUSTOM, 30, 500, MAX_MEMORY_MB + 1),
    ).toThrow(ValidationError);
  });

  test('rejects a custom size on a preset profile', ({ expect }) => {
    expect(
      () => new ExecutionPolicy(ResourceProfile.LARGE, 30, 2000, 4096),
    ).toThrow(ValidationError);
  });
});
