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

    return this.isOwnedBy(testCase, args) ? testCase : null;
  }

  async listOwnedByActor(args: {
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestCase[]> {
    return [...this.items.values()]
      .filter((testCase) => this.isOwnedBy(testCase, args))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  private isOwnedBy(
    testCase: TestCase,
    actor: { actorUserId: UUID; actorOrgId: UUID | null },
  ): boolean {
    if (
      testCase.ownerType === 'USER' &&
      testCase.ownerId === actor.actorUserId
    ) {
      return true;
    }

    return (
      testCase.ownerType === 'ORGANIZATION' &&
      !!actor.actorOrgId &&
      testCase.ownerId === actor.actorOrgId
    );
  }
}
