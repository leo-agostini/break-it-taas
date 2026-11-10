/*
|--------------------------------------------------------------------------
| Ace entry point
|--------------------------------------------------------------------------
|
| The "console.ts" file is the entrypoint for booting the AdonisJS
| command-line framework and executing commands.
|
| Commands do not boot the application, unless the currently running command
| has "options.startApp" flag set to true.
|
*/

/**
 * The outbox worker is the only long-running ace command, so it is the only
 * one booted with OpenTelemetry (migrations, tests and generators are not).
 * The SDK has to start before the app loads the libraries it patches.
 *
 * It starts the SDK through OtelManager rather than ../otel.js. That file also
 * registers import-in-the-middle's ESM loader hook, and any registration of
 * that hook, even one limited to a single module, empties the exports of every
 * TypeScript module the ts-exec loader (set up by ace.js) serves afterwards:
 * ace fails with "Missing export default" for each command. The API dodges
 * this because it runs compiled, or under hot-hook in dev. Without the hook:
 *   - pg (via knex) and http are still patched, through require hooks, so
 *     each dispatch span holds its queries and the Kubernetes API call;
 *   - pino is not (it is imported through ESM), so the worker exports its logs
 *     with a pino transport and stamps trace ids itself (config/logger.ts).
 * The provider shuts the SDK down, flushing pending data, on terminate.
 */
if (
  process.argv[2] === 'outbox:work' &&
  process.env.OTEL_SDK_DISABLED?.toLowerCase() !== 'true'
) {
  process.env.OTEL_SERVICE_NAME ??= 'breakit-worker';
  process.env.OTEL_EXPORT_LOGS ??= 'true';
  const { OtelManager } = await import('@adonisjs/otel');
  const { default: otelConfig } = await import('../config/otel.js');
  OtelManager.create(otelConfig)?.start();
}

await import('reflect-metadata');
const { Ignitor, prettyPrintError } = await import('@adonisjs/core/ignitor');

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url);

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href);
  }
  return import(filePath);
};

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env');
    });
    app.listen('SIGTERM', () => app.terminate());
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate());
  })
  .ace()
  .handle(process.argv.splice(2))
  .catch((error) => {
    process.exitCode = 1;
    prettyPrintError(error);
  });
