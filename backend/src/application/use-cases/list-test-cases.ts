import type { ActorContext } from '@/application/ports/actor-context';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import type { TestCase } from '@/domain/entities/test-case';

export type TestCaseSummary = TestCase & { runCount: number };

export class ListTestCasesUseCase {
  constructor(
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
  ) {}

  async execute(actor: ActorContext): Promise<TestCaseSummary[]> {
    const testCases = await this.testCaseRepository.listOwnedByActor({
      actorUserId: actor.userId,
      actorOrgId: actor.orgId,
    });

    const runCounts = await this.testRunRepository.countByTestCaseIds(
      testCases.map((testCase) => testCase.id as UUID),
    );

    return testCases.map((testCase) => ({
      ...testCase,
      runCount: runCounts[testCase.id as UUID] ?? 0,
    }));
  }
}
