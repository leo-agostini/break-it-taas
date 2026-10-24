import { BaseCommand, flags } from '@adonisjs/core/ace';
import type { CommandOptions } from '@adonisjs/core/types/ace';
import RunDispatchService from '#modules/load_testing/services/run_dispatch_service';
import { OutboxEventType } from '#modules/outbox/domain/events';
import { OutboxDispatcher } from '#modules/outbox/services/outbox_dispatcher';
import env from '#start/env';

/**
 * Long-running outbox worker (replaces the old standalone `src/worker.ts`).
 *
 * It runs on the host, not in Compose, because dispatching a test run creates
 * a Kubernetes Job and needs a kubeconfig (see ADR-006). This command is also
 * where event types are wired to the module that handles them, so the outbox
 * module itself depends on nothing.
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
    const dispatcher = new OutboxDispatcher().on(
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
      } catch (error) {
        this.logger.error(`Outbox dispatch cycle failed: ${String(error)}`);
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

    inFlight = cycle();
    await inFlight;

    this.logger.info(
      `Outbox dispatcher worker started (interval=${interval}ms, batchSize=${batchSize}, context=${env.get('KUBERNETES_CONTEXT') ?? '(in-cluster)'})`,
    );
  }
}
