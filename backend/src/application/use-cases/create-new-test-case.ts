import type { ActorContext } from '@/application/ports/actor-context';
import type { UnitOfWork } from '@/application/ports/unit-of-work';
import type { OutboxRepository } from '@/application/repositories/outbox-repository';
import type { TestCaseRepository } from '@/application/repositories/test-case-repository';
import type { TestRunRepository } from '@/application/repositories/test-run-repository';
import { OutboxEvent } from '@/domain/entities/outbox-event';
import { TestCase, TestCaseOwnerType } from '@/domain/entities/test-case';
import { TestRun } from '@/domain/entities/test-run';
import {
  AuthorizationError,
  ValidationError,
} from '@/domain/errors/custom-errors';
import { TestRunEvents } from '@/domain/events/test-run-events';
import { assertTimeoutCoversProfile } from '@/domain/services/execution-policy-compatibility';
import {
  assertCompatibleLoadProfile,
  assertThresholdPolicyForType,
} from '@/domain/services/load-profile-compatibility-policy';
import { deriveLoadProfile } from '@/domain/services/load-profile-presets';
import { ExecutionPolicy } from '@/domain/vos/execution-policy';
import { LoadProfile } from '@/domain/vos/load-profile';
import { Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';
import { ZodError } from 'zod';
import {
  type NewTestCaseInput,
  newTestCaseSchema,
} from '../validators/new-test-case-validator';

/**
 * A malformed payload is the caller's mistake, not a server fault. Without
 * this, a ZodError escapes as an unmapped error and the API answers 500 to a
 * request that simply had the wrong shape.
 */
function parsePayload(input: NewTestCaseInput) {
  try {
    return newTestCaseSchema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const detail = error.issues
        .map(
          (issue) => `${issue.path.join('.') || 'payload'}: ${issue.message}`,
        )
        .join('; ');
      throw new ValidationError(detail);
    }
    throw error;
  }
}

export class CreateNewTestCaseUseCase {
  constructor(
    private unitOfWork: UnitOfWork,
    private testCaseRepository: TestCaseRepository,
    private testRunRepository: TestRunRepository,
    private outboxRepository: OutboxRepository,
  ) {}

  async execute(
    input: NewTestCaseInput,
    actor: ActorContext,
  ): Promise<{ testCaseId: UUID; testRunId: UUID }> {
    const payload = parsePayload(input);
    const requestOwner =
      payload.ownerType === TestCaseOwnerType.ORGANIZATION
        ? actor.orgId
        : actor.userId;

    if (payload.ownerId !== requestOwner) {
      throw new AuthorizationError();
    }

    // A preset derives the shape the k6 guide prescribes for this test type;
    // an explicit profile is taken as authored. The validator guarantees
    // exactly one of the two is present.
    const explicitProfile = payload.loadProfile;
    const loadProfile = payload.loadPreset
      ? deriveLoadProfile(payload.testType, payload.loadPreset)
      : explicitProfile
        ? LoadProfile.create(explicitProfile.mode, explicitProfile.config)
        : (() => {
            throw new ValidationError(
              'Provide exactly one of loadProfile or loadPreset',
            );
          })();

    assertCompatibleLoadProfile(payload.testType, loadProfile.mode);

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

    assertThresholdPolicyForType(payload.testType, thresholdPolicy);
    assertTimeoutCoversProfile(loadProfile, executionPolicy);

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
