import { BaseCommand, flags } from '@adonisjs/core/ace';
import logger from '@adonisjs/core/services/logger';
import type { CommandOptions } from '@adonisjs/core/types/ace';
import RunDispatchService from '#modules/load_testing/services/run_dispatch_service';
import { OutboxEventType } from '#modules/outbox/domain/events';
import { OutboxDispatcher } from '#modules/outbox/services/outbox_dispatcher';
import { otelOutboxTelemetry } from '#modules/outbox/services/outbox_telemetry';
import env from '#start/env';

/**
 * Long-running outbox worker (replaces the old standalone `src/worker.ts`).
 *
 * It runs on the host, not in Compose, because dispatching a test run creates
 * a Kubernetes Job and needs a kubeconfig (see ADR-006). This command is also
 * where event types are wired to the module that handles them, so the outbox
 * module itself depends on nothing.
 *
 * It is also the one ace command that runs with OpenTelemetry (bin/console.ts
 * boots it as service `breakit-worker`). Logs go through the app's pino logger
 * rather than `this.logger`: nothing tails this process's stdout, so pino's
 * OTLP export is the only way its logs reach Loki.
 */
export default class OutboxWork extends BaseCommand {
  static commandName = 'outbox:work';
  static description =
    'Poll the outbox and dispatch pending events (creates runner Jobs for queued test runs)';

  static options: CommandOptions = {
    startApp: true,
    staysAlive: true,
  };

  @flags.number({ description: 'Polling interval in milliseconds' })
  declare interval?: number;

  @flags.number({ description: 'Maximum events claimed per cycle' })
  declare batchSize?: number;

  async run() {
    const interval = this.interval ?? 5_000;
    const batchSize = this.batchSize ?? 50;

    const runs = await this.app.container.make(RunDispatchService);
    const telemetry = otelOutboxTelemetry;
    const dispatcher = new OutboxDispatcher(telemetry).on(
      OutboxEventType.TEST_RUN_REQUESTED,
      (payload) => runs.dispatch(payload),
    );

    let stopping = false;
    let timer: NodeJS.Timeout | undefined;
    let inFlight: Promise<void> = Promise.resolve();

    // Each cycle schedules the next only after it finishes, so a slow cycle
    // never overlaps the following one.
    const cycle = async () => {
      if (stopping) return;
      try {
        await dispatcher.dispatchPending(batchSize);
        telemetry.recordCycle('ok');
      } catch (error) {
        telemetry.recordCycle('error');
        logger.error({ err: error }, 'Outbox dispatch cycle failed');
      }
      if (!stopping) {
        timer = setTimeout(() => {
          inFlight = cycle();
        }, interval);
      }
    };

    this.app.terminating(async () => {
      stopping = true;
      clearTimeout(timer);
      await inFlight;
    });
    process.once('SIGINT', () => this.app.terminate());

    // A backlog that built up while the worker was down is dispatched on the
    // very first cycle, before the first periodic metrics export.
    await telemetry.publishBaseline();

    inFlight = cycle();
    await inFlight;

    logger.info(
      {
        interval,
        batchSize,
        kubernetesContext: env.get('KUBERNETES_CONTEXT') ?? '(in-cluster)',
      },
      'Outbox dispatcher worker started',
    );
  }
}
