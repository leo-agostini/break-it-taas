import app from '@adonisjs/core/services/app';
import { defineConfig } from '@adonisjs/lucid';
import env from '#start/env';

const dbConfig = defineConfig({
  connection: 'pg',

  connections: {
    pg: {
      client: 'pg',
      connection: env.get('DATABASE_URL'),
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      // Models declare their columns by hand; no generated database/schema.ts.
      schemaGeneration: {
        enabled: false,
      },
      debug: app.inDev && env.get('LOG_LEVEL') === 'trace',
    },
  },
});

export default dbConfig;
