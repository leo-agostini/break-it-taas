import { test } from '@japa/runner';
import { ValidationError } from '#modules/shared/domain/errors';
import { Stage } from '#modules/test_cases/domain/vos/stage';

test.group('Stage VO', () => {
  test('creates with valid target and duration', ({ expect }) => {
    const stage = new Stage({ target: 10, duration: 2 });
    expect(stage.target).toBe(10);
  });

  test('throws when target is negative', ({ expect }) => {
    expect(() => {
      new Stage({ target: -1, duration: 2 });
    }).toThrow(ValidationError);
  });

  test('throws when duration is less than one', ({ expect }) => {
    expect(() => {
      new Stage({ target: 10, duration: 0 });
    }).toThrow(ValidationError);
  });
});
