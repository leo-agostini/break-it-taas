import { authApiClient } from '@adonisjs/auth/plugins/api_client';
import app from '@adonisjs/core/services/app';
import testUtils from '@adonisjs/core/services/test_utils';
import { sessionApiClient } from '@adonisjs/session/plugins/api_client';
import { apiClient } from '@japa/api-client';
import { assert } from '@japa/assert';
import { pluginAdonisJS } from '@japa/plugin-adonisjs';
import type { Config } from '@japa/runner/types';
import { ensureTestDatabase } from '#tests/helpers/database';

/**
 * This file is imported by the "bin/test.ts" entrypoint file.
 */

export const plugins: Config['plugins'] = [
  assert(),
  pluginAdonisJS(app),
  apiClient(),
  sessionApiClient(app),
  authApiClient(app),
];

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [],
  teardown: [],
};

/**
 * Unit tests never touch the database, so they run without Postgres. The
 * functional suite migrates a dedicated *_test database and boots the HTTP
 * server; individual groups truncate tables between tests.
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (suite.name === 'functional') {
    suite.setup(async () => {
      await ensureTestDatabase();
      return testUtils.db().migrate();
    });
    suite.setup(() => testUtils.httpServer().start());
  }
};
