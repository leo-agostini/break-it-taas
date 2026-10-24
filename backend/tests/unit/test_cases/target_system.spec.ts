import { test } from '@japa/runner';
import { ValidationError } from '#modules/shared/domain/errors';
import { TargetSystem } from '#modules/test_cases/domain/vos/target_system';

test.group('TargetSystem VO', () => {
  test('creates with valid values', ({ expect }) => {
    const target = new TargetSystem('https://api.example.com', 'staging');
    expect(target.baseUrl).toBe('https://api.example.com');
  });

  test('throws when baseUrl is blank', ({ expect }) => {
    expect(() => {
      new TargetSystem('   ', 'staging');
    }).toThrow(ValidationError);
  });

  test('throws when environment is blank', ({ expect }) => {
    expect(() => {
      new TargetSystem('https://api.example.com', '   ');
    }).toThrow(ValidationError);
  });
});
