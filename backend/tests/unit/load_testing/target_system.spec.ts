import { test } from '@japa/runner';
import { TargetSystem } from '#modules/load_testing/domain/vos/target_system';
import { ValidationError } from '#modules/shared/domain/errors';

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
