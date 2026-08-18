import type { ActorContext } from '@/application/ports/actor-context';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import type { TestRun } from '@/domain/entities/test-run';
import { NotFoundError } from '@/domain/errors/custom-errors';

export class GetTestRunUseCase {
  constructor(private testRunRepository: TestRunRepository) {}

  async execute(testRunId: UUID, actor: ActorContext): Promise<TestRun> {
    const testRun = await this.testRunRepository.findOwned({
      testRunId,
      actorUserId: actor.userId,
      actorOrgId: actor.orgId,
    });

    if (!testRun) {
      throw new NotFoundError('Test run not found');
    }

    return testRun;
  }
}
