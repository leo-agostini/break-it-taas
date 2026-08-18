import type { TransactionContext } from '@/application/ports/unit-of-work';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import type { TestRun } from '@/domain/entities/test-run';

export class InMemoryTestRunRepository implements TestRunRepository {
  items = new Map<string, TestRun>();

  constructor(private testCaseRepository?: TestCaseRepository) {}

  async save(testRun: TestRun, _tx?: TransactionContext): Promise<void> {
    this.items.set(testRun.id, testRun);
  }

  async find(testRunId: UUID): Promise<TestRun | undefined> {
    return this.items.get(testRunId);
  }

  async findOwned(args: {
    testRunId: UUID;
    actorUserId: UUID;
    actorOrgId: UUID | null;
  }): Promise<TestRun | null> {
    const run = this.items.get(args.testRunId);
    if (!run) return null;
    if (!this.testCaseRepository) return run;

    const owned = await this.testCaseRepository.findOwnedByActor({
      testCaseId: run.testCaseId,
      actorUserId: args.actorUserId,
      actorOrgId: args.actorOrgId,
    });

    return owned ? run : null;
  }

  async findAllByTestCaseId(testCaseId: UUID): Promise<TestRun[]> {
    return [...this.items.values()]
      .filter((run) => run.testCaseId === testCaseId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async countByTestCaseIds(testCaseIds: UUID[]): Promise<Record<UUID, number>> {
    const ids = new Set(testCaseIds);

    return [...this.items.values()].reduce<Record<UUID, number>>((acc, run) => {
      if (!ids.has(run.testCaseId)) return acc;
      acc[run.testCaseId] = (acc[run.testCaseId] ?? 0) + 1;
      return acc;
    }, {});
  }
}
