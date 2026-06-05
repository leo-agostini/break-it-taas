import type { ActorContext } from '@/application/ports/actor-context';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { OutboxEvent } from '@/domain/entities/outbox-event';
import { TestRun } from '@/domain/entities/test-run';
import {
  AuthorizationError,
  NotFoundError,
} from '@/domain/errors/custom-errors';
import { TestRunEvents } from '@/domain/events/test-run-events';

export class CreateNewTestRunUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private outboxRepository: OutboxRepository,
  ) {}

  async execute(testCaseId: UUID, actor: ActorContext): Promise<TestRun> {
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

    const testRun = await this.unitOfWork.transaction(async (tx) => {
      const run = TestRun.create({ testCaseId });
      run.queue();
      await this.testRunRepository.save(run, tx);

      const event = OutboxEvent.create(TestRunEvents.requested(run.id));
      await this.outboxRepository.enqueue(event, tx);

      return run;
    });

    return testRun;
  }
}
