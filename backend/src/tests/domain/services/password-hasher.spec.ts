import { describe, expect, it } from 'bun:test';
import {
  hashPassword,
  verifyPassword,
} from '@/domain/services/password-hasher';
import { ValidationError } from '@/domain/errors/custom-errors';

describe('password-hasher service', () => {
  it('hashes and verifies a password', async () => {
    const password = 'StrongPass123!';
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(verifyPassword(password, hash)).resolves.toBe(true);
  });

  it('returns false when password does not match', async () => {
    const hash = await hashPassword('StrongPass123!');
    expect(verifyPassword('WrongPass123!', hash)).resolves.toBe(false);
  });

  it('throws validation error when password is empty', async () => {
    expect(hashPassword('')).rejects.toThrow(ValidationError);
  });
});
