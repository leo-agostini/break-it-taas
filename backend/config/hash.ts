import { defineConfig, drivers } from '@adonisjs/core/hash';

/**
 * Same argon2id parameters the pre-Adonis backend hashed with, so password
 * hashes already stored in `users.password_hash` keep verifying.
 */
const hashConfig = defineConfig({
  default: 'argon',

  list: {
    argon: drivers.argon2({
      version: 0x13,
      variant: 'id',
      iterations: 3,
      memory: 65536,
      parallelism: 1,
      saltSize: 16,
      hashLength: 32,
    }),
  },
});

export default hashConfig;

declare module '@adonisjs/core/types' {
  export interface HashersList extends InferHashers<typeof hashConfig> {}
}
