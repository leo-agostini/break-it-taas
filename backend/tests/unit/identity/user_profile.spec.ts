import { test } from '@japa/runner';
import { passwordPolicyViolation } from '#modules/identity/domain/password_policy';
import {
  assertValidUserProfile,
  normalizeEmail,
  normalizeOrganizationName,
} from '#modules/identity/domain/user_profile';
import { ValidationError } from '#modules/shared/domain/errors';

test.group('User profile rules', () => {
  test('throws when name is blank', ({ expect }) => {
    expect(() =>
      assertValidUserProfile({
        name: '   ',
        nickname: 'validnick',
        email: 'user@example.com',
      }),
    ).toThrow(ValidationError);
  });

  test('throws when nickname is blank', ({ expect }) => {
    expect(() =>
      assertValidUserProfile({
        name: 'Valid Name',
        nickname: ' ',
        email: 'user@example.com',
      }),
    ).toThrow(ValidationError);
  });

  test('throws when email is blank', ({ expect }) => {
    expect(() =>
      assertValidUserProfile({
        name: 'Valid Name',
        nickname: 'validnick',
        email: '   ',
      }),
    ).toThrow(ValidationError);
  });

  test('normalizes email to trimmed lowercase', ({ expect }) => {
    expect(normalizeEmail('  Ada@Example.COM ')).toBe('ada@example.com');
  });

  test('organization name is required and trimmed', ({ expect }) => {
    expect(() => normalizeOrganizationName('   ')).toThrow(ValidationError);
    expect(normalizeOrganizationName('  Acme  ')).toBe('Acme');
  });
});

test.group('Password policy', () => {
  test('accepts a password meeting every rule', ({ expect }) => {
    expect(passwordPolicyViolation('Str0ng!Passw0rd')).toBeNull();
  });

  test('reports the first broken rule', ({ expect }) => {
    expect(passwordPolicyViolation('Sh0rt!')).toBe(
      'Password must be at least 12 characters long',
    );
    expect(passwordPolicyViolation('Has Space 123!')).toBe(
      'Password cannot contain whitespace',
    );
    expect(passwordPolicyViolation('nouppercase123!')).toBe(
      'Password must contain at least one uppercase letter',
    );
    expect(passwordPolicyViolation('NOLOWERCASE123!')).toBe(
      'Password must contain at least one lowercase letter',
    );
    expect(passwordPolicyViolation('NoDigitsHere!!')).toBe(
      'Password must contain at least one digit',
    );
    expect(passwordPolicyViolation('NoSymbols12345')).toBe(
      'Password must contain at least one symbol',
    );
  });
});
