import hash from '@adonisjs/core/services/hash';
import { test } from '@japa/runner';
import argon2 from 'argon2';

test.group('Password hashes from the pre-Adonis backend', () => {
  test('still verify with the configured hasher', async ({ expect }) => {
    // Exactly how the Bun backend's password-hasher produced stored hashes.
    const legacyHash = await argon2.hash('Str0ng!Passw0rd', {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
      hashLength: 32,
    });

    expect(await hash.use('argon').verify(legacyHash, 'Str0ng!Passw0rd')).toBe(
      true,
    );
    expect(await hash.use('argon').verify(legacyHash, 'wrong')).toBe(false);
  });
});
