import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestRun } from '@/domain/entities/test-run';

export interface TestRunRepository {
  save(testRun: TestRun, tx?: TransactionContext): Promise<void>;
  find(testRunId: UUID): Promise<TestRun | undefined>;
  findOwned(args: {
    testRunId: UUID;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestRun | null>;
  findAllByTestCaseId(testCaseId: UUID): Promise<TestRun[]>;
  countByTestCaseIds(testCaseIds: UUID[]): Promise<Record<UUID, number>>;
}
