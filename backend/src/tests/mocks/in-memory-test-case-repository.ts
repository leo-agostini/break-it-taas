import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestCase } from '@/domain/entities/test-case';

export class InMemoryTestCaseRepository implements TestCaseRepository {
  items = new Map<string, TestCase>();

  async find(id: string): Promise<TestCase | null> {
    return this.items.get(id) ?? null;
  }

  async create(testCase: TestCase, _tx?: TransactionContext): Promise<void> {
    this.items.set(testCase.id, testCase);
  }

  async findOwnedByActor(args: {
    testCaseId: string;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestCase | null> {
    const testCase = this.items.get(args.testCaseId);
    if (!testCase) return null;

    if (testCase.ownerType === 'USER' && testCase.ownerId === args.actorUserId) {
      return testCase;
    }

    if (
      testCase.ownerType === 'ORGANIZATION' &&
      args.actorOrgId &&
      testCase.ownerId === args.actorOrgId
    ) {
      return testCase;
    }

    return null;
  }
}
