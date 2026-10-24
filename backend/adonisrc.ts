import { defineConfig } from '@adonisjs/core/app';

export default defineConfig({
  experimental: {},

  /*
  | Application commands are scanned from "./commands". `outbox:work` lives
  | there and replaces the old standalone worker entrypoint.
  */
  commands: [
    () => import('@adonisjs/core/commands'),
    () => import('@adonisjs/lucid/commands'),
    () => import('@adonisjs/session/commands'),
  ],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/session/session_provider'),
    () => import('@adonisjs/lucid/database_provider'),
    () => import('@adonisjs/cors/cors_provider'),
    () => import('@adonisjs/auth/auth_provider'),
    () => import('#providers/app_provider'),
  ],

  preloads: [() => import('#start/routes'), () => import('#start/kernel')],

  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec.{ts,js}'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec.{ts,js}'],
        name: 'functional',
        timeout: 30000,
      },
      {
        // Needs the whole environment (ops/dev-up.sh) running; gated on
        // RUN_CLUSTER_INTEGRATION=1 inside the spec itself.
        files: ['tests/integration/**/*.spec.{ts,js}'],
        name: 'integration',
        timeout: 600000,
      },
    ],
    forceExit: false,
  },

  metaFiles: [],
});
