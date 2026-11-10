import { defineConfig } from '@adonisjs/core/bodyparser';

const bodyParserConfig = defineConfig({
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  form: {
    convertEmptyStringsToNull: false,
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * The JSON parser keeps the unparsed body available via `request.raw()`,
   * which the runner callback needs: its HMAC is computed over the exact bytes
   * the runner sent, not over a re-serialization of the parsed object.
   *
   * Empty strings are kept as-is so request payloads mean what they meant
   * before the Adonis migration.
   */
  json: {
    convertEmptyStringsToNull: false,
    limit: '5mb',
    types: ['application/json'],
  },

  multipart: {
    autoProcess: false,
    convertEmptyStringsToNull: false,
    processManually: [],
    limit: '1mb',
    types: ['multipart/form-data'],
  },
});

export default bodyParserConfig;
