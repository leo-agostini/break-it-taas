import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestRun } from '@/domain/entities/test-run';

export interface TestRunRepository {
  save(testRun: TestRun, tx?: TransactionContext): Promise<void>;
  find(testRunId: UUID): Promise<TestRun | undefined>;
}
