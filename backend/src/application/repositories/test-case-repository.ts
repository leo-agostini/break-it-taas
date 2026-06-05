import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestCase } from '@/domain/entities/test-case';

export interface TestCaseRepository {
  find(id: string): Promise<TestCase | null>;
  findOwnedByActor(args: {
    testCaseId: string;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestCase | null>;
  create(testCase: TestCase, tx?: TransactionContext): Promise<void>;
}
