import { OutboxDispatcherWorker } from '@/application/workers/outbox-dispatcher-worker';
import { env } from '@/infra/config/env';
import { db } from '@/infra/db/knex';
import { KnexOutboxRepository } from '@/infra/db/repositories/knex-outbox-repository';
import { KnexTestCaseRepository } from '@/infra/db/repositories/knex-test-case-repository';
import { KnexTestRunRepository } from '@/infra/db/repositories/knex-test-run-repository';
import { K3sTestRunQueue } from '@/infra/queue/k3s-test-run-queue';

const pollIntervalMs = 5_000;
const batchSize = 50;

const worker = new OutboxDispatcherWorker(
  new KnexOutboxRepository(),
  new KnexTestCaseRepository(),
  new KnexTestRunRepository(),
  new K3sTestRunQueue(),
);

let shutdownRequested = false;

const runCycle = async () => {
  if (shutdownRequested) {
    return;
  }

  try {
    await worker.dispatchPending(batchSize);
  } catch (error) {
    console.error('Outbox dispatch cycle failed', error);
  }
};

const timer = setInterval(runCycle, pollIntervalMs);
await runCycle();

console.info(
  `Outbox dispatcher worker started (interval=${pollIntervalMs}ms, batchSize=${batchSize}, endpoint=${env.K3S_QUEUE_ENDPOINT})`,
);

const shutdown = async () => {
  shutdownRequested = true;
  if (timer) {
    clearInterval(timer);
  }
  await db.destroy();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
