import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { TestRun, type TestRunStatus } from '@/domain/entities/test-run';
import { db } from '@/infra/db/knex';
import type { Knex } from 'knex';

type TestRunRow = {
  id: UUID;
  test_case_id: UUID;
  status: TestRunStatus;
  started_at?: Date;
  completed_at?: Date;
  runtime_ref?: string;
  created_at: Date;
};

const TEST_RUNS_TABLE = 'test_runs';

const contextOrDb = (tx?: TransactionContext): Knex | Knex.Transaction => {
  return (tx as Knex.Transaction | undefined) ?? db;
};

const toEntity = (row: TestRunRow): TestRun => {
  return new TestRun({
    id: row.id,
    testCaseId: row.test_case_id,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    runtimeRef: row.runtime_ref,
  });
};

export class KnexTestRunRepository implements TestRunRepository {
  async save(testRun: TestRun, tx?: TransactionContext): Promise<void> {
    const conn = contextOrDb(tx);

    await conn<TestRunRow>(TEST_RUNS_TABLE)
      .insert({
        id: testRun.id,
        test_case_id: testRun.testCaseId,
        status: testRun.status,
        started_at: testRun.startedAt,
        completed_at: testRun.completedAt,
        runtime_ref: testRun.runtimeRef,
        created_at: testRun.createdAt,
      })
      .onConflict('id')
      .merge({
        status: testRun.status,
        started_at: testRun.startedAt,
        completed_at: testRun.completedAt,
        runtime_ref: testRun.runtimeRef,
      });
  }

  async find(testRunId: UUID): Promise<TestRun | undefined> {
    const row = await db<TestRunRow>(TEST_RUNS_TABLE)
      .where({ id: testRunId })
      .first();
    if (!row) return undefined;
    return toEntity(row);
  }
}
