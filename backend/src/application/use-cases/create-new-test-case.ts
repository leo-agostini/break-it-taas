import { TestCase } from "../../domain/entities/test-case";
import { OutboxEvent } from "@/domain/entities/outbox-event";
import { TestRunEvents } from "@/domain/events/test-run-events";
import { TestRun } from "@/domain/entities/test-run";
import { Step } from "@/domain/vos/step";
import type { UnitOfWork } from "../ports/unit-of-work";
import type { OutboxRepository } from "../repositories/outbox-repository";
import type { TestCaseRepository } from "../repositories/test-case-repository";
import type { TestRunRepository } from "../repositories/test-run-repository";
import { LoadProfile } from "@/domain/vos/load-profile";
import {
  newTestCaseSchema,
  type NewTestCaseInput,
} from "../validators/new-test-case-validator";

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

    const testCase = TestCase.create({
      name: payload.name,
      ownerType: payload.ownerType,
      ownerId: payload.ownerId,
      testType: payload.testType,
      loadProfile,
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
