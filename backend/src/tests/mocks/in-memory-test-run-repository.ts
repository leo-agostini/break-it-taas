import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import type { TestRun } from '@/domain/entities/test-run';

export class InMemoryTestRunRepository implements TestRunRepository {
  items = new Map<string, TestRun>();

  async save(testRun: TestRun, _tx?: TransactionContext): Promise<void> {
    this.items.set(testRun.id, testRun);
  }

  async find(testRunId: UUID): Promise<TestRun | undefined> {
    return this.items.get(testRunId);
  }
}
