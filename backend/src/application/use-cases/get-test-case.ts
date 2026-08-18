import type { ActorContext } from '@/application/ports/actor-context';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestCase } from '@/domain/entities/test-case';
import {
  AuthorizationError,
  NotFoundError,
} from '@/domain/errors/custom-errors';

export class GetTestCaseUseCase {
  constructor(private testCaseRepository: TestCaseRepository) {}

  async execute(testCaseId: UUID, actor: ActorContext): Promise<TestCase> {
    const testCase = await this.testCaseRepository.find(testCaseId);
    if (!testCase) {
      throw new NotFoundError('Test case not found');
    }

    const ownedTestCase = await this.testCaseRepository.findOwnedByActor({
      testCaseId,
      actorUserId: actor.userId,
      actorOrgId: actor.orgId,
    });

    if (!ownedTestCase) {
      throw new AuthorizationError();
    }

    return ownedTestCase;
  }
}
