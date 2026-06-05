import { describe, expect, it } from 'bun:test';
import { TargetSystem } from '@/domain/vos/target-system';
import { ValidationError } from '@/domain/errors/custom-errors';

describe('TargetSystem VO', () => {
  it('creates with valid values', () => {
    const target = new TargetSystem('https://api.example.com', 'staging');
    expect(target.baseUrl).toBe('https://api.example.com');
  });

  it('throws when baseUrl is blank', () => {
    expect(() => {
      new TargetSystem('   ', 'staging');
    }).toThrow(ValidationError);
  });

  it('throws when environment is blank', () => {
    expect(() => {
      new TargetSystem('https://api.example.com', '   ');
    }).toThrow(ValidationError);
  });
});
