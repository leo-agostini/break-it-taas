import { describe, expect, it } from 'bun:test';
import { Organization } from '@/domain/entities/organization';
import { ValidationError } from '@/domain/errors/custom-errors';

describe('Organization entity', () => {
  it('throws when name is blank', () => {
    expect(() => {
      Organization.create({
        ownerId: crypto.randomUUID(),
        name: '   ',
      });
    }).toThrow(ValidationError);
  });
});
