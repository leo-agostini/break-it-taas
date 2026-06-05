import { describe, expect, it } from 'bun:test';
import { CreateNewTestRunUseCase } from '@/application/use-cases/create-new-test-run';
import {
  TestCase,
  TestCaseOwnerType,
  TestType,
} from '@/domain/entities/test-case';
import { TestRunStatus } from '@/domain/entities/test-run';
import { NotFoundError } from '@/domain/errors/custom-errors';
import { AuthorizationError } from '@/domain/errors/custom-errors';
import { AuthStrategyKind } from '@/domain/vos/auth-strategy';
import {
  ExecutionPolicy,
  ResourceProfile,
} from '@/domain/vos/execution-policy';
import { LoadMode, LoadProfile, TimeUnit } from '@/domain/vos/load-profile';
import { CheckKind, HttpMethod, Step } from '@/domain/vos/step';
import { TargetSystem } from '@/domain/vos/target-system';
import { ThresholdPolicy } from '@/domain/vos/threshold-policy';
import { InMemoryOutboxRepository } from '@/tests/mocks/in-memory-outbox-repository';
import { InMemoryTestCaseRepository } from '@/tests/mocks/in-memory-test-case-repository';
import { InMemoryTestRunRepository } from '@/tests/mocks/in-memory-test-run-repository';
import { InMemoryUnitOfWork } from '@/tests/mocks/in-memory-unit-of-work';

function makeTestCase() {
  return TestCase.create({
    name: 'test case',
    description: 'desc',
    ownerType: TestCaseOwnerType.USER,
    ownerId: crypto.randomUUID(),
    testType: TestType.SMOKE,
    targetSystem: new TargetSystem('https://api.example.com', 'staging'),
    authStrategy: { kind: AuthStrategyKind.NONE },
    loadProfile: LoadProfile.create(LoadMode.CONSTANT, {
      duration: 5,
      targetRate: 10,
      timeUnit: TimeUnit.SECONDS,
    }),
    thresholdPolicy: new ThresholdPolicy(0.1, 200, 400, 0.9, false),
    executionPolicy: new ExecutionPolicy(ResourceProfile.SMALL, 60),
    steps: [
      new Step('/health', HttpMethod.GET, [
        { kind: CheckKind.STATUS_CODE, expected: 200 },
      ]),
    ],
  });
}

describe('CreateNewTestRunUseCase', () => {
  it('creates and queues a run and enqueues outbox event', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const outboxRepository = new InMemoryOutboxRepository();
    const useCase = new CreateNewTestRunUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    );

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    const run = await useCase.execute(testCase.id, {
      userId: testCase.ownerId,
      orgId: null,
    });

    expect(run.testCaseId).toBe(testCase.id);
    expect(run.status).toBe(TestRunStatus.QUEUED);
    expect(testRunRepository.items.get(run.id)).toBeDefined();
    expect(outboxRepository.items).toHaveLength(1);
    expect(outboxRepository.items[0]?.aggregateId).toBe(run.id);
  });

  it('throws not found when test case does not exist', async () => {
    const useCase = new CreateNewTestRunUseCase(
      new InMemoryUnitOfWork(),
      new InMemoryTestCaseRepository(),
      new InMemoryTestRunRepository(),
      new InMemoryOutboxRepository(),
    );

    expect(
      useCase.execute(crypto.randomUUID(), {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws authorization error when actor does not own test case', async () => {
    const unitOfWork = new InMemoryUnitOfWork();
    const testCaseRepository = new InMemoryTestCaseRepository();
    const testRunRepository = new InMemoryTestRunRepository();
    const outboxRepository = new InMemoryOutboxRepository();
    const useCase = new CreateNewTestRunUseCase(
      unitOfWork,
      testCaseRepository,
      testRunRepository,
      outboxRepository,
    );

    const testCase = makeTestCase();
    await testCaseRepository.create(testCase);

    expect(
      useCase.execute(testCase.id, {
        userId: crypto.randomUUID(),
        orgId: null,
      }),
    ).rejects.toThrow(AuthorizationError);
  });
});
