import { TestCase } from '@/domain/entities/test-case';
import { OutboxEvent } from '@/domain/entities/outbox-event';
import { TestRunEvents } from '@/domain/events/test-run-events';
import { TestRun } from '@/domain/entities/test-run';
import { assertCompatibleLoadProfile } from '@/domain/services/load-profile-compatibility-policy';
import { ExecutionPolicy } from '@/domain/vos/execution-policy';
import { Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { LoadProfile } from '@/domain/vos/load-profile';
import {
  newTestCaseSchema,
  type NewTestCaseInput,
} from '../validators/new-test-case-validator';

export class CreateNewTestCaseUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private outboxRepository: OutboxRepository,
  ) {}

  async execute(
    input: NewTestCaseInput,
  ): Promise<{ testCaseId: UUID; testRunId: UUID }> {
    const payload = newTestCaseSchema.parse(input);

    const loadProfile = LoadProfile.create(
      payload.loadProfile.mode,
      payload.loadProfile.config,
    );

    assertCompatibleLoadProfile(payload.testType, payload.loadProfile.mode);

    const targetSystem = new TargetSystem(
      payload.targetSystem.baseUrl,
      payload.targetSystem.environment,
    );

    const thresholdPolicy = new ThresholdPolicy(
      payload.thresholdPolicy.maxErrorRate,
      payload.thresholdPolicy.maxP95ResponseTimeMs,
      payload.thresholdPolicy.maxP99ResponseTimeMs,
      payload.thresholdPolicy.minCheckSuccessRate,
      payload.thresholdPolicy.abortOnFail,
    );

    const executionPolicy = new ExecutionPolicy(
      payload.executionPolicy.resourceProfile,
      payload.executionPolicy.timeoutSeconds,
      payload.executionPolicy.cpuMillicores,
      payload.executionPolicy.memoryMb,
    );

    const testCase = TestCase.create({
      name: payload.name,
      description: payload.description,
      ownerType: payload.ownerType,
      ownerId: payload.ownerId,
      testType: payload.testType,
      targetSystem,
      authStrategy: payload.authStrategy,
      loadProfile,
      thresholdPolicy,
      executionPolicy,
      steps: payload.steps.map((step) => {
        return new Step(
          step.path,
          step.method,
          step.checks,
          step.body,
          step.headers,
        );
      }),
    });

    return this.unitOfWork.transaction(async (tx) => {
      await this.testCaseRepository.create(testCase, tx);

      const testRun = TestRun.create({ testCaseId: testCase.id });
      testRun.queue();
      await this.testRunRepository.save(testRun, tx);

      const event = OutboxEvent.create(TestRunEvents.requested(testRun.id));
      await this.outboxRepository.enqueue(event, tx);

      return {
        testCaseId: testCase.id,
        testRunId: testRun.id,
      };
    });
  }
}
