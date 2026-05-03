import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import { OutboxEvent } from '@/domain/entities/outbox-event';
import { TestRunEvents } from '@/domain/events/test-run-events';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { TestRun } from '@/domain/entities/test-run';
import { NotFoundError } from '@/domain/errors/custom-errors';

export class CreateNewTestRunUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private outboxRepository: OutboxRepository,
  ) {}

  async execute(testCaseId: UUID): Promise<TestRun> {
    const testCase = await this.testCaseRepository.find(testCaseId);
    if (!testCase) throw new NotFoundError('Test case not found');

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
