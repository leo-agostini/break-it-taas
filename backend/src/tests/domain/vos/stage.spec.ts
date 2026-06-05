import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@/domain/errors/custom-errors';
import { Stage } from '@/domain/vos/stage';

describe('Stage VO', () => {
  it('creates with valid target and duration', () => {
    const stage = new Stage({ target: 10, duration: 2 });
    expect(stage.target).toBe(10);
  });

  it('throws when target is negative', () => {
    expect(() => {
      new Stage({ target: -1, duration: 2 });
    }).toThrow(ValidationError);
  });

  it('throws when duration is less than one', () => {
    expect(() => {
      new Stage({ target: 10, duration: 0 });
    }).toThrow(ValidationError);
  });
});
