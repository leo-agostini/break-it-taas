import { randomUUIDv7 } from 'bun';
import type { Knex } from 'knex';
import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { ResultRepository } from '@/application/repositories/result-repository';
import { db } from '@/infra/db/knex';

type ResultRow = {
  id: UUID;
  test_run_id: UUID;
  payload: Record<string, unknown>;
  created_at: Date;
};

const RESULTS_TABLE = 'results';

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

export class KnexResultRepository implements ResultRepository {
  async saveForRun(
    testRunId: UUID,
    payload: Record<string, unknown>,
    tx?: TransactionContext,
  ): Promise<void> {
    const conn = contextOrDb(tx);

    await conn<ResultRow>(RESULTS_TABLE)
      .insert({
        id: randomUUIDv7(),
        test_run_id: testRunId,
        payload,
        created_at: new Date(),
      })
      .onConflict('test_run_id')
      .merge({
        payload,
        created_at: new Date(),
      });
  }
}
