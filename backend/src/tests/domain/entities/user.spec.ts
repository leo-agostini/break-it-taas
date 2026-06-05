import { describe, expect, it } from 'bun:test';
import { User } from '@/domain/entities/user';
import { ValidationError } from '@/domain/errors/custom-errors';

describe('User entity', () => {
  it('throws when name is blank', () => {
    expect(() => {
      User.create({
        name: '   ',
        nickname: 'validnick',
        email: 'user@example.com',
        passwordHash: 'hash',
      });
    }).toThrow(ValidationError);
  });

  it('throws when email is blank', () => {
    expect(() => {
      User.create({
        name: 'Valid Name',
        nickname: 'validnick',
        email: '   ',
        passwordHash: 'hash',
      });
    }).toThrow(ValidationError);
  });

  it('throws when password hash is blank', () => {
    expect(() => {
      User.create({
        name: 'Valid Name',
        nickname: 'validnick',
        email: 'user@example.com',
        passwordHash: '   ',
      });
    }).toThrow(ValidationError);
  });
});
